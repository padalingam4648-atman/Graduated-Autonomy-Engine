"""Agent action layer — agentic risk measurement then action proposal.

Flow
----
The LLM runs a two-phase tool-calling loop:

Phase 1 — MEASURE
  The agent calls ``count_matching_rows`` with the filter for its intended
  action.  The real row count comes back from the CSV.  Data scope is a fact,
  not a guess.

Phase 2 — PROPOSE
  Armed with the real count, the agent calls ``propose_action_tool`` to submit:
    - its chosen tool + parameters
    - all four risk dimensions (with its reasoning for each)
    - the overall risk_band  ("low" | "medium" | "high")
    - a rationale tying the dimensions together

  ``main.py`` then runs the proposal through ``build_assessment`` / ``route_action``
  / ``apply_blast_radius_floor`` exactly as before.

Why two phases instead of one?
  The old design asked the model to guess ``data_scope`` inline.  A bulk delete
  that really hits 34 000 rows was guessed at ~5 000 and banded medium.  Two
  phases fix that: phase 1 measures, phase 2 judges.

ClarificationRequest
  If the request is ambiguous the agent may call ``ask_for_clarification``
  instead of proposing.  ``main.py`` surfaces that to the caller so the user
  can answer and re-submit.

reassess_action
  If ``executor.preflight`` finds the agent's ``data_scope`` estimate was
  wildly wrong even after phase-1 measurement (shouldn't normally happen, but
  possible if the agent filtered differently in phase 2), ``main.py`` calls
  this to let the agent re-score with the true number.
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Final

import groq as groq_module
from dotenv import load_dotenv
from pydantic import BaseModel, Field

from autonomy_engine import data_store
from autonomy_engine.data_store import Criterion, DataStoreError
from autonomy_engine.risk_evaluator import (
    RegulatoryCategory,
    Reversibility,
    RiskBand,
    RiskFactors,
)

load_dotenv()
logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------
# Tunables
# --------------------------------------------------------------------------

GROQ_MODEL:         Final[str]   = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
MAX_LOOP_TURNS:     Final[int]   = 12
MAX_PLANNING_TURNS: Final[int]   = 12
MAX_ATTEMPTS:       Final[int]   = 2
RETRY_DELAY:        Final[float] = 1.0

CUSTOMER_FIELDS:   Final[list[str]] = list(data_store.FIELDS)
COUNT_TOOL_NAME:   Final[str]       = "count_matching_rows"
CLARIFY_TOOL_NAME: Final[str]       = "ask_for_clarification"

# --------------------------------------------------------------------------
# Public errors / return types
# --------------------------------------------------------------------------


class AgentActionError(RuntimeError):
    """Raised when the agent could not produce a usable action proposal."""


class ClarificationRequest(BaseModel):
    """The agent needs more information before it can safely propose."""
    question: str
    why: str
    options: list[str] = Field(default_factory=list)


# --------------------------------------------------------------------------
# AgentAction — what main.py builds the audit record from
# --------------------------------------------------------------------------


class AgentAction(BaseModel):
    """A single proposed action plus the agent's own risk self-assessment."""

    action_type: str
    description: str
    tool_name: str
    parameters: dict[str, Any]

    # Risk dimensions
    reversibility: Reversibility
    data_scope: int = Field(ge=0)
    regulatory_category: RegulatoryCategory
    confidence: float = Field(ge=0.0, le=1.0)

    # Reasoning strings (used by build_assessment → breakdown)
    reversibility_reasoning: str = ""
    data_scope_reasoning:    str = ""
    regulatory_reasoning:    str = ""
    confidence_reasoning:    str = ""
    risk_band:    RiskBand = "medium"
    severity:     float | None = None
    rationale:    str = ""

    def to_risk_factors(self) -> RiskFactors:
        return RiskFactors(
            reversibility=self.reversibility,
            reversibility_reasoning=self.reversibility_reasoning,
            data_scope=self.data_scope,
            data_scope_reasoning=self.data_scope_reasoning,
            regulatory_category=self.regulatory_category,
            regulatory_reasoning=self.regulatory_reasoning,
            confidence=self.confidence,
            confidence_reasoning=self.confidence_reasoning,
            risk_band=self.risk_band,
            severity=self.severity,
            rationale=self.rationale,
        )


# --------------------------------------------------------------------------
# Tool action-type vocabulary
# --------------------------------------------------------------------------

TOOL_ACTION_TYPES: Final[dict[str, str]] = {
    "query_transactions":       "read",
    "summarize_transactions":   "read_aggregate",
    "update_transaction":       "single_record_write",
    "delete_transaction":       "single_record_delete",
    "bulk_delete_transactions": "bulk_delete",
}

# --------------------------------------------------------------------------
# System prompt
# --------------------------------------------------------------------------

_CATEGORY_HINT = "\n".join(
    f"  {field}: {', '.join(vals)}"
    for field, vals in data_store.FIELD_VALUES.items()
)

SYSTEM_PROMPT: Final[str] = f"""\
You are an AI agent inside a graduated autonomy engine backed by a Global
Superstore retail transaction CSV (~51,000 rows spanning 2011-2014).

Schema columns: {', '.join(data_store.FIELDS)}

Known categorical values:
{_CATEGORY_HINT}

Numerical fields (use greater_than / less_than operators): quantity, sales, profit, discount
Date field (use before / after operators, ISO format YYYY-MM-DD): order_date
Primary key (for single-record operations): order_id

=== MANDATORY TWO-PHASE PROCESS ===

PHASE 1 — MEASURE (REQUIRED for bulk_delete_transactions)
You MUST call count_matching_rows before propose_action_tool whenever the
action is bulk_delete_transactions. Use your intended filter to get the real
row count. This is not optional.

For update_transaction and delete_transaction (single record): skip phase 1,
use data_scope = 1.
For query_transactions and summarize_transactions (reads): skip phase 1,
use data_scope = 0.

If the request is ambiguous and you cannot build a safe filter, call
ask_for_clarification instead.

PHASE 2 — PROPOSE
Call propose_action_tool with ALL of the following fields (every field is
required, every string field must be non-empty):

  tool_name       (string, required) one of:
                    query_transactions
                    summarize_transactions
                    update_transaction
                    delete_transaction
                    bulk_delete_transactions

  filter          (array) criteria for query/summarize/bulk_delete tools
  invoice_no      (string) the order_id value for update_transaction and delete_transaction
  field           (string) for update_transaction
  new_value       (string) for update_transaction
  group_by        (string) for summarize_transactions; use "" for no grouping
  limit           (integer, REQUIRED for query_transactions) — extract the exact count from
                  the user's request and pass it here. Examples: "show 20" → limit=20,
                  "top 10" → limit=10, "first 5" → limit=5, "get 50 rows" → limit=50.
                  If the user gives no specific number, omit this field (returns up to 100).

  reversibility   (string, required) EXACTLY one of:
                    "reversible"           — reads only
                    "partially_reversible" — updates (snapshot kept)
                    "irreversible"         — ANY delete, single or bulk

  reversibility_reasoning   (string, required, non-empty)

  data_scope      (integer, required) — write as a bare integer, NOT a string:
                    0  for reads (query_transactions, summarize_transactions)
                    1  for single-record mutations (update_transaction, delete_transaction)
                    use the count returned by count_matching_rows for bulk_delete_transactions

  data_scope_reasoning      (string, required, non-empty)

  regulatory_category (string, required) EXACTLY one of:
                    "none"               — non-personal retail metrics (category, region,
                                           sales, quantity, ship_mode, market)
                    "internal_sensitive" — customer identifiers (customer_id, customer_name)
                    "regulated"          — financial+personal combined, or request
                                           labels data as sensitive

  regulatory_reasoning      (string, required, non-empty)

  confidence      (number, required) — write as a bare decimal, NOT a string:
                    0.0 to 1.0 — how sure you are filter/params match intent

  confidence_reasoning      (string, required, non-empty)

  risk_band       (string, required) EXACTLY one of — follow these rules strictly:
                    "low"    — reads only (query_transactions, summarize_transactions)
                    "medium" — single-record update (update_transaction)
                    "high"   — ANY delete (delete_transaction or bulk_delete_transactions)
                               regardless of row count

  rationale       (string, required, non-empty) — one sentence tying all four
                  dimensions to your band choice

IMPORTANT — TYPE RULES (Groq enforces strict JSON types):
  data_scope MUST be a JSON integer:  1   not "1"
  confidence MUST be a JSON number:   0.9 not "0.9"
  All other fields must be strings.
"""

# --------------------------------------------------------------------------
# Filter schema (shared between tools)
# --------------------------------------------------------------------------

_FILTER_SCHEMA: Final[dict[str, Any]] = {
    "type": "array",
    "description": "List of AND-ed filter criteria.",
    "items": {
        "type": "object",
        "properties": {
            "field":    {"type": "string"},
            "operator": {
                "type": "string",
                "enum": ["equals", "not_equals", "contains",
                         "before", "after", "greater_than", "less_than"],
            },
            "value": {"type": "string"},
        },
        "required": ["field", "operator", "value"],
        "additionalProperties": False,
    },
}

# --------------------------------------------------------------------------
# Tool schemas
# --------------------------------------------------------------------------

PHASE1_TOOLS: Final[list[dict[str, Any]]] = [
    {
        "type": "function",
        "function": {
            "name": "count_matching_rows",
            "description": (
                "Count rows matching a filter in the transaction CSV. "
                "Call this FIRST to get the real data_scope before bulk_delete_transactions."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "filter": _FILTER_SCHEMA,
                    "intent": {
                        "type": "string",
                        "description": "One-line description of what you plan to do with these rows.",
                    },
                },
                "required": ["filter", "intent"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_action_tool",
            "description": (
                "Submit your proposed action and risk assessment. "
                "Call this after count_matching_rows."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    # ── tool selection ──────────────────────────────────────
                    "tool_name": {
                        "type": "string",
                        "enum": list(TOOL_ACTION_TYPES.keys()),
                    },
                    # ── parameters per tool ─────────────────────────────────
                    "filter":     _FILTER_SCHEMA,
                    "invoice_no": {"type": "string", "description": "For single-record tools."},
                    "field":      {"type": "string", "description": "For update_transaction."},
                    "new_value":  {"type": "string", "description": "For update_transaction."},
                    "group_by":   {
                        "type": "string",
                        "description": "For summarize_transactions; empty string for no grouping.",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "For query_transactions: MUST be set to the exact number the user requested (e.g. 'show 20' → 20, 'top 10' → 10). Default 25 if no count specified. Max 100.",
                    },
                    # ── risk dimensions ─────────────────────────────────────
                    "reversibility": {
                        "type": "string",
                        "enum": ["reversible", "partially_reversible", "irreversible"],
                        "description": (
                            "reversible=reads only; "
                            "partially_reversible=updates (snapshot kept); "
                            "irreversible=any delete (cannot be undone)"
                        ),
                    },
                    "reversibility_reasoning": {
                        "type": "string",
                        "description": "Why you chose this reversibility level.",
                    },
                    "data_scope": {
                        "type": "integer",
                        "description": (
                            "Row count from count_matching_rows. "
                            "Use 0 for reads (they change nothing). "
                            "Use 1 for single-record mutations. "
                            "Never guess for bulk operations — call count_matching_rows first."
                        ),
                    },
                    "data_scope_reasoning": {
                        "type": "string",
                        "description": "How you determined this count (measured vs estimated).",
                    },
                    "regulatory_category": {
                        "type": "string",
                        "enum": ["none", "internal_sensitive", "regulated"],
                        "description": (
                            "none=retail metrics (quantity, mall, payment_method, category); "
                            "internal_sensitive=personal identifiers (customer_id, age, gender); "
                            "regulated=financial+personal combined, or request labels data as sensitive"
                        ),
                    },
                    "regulatory_reasoning": {
                        "type": "string",
                        "description": "Why this data falls in that sensitivity class.",
                    },
                    "confidence": {
                        "type": "number",
                        "description": (
                            "0.0-1.0. How sure you are your filter/parameters match the user's intent. "
                            "Use < 0.7 if the request is ambiguous."
                        ),
                    },
                    "confidence_reasoning": {
                        "type": "string",
                        "description": "What you are or are not sure about.",
                    },
                    "risk_band": {
                        "type": "string",
                        "enum": ["low", "medium", "high"],
                        "description": (
                            "low=reads; medium=single-record mutations; "
                            "high=any delete OR bulk mutations affecting many rows"
                        ),
                    },
                    "rationale": {
                        "type": "string",
                        "description": "One sentence tying all four dimensions to your band choice.",
                    },
                },
                "required": [
                    "tool_name",
                    "reversibility",       "reversibility_reasoning",
                    "data_scope",          "data_scope_reasoning",
                    "regulatory_category", "regulatory_reasoning",
                    "confidence",          "confidence_reasoning",
                    "risk_band",           "rationale",
                ],
            },
        },
    },
]

# Module-level singleton — avoids creating a new HTTP connection pool per request.
_groq_singleton: groq_module.Groq | None = None

def _client() -> groq_module.Groq:
    global _groq_singleton
    if _groq_singleton is None:
        _groq_singleton = _groq_client()
    return _groq_singleton

# Legacy schema structures expected by test_agent_actions unit test suite
PLANNING_TOOL: Final[dict[str, Any]] = {
    "name": "count_matching_rows",
    "description": "Count rows matching a filter in the transaction CSV.",
    "strict": True,
    "parameters": {
        "type": "object",
        "properties": {
            "filter": _FILTER_SCHEMA,
            "intent": {"type": "string"},
        },
        "required": ["filter", "intent"],
        "additionalProperties": False,
    },
    "input_schema": {
        "type": "object",
        "properties": {
            "filter": _FILTER_SCHEMA,
            "intent": {"type": "string"},
        },
        "required": ["filter", "intent"],
        "additionalProperties": False,
    },
}

CLARIFICATION_TOOL: Final[dict[str, Any]] = {
    "name": "request_clarification",
    "description": "Ask for clarification when request is ambiguous.",
    "strict": True,
    "parameters": {
        "type": "object",
        "properties": {
            "question": {"type": "string"},
            "why": {"type": "string"},
            "options": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["question", "why", "options"],
        "additionalProperties": False,
    },
    "input_schema": {
        "type": "object",
        "properties": {
            "question": {"type": "string"},
            "why": {"type": "string"},
            "options": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["question", "why", "options"],
        "additionalProperties": False,
    },
}

_ACTION_ASSESSMENT_PROPERTIES = {
    "reversibility": {
        "type": "string",
        "enum": ["reversible", "partially_reversible", "irreversible"],
    },
    "reversibility_reasoning": {"type": "string"},
    "data_scope": {"type": "integer"},
    "data_scope_reasoning": {"type": "string"},
    "regulatory_category": {
        "type": "string",
        "enum": ["none", "internal_sensitive", "regulated"],
    },
    "regulatory_reasoning": {"type": "string"},
    "confidence": {"type": "number"},
    "confidence_reasoning": {"type": "string"},
    "risk_band": {"type": "string", "enum": ["low", "medium", "high"]},
    "severity": {"type": "number"},
    "rationale": {"type": "string"},
}

_SELF_ASSESSMENT_SCHEMA = {
    "type": "object",
    "properties": _ACTION_ASSESSMENT_PROPERTIES,
    "required": [
        "reversibility",
        "reversibility_reasoning",
        "data_scope",
        "data_scope_reasoning",
        "regulatory_category",
        "regulatory_reasoning",
        "confidence",
        "confidence_reasoning",
        "risk_band",
        "severity",
        "rationale",
    ],
    "additionalProperties": False,
}

_TOOL_FILTER_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "field": {"type": "string", "enum": list(CUSTOMER_FIELDS)},
            "operator": {
                "type": "string",
                "enum": ["equals", "not_equals", "contains", "before", "after", "greater_than", "less_than"],
            },
            "value": {"type": "string"},
        },
        "required": ["field", "operator", "value"],
        "additionalProperties": False,
    },
}

TOOL_SCHEMAS: Final[list[dict[str, Any]]] = [
    {
        "name": "query_transactions",
        "description": "Read rows matching filter",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "filter_description": {"type": "string"},
                "filter": _TOOL_FILTER_SCHEMA,
                "self_assessment": _SELF_ASSESSMENT_SCHEMA,
            },
            "required": ["filter_description", "filter", "self_assessment"],
            "additionalProperties": False,
        },
    },
    {
        "name": "summarize_transactions",
        "description": "Summarize rows matching filter",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "filter_description": {"type": "string"},
                "filter": _TOOL_FILTER_SCHEMA,
                "group_by": {"type": "string"},
                "self_assessment": _SELF_ASSESSMENT_SCHEMA,
            },
            "required": ["filter_description", "filter", "group_by", "self_assessment"],
            "additionalProperties": False,
        },
    },
    {
        "name": "update_transaction",
        "description": "Update a single transaction record",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "invoice_no": {"type": "string"},
                "field": {"type": "string"},
                "new_value": {"type": "string"},
                "self_assessment": _SELF_ASSESSMENT_SCHEMA,
            },
            "required": ["invoice_no", "field", "new_value", "self_assessment"],
            "additionalProperties": False,
        },
    },
    {
        "name": "delete_transaction",
        "description": "Delete a single transaction record",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "invoice_no": {"type": "string"},
                "self_assessment": _SELF_ASSESSMENT_SCHEMA,
            },
            "required": ["invoice_no", "self_assessment"],
            "additionalProperties": False,
        },
    },
    {
        "name": "bulk_delete_transactions",
        "description": "Delete multiple transaction records matching filter",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "filter_description": {"type": "string"},
                "filter": _TOOL_FILTER_SCHEMA,
                "self_assessment": _SELF_ASSESSMENT_SCHEMA,
            },
            "required": ["filter_description", "filter", "self_assessment"],
            "additionalProperties": False,
        },
    },
]

# --------------------------------------------------------------------------
# Tool execution (phase 1 only — count_matching_rows)
# --------------------------------------------------------------------------


def _parse_criteria(raw: Any) -> list[Criterion]:
    if not isinstance(raw, list):
        return []
    try:
        return [Criterion.model_validate(item) for item in raw]
    except Exception as exc:
        raise DataStoreError(f"malformed filter: {exc}") from exc


def _run_count(args: dict[str, Any]) -> str:
    try:
        criteria = _parse_criteria(args.get("filter", []))
        count = data_store.count_matching(criteria)
        return f"That filter matches {count:,} of 51,290 rows. Use this as data_scope."
    except DataStoreError as exc:
        return f"Filter criteria could not be run: {exc}"


# --------------------------------------------------------------------------
# Groq client + retry
# --------------------------------------------------------------------------


def _groq_client() -> groq_module.Groq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise AgentActionError("GROQ_API_KEY is not set.")
    return groq_module.Groq(api_key=api_key, max_retries=0)


def _groq_call(
    client: groq_module.Groq,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]],
    *,
    tool_choice: str = "required",
) -> Any:
    last_err: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return client.chat.completions.create(
                model=GROQ_MODEL,
                temperature=0,
                messages=messages,
                tools=tools,
                tool_choice=tool_choice,
            )
        except (
            groq_module.APIConnectionError,
            groq_module.RateLimitError,
            groq_module.InternalServerError,
        ) as exc:
            last_err = exc
            if attempt < MAX_ATTEMPTS:
                logger.warning(
                    "Groq attempt %d/%d failed (%s); retrying in %.1fs",
                    attempt, MAX_ATTEMPTS, type(exc).__name__, RETRY_DELAY,
                )
                time.sleep(RETRY_DELAY)
        except groq_module.APIStatusError as exc:
            if exc.status_code == 400:
                raw = str(exc)
                try:
                    body = exc.body if isinstance(exc.body, dict) else {}
                    fg = body.get("error", {}).get("failed_generation", "")
                    if fg:
                        raw = fg
                except Exception:
                    pass
                synthetic = _parse_failed_generation(raw)
                if synthetic:
                    logger.warning(
                        "Groq schema validation rejected tool call; "
                        "recovered via failed_generation parsing"
                    )
                    return synthetic
            raise AgentActionError(
                f"Groq API rejected the request ({exc.status_code}): {exc.message}"
            ) from exc
    raise AgentActionError(
        f"Groq API unreachable after {MAX_ATTEMPTS} attempts: {last_err}"
    ) from last_err


def _parse_failed_generation(error_text: str) -> Any | None:
    """Extract and parse a tool call from Groq's failed_generation error field."""
    import re

    match = re.search(
        r"<function=(\w+)>(\{.*?\})(?:</function>|>)",
        error_text,
        re.DOTALL,
    )
    if not match:
        return None

    tool_name = match.group(1)
    raw_json  = match.group(2)

    try:
        args = json.loads(raw_json)
    except json.JSONDecodeError:
        return None

    class _FakeFunction:
        def __init__(self, name: str, arguments: str):
            self.name = name
            self.arguments = arguments

    class _FakeToolCall:
        def __init__(self, name: str, args_str: str):
            self.id = "recovered-0"
            self.function = _FakeFunction(name, args_str)

    class _FakeMessage:
        def __init__(self, tc: _FakeToolCall):
            self.content = ""
            self.tool_calls = [tc]

    class _FakeChoice:
        def __init__(self, msg: _FakeMessage):
            self.message = msg
            self.finish_reason = "tool_calls"

    class _FakeResponse:
        def __init__(self, choice: _FakeChoice):
            self.choices = [choice]

    tc  = _FakeToolCall(tool_name, json.dumps(args))
    msg = _FakeMessage(tc)
    return _FakeResponse(_FakeChoice(msg))


# --------------------------------------------------------------------------
# Public API — propose_action
# --------------------------------------------------------------------------


def propose_action(
    user_request: str,
    tool_context: dict[str, Any],
) -> AgentAction | ClarificationRequest:
    """Run the two-phase agentic loop and return an action proposal or clarification."""
    client = _client()
    prompt = user_request
    situational = {k: v for k, v in tool_context.items() if k != "tools"}
    if situational:
        context_lines = "\n".join(f"- {k}: {v}" for k, v in situational.items())
        prompt = f"Context:\n{context_lines}\n\nRequest: {user_request}"

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",   "content": prompt},
    ]

    action_tools = TOOL_SCHEMAS
    if "tools" in tool_context and isinstance(tool_context["tools"], list):
        action_tools = tool_context["tools"]

    raw_tools = [PLANNING_TOOL, CLARIFICATION_TOOL, *action_tools]
    tools_to_pass = []
    for t in raw_tools:
        if "function" in t:
            func = dict(t["function"])
        else:
            func = dict(t)

        params = func.get("parameters") or func.get("input_schema") or {}
        tools_to_pass.append({
            "type": "function",
            "function": {
                "name": func["name"],
                "description": func.get("description", ""),
                "strict": True,
                "parameters": params,
            },
        })

    for turn in range(MAX_LOOP_TURNS):
        response = _groq_call(client, list(messages), tools_to_pass, tool_choice="required")
        msg = response.choices[0].message

        messages.append(_assistant_msg(msg))

        if not msg.tool_calls:
            raise AgentActionError(
                f"Agent response contained no tool call (turn {turn})."
            )

        for tc in msg.tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments)
            except (json.JSONDecodeError, TypeError, AttributeError) as exc:
                raise AgentActionError(
                    f"unparseable JSON in tool arguments from {name!r}: {exc}"
                ) from exc

            logger.info("agent called %s (turn %d)", name, turn)

            # ── Phase 1: measure ──────────────────────────────────────────
            if name == "count_matching_rows":
                result_str = _run_count(args)
                messages.append(_tool_msg(tc.id, result_str))
                continue

            # ── Clarification ────────────────────────────────────────────
            if name in ("ask_for_clarification", "request_clarification"):
                question = (args.get("question") or "").strip()
                if not question:
                    raise AgentActionError("Clarification request has no question.")
                return ClarificationRequest(
                    question=question,
                    why=args.get("why", ""),
                    options=args.get("options", []),
                )

            # ── Phase 2: propose ──────────────────────────────────────────
            if name == "propose_action_tool":
                if (
                    args.get("tool_name") == "bulk_delete_transactions"
                    and int(float(str(args.get("data_scope", 0)))) == 0
                    and args.get("filter")
                ):
                    real_count_str = _run_count({"filter": args["filter"], "intent": "auto-measure"})
                    real_count = int(real_count_str.split("matches ")[1].split(" of")[0].replace(",", "")) if "matches " in real_count_str else 0
                    args["data_scope"] = real_count
                    args["data_scope_reasoning"] = (
                        f"Auto-measured by engine: filter matched {real_count} rows"
                    )

                messages.append(_tool_msg(tc.id, json.dumps({"acknowledged": True})))
                return _build_action(args)

            # ── Legacy / Direct tool calls ──────────────────────────────
            if name in TOOL_ACTION_TYPES:
                if "self_assessment" not in args:
                    raise AgentActionError(f"tool call {name!r} is missing its self_assessment")
                sa = args["self_assessment"]
                if not isinstance(sa, dict) or "risk_band" not in sa:
                    raise AgentActionError("unusable self_assessment: missing risk_band")
                if "confidence" in sa:
                    try:
                        c_val = float(sa["confidence"])
                        if not (0.0 <= c_val <= 1.0):
                            raise AgentActionError("unusable self_assessment: confidence out of range")
                    except (ValueError, TypeError):
                        raise AgentActionError("unusable self_assessment: invalid confidence")
                merged = {
                    "tool_name": name,
                    "filter_description": args.get("filter_description"),
                    "filter": args.get("filter"),
                    "invoice_no": args.get("invoice_no"),
                    "field": args.get("field"),
                    "new_value": args.get("new_value"),
                    "group_by": args.get("group_by"),
                    "limit": args.get("limit"),
                    **sa,
                }
                messages.append(_tool_msg(tc.id, json.dumps({"acknowledged": True})))
                return _build_action(merged)

            messages.append(_tool_msg(
                tc.id, json.dumps({"error": f"unknown tool: {name}"})
            ))

    raise AgentActionError(
        f"Agent loop completed without proposing an action after {MAX_LOOP_TURNS} turns."
    )


# --------------------------------------------------------------------------
# reassess_action — called by main.py when preflight finds a scope mismatch
# --------------------------------------------------------------------------


def reassess_action(action: AgentAction, actual_rows: int) -> AgentAction:
    """Re-run just the risk judgement with the corrected row count.

    The agent already chose the tool and built the parameters.  This only asks
    it to re-evaluate the four dimensions with a corrected ``data_scope``.

    Args:
        action: The original proposal.
        actual_rows: The true row count from ``executor.preflight``.

    Returns:
        A new :class:`AgentAction` with an updated assessment.
    """
    client = _groq_client()

    prompt = (
        f"You previously proposed {action.tool_name!r} and estimated "
        f"data_scope={action.data_scope}.  The engine measured the real count: "
        f"{actual_rows} rows.  Re-submit your risk assessment via "
        f"propose_action_tool using data_scope={actual_rows} and update your "
        f"risk_band and rationale accordingly.  Keep tool_name and parameters "
        f"exactly as before."
    )

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Original request: {action.description}\n\n"
                f"Original parameters: {json.dumps(action.parameters)}\n\n"
                f"{prompt}"
            ),
        },
    ]

    for turn in range(4):
        response = _groq_call(client, list(messages), PHASE1_TOOLS, tool_choice="required")
        msg = response.choices[0].message
        messages.append(_assistant_msg(msg))

        if not msg.tool_calls:
            # Agent gave up — return original with corrected scope
            logger.warning("reassess_action: agent returned no tool call; using corrected scope only")
            return action.model_copy(update={
                "data_scope": actual_rows,
                "data_scope_reasoning": f"corrected by preflight: {actual_rows} rows",
            })

        for tc in msg.tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments)
            except (json.JSONDecodeError, TypeError, AttributeError):
                continue

            if name == "propose_action_tool":
                messages.append(_tool_msg(tc.id, json.dumps({"acknowledged": True})))
                reassessed = _build_action(args)
                # Preserve original tool and parameters — only the assessment changes
                return reassessed.model_copy(update={
                    "tool_name":   action.tool_name,
                    "action_type": action.action_type,
                    "parameters":  action.parameters,
                    "description": action.description,
                })

            if name == "count_matching_rows":
                messages.append(_tool_msg(tc.id, json.dumps({"count": actual_rows})))
                continue

            messages.append(_tool_msg(tc.id, json.dumps({"error": f"unknown tool: {name}"})))

    logger.warning("reassess_action loop exhausted; applying corrected scope only")
    return action.model_copy(update={
        "data_scope": actual_rows,
        "data_scope_reasoning": f"corrected by preflight: {actual_rows} rows",
    })


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------


def _build_action(args: dict[str, Any]) -> AgentAction:
    """Turn propose_action_tool arguments into an AgentAction.

    Coerces data_scope and confidence to the right types in case the model
    serialises them as strings (a known Groq/llama quirk).
    """
    tool_name = args["tool_name"]

    # Coerce numeric fields — llama-3.3 occasionally serialises integers and
    # floats as JSON strings even when the schema says otherwise.
    try:
        data_scope = int(float(str(args.get("data_scope", 0))))
    except (ValueError, TypeError):
        data_scope = 0

    try:
        confidence = float(str(args.get("confidence", 0.9)))
        confidence = max(0.0, min(1.0, confidence))
    except (ValueError, TypeError):
        confidence = 0.9

    # Build parameters dict from whichever keys the tool expects
    parameters: dict[str, Any] = {}
    if "filter_description" in args and args["filter_description"] is not None:
        parameters["filter_description"] = args["filter_description"]
    if "filter" in args and args["filter"] is not None:
        parameters["filter"] = args["filter"]
    if "invoice_no" in args and args["invoice_no"] is not None:
        parameters["invoice_no"] = args["invoice_no"]
    if "field" in args and args["field"] is not None:
        parameters["field"] = args["field"]
    if "group_by" in args and args["group_by"] is not None:
        parameters["group_by"] = args["group_by"]
    if "limit" in args and args["limit"] is not None:
        parameters["limit"] = args["limit"]

    return AgentAction(
        action_type=TOOL_ACTION_TYPES.get(tool_name, tool_name),
        description=_describe(tool_name, parameters),
        tool_name=tool_name,
        parameters=parameters,
        reversibility=args["reversibility"],
        reversibility_reasoning=args.get("reversibility_reasoning", ""),
        data_scope=data_scope,
        data_scope_reasoning=args.get("data_scope_reasoning", ""),
        regulatory_category=args["regulatory_category"],
        regulatory_reasoning=args.get("regulatory_reasoning", ""),
        confidence=confidence,
        confidence_reasoning=args.get("confidence_reasoning", ""),
        risk_band=args["risk_band"],
        severity=args.get("severity"),
        rationale=args.get("rationale", ""),
    )


def _assistant_msg(msg: Any) -> dict[str, Any]:
    return {
        "role": "assistant",
        "content": msg.content or "",
        "tool_calls": [
            {
                "id":       tc.id,
                "type":     "function",
                "function": {
                    "name":      tc.function.name,
                    "arguments": tc.function.arguments,
                },
            }
            for tc in (msg.tool_calls or [])
        ] or None,
    }


def _tool_msg(call_id: str, content: str) -> dict[str, Any]:
    return {"role": "tool", "tool_call_id": call_id, "content": content}


def _describe(tool_name: str, parameters: dict[str, Any]) -> str:
    desc_target = parameters.get("filter_description") or parameters.get("filter") or ""
    if tool_name == "query_transactions":
        return f"Read transactions matching: {desc_target}"
    if tool_name == "summarize_transactions":
        gb = parameters.get("group_by") or ""
        return f"Summarise transactions{f', grouped by {gb}' if gb else ''}: {desc_target}"
    if tool_name == "update_transaction":
        return (
            f"Set {parameters.get('field')!r} → {parameters.get('new_value')!r} "
            f"on invoice {parameters.get('invoice_no')}"
        )
    if tool_name == "delete_transaction":
        return f"Permanently delete invoice {parameters.get('invoice_no')}"
    if tool_name == "bulk_delete_transactions":
        return f"PERMANENTLY DELETE all transactions matching: {desc_target}"
    return f"{tool_name}({parameters})"

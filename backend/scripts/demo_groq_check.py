"""One-off local verification: prove the propose -> score -> route pipeline
works against a REAL tool-calling LLM via Groq.

Run: python scripts/demo_groq_check.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from autonomy_engine.action_proposer import (  # noqa: E402
    AgentAction,
    ClarificationRequest,
    propose_action,
)
from autonomy_engine.risk_evaluator import (  # noqa: E402
    build_assessment,
    describe_routing,
    route_action,
)

load_dotenv()

SCENARIOS = [
    ("A. aggregate read", "Which product category made the most revenue?"),
    (
        "B. single-invoice delete",
        "Delete invoice I138884 from the database, it was entered by mistake.",
    ),
    (
        "C. bulk delete",
        "Purge every Clothing transaction from the database "
        "to satisfy a data retention policy.",
    ),
]


def main() -> None:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("GROQ_API_KEY not set in .env", file=sys.stderr)
        sys.exit(1)

    print("=" * 78)
    print("LOCAL DEMO CHECK -- live tool-calling via Groq")
    print("=" * 78)

    all_ok = True
    for label, request_text in SCENARIOS:
        print(f"\n{label}: {request_text}")
        try:
            res = propose_action(request_text, {"session_id": "demo-check"})
        except Exception as exc:  # noqa: BLE001
            print(f"  FAILED to get a proposal: {exc}")
            all_ok = False
            continue

        if isinstance(res, ClarificationRequest):
            print(f"  Clarification requested: {res.question}")
            continue

        print(f"  tool called      {res.tool_name}")
        print(f"  action type      {res.action_type}")
        print(f"  risk_band        {res.risk_band}")
        factors = res.to_risk_factors()
        judged = build_assessment(factors)
        decision = route_action(judged)
        print(f"  routing          {describe_routing(judged, decision)}")

    print("\n" + "=" * 78)
    if all_ok:
        print("ALL SCENARIOS: real LLM output parsed and routed successfully.")
        print("The propose -> score -> route pipeline works end-to-end locally.")
    else:
        print("One or more scenarios failed -- see above.")
        sys.exit(1)
    print("=" * 78)


if __name__ == "__main__":
    main()

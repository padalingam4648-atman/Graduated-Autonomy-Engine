"""
Interactive human-approval demo  (multi-turn agentic loop)
===========================================================
Run:  python scripts/run_approval_demo.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from dotenv import load_dotenv
load_dotenv()

# Force Groq — no Anthropic
os.environ["AGENT_LLM_PROVIDER"] = "groq"

# Moto must start before boto3/audit_repository are imported
import moto
mock = moto.mock_aws()
mock.start()

import boto3
from autonomy_engine import audit_repository as audit_store

def _create_table() -> None:
    prefix = os.getenv("DYNAMODB_TABLE_PREFIX", "sentinel-autonomy-engine-local")
    name = f"{prefix}-audit-log"
    dynamo = boto3.resource("dynamodb", region_name=os.getenv("AWS_REGION", "us-east-1"))
    dynamo.create_table(
        TableName=name,
        KeySchema=[
            {"AttributeName": "session_id", "KeyType": "HASH"},
            {"AttributeName": "timestamp",  "KeyType": "RANGE"},
        ],
        AttributeDefinitions=[
            {"AttributeName": "session_id", "AttributeType": "S"},
            {"AttributeName": "timestamp",  "AttributeType": "S"},
        ],
        BillingMode="PAY_PER_REQUEST",
    ).wait_until_exists()

os.environ["DYNAMODB_ENDPOINT_URL"] = ""
audit_store.reset_cache()
_create_table()
audit_store.reset_cache()

from autonomy_engine import approval_manager as confirmation, executor
from autonomy_engine.action_proposer import AgentAction, ClarificationRequest, propose_action
from autonomy_engine.risk_evaluator import build_assessment, route_action

DIVIDER = "─" * 64


def main() -> None:
    user_request = (
        "Permanently delete all Clothing transactions from Kanyon mall. "
        "This is for a data retention audit and cannot be undone."
    )
    session_id = "demo-session-001"

    print(DIVIDER)
    print("PS-9.1  Graduated Autonomy Engine  —  Interactive Demo")
    print(DIVIDER)
    print(f"\nUser request : {user_request}")
    print(f"Session      : {session_id}\n")

    print("⏳  Agent is measuring risk (calling real tools) …\n")
    action = propose_action(user_request, {"session_id": session_id})
    if isinstance(action, ClarificationRequest):
        print(f"Clarification requested: {action.question}")
        return

    assessment = build_assessment(action.to_risk_factors())
    routing = route_action(assessment)

    print(f"✅  Agent chose tool   : {action.tool_name}")
    print(f"    Description        : {action.description}")
    print(f"    Reversibility      : {action.reversibility}")
    print(f"    Data scope (real)  : {action.data_scope} row(s) counted from CSV")
    print(f"    Regulatory         : {action.regulatory_category}")
    print(f"    Model confidence   : {action.confidence:.2f}")
    print(f"\n📊  Composite score : {assessment.composite_score:.4f}")
    print(f"    Routing         : {routing.upper()}\n")

    print(f"\n{DIVIDER}")

    if routing == "autonomous":
        record, result = confirmation.execute_autonomously(
            action, assessment, session_id=session_id
        )
        print("🤖  LOW RISK — executed automatically.")
        print(f"    Result: {result.detail}")
        print(f"    Audit record id : {record['record_id']}")

    elif routing == "confirm":
        confirmation_id = confirmation.create_confirmation_request(
            action, assessment, session_id=session_id
        )
        print("🟡  MEDIUM RISK — human approval required.\n")
        print(f"    Preview         : {action.description}")
        print(f"    Rows affected   : {action.data_scope}")
        print(f"    Confirmation ID : {confirmation_id}\n")

    else:
        review_id = confirmation.create_review_request(
            action, assessment, session_id=session_id
        )
        print("🔴  HIGH RISK — human approval required.\n")
        print(f"    Preview         : {action.description}")
        print(f"    Rows affected   : {action.data_scope}")
        print(f"    Review ID       : {review_id}\n")

    print(f"\n{DIVIDER}")
    print("Demo execution complete.")


if __name__ == "__main__":
    main()

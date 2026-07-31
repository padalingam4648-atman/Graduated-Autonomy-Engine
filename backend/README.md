# Autonomy Engine – Backend

The **Autonomy Engine Backend** is a FastAPI service that governs AI-driven database actions before execution. Every user request is analyzed, evaluated across multiple risk dimensions, routed through an appropriate governance workflow, and permanently recorded for traceability.

The engine combines AI-assisted action planning, policy-based risk evaluation, human approval workflows, execution management, adaptive calibration, and audit logging into a single backend service.

---

# Backend Structure

```
src/autonomy_engine/
├── action_proposer.py
├── risk_evaluator.py
├── data_store.py
├── executor.py
├── audit_repository.py
├── approval_manager.py
├── adaptive_calibration.py
├── main.py
└── lambda_handler.py
```

---

## Module Responsibilities

### action_proposer.py

Handles interaction with the language model and converts natural language requests into structured agent actions.

Responsibilities:

- Generates action proposals
- Produces structured tool parameters
- Estimates initial risk information
- Uses read-only lookup tools for accurate planning

---

### risk_evaluator.py

Evaluates every proposed action before execution.

The evaluation considers four independent dimensions:

- Reversibility
- Data Scope
- Regulatory Category
- Confidence

The module also applies governance rules that prevent high-impact operations from bypassing required human supervision.

---

### adaptive_calibration.py

Learns from historical human decisions.

Repeated approvals gradually reduce unnecessary confirmations, while repeated rejections increase supervision for similar future actions.

Calibration never overrides mandatory safety restrictions.

---

### data_store.py

Provides access to the underlying transaction dataset.

Responsibilities include:

- Record filtering
- Scope estimation
- Snapshot creation
- Rollback preparation

---

### executor.py

Executes approved operations against the dataset.

Before every modification, a snapshot is created to preserve the previous state and support recovery.

---

### audit_repository.py

Stores the complete execution history.

Each audit record contains the decision process, execution details, timestamps, routing information, and policy metadata.

---

### approval_manager.py

Manages operations that require manual intervention.

It maintains separate approval queues for:

- Confirmation
- Full Review

---

## Installation

Clone the repository and move to the backend directory.

```bash
cd backend
```

Create a virtual environment.

```bash
python -m venv .venv
```

Activate it.

Windows

```powershell
.venv\Scripts\Activate.ps1
```

Linux / macOS

```bash
source .venv/bin/activate
```

Install dependencies.

```bash
pip install -r requirements.txt
```

Create the environment file.

```bash
cp .env.example .env
```

Update the required configuration values.

```env
GROQ_API_KEY=your_api_key
DYNAMODB_TABLE_NAME=autonomy-engine-audit-log
AWS_REGION=us-east-1
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

---

# Running the Server

Start the application using Uvicorn.

```bash
uvicorn autonomy_engine.main:app --reload --port 8000
```

Default endpoints:

```
API
http://localhost:8000

Swagger
http://localhost:8000/docs

ReDoc
http://localhost:8000/redoc
```

---

# REST Endpoints

| Method | Endpoint | Purpose |
|---------|----------|---------|
| POST | `/actions/propose` | Generate, evaluate, and route an AI action |
| GET | `/confirmations/pending` | Retrieve pending confirmation requests |
| POST | `/confirmations/{id}/resolve` | Resolve confirmation requests |
| GET | `/reviews/pending` | Retrieve pending review requests |
| POST | `/reviews/{id}/resolve` | Resolve review requests |
| GET | `/audit/{session_id}` | Retrieve audit history for a session |
| GET | `/metrics` | View engine metrics and routing statistics |
| GET | `/policy/status` | View active governance policy |
| GET | `/health` | Service health status |

---

# Testing

Run the complete test suite.

```bash
pytest
```

Run with detailed output.

```bash
pytest -v
```

Run integration tests.

```bash
pytest -m integration
```

---

# Demo Scripts

Interactive approval workflow.

```bash
python scripts/run_approval_demo.py
```

LLM connectivity check.

```bash
python scripts/demo_groq_check.py
```

Run the backend locally.

```bash
python scripts/run_local.py
```

---

# Backend Workflow

```
User Request
      │
      ▼
Action Proposal
      │
      ▼
Risk Evaluation
      │
      ▼
Adaptive Calibration
      │
      ▼
Governance Decision
      │
      ▼
Approval (if required)
      │
      ▼
Execution
      │
      ▼
Audit Repository
```
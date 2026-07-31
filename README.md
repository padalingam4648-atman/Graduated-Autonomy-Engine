<div align="center">

# 🚀 Autonomy Engine

### AI-Powered Database Governance & Risk-Based Decision Platform

An intelligent governance platform that evaluates AI-generated database operations, performs multi-dimensional risk analysis, routes actions through adaptive approval workflows, and maintains a complete audit trail for every decision.

![Python](https://img.shields.io/badge/Python-3.11-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-green)
![React](https://img.shields.io/badge/React-Frontend-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6)
![License](https://img.shields.io/badge/License-MIT-orange)

</div>

---

# 📖 Overview

Autonomy Engine is an AI governance platform that safely manages AI-generated database operations through intelligent decision routing.

Instead of immediately executing every AI-generated action, the platform evaluates each request using multiple risk dimensions, determines the appropriate governance level, and executes actions only after the required level of supervision has been satisfied.

Every execution is permanently recorded with its reasoning, routing decision, execution result, and audit history.

---

# ✨ Key Features

- 🤖 AI-powered action proposal from natural language
- 🛡️ Multi-dimensional risk evaluation
- ⚖️ Graduated autonomy decision routing
- 👨‍💼 Human approval workflow for medium and high-risk actions
- 🔄 Adaptive calibration based on historical approvals
- 📊 Live governance dashboard
- 📝 Complete audit trail
- 💾 Safe execution with rollback support
- ☁️ DynamoDB audit persistence

---

# 🏗️ System Architecture

```text
                 User Request
                      │
                      ▼
              AI Action Proposal
                      │
                      ▼
             Risk Evaluation Engine
                      │
                      ▼
          Adaptive Threshold Calibration
                      │
                      ▼
            Blast Radius Safety Floor
                      │
                      ▼
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
 Autonomous      Confirmation    Full Review
 Execution          Queue          Queue
        │             │             │
        └─────────────┼─────────────┘
                      │
                      ▼
             Database Execution
                      │
                      ▼
              Audit Repository
                      │
                      ▼
              Dashboard & Reports
```

---

# 📂 Project Structure

```text
Autonomy Engine/
│
├── backend/
│   ├── src/autonomy_engine/
│   ├── tests/
│   ├── scripts/
│   └── README.md
│
├── frontend/
│   ├── src/
│   └── README.md
│
├── docs/
│
└── README.md
```

---

# ⚙️ Backend Workflow

```text
User Prompt
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
Safety Floor
      │
      ▼
Decision Routing
      │
      ▼
Database Execution
      │
      ▼
Audit Repository
```

---

# 🖥️ Frontend Workflow

```text
Landing Page
      │
      ▼
Dashboard
      │
      ▼
Query Writer
      │
      ▼
AI Governance Analysis
      │
      ▼
Execution Result
      │
      ▼
Audit Logs
```

---

# 🚀 Getting Started

## Backend

```bash
cd backend

python -m venv .venv

# Windows
.venv\Scripts\Activate.ps1

# Linux/macOS
source .venv/bin/activate

pip install -r requirements.txt

uvicorn autonomy_engine.main:app --reload
```

Backend URL

```
http://localhost:8000
```

Swagger

```
http://localhost:8000/docs
```

---

## Frontend

```bash
cd frontend

npm install

npm run dev
```

Frontend URL

```
http://localhost:5173
```

---

# 📚 Documentation

Detailed project documentation is available inside each workspace.

| Documentation | Description |
|--------------|-------------|
| 📘 `backend/README.md` | Backend architecture, API endpoints, modules, testing |
| 📗 `frontend/README.md` | Frontend pages, components, setup, dashboard |

---

# 📸 Screenshots

### Landing Page

> *Add screenshot here*

---

### Dashboard

> *Add screenshot here*

---

### Query Writer

> *Add screenshot here*

---

### Audit Logs

> *Add screenshot here*

---

# 🎯 Core Capabilities

- AI-assisted action planning
- Risk-aware governance engine
- Dynamic approval routing
- Human-in-the-loop review
- Safe database execution
- Adaptive threshold learning
- Complete execution auditing
- Real-time dashboard monitoring

---

# 🔮 Future Improvements

- Multi-database support
- Policy management
- Role-based access control
- Advanced analytics dashboard
- Real-time monitoring
- Explainable AI insights

---

# 📄 License

This project is licensed under the MIT License.

---

<div align="center">

**Autonomy Engine**

*Intelligent Decisions • Secure Execution • Complete Audit*

</div>
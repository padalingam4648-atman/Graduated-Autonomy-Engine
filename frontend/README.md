# Autonomy Engine – Frontend

The **Autonomy Engine Frontend** is a modern web application that provides an interactive interface for AI-powered database governance. It enables users to submit natural language requests, review AI-generated risk assessments, monitor governance decisions, inspect execution results, and explore complete audit histories through an intuitive dashboard.

---

# Project Structure

```
frontend/
├── public/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   ├── ActionResult.tsx
│   │   ├── AuditTrail.tsx
│   │   ├── RequestForm.tsx
│   │   ├── RiskBreakdown.tsx
│   │   └── SessionBar.tsx
│   ├── pages/
│   │   ├── LandingPage.tsx
│   │   ├── Dashboard.tsx
│   │   ├── QueryWriter.tsx
│   │   ├── AuditPage.tsx
│   │   └── Settings.tsx
│   ├── services/
│   ├── types.ts
│   ├── styles.css
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── tailwind.config.js
└── vite.config.ts
```

---

# Application Pages

## Landing Page

The entry point of the application introducing the Autonomy Engine platform, governance workflow, and system overview.

---

## Dashboard

Provides a centralized overview of the platform.

Displays:

- System statistics
- Recent requests
- Risk distribution
- AI service status
- Database status
- Audit health

---

## Query Writer

The primary workspace for interacting with the engine.

Features:

- Natural language request submission
- AI governance analysis
- Risk evaluation
- Generated SQL preview
- Execution status
- Database results
- Approval workflow

---

## Audit Logs

Displays the complete execution history.

Includes:

- Session history
- User requests
- Risk evaluations
- Routing decisions
- Generated SQL
- Execution details
- Audit timeline

---

## Settings

Allows configuration of application preferences and system information.

Displays:

- AI configuration
- Database connection status
- Risk policy information
- Application settings

---

# Installation

Navigate to the frontend directory.

```bash
cd frontend
```

Install project dependencies.

```bash
npm install
```

Create the environment configuration.

```bash
cp .env.example .env.local
```

Configure the backend API.

```env
VITE_API_BASE_URL=http://localhost:8000
```

Start the development server.

```bash
npm run dev
```

Application URL

```
http://localhost:5173
```

---

# Available Scripts

Start the development server.

```bash
npm run dev
```

Create a production build.

```bash
npm run build
```

Preview the production build.

```bash
npm run preview
```

Run lint checks.

```bash
npm run lint
```

---

# Backend Integration

The frontend communicates directly with the backend API.

Default API endpoint:

```
http://localhost:8000
```

Ensure the backend server is running before launching the frontend.

---

# Frontend Workflow

```
Landing Page
      │
      ▼
Dashboard
      │
      ▼
Query Writer
      │
      ▼
Natural Language Request
      │
      ▼
AI Governance Analysis
      │
      ▼
Risk Evaluation
      │
      ▼
Routing Decision
      │
      ▼
Execution Result
      │
      ▼
Audit Logs
```
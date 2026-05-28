# Incident Triage Assistant

A **deterministic, rule-based incident triage engine** with a FastAPI web dashboard. It evaluates incoming alerts against a configurable rule set, computes a dynamic risk score, detects false positives, assigns severity, and pages the appropriate on-call engineer — all without machine learning. Every decision is fully traceable and auditable.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend Framework** | [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+) |
| **ORM** | [SQLAlchemy](https://www.sqlalchemy.org/) |
| **Schema Validation** | [Pydantic](https://docs.pydantic.dev/) |
| **Templating** | [Jinja2](https://jinja.palletsprojects.com/) |
| **Frontend** | Vanilla CSS + JavaScript (server-rendered) |
| **Database** | PostgreSQL (primary) / SQLite (fallback) |
| **ASGI Server** | [Uvicorn](https://www.uvicorn.org/) |
| **Fonts** | Inter (UI) + JetBrains Mono (code) via Google Fonts |
| **Environment** | `python-dotenv` for `.env` support |

---

## Features

| Route | Method | Description |
|---|---|---|
| `/` | GET | **Dashboard** — stats, alert feed, severity distribution |
| `/triage` | GET, POST | **Triage Alert** — paste a JSON alert payload and run triage |
| `/rules` | GET, POST | **Rules Engine** — browse/search rules, add new ones, import from JSON |
| `/playbooks` | GET, POST | **Playbooks** — browse/search runbooks by incident type |
| `/history` | GET | **History** — browse past triage sessions with search & detail view |
| `/rules/import` | POST | **Import Rules** — bulk-import rules from a JSON file |
| `/rules/{id}/delete` | POST | **Delete Rule** |
| `/playbooks/{name}/delete` | POST | **Delete Playbook** |

### Triage Pipeline (High Level)

```
Alert JSON
    │
    ├── Track A: Rule Engine ──→ matched rules + their severity
    │
    ├── Track B: Risk Score ───→ dynamic severity (0–120 → LOW→CRITICAL)
    │
    ├── Severity Merge ────────→ dynamic wins if CRITICAL/HIGH, else rule wins
    │
    ├── False Positive Engine ─→ signal-based FP confidence scoring
    │     └─ if FP → override severity to LOW, NO-ESCALATION
    │
    └── Escalation + Engineer ─→ SEV-1/2/3 mapping + on-call lookup
```

See [`TECHNICAL.md`](./TECHNICAL.md) for the full algorithmic deep-dive.

---

## How to Run

### Option 1: Quick Start (SQLite — no setup needed)

```bash
# 1. Create & activate virtual environment
python -m venv venv
# Windows: .\venv\Scripts\activate
# Linux/Mac: source venv/bin/activate

# 2. Install dependencies
pip install -r backend/requirements.txt

# 3. Set database to SQLite & seed data
set DATABASE_URL=sqlite:///./incident_triage.db
python -m backend.seed

# 4. Start server
set DATABASE_URL=sqlite:///./incident_triage.db
python -m uvicorn backend.main:app --port 8888 --reload
```

Open **http://localhost:8888**

---

### Option 2: PostgreSQL (Production)

First, make sure PostgreSQL is running. Then:

```bash
# 1. Create & activate virtual environment
python -m venv venv
# Windows: .\venv\Scripts\activate
# Linux/Mac: source venv/bin/activate

# 2. Install dependencies
pip install -r backend/requirements.txt

# 3. Set your database URL & seed data
set DATABASE_URL=postgresql://postgres:MyPassword@localhost:5432/incident_triage
python -m backend.seed

# 4. Start server
set DATABASE_URL=postgresql://postgres:MyPassword@localhost:5432/incident_triage
python -m uvicorn backend.main:app --port 8888 --reload
```

> **⚠️ If your password contains `@` or `#`, you must URL-encode them:**  
> `@` → `%40`, `#` → `%23`  
> For example, password `Post@1234` becomes `Post%401234`:
> ```
> set DATABASE_URL=postgresql://postgres:Post%401234@localhost:5432/incident_triage
> ```

Instead of typing the URL every time, create a `.env` file in the project root:
```
DATABASE_URL=postgresql://postgres:MyPassword@localhost:5432/incident_triage
```
The app reads it automatically (via `python-dotenv`). The app also creates the database automatically if it doesn't exist.

---

### Shell-Specific Notes

| Shell | Set env var | Example |
|---|---|---|
| **cmd.exe** | `set VAR=value` | `set DATABASE_URL=sqlite:///...` |
| **PowerShell** | `$env:VAR="value"` | `$env:DATABASE_URL="sqlite:///..."` |
| **bash/zsh** | `export VAR=value` | `export DATABASE_URL="sqlite:///..."` |

---



## Running with Docker (Alternative)

If you prefer Docker, you can run with PostgreSQL:

```bash
# Start a Postgres container
docker run -d --name triage-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16

# Build and run the app
docker build -t incident-triage .
docker run -d --name triage-app -p 8888:8888 `
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/incident_triage" `
  incident-triage
```

> *Note: A `Dockerfile` is not yet included — this is a placeholder workflow.*

---

## Testing Scenarios

We have bundled **7 pre-configured test alert payloads** in [`all_test_scenarios.json`](./all_test_scenarios.json). These cover both True Positive and False Positive scenarios across multiple incident types (system monitoring, brute force, DDoS, firewall breach, port scanning, unauthorized access, network latency).

**To test:** Open the **Triage Alert** page (`/triage`), paste a JSON payload from the file, and click **Run Triage**.

---

## Project Structure

```
├── backend/                    # Python backend
│   ├── core/                   # Triage engine internals
│   │   ├── rule_engine.py      #   Rule matching & condition evaluation
│   │   ├── escalation.py       #   Severity mapping, risk scoring, FP detection
│   │   └── triage.py           #   Orchestrator — runs the full triage pipeline
│   ├── templates/              # Jinja2 HTML templates (server-rendered)
│   │   ├── base.html           #   Layout with sidebar navigation
│   │   ├── dashboard.html      #   Home page — stats & alert feed
│   │   ├── triage.html         #   Alert JSON editor & results view
│   │   ├── rules.html          #   CRUD for triage rules
│   │   ├── playbooks.html      #   Runbook viewer by incident type
│   │   └── history.html        #   Past triage sessions
│   ├── static/                 # Static assets
│   │   ├── style.css           #   Sentinel-interface design system
│   │   └── script.js           #   Client-side interactivity
│   ├── main.py                 # FastAPI application + all route handlers
│   ├── database.py             # SQLAlchemy engine & session setup
│   ├── models.py               # ORM models (Rule, Playbook, Engineer, TriageResult)
│   ├── schemas.py              # Pydantic request/response schemas
│   ├── seed.py                 # Database seeder (10 rules, 10 playbooks, 3 engineers)
│   └── requirements.txt        # Python dependencies
├── config/
│   └── engineers.json          # On-call engineer roster (reference)
├── rules/
│   └── rules.json              # Rule definitions (reference / import source)
├── runbook/
│   └── runbook.md              # Runbook documentation per incident type
├── all_test_scenarios.json     # 7 pre-configured test alert payloads
├── incident_triage.db          # SQLite database (auto-created when using SQLite)
├── TECHNICAL.md                # Full algorithmic deep-dive
└── README.md                   # This file
```


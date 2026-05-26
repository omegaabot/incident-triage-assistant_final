# Incident Triage Assistant

Rule-based alert triage engine with a FastAPI web dashboard.

## Tech Stack

- **Backend:** FastAPI + SQLAlchemy + Jinja2
- **Database:** PostgreSQL (SQLite fallback via `DATABASE_URL` env var)
- **Frontend:** Server-rendered Jinja2 templates + Vanilla CSS/JS

## Features

| Route | Description |
|---|---|
| `GET /` | Dashboard — stats, alert feed, severity distribution |
| `GET/POST /triage` | Run triage on an alert JSON payload |
| `GET/POST /rules` | Browse/search rules, add new ones |
| `GET/POST /playbooks` | Browse/search playbooks by incident type |
| `GET /history` | Browse past triage sessions |

## How to Run (Virtual Environment)

```bash
# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate      # Windows
# source venv/bin/activate   # Linux/Mac

# Install dependencies
pip install -r backend/requirements.txt

# Seed database using the SQLite fallback
$env:DATABASE_URL="sqlite:///./incident_triage.db"
python -m backend.seed

# Start the server (runs on port 8888)
$env:DATABASE_URL="sqlite:///./incident_triage.db"
python -m uvicorn backend.main:app --port 8888
```

Open http://localhost:8888

## Testing Scenarios

We have bundled 7 pre-configured, direct copy-pasteable test alert payloads in [all_test_scenarios.json](file:///c:/Users/aditya1/Desktop/2_DO/incident-triage-assistant_final/all_test_scenarios.json). You can paste any JSON payload from that list directly into the **Triage Alert** page to instantly test various True Positive and False Positive incident classifications.

## Project Structure

```
backend/
  core/           # Rule engine, escalation, triage logic
  templates/      # Jinja2 HTML templates
  static/         # CSS, JS
  main.py         # FastAPI app + routes
  database.py     # SQLAlchemy setup
  models.py       # ORM models
  schemas.py      # Pydantic schemas
  seed.py         # DB seed script
config/           # Engineer config
rules/            # Rule definitions (reference)
runbook/          # Runbook markdown (reference)
all_test_scenarios.json # Consolidated alert JSON payloads for easy testing
incident_triage.db # SQLite Database (seeding target)
```


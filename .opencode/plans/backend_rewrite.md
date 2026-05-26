# Full Python Backend with PostgreSQL + Jinja2 Templates

## Summary
Replace the React frontend and sample JSON data with a FastAPI backend serving Jinja2 templates, using PostgreSQL via SQLAlchemy. All triage logic moves server-side.

---

## Phase 1 — Remove Old Files (Done)

Deleted:
- `data/*.json` — 7 sample alert files
- `SCENARIOS.md` — sample scenario docs
- `src/triageEngine.js` — JS triage engine (all logic now in Python)
- `src/pages/` and `src/components/` — React UI
- `src/App.jsx`, `src/App.css`, `src/main.jsx`, `src/index.css` — React app shell
- `src/assets/` — images
- `public/`, `dist/` — build artifacts
- `package.json`, `package-lock.json`, `vite.config.js`, `index.html`, `eslint.config.js` — frontend tooling
- `output/reports.txt` — old generated reports
- `src/__pycache__/` — cache

---

## Phase 2 — Core Python Library (`backend/core/`)

### `backend/core/__init__.py`
- Empty

### `backend/core/rule_engine.py`
Refactored from `src/rule_engine.py`:
- `evaluate_condition(condition, alert_data)` — same `eval()` logic
- `apply_rules(alert_data, rules)` — same logic, but also includes `checks`, `checklist`, `false_positive_signals` from DB rules

### `backend/core/escalation.py`
Refactored from `src/escalation.py` + helpers from `src/triage.py`:
- `map_severity(severity)` — `HIGH`→`SEV-1`, `MEDIUM`→`SEV-2`, `LOW`→`SEV-3`
- `get_final_severity(results)` — highest severity from matched rules
- `calculate_priority(results)` — priority scoring
- `detect_false_positive(alert, results)` — FP detection
- `sort_by_severity(results)` — sort matched rules by severity order
- `SEVERITY_ORDER` constant

### `backend/core/triage.py`
New combined triage runner:
- `run_triage(alert, rules, engineers)` — calls `apply_rules`, `get_final_severity`, `map_severity`, `calculate_priority`, `detect_false_positive`, looks up engineer from list, returns a complete result dict

---

## Phase 3 — Database Layer

### `backend/database.py`
- SQLAlchemy engine + `SessionLocal` factory
- PostgreSQL connection string from `DATABASE_URL` env var (fallback to SQLite for dev)
- `get_db()` dependency for FastAPI routes

### `backend/models.py`
SQLAlchemy ORM models:

```python
class Rule(Base):
    __tablename__ = "rules"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    condition = Column(String, nullable=False)
    severity = Column(String, nullable=False)
    message = Column(String, nullable=False)
    action = Column(String, nullable=False)
    checks = Column(JSON, default=list)
    checklist = Column(JSON, default=list)
    false_positive_signals = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

class Playbook(Base):
    __tablename__ = "playbooks"
    id = Column(Integer, primary_key=True)
    rule_name = Column(String, nullable=False)
    trigger = Column(String, nullable=False)
    immediate_steps = Column(JSON, default=list)
    commands = Column(JSON, default=list)
    resolution_checklist = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

class Engineer(Base):
    __tablename__ = "engineers"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    team = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    escalation_level = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class TriageResult(Base):
    __tablename__ = "triage_results"
    id = Column(Integer, primary_key=True)
    alert_data = Column(JSON, nullable=False)
    final_severity = Column(String, nullable=False)
    escalation_level = Column(String, nullable=False)
    risk_score = Column(Integer, default=0)
    priority_score = Column(Integer, default=0)
    is_false_positive = Column(Boolean, default=False)
    fp_confidence = Column(Integer, default=0)
    engineer_name = Column(String, nullable=True)
    matched_rule_names = Column(JSON, default=list)
    timestamp = Column(DateTime, default=datetime.utcnow)
```

### `backend/schemas.py`
Pydantic models for request validation:
- `AlertInput` — validates incoming alert JSON (type, service, status, plus arbitrary fields)
- `RuleCreate` — name, type, condition, severity, message, action, checks, checklist, fp_signals
- `PlaybookCreate` — rule_name, trigger, immediate_steps, commands, resolution_checklist

---

## Phase 4 — FastAPI App (`backend/main.py`)

```python
from fastapi import FastAPI, Request, Form, Depends
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
# ... imports ...
```

### Routes (all serve Jinja2 HTML)

| Route | Method | Purpose |
|---|---|---|
| `/` | GET | Dashboard — stats from DB, recent triages |
| `/triage` | GET | Triage form page |
| `/triage` | POST | Accept alert JSON, run triage, save to DB, show result |
| `/rules` | GET | List rules from DB, expandable cards |
| `/rules` | POST | Create new rule in DB |
| `/playbooks` | GET | Playbook viewer with sidebar + detail |
| `/playbooks` | POST | Create new playbook entry |
| `/history` | GET | Past triage results with search |

### Dashboard Logic
- Count total triage results by severity
- Show last 10 results in a feed
- Severity distribution percentages

### Triage Logic
- Parse JSON from form textarea
- Load all rules and engineers from DB
- Call `run_triage(alert_dict, rules_list, engineers_list)`
- Save `TriageResult` to DB
- Render result in template

---

## Phase 5 — Static Assets (`backend/static/`)

### `backend/static/style.css`
Consolidated from all existing CSS files (~2500 lines → 1 file):
- `:root` variables (colors, spacing, typography, shadows) from `src/index.css`
- Layout: `.app-layout`, `.sidebar`, `.page` from `App.css` + `Sidebar.css`
- Components: `.btn`, `.card`, `.badge`, `.input`, `.code-block`, `.divider`, `.progress-bar` from `src/index.css`
- Stats bar: `.rules-stats-bar`, `.rules-stat` from `RulesPage.css`
- Rule cards: `.rule-card`, `.rule-condition`, `.rule-expanded` from `RulesPage.css`
- Playbook: `.playbook-layout`, `.playbook-sidebar`, `.playbook-detail` from `PlaybookPage.css`
- Triage: `.triage-layout`, `.triage-editor`, `.triage-textarea` from `TriagePage.css`
- Report: `.report-header`, `.report-tabs`, `.info-grid`, `.metrics-grid`, `.issue-card`, `.checklist-item`, `.engineer-card` from `TriageReport.css`
- Dashboard: `.dashboard-stats`, `.alert-feed`, `.severity-dist-list`, `.quick-action-grid` from `Dashboard.css`
- History: `.history-layout`, `.history-list`, `.history-item` from `HistoryPage.css`
- Stat card: `.stat-card` from `StatCard.css`
- Animations: `@keyframes` for slide-in-up, fade-in, pulse-dot, spin

### `backend/static/script.js`
Minimal vanilla JS (~80 lines):
- Sidebar toggle (collapse/expand)
- Rule card expand/collapse
- Tab switching for triage report
- Interactive checklist (check/uncheck)
- Nav active state highlighting

---

## Phase 6 — Jinja2 Templates (`backend/templates/`)

### `base.html`
Full HTML5 layout with:
- Link to `style.css`
- Collapsible sidebar with nav items (Dashboard, Triage, Rules, Playbook, History)
- `{% block content %}` for page content
- Script include for `script.js`

Severity badge macro:
```jinja
{% macro severity_badge(sev) %}
<span class="badge badge-{{ sev.lower() if sev in ['CRITICAL','HIGH','MEDIUM','LOW'] else 'info' }}">
  {{ sev }}
</span>
{% endmacro %}
```

### `dashboard.html`
- 4 stat cards: Total Alerts, Critical/High, False Positives, Active Rules
- Live Alert Feed: last 10 triage results from DB
- Severity Distribution: count + % per severity
- Quick Actions: 4 cards linking to other pages

### `triage.html`
- Left panel: JSON textarea + "Run Triage" button
- Right panel: shows result (same layout as current `TriageReport.jsx`)
  - Tabbed: Overview, Issues, Checklist, On-Call
  - Uses `severity_badge` macro
  - Summary info rows, metrics chips, FP analysis, diagnostic checks, interactive checklist, engineer card

### `rules.html`
- "Add Rule" inline form (POST to /rules)
- Stats bar: total, HIGH, MEDIUM counts
- Search input + type filter buttons
- Expandable rule cards: condition code block, action, checks, checklist, FP signals
- Sorted by severity (LOW → MEDIUM → HIGH)

### `playbooks.html`
- Left sidebar: rule names with severity badges
- Right detail: trigger condition, immediate steps (ordered), diagnostic commands (code block), diagnostic checks, resolution checklist, primary action
- "Add Playbook" inline form

### `history.html`
- Left sidebar: searchable list of past triages
- Each item: alert ID, service, severity badge, escalation level
- Right detail: full TriageReport view using macros

---

## Phase 7 — Seed Script (`backend/seed.py`)

Reads from existing files to populate DB:
- `rules/rules.json` → `Rule` table
- `runbook/runbook.md` → `Playbook` table (parse headings as rule names, bullets as immediate_steps)
- `config/engineers.json` → `Engineer` table (fallback to hardcoded data if file is empty)

Idempotent — clears and re-seeds on each run.

---

## Phase 8 — Dependencies (`backend/requirements.txt`)

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
sqlalchemy==2.0.35
psycopg2-binary==2.9.9
jinja2==3.1.4
python-dotenv==1.0.1
pydantic==2.9.0
```

---

## Phase 9 — Setup & Run

```bash
# 1. Install Python dependencies
pip install -r backend/requirements.txt

# 2. Set PostgreSQL connection (or fallback to SQLite)
set DATABASE_URL=postgresql://user:pass@localhost:5432/incident_triage

# 3. Seed the database
python -m backend.seed

# 4. Start the server
uvicorn backend.main:app --reload --port 8000

# 5. Open http://localhost:8000
```

---

## Files to Keep
- `rules/rules.json` — seeded into DB
- `runbook/runbook.md` — seeded into DB
- `config/engineers.json` — seeded into DB
- `README.md`, `TECHNICAL.md`
- `.gitignore`

## Files to Create
```
backend/
├── __init__.py
├── main.py              # FastAPI app + routes
├── database.py          # SQLAlchemy setup
├── models.py            # ORM models
├── schemas.py           # Pydantic schemas
├── seed.py              # DB seed script
├── requirements.txt
├── core/
│   ├── __init__.py
│   ├── rule_engine.py
│   ├── escalation.py
│   └── triage.py
├── templates/
│   ├── base.html
│   ├── dashboard.html
│   ├── triage.html
│   ├── rules.html
│   ├── playbooks.html
│   └── history.html
└── static/
    ├── style.css
    └── script.js
```

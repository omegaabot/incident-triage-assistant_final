import json
from datetime import datetime
from fastapi import FastAPI, Request, Form, Depends
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from pathlib import Path

from backend.database import get_db, init_db
from backend.models import Rule, Playbook, Engineer, TriageResult
from backend.core.triage import run_triage
from backend.core.escalation import SEVERITY_ORDER

app = FastAPI(title="Incident Triage Assistant")

BASE_DIR = Path(__file__).resolve().parent
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


@app.on_event("startup")
def on_startup():
    init_db()


def severity_badge_html(severity):
    css_class = severity.lower() if severity in ("CRITICAL", "HIGH", "MEDIUM", "LOW") else "info"
    return f'<span class="badge badge-{css_class}">{severity}</span>'


templates.env.globals["severity_badge"] = severity_badge_html


def get_engineers(db):
    db_engs = db.query(Engineer).all()
    if db_engs:
        return [{"name": e.name, "team": e.team, "email": e.email, "phone": e.phone, "escalation_level": e.escalation_level} for e in db_engs]
    return [
        {"name": "Ramesh", "team": "Senior SRE Team", "email": "ramesh.sre@company.com", "phone": "+91-9876543210", "escalation_level": "SEV-1"},
        {"name": "Priya", "team": "Cloud Support Team", "email": "priya.support@company.com", "phone": "+91-9123456780", "escalation_level": "SEV-2"},
        {"name": "Monitoring Team", "team": "NOC Team", "email": "noc@company.com", "phone": "+91-9000000000", "escalation_level": "SEV-3"},
    ]


def get_rules(db):
    db_rules = db.query(Rule).all()
    if db_rules:
        return [{"name": r.name, "type": r.type, "condition": r.condition, "severity": r.severity,
                 "message": r.message, "action": r.action, "checks": r.checks or [],
                 "checklist": r.checklist or [], "false_positive_signals": r.false_positive_signals or []} for r in db_rules]
    return []


def get_playbooks(db):
    pb = db.query(Playbook).all()
    if pb:
        return {p.rule_name: {"trigger": p.trigger, "immediateSteps": p.immediate_steps or [],
                              "commands": p.commands or [], "resolutionChecklist": p.resolution_checklist or []} for p in pb}
    return {}


# ── DASHBOARD ──
@app.get("/", response_class=HTMLResponse)
def dashboard(request: Request, db: Session = Depends(get_db)):
    results = db.query(TriageResult).order_by(TriageResult.timestamp.desc()).limit(50).all()
    total = len(results)
    critical = sum(1 for r in results if r.final_severity == "CRITICAL")
    high = sum(1 for r in results if r.final_severity == "HIGH")
    false_positives = sum(1 for r in results if r.is_false_positive)
    rules_count = db.query(Rule).count()
    if rules_count == 0:
        rules_count = 10

    severity_counts = {}
    for r in results:
        sev = r.final_severity
        severity_counts[sev] = severity_counts.get(sev, 0) + 1

    return templates.TemplateResponse(request, "dashboard.html", {
        "results": results,
        "total": total,
        "critical": critical,
        "high": high,
        "false_positives": false_positives,
        "rules_count": rules_count,
        "severity_counts": severity_counts,
        "severity_order": ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
    })


# ── TRIAGE ──
@app.get("/triage", response_class=HTMLResponse)
def triage_form(request: Request):
    return templates.TemplateResponse(request, "triage.html", {
        "result": None,
        "alert_json": '{\n  "type": "system_monitoring",\n  "service": "payment-api",\n  "cpu_usage": 92,\n  "memory_usage": 85,\n  "error_rate": 60,\n  "response_time": 1200,\n  "status": "degraded"\n}',
    })


@app.post("/triage", response_class=HTMLResponse)
def triage_run(request: Request, alert_json: str = Form(...), db: Session = Depends(get_db)):
    result = None
    error = None
    try:
        alert = json.loads(alert_json)
        rules = get_rules(db)
        engineers = get_engineers(db)
        result = run_triage(alert, rules, engineers)

        tr = TriageResult(
            alert_data=alert,
            final_severity=result["final_severity"],
            escalation_level=result["escalation_level"],
            risk_score=result["risk_score"],
            priority_score=result["priority_score"],
            is_false_positive=result["fp_result"]["is_false_alert"],
            fp_confidence=result["fp_result"]["confidence"],
            engineer_name=result["engineer"]["name"],
            matched_rule_names=[r["name"] for r in result["matched_rules"]],
            timestamp=datetime.now(),
        )
        db.add(tr)
        db.commit()
    except json.JSONDecodeError as e:
        error = f"Invalid JSON: {e}"
    except Exception as e:
        error = str(e)

    return templates.TemplateResponse(request, "triage.html", {
        "result": result,
        "error": error,
        "alert_json": alert_json,
    })


# ── RULES ──
@app.get("/rules", response_class=HTMLResponse)
def rules_list(request: Request, search: str = "", rule_type: str = "", db: Session = Depends(get_db)):
    rules = get_rules(db)
    types = sorted(set(r["type"] for r in rules))

    filtered = rules
    if search:
        filtered = [r for r in filtered if search.lower() in r["name"].lower() or search.lower() in r["type"].lower()]
    if rule_type:
        filtered = [r for r in filtered if r["type"] == rule_type]

    filtered.sort(key=lambda r: SEVERITY_ORDER.get(r["severity"], 0))

    total = len(rules)
    high_count = sum(1 for r in rules if r["severity"] == "HIGH")
    medium_count = sum(1 for r in rules if r["severity"] == "MEDIUM")

    return templates.TemplateResponse(request, "rules.html", {
        "rules": filtered,
        "all_rules": rules,
        "types": types,
        "total": total,
        "high_count": high_count,
        "medium_count": medium_count,
        "search": search,
        "rule_type": rule_type,
    })


@app.post("/rules")
def rules_create(
    request: Request,
    name: str = Form(...),
    rule_type: str = Form(...),
    severity: str = Form(...),
    condition: str = Form(...),
    message: str = Form(...),
    action: str = Form(...),
    checks: str = Form(""),
    checklist: str = Form(""),
    fp_signals: str = Form(""),
    db: Session = Depends(get_db),
):
    rule = Rule(
        name=name,
        type=rule_type,
        severity=severity,
        condition=condition,
        message=message,
        action=action,
        checks=[c.strip() for c in checks.split("\n") if c.strip()],
        checklist=[c.strip() for c in checklist.split("\n") if c.strip()],
        false_positive_signals=[s.strip() for s in fp_signals.split("\n") if s.strip()],
    )
    db.add(rule)
    db.commit()
    return RedirectResponse(url="/rules", status_code=303)


# ── PLAYBOOKS ──
@app.get("/playbooks", response_class=HTMLResponse)
def playbooks_list(request: Request, selected: str = "", db: Session = Depends(get_db)):
    rules = get_rules(db)
    runbook = get_playbooks(db)
    if not selected and rules:
        selected = rules[0]["name"]

    rule = next((r for r in rules if r["name"] == selected), None)
    rb = runbook.get(selected)

    return templates.TemplateResponse(request, "playbooks.html", {
        "rules": rules,
        "selected": selected,
        "rule": rule,
        "rb": rb,
    })


@app.post("/playbooks")
def playbooks_create(
    rule_name: str = Form(...),
    trigger: str = Form(...),
    immediate_steps: str = Form(""),
    commands: str = Form(""),
    resolution_checklist: str = Form(""),
    db: Session = Depends(get_db),
):
    existing = db.query(Playbook).filter(Playbook.rule_name == rule_name).first()
    if existing:
        existing.trigger = trigger
        existing.immediate_steps = [s.strip() for s in immediate_steps.split("\n") if s.strip()]
        existing.commands = [c.strip() for c in commands.split("\n") if c.strip()]
        existing.resolution_checklist = [r.strip() for r in resolution_checklist.split("\n") if r.strip()]
    else:
        pb = Playbook(
            rule_name=rule_name,
            trigger=trigger,
            immediate_steps=[s.strip() for s in immediate_steps.split("\n") if s.strip()],
            commands=[c.strip() for c in commands.split("\n") if c.strip()],
            resolution_checklist=[r.strip() for r in resolution_checklist.split("\n") if r.strip()],
        )
        db.add(pb)
    db.commit()
    return RedirectResponse(url="/playbooks", status_code=303)


# ── HISTORY ──
@app.get("/history", response_class=HTMLResponse)
def history_list(request: Request, search: str = "", db: Session = Depends(get_db)):
    query = db.query(TriageResult).order_by(TriageResult.timestamp.desc())
    if search:
        like = f"%{search}%"
        all_results = query.all()
        results = [r for r in all_results if
                   search.lower() in str(r.alert_data.get("service", "")).lower() or
                   search.lower() in r.final_severity.lower() or
                   search.lower() in str(r.alert_data.get("type", "")).lower()]
    else:
        results = query.limit(100).all()

    selected_id = request.query_params.get("selected")
    selected_result = None
    if selected_id:
        selected_result = db.query(TriageResult).filter(TriageResult.id == int(selected_id)).first()

    return templates.TemplateResponse(request, "history.html", {
        "results": results,
        "selected_result": selected_result,
        "search": search,
    })

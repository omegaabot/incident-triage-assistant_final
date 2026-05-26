from datetime import datetime
from backend.core.rule_engine import apply_rules
from backend.core.escalation import (
    map_severity, get_rule_severity, calculate_risk_score,
    calculate_dynamic_severity, calculate_priority, calculate_fp_confidence,
    sort_by_severity
)


def run_triage(alert, rules, engineers):
    # Track A: Rule Engine matches
    results = apply_rules(alert, rules)
    results = sort_by_severity(results)
    rule_severity = get_rule_severity(results)

    # Track B: Dynamic Risk Scoring
    risk_score = calculate_risk_score(alert)
    dynamic_severity = calculate_dynamic_severity(risk_score)

    # Final Severity Resolution (Dynamic severity wins if it is CRITICAL or HIGH)
    if dynamic_severity in ("CRITICAL", "HIGH"):
        severity = dynamic_severity
    else:
        severity = rule_severity

    # False Positive Engine check
    fp_result = calculate_fp_confidence(alert, results)

    # Override if False Positive detected
    if fp_result["is_false_alert"]:
        severity = "LOW"
        escalation_level = "NO-ESCALATION"
    else:
        escalation_level = map_severity(severity)

    # Priority score
    priority = calculate_priority(results)

    # Engineer Lookup
    engineer = None
    if escalation_level != "NO-ESCALATION":
        for eng in engineers:
            eng_esc = getattr(eng, "escalation_level", None) or (eng.get("escalation_level") if isinstance(eng, dict) else None)
            if eng_esc == escalation_level:
                if not isinstance(eng, dict):
                    engineer = {
                        "name": eng.name,
                        "team": eng.team,
                        "email": eng.email,
                        "phone": eng.phone,
                        "escalation_level": eng.escalation_level
                    }
                else:
                    engineer = eng
                break
                
    if not engineer and escalation_level != "NO-ESCALATION" and engineers:
        first_eng = engineers[0]
        if not isinstance(first_eng, dict):
            engineer = {
                "name": first_eng.name,
                "team": first_eng.team,
                "email": first_eng.email,
                "phone": first_eng.phone,
                "escalation_level": first_eng.escalation_level
            }
        else:
            engineer = first_eng
            
    if not engineer:
        engineer = {"name": "N/A", "team": "N/A", "email": "N/A", "phone": "N/A", "escalation_level": "NO-ESCALATION"}

    return {
        "alert": alert,
        "matched_rules": results,
        "final_severity": severity,
        "risk_score": risk_score,
        "escalation_level": escalation_level,
        "engineer": engineer,
        "priority_score": priority,
        "fp_result": fp_result,
        "timestamp": datetime.now().isoformat(),
    }


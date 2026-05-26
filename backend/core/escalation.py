from backend.core.rule_engine import evaluate_condition

SEVERITY_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}


def map_severity(severity):
    if severity in ("CRITICAL", "HIGH"):
        return "SEV-1"
    elif severity == "MEDIUM":
        return "SEV-2"
    else:
        return "SEV-3"


def calculate_risk_score(alert):
    score = 0
    
    # Risk rules weight mapping based on TECHNICAL.md:
    if alert.get("requests_per_second", 0) > 10000:
        score += 30
    if alert.get("requests_per_second", 0) > 5000:
        score += 20
    if alert.get("network_latency", 0) > 1000:
        score += 20
    if alert.get("packet_loss", 0) > 20:
        score += 15
    if alert.get("status") == "under_attack":
        score += 25
    if alert.get("environment") == "production":
        score += 10
        
    return min(score, 120)


def calculate_dynamic_severity(risk_score):
    if risk_score >= 80:
        return "CRITICAL"
    elif risk_score >= 50:
        return "HIGH"
    elif risk_score >= 25:
        return "MEDIUM"
    else:
        return "LOW"


def get_rule_severity(results):
    if any(r["severity"] == "HIGH" for r in results):
        return "HIGH"
    elif any(r["severity"] == "MEDIUM" for r in results):
        return "MEDIUM"
    else:
        return "LOW"


def calculate_priority(results):
    if not results:
        return 0
    score = 0
    for r in results:
        if r["severity"] == "HIGH":
            score += 1
        elif r["severity"] == "MEDIUM":
            score += 2
        else:
            score += 3
    return score


def calculate_fp_confidence(alert, results):
    if len(results) == 0:
        return {"is_false_alert": True, "confidence": 90, "reasons": ["No rules matched"]}
        
    score = 0
    reasons = []
    
    for r in results:
        signals = r.get("false_positive_signals", [])
        for signal_cond in signals:
            if evaluate_condition(signal_cond, alert):
                score += 1
                reasons.append(signal_cond)
                
    if alert.get("status") == "healthy":
        score += 2
        reasons.append("System status is healthy")
        
    confidence = min(score * 20, 100)
    is_false = confidence >= 50
    
    return {
        "is_false_alert": is_false,
        "confidence": confidence,
        "reasons": reasons
    }


def sort_by_severity(results):
    return sorted(results, key=lambda r: SEVERITY_ORDER.get(r["severity"], 0), reverse=True)


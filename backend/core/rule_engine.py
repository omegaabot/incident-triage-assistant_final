def evaluate_condition(condition, alert_data):
    try:
        safe_data = {
            "healthy": "healthy",
            "degraded": "degraded",
            "production": "production",
            "staging": "staging",
            "under_attack": "under_attack",
            "investigating": "investigating"
        }
        for key, value in alert_data.items():
            safe_data[key] = value
        return eval(condition, {}, safe_data)
    except NameError:
        return False
    except Exception as e:
        print(f"Error evaluating condition: {condition} - {e}")
        return False


def apply_rules(alert_data, rules):
    matched_rules = []
    alert_type = alert_data.get("type")
    for rule in rules:
        if rule.get("type") != alert_type:
            continue
        condition = rule.get("condition", "")
        if evaluate_condition(condition, alert_data):
            matched_rules.append({
                "name": rule["name"],
                "type": rule["type"],
                "severity": rule["severity"],
                "message": rule["message"],
                "action": rule["action"],
                "checks": rule.get("checks", []),
                "checklist": rule.get("checklist", []),
                "false_positive_signals": rule.get("false_positive_signals", []),
            })
    return matched_rules


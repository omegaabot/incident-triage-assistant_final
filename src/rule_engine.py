import json

# Load rules from JSON file
def load_rules(file_path):
    with open(file_path, 'r') as f:
        data = json.load(f)
        return data["rules"]


# Safe condition evaluator
def evaluate_condition(condition, alert_data):

    try:
        # Create safe local dictionary
        safe_data = {}

        # Add alert fields safely
        for key, value in alert_data.items():
            safe_data[key] = value

        # Evaluate condition
        return eval(condition, {}, safe_data)

    except NameError:
        # Missing field
        return False

    except Exception as e:
        print(f"❌ Error evaluating condition: {condition}")
        print(f"Reason: {e}")
        return False


# Apply all matching rules
def apply_rules(alert_data, rules):

    matched_rules = []

    # Get alert type
    alert_type = alert_data.get("type")

    for rule in rules:

        # Skip unrelated rule types
        if rule.get("type") != alert_type:
            continue

        condition = rule["condition"]

        # Evaluate condition
        if evaluate_condition(condition, alert_data):

            matched_rules.append({
                "name": rule["name"],
                "type": rule["type"],
                "severity": rule["severity"],
                "message": rule["message"],
                "action": rule["action"]
            })

    return matched_rules
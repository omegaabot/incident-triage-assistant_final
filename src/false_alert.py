from colorama import Fore


# Detect false alerts
def is_false_alert(alert, results):

    # If no rules matched
    if len(results) == 0:
        return True

    # Healthy system check
    if alert.get("status") == "healthy":
        return True

    return False


# Print false alert message
def handle_false_alert(alert):

    print(Fore.GREEN + "\n✅ FALSE ALERT DETECTED")
    print(
        Fore.GREEN +
        f"Service '{alert.get('service')}' appears healthy"
    )

    print(
        Fore.GREEN +
        "No escalation or notification required\n"
    )
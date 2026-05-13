from colorama import Fore
from datetime import datetime


# ==========================================
# SEND EMAIL NOTIFICATION
# ==========================================

def send_email_notification(
    engineer,
    alert,
    severity
):

    timestamp = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    print(Fore.CYAN + "\n📧 EMAIL NOTIFICATION")
    print(Fore.CYAN + "=" * 50)

    print(f"To          : {engineer['email']}")
    print(f"Engineer    : {engineer['name']}")
    print(f"Team        : {engineer['team']}")
    print(f"Time        : {timestamp}")

    print(
        f"Subject     : [{severity}] Incident Alert - "
        f"{alert.get('service')}"
    )

    print("\n📩 Message:")

    print(
        f"""
Hello {engineer['name']},

A new incident has been detected.

Service  : {alert.get('service')}
Status   : {alert.get('status')}
Severity : {severity}

Please investigate the issue immediately.

Regards,
Incident Triage System
"""
    )

    print(
        Fore.GREEN +
        "\n✅ Notification sent successfully"
    )
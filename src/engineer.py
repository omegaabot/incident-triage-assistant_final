from colorama import Fore


# ==========================================
# GET ON-CALL ENGINEER
# ==========================================
def get_oncall_engineer(severity):

    if severity == "SEV-1":

        return {
            "name": "Ramesh",
            "team": "Senior SRE Team",
            "email": "ramesh.sre@company.com",
            "phone": "+91-9876543210"
        }

    elif severity == "SEV-2":

        return {
            "name": "Priya",
            "team": "Cloud Support Team",
            "email": "priya.support@company.com",
            "phone": "+91-9123456780"
        }

    else:

        return {
            "name": "Monitoring Team",
            "team": "NOC Team",
            "email": "noc@company.com",
            "phone": "+91-9000000000"
        }


# ==========================================
# NOTIFY ON-CALL ENGINEER
# ==========================================
def notify_oncall_engineer(
    engineer,
    escalation_level
):

    print(Fore.CYAN + "\n📞 ON-CALL ENGINEER NOTIFIED")
    print(Fore.CYAN + "=" * 50)

    print(
        f"Engineer Name  : {engineer['name']}"
    )

    print(
        f"Support Team   : {engineer['team']}"
    )

    print(
        f"Contact Email  : {engineer['email']}"
    )

    print(
        f"Phone Number   : {engineer['phone']}"
    )

    print(
        f"Escalation     : {escalation_level}"
    )

    print(
        Fore.GREEN +
        "\n✅ Engineer notification completed"
    )
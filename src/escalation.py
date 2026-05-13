from colorama import Fore


# ==========================================
# ESCALATION ENGINE
# ==========================================

def map_severity(severity):

    if severity == "HIGH":
        return "SEV-1"

    elif severity == "MEDIUM":
        return "SEV-2"

    else:
        return "SEV-3"


# ==========================================
# SHOW ESCALATION DETAILS
# ==========================================

def show_escalation_details(final_severity):

    sev_level = map_severity(final_severity)

    print(Fore.MAGENTA + "\n🚨 ESCALATION DETAILS")
    print(Fore.MAGENTA + "=" * 50)

    print(f"Escalation Level : {sev_level}")

    if sev_level == "SEV-1":

        print(
            Fore.RED +
            "\nCritical incident detected → Immediate response required"
        )

    elif sev_level == "SEV-2":

        print(
            Fore.YELLOW +
            "\nModerate incident detected → Quick investigation required"
        )

    else:

        print(
            Fore.GREEN +
            "\nLow priority incident → Monitoring recommended"
        )

    return sev_level
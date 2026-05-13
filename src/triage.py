import json
import os
import sys
from datetime import datetime
from colorama import Fore, Style, init

from rule_engine import load_rules, apply_rules
from escalation import map_severity

from engineer import (
    get_oncall_engineer,
    notify_oncall_engineer
)

from notification import send_email_notification

init(autoreset=True)


# ==========================================
# FINAL SEVERITY CALCULATION
# ==========================================
def get_final_severity(results):

    if any(r["severity"] == "HIGH" for r in results):
        return "HIGH"

    elif any(r["severity"] == "MEDIUM" for r in results):
        return "MEDIUM"

    else:
        return "LOW"


# ==========================================
# PRIORITY SCORE
# ==========================================
def calculate_priority(results):

    score = 0

    for r in results:

        if r["severity"] == "HIGH":
            score += 1

        elif r["severity"] == "MEDIUM":
            score += 2

        else:
            score += 3

    return score


# ==========================================
# FALSE POSITIVE DETECTION
# ==========================================
def detect_false_positive(alert, results):

    if len(results) == 0:
        return True

    if alert.get("status") == "healthy":
        return True

    return False


# ==========================================
# LOAD ALERT JSON
# ==========================================
def load_alert(file_path):

    with open(file_path, 'r') as f:
        return json.load(f)


# ==========================================
# LOAD RUNBOOK
# ==========================================
def load_runbook():

    runbook = {}
    current_section = None

    with open("../runbook/runbook.md", "r") as f:

        for line in f:

            line = line.strip()

            if line.startswith("##"):

                current_section = line.replace(
                    "##",
                    ""
                ).strip()

                runbook[current_section] = []

            elif line.startswith("-") and current_section:

                runbook[current_section].append(
                    line[1:].strip()
                )

    return runbook


# ==========================================
# GENERATE REPORT
# ==========================================
def generate_report(alert, results):

    severity = get_final_severity(results)

    escalation_level = map_severity(severity)

    engineer = get_oncall_engineer(
        escalation_level
    )

    priority = calculate_priority(results)

    timestamp = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    runbook = load_runbook()

    false_positive = detect_false_positive(
        alert,
        results
    )

    report_lines = []

    # ==========================================
    # HEADER
    # ==========================================
    report_lines.append("=" * 60)
    report_lines.append("🚨 INCIDENT TRIAGE REPORT 🚨")
    report_lines.append("=" * 60)

    # ==========================================
    # INCIDENT SUMMARY
    # ==========================================
    report_lines.append(f"Time              : {timestamp}")
    report_lines.append(f"Service           : {alert.get('service')}")
    report_lines.append(f"Type              : {alert.get('type')}")
    report_lines.append(f"Status            : {alert.get('status')}")
    report_lines.append(f"Final Severity    : {severity}")
    report_lines.append(f"Escalation Level  : {escalation_level}")
    report_lines.append(f"Priority Score    : {priority}")
    report_lines.append(f"Matched Incidents : {len(results)}")

    # ==========================================
    # FALSE POSITIVE
    # ==========================================
    report_lines.append("\n🛡 False Positive Detection:")

    if false_positive:

        report_lines.append(
            "Possible False Positive Alert"
        )

    else:

        report_lines.append(
            "Valid Security Incident"
        )

    # ==========================================
    # ON-CALL ENGINEER
    # ==========================================
    report_lines.append("\n📞 On-Call Engineer:")

    report_lines.append(
        f"Name              : {engineer['name']}"
    )

    report_lines.append(
        f"Team              : {engineer['team']}"
    )

    report_lines.append(
        f"Contact Email     : {engineer['email']}"
    )

    report_lines.append(
        f"Phone             : {engineer['phone']}"
    )

    # ==========================================
    # ISSUES FOUND
    # ==========================================
    report_lines.append("\n⚠ Issues Found:")

    if results:

        for r in results:

            report_lines.append(
                f"- [{r['severity']}] {r['message']}"
            )

    else:

        report_lines.append(
            "No issues detected"
        )

    # ==========================================
    # SUGGESTED ACTIONS
    # ==========================================
    report_lines.append("\n✅ Suggested Actions:")

    if results:

        for r in results:

            report_lines.append(
                f"- {r['action']}"
            )

    else:

        report_lines.append(
            "No action needed"
        )

    # ==========================================
    # RUNBOOK SUGGESTIONS
    # ==========================================
    report_lines.append(
        "\n📘 Runbook Suggestions:"
    )

    if results:

        for r in results:

            title = r["name"]

            if title in runbook:

                report_lines.append(
                    f"\n{title}:"
                )

                for step in runbook[title]:

                    report_lines.append(
                        f"   • {step}"
                    )

    else:

        report_lines.append(
            "No runbook actions needed"
        )

    # ==========================================
    # INCIDENT CHECKLIST
    # ==========================================
    report_lines.append(
        "\n📋 Incident Checklist:"
    )

    if results:

        for r in results:

            report_lines.append(
                f"[ ] {r['name']}"
            )

    else:

        report_lines.append(
            "[ ] System is healthy"
        )

    # ==========================================
    # FOOTER
    # ==========================================
    report_lines.append("\n" + "=" * 60)

    report_lines.append(
        "✅ TRIAGE PROCESS COMPLETED"
    )

    report_lines.append("=" * 60 + "\n")

    # ==========================================
    # CONSOLE OUTPUT
    # ==========================================
    for line in report_lines:

        if "INCIDENT TRIAGE REPORT" in line:

            print(
                Fore.RED +
                Style.BRIGHT +
                line
            )

        elif "Final Severity" in line:

            if severity == "HIGH":

                print(Fore.RED + line)

            elif severity == "MEDIUM":

                print(Fore.YELLOW + line)

            else:

                print(Fore.GREEN + line)

        elif "Escalation Level" in line:

            print(
                Fore.MAGENTA +
                Style.BRIGHT +
                line
            )

        elif "False Positive" in line:

            print(
                Fore.YELLOW +
                Style.BRIGHT +
                line
            )

        elif "On-Call Engineer" in line:

            print(
                Fore.CYAN +
                Style.BRIGHT +
                line
            )

        elif "Priority Score" in line:

            print(Fore.MAGENTA + line)

        elif "Issues Found" in line:

            print(
                Fore.RED +
                Style.BRIGHT +
                line
            )

        elif "Suggested Actions" in line:

            print(
                Fore.GREEN +
                Style.BRIGHT +
                line
            )

        elif "Runbook Suggestions" in line:

            print(
                Fore.BLUE +
                Style.BRIGHT +
                line
            )

        elif "Checklist" in line:

            print(
                Fore.CYAN +
                Style.BRIGHT +
                line
            )

        elif "TRIAGE PROCESS COMPLETED" in line:

            print(
                Fore.GREEN +
                Style.BRIGHT +
                line
            )

        else:

            print(line)

    # ==========================================
    # SAVE REPORT
    # ==========================================
    with open(
        "../output/reports.txt",
        "a",
        encoding="utf-8"
    ) as f:

        for line in report_lines:

            f.write(line + "\n")

    # ==========================================
    # EMAIL NOTIFICATION
    # ==========================================
    send_email_notification(
        engineer,
        alert,
        escalation_level
    )

    # ==========================================
    # NOTIFY ENGINEER
    # ==========================================
    notify_oncall_engineer(
        engineer,
        escalation_level
    )


# ==========================================
# PROCESS SINGLE ALERT FILE
# ==========================================
def process_single_file(alert_file, rules):

    try:

        print(Fore.CYAN + Style.BRIGHT)

        print("=" * 60)

        print("📂 Processing Single Alert")

        print("=" * 60)

        alert = load_alert(alert_file)

        results = apply_rules(alert, rules)

        generate_report(alert, results)

    except FileNotFoundError:

        print(
            Fore.RED +
            "❌ Alert file not found"
        )

    except Exception as e:

        print(
            Fore.RED +
            f"❌ Error: {e}"
        )


# ==========================================
# PROCESS ALL ALERT FILES
# ==========================================
def process_all_files(rules):

    data_folder = "../data/"

    files = os.listdir(data_folder)

    print(Fore.CYAN + Style.BRIGHT)

    print("=" * 60)

    print("📂 PROCESSING ALL ALERT FILES")

    print("=" * 60)

    for file in files:

        if file.endswith(".json"):

            print(
                Fore.BLUE +
                f"\n📄 Processing: {file}"
            )

            alert_path = os.path.join(
                data_folder,
                file
            )

            try:

                alert = load_alert(alert_path)

                results = apply_rules(alert, rules)

                generate_report(alert, results)

            except Exception as e:

                print(
                    Fore.RED +
                    f"❌ Error processing {file}"
                )

                print(f"Reason: {e}")


# ==========================================
# MAIN FUNCTION
# ==========================================
def main():

    rules = load_rules(
        "../rules/rules.json"
    )

    if len(sys.argv) < 2:

        print(
            Fore.RED +
            "❌ Please provide input"
        )

        print("\nUsage:")

        print("\n1️⃣ Run single alert:")

        print(
            "python triage.py ../data/ddos_attack.json"
        )

        print("\n2️⃣ Run all alerts:")

        print(
            "python triage.py all"
        )

        return

    user_input = sys.argv[1]

    if user_input.lower() == "all":

        process_all_files(rules)

    else:

        process_single_file(
            user_input,
            rules
        )


# ==========================================
# RUN APPLICATION
# ==========================================
if __name__ == "__main__":

    main()
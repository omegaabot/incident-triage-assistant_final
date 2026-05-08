import json
import os

from rule_engine import load_rules, apply_rules


# Load rules
rules = load_rules("../rules/rules.json")


# Folder containing all alert JSON files
data_folder = "../data/"


print("=" * 50)
print("🧪 INCIDENT TRIAGE TEST ENGINE")
print("=" * 50)


# Read all JSON files
files = os.listdir(data_folder)

for file in files:

    # Process only JSON files
    if file.endswith(".json"):

        print(f"\n📂 Testing Alert File: {file}")

        # Build full file path
        alert_path = os.path.join(data_folder, file)

        # Load alert JSON
        with open(alert_path, "r") as f:
            alert = json.load(f)

        # Apply rules
        results = apply_rules(alert, rules)

        # Show matched rules
        if results:
            print("✅ Matched Rules:")

            for r in results:
                print(f"   - {r['name']} ({r['severity']})")

        else:
            print("⚠ No rules matched")


print("\n" + "=" * 50)
print("✅ Testing Completed")
print("=" * 50)
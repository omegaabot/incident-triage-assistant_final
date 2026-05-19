# 🔬 TECHNICAL.md — Incident Triage Assistant Internals

> Deep-dive documentation covering every algorithm, calculation, data model, and decision in the system. This file is the source of truth for how the triage engine actually works.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Alert JSON Schema](#2-alert-json-schema)
3. [Rule Engine](#3-rule-engine)
4. [Risk Score Calculation](#4-risk-score-calculation)
5. [Severity Classification](#5-severity-classification)
6. [False Positive Detection](#6-false-positive-detection)
7. [Priority Score](#7-priority-score)
8. [Escalation Mapping](#8-escalation-mapping)
9. [On-Call Engineer Assignment](#9-on-call-engineer-assignment)
10. [Final Severity Resolution](#10-final-severity-resolution)
11. [Full Triage Pipeline (End-to-End)](#11-full-triage-pipeline-end-to-end)
12. [Rules Reference](#12-rules-reference)
13. [Risk Rules Reference](#13-risk-rules-reference)
14. [Webapp Architecture](#14-webapp-architecture-react--vite)
15. [Adding a New Rule](#15-adding-a-new-rule)

---

## 1. System Overview

The Incident Triage Assistant is a **deterministic, rule-based triage engine**. It does not use machine learning. Every decision is traceable to a specific rule, weight, or threshold — making it fully auditable and predictable in a production SOC environment.

The engine runs two independent analysis tracks and merges them:

```
                    ┌─────────────────────────────────────┐
                    │           Alert JSON Input           │
                    └──────────────────┬──────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                      │
          ┌─────────▼──────────┐              ┌───────────▼──────────┐
          │   Track A          │              │   Track B            │
          │   Rule Engine      │              │   Risk Score Engine  │
          │   (rules.json)     │              │   (risk_rules.json)  │
          │                    │              │                      │
          │  Type-filtered     │              │  Field-weight sum    │
          │  condition eval    │              │  across all fields   │
          └─────────┬──────────┘              └───────────┬──────────┘
                    │                                      │
          ┌─────────▼──────────┐              ┌───────────▼──────────┐
          │  Matched Rules     │              │  Risk Score (0–120)  │
          │  + Severity        │              │  → Dynamic Severity  │
          └─────────┬──────────┘              └───────────┬──────────┘
                    │                                      │
                    └──────────────────┬───────────────────┘
                                       │
                    ┌──────────────────▼──────────────────┐
                    │         Final Severity Resolution    │
                    │  (Dynamic wins if CRITICAL or HIGH)  │
                    └──────────────────┬──────────────────┘
                                       │
                    ┌──────────────────▼──────────────────┐
                    │       False Positive Detection       │
                    │  (signal scoring + heuristics)       │
                    └──────────────────┬──────────────────┘
                                       │
                    ┌──────────────────▼──────────────────┐
                    │        Escalation + Engineer         │
                    │     Checklist + Runbook + Report     │
                    └─────────────────────────────────────┘
```

---

## 2. Alert JSON Schema

### Required Fields

| Field | Type | Description |
|---|---|---|
| `type` | string | Alert category — must match a rule's `type` exactly |
| `service` | string | The affected service name |

### Common Optional Fields

| Field | Type | Used By Rules |
|---|---|---|
| `alert_id` | string | Displayed in report header |
| `timestamp` | ISO 8601 string | Displayed in report |
| `environment` | string | FP heuristic — dev/staging environments reduce confidence |
| `datacenter` | string | Informational |
| `source_system` | string | Informational |
| `description` | string | Displayed in report |
| `status` | string | FP heuristic — `"healthy"` suppresses alerts |

### Metric Fields (used in rule conditions)

| Field | Type | Relevant Alert Types |
|---|---|---|
| `cpu_usage` | number (%) | `system_monitoring` |
| `memory_usage` | number (%) | `system_monitoring` |
| `error_rate` | number (%) | `system_monitoring` |
| `response_time` | number (ms) | `system_monitoring`, `bruteforce_attack` |
| `requests_per_second` | number | `ddos_attack` |
| `network_latency` | number (ms) | `ddos_attack`, `network_latency` |
| `packet_loss` | number (%) | `ddos_attack`, `network_latency` |
| `failed_login_attempts` | number | `bruteforce_attack` |
| `blocked_ips` | number | `bruteforce_attack`, `port_scanning` |
| `intrusion_attempts` | number | `firewall_breach` |
| `malicious_packets_detected` | number | `firewall_breach` |
| `blocked_connections` | number | `firewall_breach` |
| `port_scan_attempts` | number | `port_scanning` |
| `suspicious_ip_count` | number | `port_scanning`, `unauthorized_access` |
| `unauthorized_access_attempts` | number | `unauthorized_access` |
| `bandwidth_usage` | number (Gbps) | `ddos_attack` |

---

## 3. Rule Engine

**Source:** `src/rule_engine.py` · **JS Port:** `webapp/src/triageEngine.js → applyRules()`

### How It Works

```python
def apply_rules(alert_data, rules):
    alert_type = alert_data.get("type")
    matched = []

    for rule in rules:
        if rule.get("type") != alert_type:
            continue                          # Skip rules for other alert types

        if evaluate_condition(rule["condition"], alert_data):
            matched.append({ ...rule fields... })

    return matched
```

**Step 1 — Type Filter:** Only rules whose `type` field exactly matches the alert's `type` are evaluated. This prevents irrelevant rules from firing.

**Step 2 — Condition Evaluation:**

```python
def evaluate_condition(condition: str, alert_data: dict) -> bool:
    try:
        return bool(eval(condition, {}, dict(alert_data)))
    except NameError:
        return False
```

The condition string (e.g. `"cpu_usage > 90"`) is evaluated using Python's `eval()` in a sandboxed scope where only the alert's own fields are available as variables. Missing fields return `False` (safe default, no crash).

**Step 3 — Message Interpolation:** The rule's `message` field supports `{field_name}` placeholders:

```python
def interpolate(template: str, alert_data: dict) -> str:
    def replacer(match):
        key = match.group(1)
        return str(alert_data.get(key, f"{{{key}}}"))
    return re.sub(r"\{(\w+)\}", replacer, template)
```

Example: `"CPU usage is critically high ({cpu_usage}%)"` → `"CPU usage is critically high (92%)"`

### Output Structure (per matched rule)

```python
{
    "name":                   "High CPU Usage",
    "type":                   "system_monitoring",
    "severity":               "HIGH",
    "message":                "CPU usage is critically high (92%)",
    "action":                 "Restart service or scale infrastructure",
    "checks":                 [...],   # 5 investigation questions
    "checklist":              [...],   # 6 resolution steps
    "false_positive_signals": [...]    # signal definitions for FP scoring
}
```

### Multiple Rule Matches

A single alert can match **multiple rules** simultaneously. For example, a system degradation alert with `cpu_usage: 92`, `error_rate: 60`, `response_time: 1200`, `memory_usage: 85` matches **4 rules at once**:

1. High CPU Usage
2. High Error Rate
3. Slow Response
4. High Memory Usage

All 4 are returned, and their checklists are merged into the triage output.

---

## 4. Risk Score Calculation

**Source:** `src/risk_engine.py` · **JS Port:** `webapp/src/triageEngine.js → calculateRiskScore()`

The risk score is a **weighted additive model** computed independently of the rule engine. It looks at specific high-signal fields and sums up weights for every field that crosses its threshold.

### Algorithm

```python
def calculate_risk_score(alert):
    rules = load_risk_rules()   # from rules/risk_rules.json
    score = 0

    for rule in rules:
        field    = rule["field"]
        operator = rule["operator"]
        value    = rule["value"]
        weight   = rule["weight"]

        alert_value = alert.get(field)
        if alert_value is None:
            continue

        if evaluate_condition(alert_value, operator, value):
            score += weight

    return score
```

### Risk Rules Table (`rules/risk_rules.json`)

| Field | Operator | Threshold | Weight | Rationale |
|---|---|---|---|---|
| `requests_per_second` | `>` | 10,000 | **+30** | Extreme traffic — strong DDoS signal |
| `requests_per_second` | `>` | 5,000 | **+20** | Elevated traffic — moderate DDoS signal |
| `network_latency` | `>` | 1,000 ms | **+20** | Severe latency — pipeline likely saturated |
| `packet_loss` | `>` | 20% | **+15** | Significant packet drop — network under stress |
| `status` | `==` | `"under_attack"` | **+25** | Explicit attack status — high confidence signal |
| `environment` | `==` | `"production"` | **+10** | Production incidents carry higher inherent risk |

### Maximum Possible Score

The rules are additive and can stack. Theoretical maximum with all rules triggered simultaneously:

```
30 + 20 + 20 + 15 + 25 + 10 = 120
```

> **Note:** The `requests_per_second > 10000` and `> 5000` rules can both fire on the same alert. An alert with `requests_per_second: 15000` would score `+30 + +20 = +50` from that field alone.

### Worked Example — DDoS Alert

```json
{
  "requests_per_second": 25000,
  "network_latency": 1200,
  "packet_loss": 40,
  "status": "under_attack",
  "environment": "production"
}
```

| Rule | Matches? | Weight |
|---|---|---|
| `requests_per_second > 10000` | ✅ 25000 > 10000 | +30 |
| `requests_per_second > 5000` | ✅ 25000 > 5000 | +20 |
| `network_latency > 1000` | ✅ 1200 > 1000 | +20 |
| `packet_loss > 20` | ✅ 40 > 20 | +15 |
| `status == "under_attack"` | ✅ | +25 |
| `environment == "production"` | ✅ | +10 |

**Total Risk Score: 120 → CRITICAL**

---

## 5. Severity Classification

**Source:** `src/severity.py` · **JS Port:** `webapp/src/triageEngine.js → calculateSeverity()`

The dynamic severity is derived from the risk score using fixed thresholds:

```python
def calculate_severity(alert):
    score = calculate_risk_score(alert)

    if score >= 80:
        return "CRITICAL", score
    elif score >= 50:
        return "HIGH", score
    elif score >= 25:
        return "MEDIUM", score
    else:
        return "LOW", score
```

### Severity Thresholds

| Score Range | Dynamic Severity | Meaning |
|---|---|---|
| 80 – 120 | **CRITICAL** | Multiple high-signal fields breached simultaneously |
| 50 – 79 | **HIGH** | Significant breach — immediate action required |
| 25 – 49 | **MEDIUM** | Elevated concern — investigation needed |
| 0 – 24 | **LOW** | Minimal risk signal — likely noise or benign |

### Worked Example — System Degradation Alert

```json
{ "cpu_usage": 92, "memory_usage": 85, "error_rate": 60,
  "response_time": 1200, "environment": "production", "status": "degraded" }
```

None of the risk fields (`requests_per_second`, `network_latency`, `packet_loss`, `status == "under_attack"`) match for a system monitoring alert.

Only `environment == "production"` → **+10**

**Risk Score: 10 → Dynamic Severity: LOW**

But the Rule Engine matches 4 rules (all HIGH or MEDIUM). See [Section 10](#10-final-severity-resolution) for how these are merged.

---

## 6. False Positive Detection

**Source:** `src/false_alert.py` · **JS Port:** `webapp/src/triageEngine.js → detectFalseAlert()`

This is the most nuanced part of the engine. It uses a **signal-based confidence scoring model** to determine whether a triggered alert is likely noise.

### Algorithm

```python
def is_false_alert(alert, results):
    reasons = []
    score = 0

    # Hard case: no rules matched at all
    if len(results) == 0:
        return {"is_false_alert": True, "confidence": 90,
                "reasons": ["No rule matched"]}

    # Check rule-specific false positive signals
    for r in results:
        signals = r.get("false_positive_signals", [])
        for signal in signals:
            field    = signal.get("field")
            operator = signal.get("operator")
            value    = signal.get("value")

            alert_value = alert.get(field)
            if alert_value is None:
                continue

            if evaluate_condition(alert_value, operator, value):
                score += 1
                reasons.append(f"{field} {operator} {value}")

    # Heuristic: healthy status is a strong suppression signal
    if alert.get("status") == "healthy":
        score += 2
        reasons.append("System status is healthy")

    # Convert signal count to confidence percentage
    confidence = min(score * 20, 100)
    is_false   = confidence >= 50

    return {"is_false_alert": is_false, "confidence": confidence,
            "reasons": reasons}
```

### Scoring Model

| Signal Source | Points Added | Confidence Added |
|---|---|---|
| Each passing `false_positive_signal` condition | +1 | +20% |
| `status == "healthy"` heuristic | +2 | +40% |
| No rules matched at all | — | Fixed 90% |

**Decision Threshold:** `confidence >= 50%` → `is_false_alert = True`

This means:
- **1 signal** passing → 20% → Not a false positive
- **2 signals** passing → 40% → Not a false positive
- **3 signals** passing → 60% → **False Positive ✅**
- **`status == "healthy"`** alone → 40% → Not suppressed (needs one more signal)
- **`status == "healthy"` + 1 signal** → 60% → **False Positive ✅**

### What Are False Positive Signals?

Each rule in `rules.json` ships with its own `false_positive_signals` — soft conditions that, alone, don't disprove an incident but are suspicious indicators of noise.

**Brute Force Attack example:**

| Signal | Meaning |
|---|---|
| `failed_login_attempts < 250` | Only barely above the 200 threshold — marginal, could be noise |
| `blocked_ips > 40` | Most attackers are already blocked — attack likely contained |
| `response_time < 300` | Auth service isn't struggling — attack isn't impactful |

**Worked Example — False Positive Test Alert:**

```json
{
  "type": "bruteforce_attack",
  "failed_login_attempts": 220,
  "blocked_ips": 45,
  "response_time": 250,
  "status": "healthy"
}
```

| Signal | Passes? | Score |
|---|---|---|
| `failed_login_attempts < 250` | ✅ 220 < 250 | +1 |
| `blocked_ips > 40` | ✅ 45 > 40 | +1 |
| `response_time < 300` | ✅ 250 < 300 | +1 |
| `status == "healthy"` heuristic | ✅ | +2 |

**Total Score: 5 → Confidence: 100% → FALSE POSITIVE ✅**

Result: Severity overridden to LOW, escalation set to `NO-ESCALATION`, no engineer paged.

---

## 7. Priority Score

**Source:** `src/triage.py → calculate_priority()` · **JS Port:** `webapp/src/triageEngine.js → calcPriorityScore()`

The priority score is a **secondary triage signal** that indicates how many high-severity issues were found. Lower score = higher urgency (like golf scoring).

```python
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
```

| Matched Severity | Points |
|---|---|
| HIGH | +1 (most urgent) |
| MEDIUM | +2 |
| LOW | +3 (least urgent) |

**Example:** System degradation alert matches 2 HIGH rules + 2 MEDIUM rules:
- `2 × 1 (HIGH) + 2 × 2 (MEDIUM) = 2 + 4 = 6`

A priority score of **6** means multiple rules matched but they include both high and medium severity findings.

A priority score of **2** (two HIGH rules, nothing else) would indicate a more focused, severe incident.

> Priority is informational — it does not affect escalation. It helps analysts quickly gauge the "density" of issues in a multi-rule alert.

---

## 8. Escalation Mapping

**Source:** `src/escalation.py` · **JS Port:** `webapp/src/triageEngine.js → mapSeverityToEscalation()`

Maps the final computed severity to an incident escalation tier:

```python
def map_severity(severity: str) -> str:
    if severity in ("CRITICAL", "HIGH"):
        return "SEV-1"
    elif severity == "MEDIUM":
        return "SEV-2"
    else:
        return "SEV-3"
```

| Final Severity | Escalation Level | Response Expectation |
|---|---|---|
| CRITICAL | SEV-1 | Immediate — wake senior SRE |
| HIGH | SEV-1 | Immediate — wake senior SRE |
| MEDIUM | SEV-2 | Urgent — notify cloud support within 15 min |
| LOW | SEV-3 | Non-urgent — NOC team monitors |
| (False Positive) | NO-ESCALATION | Suppressed — no engineer contacted |

---

## 9. On-Call Engineer Assignment

**Source:** `src/engineer.py` · **Config:** `config/engineers.json`

The on-call lookup is a simple deterministic mapping based on escalation level:

```python
def get_oncall_engineer(severity: str) -> dict:
    if severity == "SEV-1":
        return {"name": "Ramesh", "team": "Senior SRE Team",
                "email": "ramesh.sre@company.com", "phone": "+91-9876543210"}
    elif severity == "SEV-2":
        return {"name": "Priya", "team": "Cloud Support Team",
                "email": "priya.support@company.com", "phone": "+91-9123456780"}
    else:
        return {"name": "Monitoring Team", "team": "NOC Team",
                "email": "noc@company.com", "phone": "+91-9000000000"}
```

| Escalation | Engineer | Team |
|---|---|---|
| SEV-1 | Ramesh | Senior SRE Team |
| SEV-2 | Priya | Cloud Support Team |
| SEV-3 | Monitoring Team | NOC Team |
| NO-ESCALATION | N/A | — |

If an alert is marked as a false positive, the engineer fields are set to `"N/A"` and no notification is dispatched.

---

## 10. Final Severity Resolution

**Source:** `src/triage.py → generate_report()` · **JS Port:** `webapp/src/triageEngine.js → triageAlert()`

Two independent severity values are produced:
- **Dynamic Severity** — from the risk score engine (Track B)
- **Rule Severity** — the highest severity among all matched rules (Track A)

They are merged with this rule:

```python
# Dynamic (risk score) severity wins if it's CRITICAL or HIGH
severity = dynamic_severity if dynamic_severity in ["CRITICAL", "HIGH"] else rule_severity
```

### Decision Logic

| Dynamic Severity | Rule Severity | Final Severity |
|---|---|---|
| CRITICAL | any | **CRITICAL** |
| HIGH | any | **HIGH** |
| MEDIUM | HIGH | **HIGH** (rule wins) |
| MEDIUM | MEDIUM | **MEDIUM** |
| LOW | HIGH | **HIGH** (rule wins) |
| LOW | MEDIUM | **MEDIUM** (rule wins) |
| LOW | LOW | **LOW** |

**Rationale:** The risk engine catches threats the rule engine might underweight (e.g. a DDoS with many stacked risk signals). The rule engine catches domain-specific threats (e.g. brute force) that may not score high on generic risk metrics. The merge takes the worst-case view.

### Post-Resolution: False Positive Override

If the FP engine marks the alert as a false positive after severity is resolved, the final severity is **forcibly overridden to LOW** regardless of what the risk or rule engines computed:

```python
if fp_result["is_false_alert"]:
    severity = "LOW"
    escalation_level = "NO-ESCALATION"
```

---

## 11. Full Triage Pipeline (End-to-End)

```
Input: alert JSON dict
        │
        ├─── 1. apply_rules(alert, rules)
        │         Filter by alert["type"]
        │         Evaluate each rule's condition string
        │         Return: matched_rules[]
        │
        ├─── 2. calculate_risk_score(alert)
        │         Iterate risk_rules.json
        │         Sum weights for passing conditions
        │         Return: risk_score (int, 0–120)
        │
        ├─── 3. calculate_severity(risk_score)
        │         ≥80 → CRITICAL
        │         ≥50 → HIGH
        │         ≥25 → MEDIUM
        │         <25  → LOW
        │         Return: dynamic_severity
        │
        ├─── 4. get_rule_severity(matched_rules)
        │         If any rule is HIGH → HIGH
        │         Elif any rule is MEDIUM → MEDIUM
        │         Else → LOW
        │         Return: rule_severity
        │
        ├─── 5. Final severity merge
        │         dynamic in [CRITICAL, HIGH] → use dynamic
        │         else → use rule_severity
        │         Return: final_severity
        │
        ├─── 6. is_false_alert(alert, matched_rules)
        │         Check each rule's false_positive_signals
        │         Add heuristic (status == "healthy")
        │         confidence = min(score * 20, 100)
        │         is_false_alert = confidence >= 50
        │         Return: {is_false_alert, confidence, reasons}
        │
        ├─── 7. If false positive:
        │         final_severity = "LOW"
        │         escalation_level = "NO-ESCALATION"
        │         engineer = N/A
        │
        ├─── 8. Else:
        │         escalation_level = map_severity(final_severity)
        │         engineer = get_oncall_engineer(escalation_level)
        │
        ├─── 9. calculate_priority(matched_rules)
        │         Sum: HIGH=1, MEDIUM=2, LOW=3 per rule
        │         Return: priority_score
        │
        └─── 10. Build report
                  { alert, matched_rules, final_severity, risk_score,
                    escalation_level, engineer, priority_score,
                    fp_result, timestamp }

Output: Triage Report dict
```

---

## 12. Rules Reference

Complete listing of all 10 rules in `rules/rules.json`:

| # | Name | Type | Condition | Severity | Checks | Checklist Items |
|---|---|---|---|---|---|---|
| 1 | High CPU Usage | `system_monitoring` | `cpu_usage > 90` | HIGH | 5 | 6 |
| 2 | High Error Rate | `system_monitoring` | `error_rate > 50` | HIGH | 5 | 6 |
| 3 | Slow Response | `system_monitoring` | `response_time > 1000` | MEDIUM | 5 | 6 |
| 4 | High Memory Usage | `system_monitoring` | `memory_usage > 80` | MEDIUM | 5 | 6 |
| 5 | Brute Force Attack | `bruteforce_attack` | `failed_login_attempts > 200` | HIGH | 5 | 7 |
| 6 | DDoS Attack | `ddos_attack` | `requests_per_second > 10000` | HIGH | 5 | 7 |
| 7 | Firewall Breach | `firewall_breach` | `intrusion_attempts > 50` | HIGH | 5 | 7 |
| 8 | Port Scanning Activity | `port_scanning` | `port_scan_attempts > 100` | MEDIUM | 5 | 6 |
| 9 | Unauthorized Access | `unauthorized_access` | `unauthorized_access_attempts > 50` | HIGH | 5 | 7 |
| 10 | High Network Latency | `network_latency` | `network_latency > 500` | MEDIUM | 5 | 6 |

### False Positive Signals per Rule

| Rule | FP Signal 1 | FP Signal 2 | FP Signal 3 |
|---|---|---|---|
| High CPU Usage | `cpu_usage < 95` | `status == "healthy"` | `error_rate < 10` |
| High Error Rate | `error_rate < 60` | `status == "healthy"` | `response_time < 500` |
| Slow Response | `response_time < 1200` | `error_rate < 5` | `cpu_usage < 50` |
| High Memory Usage | `memory_usage < 85` | `status == "healthy"` | `cpu_usage < 40` |
| Brute Force Attack | `failed_login_attempts < 250` | `blocked_ips > 40` | `response_time < 300` |
| DDoS Attack | `requests_per_second < 15000` | `packet_loss < 10` | `network_latency < 500` |
| Firewall Breach | `intrusion_attempts < 75` | `malicious_packets_detected < 500` | `blocked_connections > 450` |
| Port Scanning | `port_scan_attempts < 200` | `blocked_ips > 15` | `suspicious_ip_count < 10` |
| Unauthorized Access | `unauthorized_access_attempts < 75` | `failed_login_attempts < 100` | `suspicious_ip_count < 5` |
| High Network Latency | `network_latency < 700` | `packet_loss < 5` | — |

---

## 13. Risk Rules Reference

Complete listing of `rules/risk_rules.json`:

| Field | Operator | Threshold | Weight | Notes |
|---|---|---|---|---|
| `requests_per_second` | `>` | 10,000 | 30 | Critical DDoS signal |
| `requests_per_second` | `>` | 5,000 | 20 | Elevated traffic — can stack with the above |
| `network_latency` | `>` | 1,000 ms | 20 | Severe latency |
| `packet_loss` | `>` | 20% | 15 | Network stress |
| `status` | `==` | `"under_attack"` | 25 | Explicit attack declaration |
| `environment` | `==` | `"production"` | 10 | Production risk multiplier |

**Maximum risk score:** 120 (all 6 rules firing simultaneously)

**Severity thresholds against this score:**
```
0   ──── 25 ──── 50 ──── 80 ──── 120
│   LOW  │  MED  │  HIGH │ CRIT  │
```

---

## 14. Webapp Architecture (React + Vite)

The React webapp is a **completely standalone implementation** that mirrors all Python logic in JavaScript. No backend server is required.

### Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | React 18 | Component-based, hooks for state |
| Build Tool | Vite | Sub-second HMR, fast cold start |
| Styling | Vanilla CSS | Full control, no utility-class bloat |
| State | React `useState` / `useCallback` | No external state library needed |
| Routing | Manual page state in `App.jsx` | No router needed for 5 pages |
| Logic | Inline JS in `triageEngine.js` | Direct port of Python algorithms |

### Python → JavaScript Mapping

| Python Module | JS Function / Structure | Location |
|---|---|---|
| `rule_engine.py :: apply_rules()` | `applyRules(alert)` | `triageEngine.js` |
| `rule_engine.py :: evaluate_condition()` | `evalOp(fieldVal, op, ruleVal)` | `triageEngine.js` |
| `rule_engine.py :: interpolate()` | Template literals in rule objects | `triageEngine.js` |
| `severity.py :: calculate_severity()` | `calculateSeverity(alert)` | `triageEngine.js` |
| `risk_engine.py :: calculate_risk_score()` | `calculateRiskScore(alert)` | `triageEngine.js` |
| `false_alert.py :: is_false_alert()` | `detectFalseAlert(alert, matchedRules)` | `triageEngine.js` |
| `escalation.py :: map_severity()` | `mapSeverityToEscalation(severity)` | `triageEngine.js` |
| `engineer.py :: get_oncall_engineer()` | `ENGINEERS[escalationLevel]` lookup | `triageEngine.js` |
| `triage.py :: calculate_priority()` | `calcPriorityScore(matchedRules)` | `triageEngine.js` |
| `triage.py :: generate_report()` | `triageAlert(alert)` | `triageEngine.js` |
| `rules/rules.json` | `RULES[]` array (inline) | `triageEngine.js` |
| `rules/risk_rules.json` | `RISK_RULES[]` array (inline) | `triageEngine.js` |

### Key Difference: Rule Conditions

In Python, rule conditions are strings evaluated with `eval()`:
```python
"condition": "cpu_usage > 90"
eval("cpu_usage > 90", {}, {"cpu_usage": 92})  # True
```

In JavaScript, they are compiled arrow functions for safety and performance:
```js
condition: (a) => a.cpu_usage > 90
```

This eliminates any eval security concern in the browser environment while keeping identical logic.

### Component Tree

```
App.jsx
├── Sidebar.jsx              # Navigation, live status, collapse toggle
└── [active page]
    ├── Dashboard.jsx        # Stats, alert feed, severity distribution
    ├── TriagePage.jsx       # JSON editor + sample selector + report
    │   └── TriageReport.jsx # Tabbed: Overview, Issues, Checklist, On-Call
    │       └── SeverityBadge.jsx
    ├── PlaybookPage.jsx     # Searchable runbook viewer
    ├── RulesPage.jsx        # Expandable rule cards
    └── HistoryPage.jsx      # Past sessions list + report viewer
```

### State Flow

```
App.jsx
  triageHistory[]   ← addToHistory(result) called from TriagePage
  activePage        ← navigateTo(page) called from any page
        │
        ▼
TriagePage
  jsonInput         ← user edits textarea
  selectedSample    ← user clicks sample button
  result            ← set after triageAlert(alert) runs
        │
        ▼
triageEngine.js :: triageAlert(alertJSON)
  → returns full result object
  → result is passed to TriageReport as prop
  → also pushed to triageHistory via addToHistory()
```

### Design System (Sentinel Interface)

Sourced from the Stitch MCP project "TriageAI Incident Assistant":

| Token | Value | Usage |
|---|---|---|
| `--surface` | `#131314` | Page background |
| `--surface-container-low` | `#1c1b1c` | Card backgrounds |
| `--cyber-blue` | `#3b82f6` | Primary actions, active states |
| `--critical` | `#ff4757` | CRITICAL severity |
| `--high` | `#ff6b35` | HIGH severity |
| `--medium` | `#ffa502` | MEDIUM severity |
| `--low` | `#2ed573` | LOW / success states |
| `--font-sans` | Inter | All UI text |
| `--font-mono` | JetBrains Mono | IDs, logs, code |
| `--radius-md` | `12px` | Card border radius |

---

## 15. Adding a New Rule

Follow these steps to add a new incident type end-to-end:

### Step 1 — Define the rule in `rules/rules.json`

```json
{
  "name": "Database Connection Exhaustion",
  "type": "database_alert",
  "condition": "active_connections > 500",
  "severity": "HIGH",
  "message": "Database connection pool exhausted ({active_connections} active connections)",
  "action": "Scale connection pool or restart database proxy",
  "checks": [
    "Check which application is holding open the most connections",
    "Verify if connection pool size is configured correctly",
    "Look for long-running queries blocking connection release",
    "Check if a recent deployment changed connection pooling config",
    "Verify if the database is under heavy write load"
  ],
  "checklist": [
    "Identify the top connection-holding application via pg_stat_activity",
    "Kill stale/idle connections if safe to do so",
    "Increase max_connections in database config as emergency measure",
    "Add connection pool middleware (PgBouncer) if not already present",
    "Set connection timeout limits to prevent indefinite blocking"
  ],
  "false_positive_signals": [
    { "field": "active_connections", "operator": "<", "value": 600 },
    { "field": "status", "operator": "==", "value": "healthy" },
    { "field": "query_latency_ms", "operator": "<", "value": 100 }
  ]
}
```

### Step 2 — Add a runbook section in `runbook/runbook.md`

The `## Heading` **must exactly match** the rule's `name` field:

```markdown
## Database Connection Exhaustion

**Trigger:** `active_connections > 500`
**Severity:** HIGH
**Escalation:** SEV-1

### Immediate Steps
- Identify connection-holding applications
- Kill idle connections
- Scale connection pool

### Diagnostic Commands
```bash
SELECT pid, usename, application_name, state, query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;
```

### Resolution Checklist
- [ ] Identify top connection-holding process
- [ ] Kill stale connections
- [ ] Increase max_connections limit
```

### Step 3 — Add a sample alert JSON in `data/`

```json
{
  "alert_id": "INC-9001-DB",
  "timestamp": "2026-05-20T08:00:00Z",
  "environment": "production",
  "source_system": "Datadog",
  "description": "Database connection pool is exhausted on the main PostgreSQL cluster.",
  "type": "database_alert",
  "service": "postgres-primary",
  "status": "degraded",
  "active_connections": 520,
  "query_latency_ms": 450
}
```

### Step 4 — Update `webapp/src/triageEngine.js`

Add the rule to the `RULES[]` array using the same structure:

```js
{
  name: "Database Connection Exhaustion",
  type: "database_alert",
  condition: (a) => a.active_connections > 500,
  severity: "HIGH",
  message: (a) => `Database connection pool exhausted (${a.active_connections} active connections)`,
  action: "Scale connection pool or restart database proxy",
  checks: [ "..." ],
  checklist: [ "..." ],
  false_positive_signals: [
    { field: "active_connections", op: "<", value: 600 },
    { field: "status", op: "==", value: "healthy" },
    { field: "query_latency_ms", op: "<", value: 100 },
  ],
},
```

### Step 5 — Document in `SCENARIOS.md`

Add a new scenario section with the alert payload, expected triage output, and suggested actions.

---

*Last updated: 2026-05-20 · Maintained by: Senior SRE Team*

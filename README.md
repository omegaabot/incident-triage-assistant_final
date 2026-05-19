# 🛡️ TriageAI – Incident Triage Assistant (Webapp)

> *Because the last thing you want at 3am is to stare at a wall of alerts wondering "is this real or not?"*

A smart, rule-based incident triage webapp built with **React + Vite**. Paste a raw JSON alert payload, and it instantly classifies severity, runs false positive detection, generates diagnostic checklists, and tells you exactly who to wake up — all running entirely in the browser, no backend needed.

---

## 🚀 Quick Start

```bash
npm install
npm run dev
# Open http://localhost:5173/
```

To build for production:
```bash
npm run build
# Serve the dist/ folder with any static host
```

---

## ✨ Features

| Feature | What it does |
|---|---|
| 🔍 **Rules Engine** | 10 rules across security and system monitoring alert types |
| 🧠 **False Positive Detection** | Confidence-scored suppression engine (0–100%) |
| 📋 **Interactive Checklists** | Click-to-check resolution steps per incident type |
| 🔎 **Diagnostic Checks** | Specific investigation steps per alert type |
| 🚨 **Severity + Escalation** | CRITICAL / HIGH / MEDIUM / LOW → SEV-1/2/3 |
| 📘 **Playbook Viewer** | Full runbooks with bash commands per incident type |
| ⚙️ **Rules Browser** | Browse all 10 rules, conditions, and FP signals |
| 🕐 **Triage History** | Session history with full report recall |
| 🌑 **Sentinel Dark UI** | Precision-built dark interface for SOC environments |

---

## 🗂️ Pages

| Page | Description |
|---|---|
| **Dashboard** | Live alert feed, severity distribution, stat cards, quick actions |
| **Triage Alert** | JSON editor + 8 sample scenarios → full tabbed triage report |
| **Playbook** | Searchable runbook viewer with bash commands and resolution steps |
| **Rules Engine** | Expandable rule cards with conditions and false positive signals |
| **History** | Searchable past triage sessions with full report viewer |

---

## ⚙️ How the Triage Engine Works

All logic runs in `src/triageEngine.js` — a complete JavaScript port of the Python backend.

```
Alert JSON
    │
    ├─ Rule Engine        → Match rules by type + condition
    ├─ Risk Score Engine  → Weighted field scoring (0–120)
    ├─ Severity Calc      → CRITICAL(≥80) / HIGH(≥50) / MEDIUM(≥25) / LOW
    ├─ FP Detection       → Signal scoring, ≥50% confidence = False Positive
    ├─ Escalation         → SEV-1 / SEV-2 / SEV-3 / NO-ESCALATION
    └─ On-Call Lookup     → Engineer assigned by escalation tier
```

> For the full mathematical breakdown of every algorithm, see **[TECHNICAL.md](TECHNICAL.md)**.

---

## 🚨 Supported Alert Types

| Alert Type | `type` field | Trigger |
|---|---|---|
| High CPU Usage | `system_monitoring` | `cpu_usage > 90` |
| High Error Rate | `system_monitoring` | `error_rate > 50` |
| Slow Response | `system_monitoring` | `response_time > 1000` |
| High Memory Usage | `system_monitoring` | `memory_usage > 80` |
| Brute Force Attack | `bruteforce_attack` | `failed_login_attempts > 200` |
| DDoS Attack | `ddos_attack` | `requests_per_second > 10000` |
| Firewall Breach | `firewall_breach` | `intrusion_attempts > 50` |
| Port Scanning | `port_scanning` | `port_scan_attempts > 100` |
| Unauthorized Access | `unauthorized_access` | `unauthorized_access_attempts > 50` |
| High Network Latency | `network_latency` | `network_latency > 500` |

---

## 📋 Sample Alert JSON Format

```json
{
  "alert_id":      "INC-0001-XYZ",
  "timestamp":     "2026-05-17T10:00:00Z",
  "environment":   "production",
  "datacenter":    "us-east-1",
  "source_system": "Prometheus",
  "description":   "Payment API experiencing resource exhaustion",
  "type":          "system_monitoring",
  "service":       "payment-api",
  "status":        "degraded",
  "cpu_usage":     92,
  "error_rate":    60,
  "response_time": 1200
}
```

`type` and `service` are required. All other fields are optional.

---

## 🏗️ Project Structure

```
src/
├── triageEngine.js       # All triage logic (rules, risk score, FP detection, severity)
├── App.jsx               # Root component, page routing, history state
├── index.css             # Sentinel Interface design system (CSS variables)
├── components/
│   ├── Sidebar.jsx       # Collapsible navigation
│   ├── SeverityBadge.jsx # Color-coded severity chips
│   ├── StatCard.jsx      # Dashboard metric cards
│   └── TriageReport.jsx  # Tabbed output: Overview, Issues, Checklist, On-Call
└── pages/
    ├── Dashboard.jsx     # Live feed + stats + quick actions
    ├── TriagePage.jsx    # Main analyzer with JSON editor
    ├── PlaybookPage.jsx  # Runbook viewer per incident type
    ├── RulesPage.jsx     # Browse all 10 rules
    └── HistoryPage.jsx   # Past triage sessions
```

---

## 📞 On-Call Escalation

| SEV Level | Triggered by | Engineer |
|---|---|---|
| SEV-1 | CRITICAL / HIGH | Ramesh — Senior SRE Team |
| SEV-2 | MEDIUM | Priya — Cloud Support Team |
| SEV-3 | LOW | NOC Monitoring Team |
| NO-ESCALATION | False Positive | — (suppressed) |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 |
| Build Tool | Vite |
| Styling | Vanilla CSS (Sentinel Interface design system) |
| Logic | Pure JavaScript (no external dependencies) |
| Fonts | Inter + JetBrains Mono (Google Fonts) |

---

## 📖 Documentation

- **[TECHNICAL.md](TECHNICAL.md)** — Full algorithm internals: risk scoring, severity thresholds, FP detection math, Python→JS mapping, adding new rules
- **[SCENARIOS.md](SCENARIOS.md)** — 7 documented test scenarios with expected triage outputs

---

*Built with React, Vite, and the Sentinel Interface design system · Part of the TriageAI project*

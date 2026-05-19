# 🛡️ TriageAI — Incident Triage Assistant

> *Your first-line analyst that never sleeps.*

A fully browser-based incident triage webapp built with **React 19 + Vite 8**. Drop in a raw JSON alert payload and get back an instant severity classification, false positive verdict, on-call engineer assignment, and a step-by-step resolution checklist — all running entirely client-side with zero backend required.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

---

## 📸 What You'll See

| Page | Description |
|---|---|
| **Dashboard** | Live alert feed, severity distribution bars, stat cards, quick-action buttons |
| **Triage Alert** | Paste JSON or pick a sample → run analysis → get a tabbed report |
| **Playbook** | Searchable runbook per incident type with bash commands and resolution steps |
| **Rules Engine** | Browse all 10 rules, trigger conditions, and false positive signal definitions |
| **History** | All triage sessions from the current browser session with full report recall |

---

## ⚙️ How the Engine Works

All triage logic lives in [`src/triageEngine.js`](src/triageEngine.js). It's a complete JavaScript port of the original Python backend — no server, no API calls.

### Pipeline (end-to-end)

```
Alert JSON Input
       │
       ├─── 1. Rule Engine
       │         Filter rules by alert.type
       │         Evaluate each rule's condition (e.g. cpu_usage > 90)
       │         Return: matched_rules[]
       │
       ├─── 2. Risk Score Engine
       │         6 weighted risk rules across 5 fields
       │         Sum weights for every passing condition
       │         Return: riskScore (0 – 120)
       │
       ├─── 3. Severity Classification
       │         riskScore ≥ 80  → CRITICAL
       │         riskScore ≥ 50  → HIGH
       │         riskScore ≥ 25  → MEDIUM
       │         riskScore < 25  → LOW
       │
       ├─── 4. Final Severity Merge
       │         Dynamic (CRITICAL/HIGH) wins over rule severity
       │         Otherwise rule severity wins
       │
       ├─── 5. False Positive Detection
       │         Each matched rule has false_positive_signals
       │         Each passing signal → +20% confidence
       │         status == "healthy" → +40% confidence
       │         confidence ≥ 50% → suppressed as False Positive
       │
       ├─── 6. Escalation Mapping
       │         CRITICAL / HIGH  → SEV-1
       │         MEDIUM           → SEV-2
       │         LOW              → SEV-3
       │         False Positive   → NO-ESCALATION
       │
       └─── 7. On-Call Engineer Assignment
                 SEV-1 → Ramesh (Senior SRE)
                 SEV-2 → Priya (Cloud Support)
                 SEV-3 → NOC Monitoring Team
```

> For the full mathematical deep-dive on every algorithm, see **[TECHNICAL.md](TECHNICAL.md)**.

---

## 🚨 Rules — All 10 Supported Alert Types

| # | Rule Name | `type` field | Trigger Condition | Severity |
|---|---|---|---|---|
| 1 | High CPU Usage | `system_monitoring` | `cpu_usage > 90` | HIGH |
| 2 | High Error Rate | `system_monitoring` | `error_rate > 50` | HIGH |
| 3 | Slow Response | `system_monitoring` | `response_time > 1000` | MEDIUM |
| 4 | High Memory Usage | `system_monitoring` | `memory_usage > 80` | MEDIUM |
| 5 | Brute Force Attack | `bruteforce_attack` | `failed_login_attempts > 200` | HIGH |
| 6 | DDoS Attack | `ddos_attack` | `requests_per_second > 10000` | HIGH |
| 7 | Firewall Breach | `firewall_breach` | `intrusion_attempts > 50` | HIGH |
| 8 | Port Scanning Activity | `port_scanning` | `port_scan_attempts > 100` | MEDIUM |
| 9 | Unauthorized Access | `unauthorized_access` | `unauthorized_access_attempts > 50` | HIGH |
| 10 | High Network Latency | `network_latency` | `network_latency > 500` | MEDIUM |

A single alert can match **multiple rules simultaneously** (e.g. a system overload alert with high CPU + high error rate + slow response matches 3 rules at once).

---

## 🧠 False Positive Detection

The false positive engine uses a **signal confidence model**. Each rule defines `false_positive_signals` — soft conditions that, when combined, indicate the alert is likely noise:

| Signal Score | Confidence | Result |
|---|---|---|
| 0 signals pass | 0% | Real incident 🚨 |
| 1 signal passes | 20% | Real incident 🚨 |
| 2 signals pass | 40% | Real incident 🚨 |
| 3 signals pass | 60% | **False Positive ✅** |
| `status == "healthy"` alone | 40% | Real incident 🚨 |
| `status == "healthy"` + 1 signal | 60% | **False Positive ✅** |
| No rules matched at all | 90% | **False Positive ✅** |

When marked as false positive: severity is forced to **LOW**, escalation is **NO-ESCALATION**, no engineer is paged.

---

## 📦 8 Built-In Sample Scenarios

Pre-loaded in the Triage page for one-click testing:

| Alert ID | Label | Type | Expected Severity | FP? |
|---|---|---|---|---|
| `INC-8894-SYS` | System Overload – Payment API | `system_monitoring` | HIGH (SEV-1) | No |
| `INC-8890-BRT` | Brute Force – Auth Service | `bruteforce_attack` | HIGH (SEV-1) | No |
| `INC-8891-DDoS` | DDoS Attack – CDN Edge | `ddos_attack` | CRITICAL (SEV-1) | No |
| `INC-8892-FW` | Firewall Breach – Internal | `firewall_breach` | HIGH (SEV-1) | No |
| `INC-8893-PSC` | Port Scan – Database Subnet | `port_scanning` | MEDIUM (SEV-2) | No |
| `INC-8895-UA` | Unauthorized Access – Admin Panel | `unauthorized_access` | HIGH (SEV-1) | No |
| `INC-FP-001` | False Positive – Healthy Node | `system_monitoring` | LOW | **Yes ✅** |
| `INC-8896-NL` | Network Latency – ISP Link | `network_latency` | MEDIUM (SEV-2) | No |

---

## 📋 Alert JSON Schema

Paste any alert JSON in this format:

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
  "memory_usage":  85,
  "error_rate":    60,
  "response_time": 1200
}
```

**Required:** `type`, `service` — everything else is optional but improves accuracy.

### All Supported Metric Fields

| Field | Type | Used By |
|---|---|---|
| `cpu_usage` | number (%) | `system_monitoring` |
| `memory_usage` | number (%) | `system_monitoring` |
| `error_rate` | number (%) | `system_monitoring` |
| `response_time` | number (ms) | `system_monitoring`, `bruteforce_attack` |
| `failed_login_attempts` | number | `bruteforce_attack` |
| `blocked_ips` | number | `bruteforce_attack`, `port_scanning` |
| `requests_per_second` | number | `ddos_attack` |
| `packet_loss` | number (%) | `ddos_attack`, `network_latency` |
| `network_latency` | number (ms) | `ddos_attack`, `network_latency` |
| `bandwidth_usage` | number (Gbps) | `ddos_attack` |
| `intrusion_attempts` | number | `firewall_breach` |
| `malicious_packets_detected` | number | `firewall_breach` |
| `blocked_connections` | number | `firewall_breach` |
| `port_scan_attempts` | number | `port_scanning` |
| `suspicious_ip_count` | number | `port_scanning`, `unauthorized_access` |
| `unauthorized_access_attempts` | number | `unauthorized_access` |
| `status` | string | FP detection heuristic (`"healthy"` suppresses) |
| `environment` | string | Risk scoring (`"production"` adds +10) |

---

## 🗂️ Project Structure

```
incident-triage-assistant_final/
│
├── index.html                        # Entry point — fonts, meta, SEO tags
├── vite.config.js                    # Vite build config
├── package.json                      # React 19, Vite 8, ESLint
├── eslint.config.js
│
├── src/
│   ├── main.jsx                      # React root mount
│   ├── App.jsx                       # Page router, history state, sidebar toggle
│   ├── App.css                       # Layout grid and page-level styles
│   ├── index.css                     # ★ Sentinel Interface design system (all CSS vars)
│   ├── triageEngine.js               # ★ All triage logic — rules, risk score, FP detection
│   │
│   ├── components/
│   │   ├── Sidebar.jsx / .css        # Collapsible nav with live status indicator
│   │   ├── SeverityBadge.jsx         # CRITICAL / HIGH / MEDIUM / LOW chips
│   │   ├── StatCard.jsx / .css       # Dashboard metric cards
│   │   └── TriageReport.jsx / .css   # Tabbed report: Overview, Issues, Checklist, On-Call
│   │
│   └── pages/
│       ├── Dashboard.jsx / .css      # Alert feed, distribution bars, quick actions
│       ├── TriagePage.jsx / .css     # JSON editor, sample picker, analysis runner
│       ├── PlaybookPage.jsx / .css   # Searchable runbook viewer
│       ├── RulesPage.jsx / .css      # Expandable rule browser
│       └── HistoryPage.jsx / .css    # Past session list + detail panel
│
├── public/
│   ├── favicon.svg
│   └── icons.svg
│
├── TECHNICAL.md                      # Full algorithm documentation
└── SCENARIOS.md                      # 7 documented test scenarios
```

---

## 🏗️ Tech Stack

| Layer | Technology | Version |
|---|---|---|
| UI Framework | React | 19.2.6 |
| Build Tool | Vite | 8.0.12 |
| Styling | Vanilla CSS | — |
| Fonts | Inter + JetBrains Mono | Google Fonts |
| Linting | ESLint + react-hooks plugin | 10.x |
| Logic | Pure JavaScript (no lib) | ES2022 |

**Zero runtime dependencies** beyond React and React-DOM — no Redux, no router library, no UI component library.

---

## 🎨 Design System — Sentinel Interface

Implemented entirely in `src/index.css` using CSS custom properties:

| Token | Value | Usage |
|---|---|---|
| `--surface` | `#131314` | Page background |
| `--surface-container-low` | `#1c1b1c` | Card backgrounds |
| `--cyber-blue` | `#3b82f6` | Primary actions, active nav, tab indicators |
| `--critical` | `#ff4757` | CRITICAL severity — red glow on card border |
| `--high` | `#ff6b35` | HIGH severity |
| `--medium` | `#ffa502` | MEDIUM severity |
| `--low` | `#2ed573` | LOW / success / false positive confirmed |
| `--font-sans` | Inter | All UI text |
| `--font-mono` | JetBrains Mono | Alert IDs, timestamps, code, conditions |
| `--radius-md` | `12px` | Card border radius |

---

## 📞 On-Call Escalation Matrix

| Escalation | Triggered When | Engineer | Team |
|---|---|---|---|
| **SEV-1** | Severity = CRITICAL or HIGH | Ramesh | Senior SRE Team |
| **SEV-2** | Severity = MEDIUM | Priya | Cloud Support Team |
| **SEV-3** | Severity = LOW | Monitoring Team | NOC Team |
| **NO-ESCALATION** | False Positive detected | — | Suppressed |

---

## 📖 Additional Documentation

| File | Contents |
|---|---|
| **[TECHNICAL.md](TECHNICAL.md)** | Deep-dive: risk score weights, severity thresholds, FP scoring math, Python→JS mapping, all rule FP signals, adding new rules |
| **[SCENARIOS.md](SCENARIOS.md)** | 7 fully documented test scenarios with alert payloads and expected outputs |

---

*TriageAI · React 19 + Vite 8 · Sentinel Interface · Built for SOC teams*

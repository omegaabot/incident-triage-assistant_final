# 🧪 Sample Alert Scenarios

This document describes every sample alert scenario included in the `data/` directory. Each scenario represents a realistic production incident with expected triage outputs — useful for demonstrations, testing the rule engine, or onboarding new team members.

---

## Scenario 1 — DDoS Attack on API Gateway

**File:** `data/ddos_attack.json`

### Context
A volumetric Distributed Denial-of-Service attack was detected by Cloudflare targeting the public API gateway in the `eu-central-1` datacenter. Inbound request rates spiked to 25,000 req/s — 2.5× the critical threshold — causing response times of 2,000 ms and 40% packet loss.

### Alert Payload
```json
{
  "alert_id": "INC-8891-DDS",
  "timestamp": "2026-05-17T10:39:15Z",
  "environment": "production",
  "datacenter": "eu-central-1",
  "source_system": "Cloudflare",
  "description": "Massive spike in inbound HTTP requests exceeding standard thresholds, indicating a volumetric DDoS attack.",
  "type": "ddos_attack",
  "service": "api-gateway",
  "status": "under_attack",
  "requests_per_second": 25000,
  "network_latency": 1200,
  "packet_loss": 40,
  "response_time": 2000
}
```

### Expected Triage Output
| Field | Value |
|---|---|
| **Severity** | HIGH |
| **Escalation** | SEV-1 |
| **Rule Matched** | DDoS Attack (`requests_per_second > 10000`) |
| **On-Call Engineer** | Ramesh Kumar — Senior SRE Team |
| **False Positive** | No |

### Suggested Actions
- Enable Cloudflare "Under Attack" mode
- Filter malicious traffic using WAF rules
- Block suspicious IP CIDR ranges
- Temporarily scale API gateway capacity
- Monitor traffic spikes via real-time dashboard

---

## Scenario 2 — Brute Force Attack on Auth Service

**File:** `data/bruteforce_alert.json`

### Context
AWS WAF detected a brute-force credential stuffing attack targeting the authentication service. Over 500 failed login attempts were logged in under 60 seconds from 45 distinct blocked IPs, suggesting an automated attack tool is being used.

### Alert Payload
```json
{
  "alert_id": "INC-8890-BRT",
  "timestamp": "2026-05-17T10:35:00Z",
  "environment": "production",
  "datacenter": "us-east-1",
  "source_system": "AWS WAF",
  "description": "An unusually high volume of failed authentication attempts detected on the auth-service.",
  "type": "bruteforce_attack",
  "service": "auth-service",
  "status": "under_attack",
  "failed_login_attempts": 500,
  "blocked_ips": 45,
  "response_time": 450
}
```

### Expected Triage Output
| Field | Value |
|---|---|
| **Severity** | HIGH |
| **Escalation** | SEV-1 |
| **Rule Matched** | Brute Force Attack (`failed_login_attempts > 200`) |
| **On-Call Engineer** | Ramesh Kumar — Senior SRE Team |
| **False Positive** | No |

### Suggested Actions
- Block all 45 identified attacking IPs at perimeter
- Enable account lockout after 5 failed attempts
- Force password reset for any accounts with ≥ 10 failures
- Enable MFA for all user accounts
- Correlate with authentication logs to detect successful breaches

---

## Scenario 3 — Firewall Breach on Internal Network

**File:** `data/firewall_breach.json`

### Context
Palo Alto Networks NGFW detected multiple intrusion attempts that bypassed edge firewall rules on critical internal subnets in `us-west-2`. 75 intrusion attempts were logged alongside 1,200 malicious packets — indicating a targeted network intrusion attempt.

### Alert Payload
```json
{
  "alert_id": "INC-8892-FWB",
  "timestamp": "2026-05-17T10:41:22Z",
  "environment": "production",
  "datacenter": "us-west-2",
  "source_system": "Palo Alto Networks",
  "description": "Multiple intrusion attempts bypassed edge firewall rules on critical subnets.",
  "type": "firewall_breach",
  "service": "firewall-system",
  "status": "critical",
  "intrusion_attempts": 75,
  "malicious_packets_detected": 1200,
  "blocked_connections": 500
}
```

### Expected Triage Output
| Field | Value |
|---|---|
| **Severity** | HIGH |
| **Escalation** | SEV-1 |
| **Rule Matched** | Firewall Breach (`intrusion_attempts > 50`) |
| **On-Call Engineer** | Ramesh Kumar — Senior SRE Team |
| **False Positive** | No |

### Suggested Actions
- Review firewall logs for the specific rule that was bypassed
- Block malicious traffic at perimeter immediately
- Isolate affected subnet segments
- Run a full vulnerability scan on affected hosts
- Notify security & compliance team

---

## Scenario 4 — Port Scanning on Network Perimeter

**File:** `data/port_scanning_alert.json`

### Context
Datadog Security detected automated port scanning activity targeting internal load balancers in the staging environment. 450 port scan attempts were recorded from 32 suspicious IPs — typically a reconnaissance phase before a more targeted attack.

### Alert Payload
```json
{
  "alert_id": "INC-8893-PSC",
  "timestamp": "2026-05-17T10:42:05Z",
  "environment": "staging",
  "datacenter": "us-east-1",
  "source_system": "Datadog Security",
  "description": "Automated port scanning activity detected targeting internal load balancers.",
  "type": "port_scanning",
  "service": "network-firewall",
  "status": "security_alert",
  "port_scan_attempts": 450,
  "suspicious_ip_count": 32,
  "blocked_ips": 18
}
```

### Expected Triage Output
| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Escalation** | SEV-2 |
| **Rule Matched** | Port Scanning Activity (`port_scan_attempts > 100`) |
| **On-Call Engineer** | Priya Sharma — Cloud Support Team |
| **False Positive** | No |

### Suggested Actions
- Block all 32 suspicious source IPs at the perimeter
- Close unnecessary open ports identified in the scan
- Enable IDS rules to alert on subsequent scan attempts
- Treat as a reconnaissance phase and increase monitoring

---

## Scenario 5 — System Degradation on Payment API

**File:** `data/sample_alert.json`

### Context
Prometheus alerted on the payment API cluster in `ap-south-1`. All four key metrics are simultaneously breached — CPU at 92%, memory at 85%, error rate at 60%, and response time at 1,200 ms — indicating a full system degradation event, likely caused by a traffic surge or code regression.

### Alert Payload
```json
{
  "alert_id": "INC-8894-SYS",
  "timestamp": "2026-05-17T10:43:10Z",
  "environment": "production",
  "datacenter": "ap-south-1",
  "source_system": "Prometheus",
  "description": "Payment API nodes are experiencing resource exhaustion and elevated error rates.",
  "type": "system_monitoring",
  "service": "payment-api",
  "cpu_usage": 92,
  "memory_usage": 85,
  "error_rate": 60,
  "response_time": 1200,
  "status": "degraded"
}
```

### Expected Triage Output
| Field | Value |
|---|---|
| **Severity** | HIGH |
| **Escalation** | SEV-1 |
| **Rules Matched** | High CPU Usage, High Error Rate, Slow Response, High Memory Usage (4 rules) |
| **Priority Score** | 6 |
| **On-Call Engineer** | Ramesh Kumar — Senior SRE Team |
| **False Positive** | No |

### Suggested Actions
- Immediately scale horizontally — add more payment API nodes
- Investigate the most recent deployment for regressions
- Optimize slow database queries identified in APM
- Check for memory leaks in the service
- Notify payment provider if SLA thresholds are being breached

---

## Scenario 6 — Healthy System (False Positive Baseline)

**File:** `data/sample_alert2.json`

### Context
Routine Prometheus health check on the user service in `ap-south-1`. All metrics are within normal operating ranges — CPU at 40%, memory at 50%, error rate at 10%, response time at 300 ms. No rules match. This scenario demonstrates false positive detection.

### Alert Payload
```json
{
  "alert_id": "INC-8895-SYS",
  "timestamp": "2026-05-17T10:45:00Z",
  "environment": "production",
  "datacenter": "ap-south-1",
  "source_system": "Prometheus",
  "description": "Routine health check for user-service. System operating normally.",
  "type": "system_monitoring",
  "service": "user-service",
  "cpu_usage": 40,
  "memory_usage": 50,
  "error_rate": 10,
  "response_time": 300,
  "status": "healthy"
}
```

### Expected Triage Output
| Field | Value |
|---|---|
| **Severity** | LOW |
| **Escalation** | SEV-3 |
| **Rules Matched** | None |
| **On-Call Engineer** | NOC Monitoring Team |
| **False Positive** | **Yes** ✅ |

### Purpose
This scenario validates that the triage system correctly identifies no-action events. A healthy alert should result in a false positive flag, SEV-3 escalation, and no runbook suggestions.

---

## Scenario 7 — Unauthorized Access on Admin Dashboard

**File:** `data/unauthorized_access.json`

### Context
Splunk SIEM flagged repeated unauthorized access attempts on the admin dashboard in `us-east-2`. 150 unauthorized access attempts and 300 failed logins were detected from 20 suspicious IPs — a clear sign of a targeted account takeover attempt.

### Alert Payload
```json
{
  "alert_id": "INC-8896-UNA",
  "timestamp": "2026-05-17T10:48:33Z",
  "environment": "production",
  "datacenter": "us-east-2",
  "source_system": "Splunk SIEM",
  "description": "Repeated unauthorized access attempts flagged on the admin dashboard route.",
  "type": "unauthorized_access",
  "service": "admin-dashboard",
  "status": "security_warning",
  "unauthorized_access_attempts": 150,
  "failed_login_attempts": 300,
  "suspicious_ip_count": 20
}
```

### Expected Triage Output
| Field | Value |
|---|---|
| **Severity** | HIGH |
| **Escalation** | SEV-1 |
| **Rule Matched** | Unauthorized Access (`unauthorized_access_attempts > 50`) |
| **On-Call Engineer** | Ramesh Kumar — Senior SRE Team |
| **False Positive** | No |

### Suggested Actions
- Immediately revoke all active admin sessions
- Block all 20 suspicious source IPs
- Force MFA on all admin accounts
- Conduct a full audit of admin access logs for the past 72 hours
- Notify compliance team if admin data was accessed

---

## Rules Reference Summary

| Rule Name | Type | Condition | Severity |
|---|---|---|---|
| High CPU Usage | system_monitoring | `cpu_usage > 90` | HIGH |
| High Error Rate | system_monitoring | `error_rate > 50` | HIGH |
| Slow Response | system_monitoring | `response_time > 1000` | MEDIUM |
| High Memory Usage | system_monitoring | `memory_usage > 80` | MEDIUM |
| Brute Force Attack | bruteforce_attack | `failed_login_attempts > 200` | HIGH |
| DDoS Attack | ddos_attack | `requests_per_second > 10000` | HIGH |
| Firewall Breach | firewall_breach | `intrusion_attempts > 50` | HIGH |
| Port Scanning Activity | port_scanning | `port_scan_attempts > 100` | MEDIUM |
| Unauthorized Access | unauthorized_access | `unauthorized_access_attempts > 50` | HIGH |
| High Network Latency | network_latency | `network_latency > 500` | MEDIUM |

---

*These scenarios are used for development testing, demonstrations, and onboarding purposes only.*

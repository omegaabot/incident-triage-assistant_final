// ===================================================
// TRIAGE ENGINE – JavaScript port of the Python logic
// Mirrors: src/rule_engine.py, severity.py, 
//          false_alert.py, escalation.py, risk_engine.py
// ===================================================

// ── Rules (from rules/rules.json) ──────────────────
export const RULES = [
  {
    name: "High CPU Usage",
    type: "system_monitoring",
    condition: (a) => a.cpu_usage > 90,
    severity: "HIGH",
    message: (a) => `CPU usage is critically high (${a.cpu_usage}%)`,
    action: "Restart service or scale infrastructure",
    checks: [
      "Identify which process is consuming the most CPU (run `top -o %CPU`)",
      "Check if a recent deployment introduced a regression or infinite loop",
      "Verify if auto-scaling is enabled and has triggered",
      "Look for memory pressure - OOM may force heavy swap and CPU spikes",
      "Check if cpu_usage has been consistently high or is a momentary spike",
    ],
    checklist: [
      "Identify top CPU-consuming process",
      "Review recent deployments for regressions",
      "Check if auto-scaling kicked in",
      "Restart affected service as short-term fix",
      "Notify development team if a code fix is required",
      "Add CPU usage threshold alert with trend-based alerting",
    ],
    false_positive_signals: [
      { field: "cpu_usage", op: "<", value: 95.0 },
      { field: "status", op: "==", value: "healthy" },
      { field: "error_rate", op: "<", value: 10.0 },
    ],
  },
  {
    name: "High Error Rate",
    type: "system_monitoring",
    condition: (a) => a.error_rate > 50,
    severity: "HIGH",
    message: (a) => `Error rate is critically high (${a.error_rate}%)`,
    action: "Check logs and API endpoints immediately",
    checks: [
      "Check application logs for the specific error type (5xx, exceptions, timeouts)",
      "Verify database connectivity - most error spikes trace back to DB issues",
      "Check if a recent code deployment correlates with the error spike time",
      "Review dependency health - downstream APIs, message queues, caches",
      "Compare error_rate trend - sudden spike vs. gradual rise indicates different causes",
    ],
    checklist: [
      "Pull error logs for the affected service",
      "Check database connection pool status",
      "Verify all downstream service health endpoints",
      "Check if a rollback of the last deployment resolves the issue",
      "Set up error-rate-specific alerting with anomaly detection",
      "Document root cause after resolution",
    ],
    false_positive_signals: [
      { field: "error_rate", op: "<", value: 60.0 },
      { field: "status", op: "==", value: "healthy" },
      { field: "response_time", op: "<", value: 500.0 },
    ],
  },
  {
    name: "Slow Response",
    type: "system_monitoring",
    condition: (a) => a.response_time > 1000,
    severity: "MEDIUM",
    message: (a) => `Response time is degraded (${a.response_time}ms)`,
    action: "Optimize database queries and check for bottlenecks",
    checks: [
      "Check if response_time increase is isolated to specific endpoints or global",
      "Review slow query logs in the database for queries over 500ms",
      "Verify network latency between services - especially DB and cache hops",
      "Check if the issue is CPU/memory pressure causing execution slowdown",
      "Look at connection pool exhaustion - if all connections are used, requests queue",
    ],
    checklist: [
      "Identify the slowest endpoint via APM traces",
      "Run EXPLAIN on top N slow queries",
      "Check and potentially increase DB connection pool size",
      "Enable response caching for frequently accessed read-only endpoints",
      "Verify CDN/load balancer configuration is not introducing latency",
      "Set a P95/P99 latency alert threshold for early warning",
    ],
    false_positive_signals: [
      { field: "response_time", op: "<", value: 1200.0 },
      { field: "error_rate", op: "<", value: 5.0 },
      { field: "cpu_usage", op: "<", value: 50.0 },
    ],
  },
  {
    name: "High Memory Usage",
    type: "system_monitoring",
    condition: (a) => a.memory_usage > 80,
    severity: "MEDIUM",
    message: (a) => `Memory usage is high (${a.memory_usage}%)`,
    action: "Check for memory leaks or restart service",
    checks: [
      "Identify which process is consuming the most memory (run `ps aux --sort=-%mem`)",
      "Check if memory usage is growing over time (leak) or stable but high (undersized)",
      "Review recent deployments for new in-memory caching or data structure changes",
      "Inspect JVM heap if a Java service - check GC pause frequency",
      "Verify if swap is being used heavily - indicates physical memory is exhausted",
    ],
    checklist: [
      "Identify the memory-consuming process",
      "Check memory usage trend over the past 24 hours",
      "Profile the application for memory leaks",
      "Restart the service if memory usage exceeds 90% as an emergency measure",
      "Increase instance memory allocation if the workload is legitimate",
      "Add memory-based auto-scaling policy",
    ],
    false_positive_signals: [
      { field: "memory_usage", op: "<", value: 85.0 },
      { field: "status", op: "==", value: "healthy" },
      { field: "cpu_usage", op: "<", value: 40.0 },
    ],
  },
  {
    name: "Brute Force Attack",
    type: "bruteforce_attack",
    condition: (a) => a.failed_login_attempts > 200,
    severity: "HIGH",
    message: (a) =>
      `Brute force attack detected - ${a.failed_login_attempts} failed login attempts`,
    action: "Block suspicious IPs and enable rate limiting",
    checks: [
      "Check if failed_login_attempts originate from a single IP or are distributed (botnet)",
      "Compare blocked_ips count vs. total attempts - low ratio suggests a single aggressive source",
      "Verify if attack targets specific usernames (credential stuffing) or random accounts",
      "Check response_time - high latency may indicate the auth service DB is under load",
      "Review whether any attempts succeeded before the block was applied",
    ],
    checklist: [
      "Block all attacking IP addresses at the WAF/firewall level",
      "Enable account lockout policy after 5 consecutive failures",
      "Force password reset for any accounts that received 10+ failed attempts",
      "Enable MFA on all user accounts, especially privileged ones",
      "Review auth logs for successful logins during the attack window",
      "Notify affected users if their accounts were targeted",
      "Tune rate limiting rules to 10 requests/minute per IP on the login endpoint",
    ],
    false_positive_signals: [
      { field: "failed_login_attempts", op: "<", value: 250.0 },
      { field: "blocked_ips", op: ">", value: 40.0 },
      { field: "response_time", op: "<", value: 300.0 },
    ],
  },
  {
    name: "DDoS Attack",
    type: "ddos_attack",
    condition: (a) => a.requests_per_second > 10000,
    severity: "HIGH",
    message: (a) =>
      `DDoS attack in progress - ${a.requests_per_second} req/s detected`,
    action: "Enable DDoS protection and activate traffic filtering",
    checks: [
      "Check if requests_per_second spike is from a single origin or globally distributed",
      "Review packet_loss percentage - high loss confirms volumetric flood not a traffic spike",
      "Check network_latency - extreme latency (>1000ms) confirms the pipeline is saturated",
      "Verify if the attack targets a specific endpoint or floods all routes uniformly",
      "Check if CDN/WAF rate-limiting rules have already auto-triggered",
    ],
    checklist: [
      "Enable CDN-level DDoS protection (e.g., Cloudflare Under Attack mode)",
      "Activate WAF rate-limiting rules - cap at 100 req/min per IP",
      "Blackhole-route identified attacking IP CIDR ranges",
      "Temporarily scale up origin capacity to absorb legitimate traffic",
      "Contact upstream ISP if attack exceeds 10Gbps+ (volumetric)",
      "Document attacking IP ranges and request patterns for post-incident review",
      "Confirm service recovery after mitigation is applied",
    ],
    false_positive_signals: [
      { field: "requests_per_second", op: "<", value: 15000.0 },
      { field: "packet_loss", op: "<", value: 10.0 },
      { field: "network_latency", op: "<", value: 500.0 },
    ],
  },
  {
    name: "Firewall Breach",
    type: "firewall_breach",
    condition: (a) => a.intrusion_attempts > 50,
    severity: "HIGH",
    message: (a) =>
      `Firewall breach detected - ${a.intrusion_attempts} intrusion attempts, ${a.malicious_packets_detected} malicious packets`,
    action: "Isolate affected systems and review firewall rules immediately",
    checks: [
      "Identify which specific firewall rule or port was bypassed",
      "Review malicious_packets_detected - high counts suggest a sustained attack, not a probe",
      "Check blocked_connections vs. intrusion_attempts ratio - low ratio means many slipped through",
      "Determine if the breach targeted internal subnets (lateral movement risk) or edge systems",
      "Verify if any data exfiltration commands or reverse shells were initiated",
    ],
    checklist: [
      "Immediately isolate any hosts that received intrusion traffic from the internal network",
      "Patch or tighten the specific firewall rule that was bypassed",
      "Run a full vulnerability scan on all hosts in the affected subnet",
      "Check for indicators of compromise (IoC) on affected systems",
      "Review and tighten egress filtering to prevent data exfiltration",
      "Notify security and compliance team - this may be a reportable incident",
      "Conduct a post-incident forensic review within 48 hours",
    ],
    false_positive_signals: [
      { field: "intrusion_attempts", op: "<", value: 75.0 },
      { field: "malicious_packets_detected", op: "<", value: 500.0 },
      { field: "blocked_connections", op: ">", value: 450.0 },
    ],
  },
  {
    name: "Port Scanning Activity",
    type: "port_scanning",
    condition: (a) => a.port_scan_attempts > 100,
    severity: "MEDIUM",
    message: (a) =>
      `Port scanning detected - ${a.port_scan_attempts} attempts from ${a.suspicious_ip_count} IPs`,
    action: "Block scanning IPs and review exposed services",
    checks: [
      "Determine if scanning is from a single IP or coordinated across suspicious_ip_count sources",
      "Check which ports were probed - focus on DB ports (5432, 3306), SSH (22), admin panels",
      "Compare blocked_ips to suspicious_ip_count - if few were blocked, exposure window was large",
      "Verify if this is an internal security scan (authorized) - check with security team first",
      "Treat as a reconnaissance phase - check logs for follow-up intrusion attempts",
    ],
    checklist: [
      "Block all scanning IPs at the perimeter firewall",
      "Audit all open ports - close any that are not business-critical",
      "Verify SSH and admin panel access is restricted to VPN/bastion only",
      "Enable IDS/IPS rules to detect and block future port scan patterns",
      "Check logs in the 24 hours after the scan for targeted attack follow-ups",
      "Document findings and share IOC list with security team",
    ],
    false_positive_signals: [
      { field: "port_scan_attempts", op: "<", value: 200.0 },
      { field: "blocked_ips", op: ">", value: 15.0 },
      { field: "suspicious_ip_count", op: "<", value: 10.0 },
    ],
  },
  {
    name: "Unauthorized Access",
    type: "unauthorized_access",
    condition: (a) => a.unauthorized_access_attempts > 50,
    severity: "HIGH",
    message: (a) =>
      `Unauthorized access attempts detected - ${a.unauthorized_access_attempts} attempts on ${a.service}`,
    action: "Revoke sessions, rotate credentials, and audit access logs",
    checks: [
      "Determine if unauthorized_access_attempts include any successful logins",
      "Check failed_login_attempts vs. unauthorized_access_attempts - gap may indicate session hijacking",
      "Review suspicious_ip_count - high count suggests a coordinated attack tool",
      "Verify if the targeted service (admin panel, API) has MFA enforced",
      "Check if the attack correlates with a recent credential dump from dark web monitoring",
    ],
    checklist: [
      "Immediately revoke all active sessions for accounts in scope",
      "Rotate API keys, OAuth tokens, and service account credentials",
      "Force password reset for all affected user accounts",
      "Enable MFA on all accounts - block login for non-MFA users temporarily",
      "Audit access logs for the past 72 hours for any successful unauthorized access",
      "Notify affected users of potential account compromise",
      "Conduct a full access permission audit - enforce least privilege",
    ],
    false_positive_signals: [
      { field: "unauthorized_access_attempts", op: "<", value: 75.0 },
      { field: "failed_login_attempts", op: "<", value: 100.0 },
      { field: "suspicious_ip_count", op: "<", value: 5.0 },
    ],
  },
  {
    name: "High Network Latency",
    type: "network_latency",
    condition: (a) => a.network_latency > 500,
    severity: "MEDIUM",
    message: (a) => `Network latency is high (${a.network_latency}ms)`,
    action: "Trace the network path and identify the bottleneck",
    checks: [
      "Run traceroute to identify exactly where in the path latency is introduced",
      "Check if latency is regional (single AZ/DC) or global across all endpoints",
      "Verify ISP status page - carrier-level outages cause upstream latency spikes",
      "Check for BGP route changes in the past 2 hours that may have rerouted traffic",
      "Review bandwidth utilization - link saturation is the most common cause",
    ],
    checklist: [
      "Run traceroute to key services and identify the high-latency hop",
      "Check bandwidth utilization on all external links",
      "Verify ISP and CDN status pages for known incidents",
      "Fail over to the secondary network link or backup route if available",
      "Contact ISP if the problem is upstream and exceeds 30 minutes",
      "Document the latency timeline and network path for post-incident review",
    ],
    false_positive_signals: [
      { field: "network_latency", op: "<", value: 700.0 },
      { field: "packet_loss", op: "<", value: 5.0 },
    ],
  },
];

// ── Risk Rules (from rules/risk_rules.json) ─────────
const RISK_RULES = [
  { field: "requests_per_second", op: ">", value: 10000, weight: 30 },
  { field: "requests_per_second", op: ">", value: 5000, weight: 20 },
  { field: "network_latency", op: ">", value: 1000, weight: 20 },
  { field: "packet_loss", op: ">", value: 20, weight: 15 },
  { field: "status", op: "==", value: "under_attack", weight: 25 },
  { field: "environment", op: "==", value: "production", weight: 10 },
];

// ── On-call Engineers (from config/engineers.json) ──
const ENGINEERS = {
  "SEV-1": {
    name: "Ramesh",
    team: "Senior SRE Team",
    email: "ramesh.sre@company.com",
    phone: "+91-9876543210",
  },
  "SEV-2": {
    name: "Priya",
    team: "Cloud Support Team",
    email: "priya.support@company.com",
    phone: "+91-9123456780",
  },
  "SEV-3": {
    name: "Monitoring Team",
    team: "NOC Team",
    email: "noc@company.com",
    phone: "+91-9000000000",
  },
  "NO-ESCALATION": {
    name: "N/A",
    team: "N/A",
    email: "N/A",
    phone: "N/A",
  },
};

// ── Helpers ─────────────────────────────────────────
function evalOp(fieldVal, op, ruleVal) {
  if (fieldVal === undefined || fieldVal === null) return false;
  if (op === ">") return fieldVal > ruleVal;
  if (op === "<") return fieldVal < ruleVal;
  if (op === "==") return fieldVal === ruleVal;
  return false;
}

// ── Risk Score (mirrors risk_engine.py) ─────────────
function calculateRiskScore(alert) {
  let score = 0;
  for (const rule of RISK_RULES) {
    const fieldVal = alert[rule.field];
    if (evalOp(fieldVal, rule.op, rule.value)) {
      score += rule.weight;
    }
  }
  return score;
}

// ── Severity (mirrors severity.py) ──────────────────
function calculateSeverity(alert) {
  const score = calculateRiskScore(alert);
  if (score >= 80) return { severity: "CRITICAL", score };
  if (score >= 50) return { severity: "HIGH", score };
  if (score >= 25) return { severity: "MEDIUM", score };
  return { severity: "LOW", score };
}

// ── Rule Engine (mirrors rule_engine.py) ────────────
function applyRules(alert) {
  return RULES.filter((rule) => {
    if (rule.type !== alert.type) return false;
    try {
      return rule.condition(alert);
    } catch {
      return false;
    }
  }).map((rule) => ({
    name: rule.name,
    type: rule.type,
    severity: rule.severity,
    message: rule.message(alert),
    action: rule.action,
    checks: rule.checks,
    checklist: rule.checklist,
    false_positive_signals: rule.false_positive_signals,
  }));
}

// ── Final Severity from matched rules ───────────────
function getRuleSeverity(matchedRules) {
  if (matchedRules.some((r) => r.severity === "HIGH")) return "HIGH";
  if (matchedRules.some((r) => r.severity === "MEDIUM")) return "MEDIUM";
  return "LOW";
}

// ── False Alert Detection (mirrors false_alert.py) ──
function detectFalseAlert(alert, matchedRules) {
  if (matchedRules.length === 0) {
    return {
      isFalseAlert: true,
      confidence: 90,
      reasons: ["No rule matched — alert did not exceed any threshold."],
    };
  }

  let score = 0;
  const reasons = [];

  // Rule-specific false positive signals
  for (const rule of matchedRules) {
    for (const sig of rule.false_positive_signals || []) {
      const fieldVal = alert[sig.field];
      if (evalOp(fieldVal, sig.op, sig.value)) {
        score += 1;
        reasons.push(`${sig.field} ${sig.op} ${sig.value}`);
      }
    }
  }

  // Extra heuristic: healthy status
  if (alert.status === "healthy") {
    score += 2;
    reasons.push("System status is healthy");
  }

  const confidence = Math.min(score * 20, 100);
  const isFalseAlert = confidence >= 50;

  return { isFalseAlert, confidence, reasons };
}

// ── Escalation Mapping (mirrors escalation.py) ──────
function mapSeverityToEscalation(severity) {
  if (severity === "CRITICAL" || severity === "HIGH") return "SEV-1";
  if (severity === "MEDIUM") return "SEV-2";
  return "SEV-3";
}

// ── Priority Score ───────────────────────────────────
function calcPriorityScore(matchedRules) {
  return matchedRules.reduce((acc, r) => {
    if (r.severity === "HIGH") return acc + 1;
    if (r.severity === "MEDIUM") return acc + 2;
    return acc + 3;
  }, 0);
}

// ── MAIN TRIAGE FUNCTION ─────────────────────────────
export function triageAlert(alert) {
  const matchedRules = applyRules(alert);
  const { severity: dynamicSeverity, score: riskScore } = calculateSeverity(alert);
  const ruleSeverity = getRuleSeverity(matchedRules);

  // Take higher severity
  let finalSeverity =
    dynamicSeverity === "CRITICAL" || dynamicSeverity === "HIGH"
      ? dynamicSeverity
      : ruleSeverity;

  const fpResult = detectFalseAlert(alert, matchedRules);
  let escalationLevel;
  let engineer;

  if (fpResult.isFalseAlert) {
    finalSeverity = "LOW";
    escalationLevel = "NO-ESCALATION";
    engineer = ENGINEERS["NO-ESCALATION"];
  } else {
    escalationLevel = mapSeverityToEscalation(finalSeverity);
    engineer = ENGINEERS[escalationLevel];
  }

  const priorityScore = calcPriorityScore(matchedRules);

  return {
    alert,
    matchedRules,
    finalSeverity,
    riskScore,
    escalationLevel,
    engineer,
    priorityScore,
    fpResult,
    timestamp: new Date().toISOString(),
  };
}

// ── Sample Alert Scenarios ───────────────────────────
export const SAMPLE_ALERTS = [
  {
    id: "INC-8894-SYS",
    label: "System Overload – Payment API",
    alert_id: "INC-8894-SYS",
    timestamp: "2026-05-17T10:43:10Z",
    environment: "production",
    datacenter: "ap-south-1",
    source_system: "Prometheus",
    description:
      "Payment API nodes experiencing resource exhaustion and elevated error rates.",
    type: "system_monitoring",
    service: "payment-api",
    cpu_usage: 92,
    memory_usage: 85,
    error_rate: 60,
    response_time: 1200,
    status: "degraded",
  },
  {
    id: "INC-8890-BRT",
    label: "Brute Force – Auth Service",
    alert_id: "INC-8890-BRT",
    timestamp: "2026-05-17T10:35:00Z",
    environment: "production",
    datacenter: "us-east-1",
    source_system: "AWS WAF",
    description:
      "An unusually high volume of failed authentication attempts detected on the auth-service.",
    type: "bruteforce_attack",
    service: "auth-service",
    status: "under_attack",
    failed_login_attempts: 500,
    blocked_ips: 45,
    response_time: 450,
  },
  {
    id: "INC-8891-DDoS",
    label: "DDoS Attack – CDN Edge",
    alert_id: "INC-8891-DDoS",
    timestamp: "2026-05-17T11:00:00Z",
    environment: "production",
    datacenter: "eu-west-1",
    source_system: "Cloudflare",
    description:
      "Massive DDoS flood hitting CDN edge nodes. Traffic volumes exceeding 15,000 req/s.",
    type: "ddos_attack",
    service: "cdn-edge",
    status: "under_attack",
    requests_per_second: 15000,
    packet_loss: 25,
    network_latency: 1200,
    bandwidth_usage: 9.5,
  },
  {
    id: "INC-8892-FW",
    label: "Firewall Breach – Internal",
    alert_id: "INC-8892-FW",
    timestamp: "2026-05-17T09:55:00Z",
    environment: "production",
    datacenter: "ap-south-1",
    source_system: "Snort IDS",
    description:
      "Firewall breach detected with multiple intrusion attempts bypassing perimeter rules.",
    type: "firewall_breach",
    service: "network-perimeter",
    status: "under_attack",
    intrusion_attempts: 120,
    malicious_packets_detected: 8500,
    blocked_connections: 95,
  },
  {
    id: "INC-8893-PSC",
    label: "Port Scan – Database Subnet",
    alert_id: "INC-8893-PSC",
    timestamp: "2026-05-17T08:20:00Z",
    environment: "production",
    datacenter: "us-west-2",
    source_system: "Suricata IDS",
    description:
      "Aggressive port scanning detected targeting the internal database subnet.",
    type: "port_scanning",
    service: "db-subnet",
    status: "suspicious",
    port_scan_attempts: 340,
    suspicious_ip_count: 3,
    blocked_ips: 2,
  },
  {
    id: "INC-8895-UA",
    label: "Unauthorized Access – Admin Panel",
    alert_id: "INC-8895-UA",
    timestamp: "2026-05-17T12:10:00Z",
    environment: "production",
    datacenter: "us-east-1",
    source_system: "Okta SIEM",
    description:
      "Multiple unauthorized access attempts detected on the admin panel.",
    type: "unauthorized_access",
    service: "admin-panel",
    status: "suspicious",
    unauthorized_access_attempts: 85,
    failed_login_attempts: 120,
    suspicious_ip_count: 8,
  },
  {
    id: "INC-FP-001",
    label: "False Positive – Healthy Node",
    alert_id: "INC-FP-001",
    timestamp: "2026-05-17T07:00:00Z",
    environment: "production",
    datacenter: "ap-south-1",
    source_system: "DataDog",
    description: "Alert triggered but system is reporting healthy metrics.",
    type: "system_monitoring",
    service: "user-api",
    cpu_usage: 91,
    memory_usage: 75,
    error_rate: 8,
    response_time: 1100,
    status: "healthy",
  },
  {
    id: "INC-8896-NL",
    label: "Network Latency – ISP Link",
    alert_id: "INC-8896-NL",
    timestamp: "2026-05-17T13:30:00Z",
    environment: "production",
    datacenter: "eu-central-1",
    source_system: "Zabbix",
    description: "High network latency detected on primary ISP uplink.",
    type: "network_latency",
    service: "edge-router",
    status: "degraded",
    network_latency: 780,
    packet_loss: 8,
  },
];

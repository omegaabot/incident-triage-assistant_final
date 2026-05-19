import { useState } from 'react';
import { RULES } from '../triageEngine';
import SeverityBadge from '../components/SeverityBadge';
import './PlaybookPage.css';

// Full runbook content
const RUNBOOK = {
  "High CPU Usage": {
    trigger: "cpu_usage > 90",
    immediateSteps: ["Restart service", "Check running processes", "Scale infrastructure", "Analyze CPU-intensive tasks"],
    commands: ["top -o %CPU", "systemctl status <service-name>", "vmstat 1 10"],
    resolutionChecklist: [
      "Identify the process consuming the most CPU",
      "Check for infinite loops or runaway threads",
      "Review recent deployments that could have caused regression",
      "Scale horizontally if load is legitimate",
      "Notify the development team if a code fix is required",
    ],
  },
  "High Error Rate": {
    trigger: "error_rate > 50",
    immediateSteps: ["Check logs", "Validate API endpoints", "Debug recent changes", "Verify database connectivity"],
    commands: ["tail -f /var/log/app/error.log", "grep ' 5[0-9][0-9] ' /var/log/nginx/access.log | wc -l", "curl -I https://<your-api>/health"],
    resolutionChecklist: [
      "Check the most recent deployment or config change",
      "Verify external service dependencies (DB, cache, message queues)",
      "Roll back if a bad deployment is confirmed",
      "Set up alerting thresholds to catch future spikes early",
    ],
  },
  "Slow Response": {
    trigger: "response_time > 1000ms",
    immediateSteps: ["Optimize database queries", "Check network latency", "Analyze slow API endpoints", "Restart overloaded services"],
    commands: ["mysqldumpslow -s t /var/log/mysql/slow.log", 'curl -o /dev/null -s -w "%{time_total}\\n" https://<api>/endpoint', "SHOW PROCESSLIST;"],
    resolutionChecklist: [
      "Identify the slowest endpoints from APM traces",
      "Add or optimize database indexes",
      "Enable query result caching where appropriate",
      "Check for N+1 query problems in application code",
    ],
  },
  "High Memory Usage": {
    trigger: "memory_usage > 80",
    immediateSteps: ["Check memory leaks", "Restart service", "Analyze memory-consuming apps", "Increase memory resources if needed"],
    commands: ["ps aux --sort=-%mem | head -20", "free -h", "jmap -heap <pid>"],
    resolutionChecklist: [
      "Identify the top memory-consuming process",
      "Check for memory leaks using a profiler (e.g., Valgrind, JProfiler)",
      "Restart affected services as a short-term fix",
      "Increase instance memory or add more nodes if load is legitimate",
    ],
  },
  "Brute Force Attack": {
    trigger: "failed_login_attempts > 200",
    immediateSteps: ["Block suspicious IP addresses", "Enable rate limiting", "Enable account lockout policies", "Review authentication logs", "Enable MFA"],
    commands: ["grep \"Failed password\" /var/log/auth.log | awk '{print $11}' | sort | uniq -c | sort -rn | head -20", "iptables -A INPUT -s <ATTACKER_IP> -j DROP", "fail2ban-client status sshd"],
    resolutionChecklist: [
      "Immediately block top attacking IPs at the firewall level",
      "Enable account lockout after N failed attempts",
      "Force password reset for any compromised accounts",
      "Enable MFA for all privileged accounts",
      "Review logs to determine if any accounts were successfully breached",
    ],
  },
  "DDoS Attack": {
    trigger: "requests_per_second > 10000",
    immediateSteps: ["Enable DDoS protection", "Filter malicious traffic", "Block suspicious IP ranges", "Scale infrastructure temporarily", "Monitor traffic spikes"],
    commands: ["netstat -ntu | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -nr | head -20", "iftop -i eth0", "iptables -A INPUT -p tcp --dport 80 -m limit --limit 100/min -j ACCEPT"],
    resolutionChecklist: [
      "Enable CDN-level DDoS protection (e.g., Cloudflare Under Attack mode)",
      "Activate rate limiting and traffic scrubbing rules",
      "Blackhole-route the attacking IP ranges if identifiable",
      "Temporarily scale up bandwidth/instances to absorb traffic",
      "Contact upstream ISP if attack exceeds infrastructure capacity",
      "Document attack vectors for post-incident review",
    ],
  },
  "Firewall Breach": {
    trigger: "intrusion_attempts > 50",
    immediateSteps: ["Review firewall logs", "Block malicious traffic", "Verify firewall rules", "Isolate affected systems", "Alert security team"],
    commands: ["grep \"DENIED\" /var/log/firewall.log | tail -50", "iptables -L -v -n", "iptables -I INPUT -s 0.0.0.0/0 -j DROP"],
    resolutionChecklist: [
      "Identify which subnet/port was breached",
      "Patch or tighten the specific firewall rule that was bypassed",
      "Isolate any compromised hosts from the internal network",
      "Run a full vulnerability scan on affected segments",
      "File a security incident report and notify compliance team if required",
    ],
  },
  "Port Scanning Activity": {
    trigger: "port_scan_attempts > 100",
    immediateSteps: ["Block suspicious IP addresses", "Enable intrusion detection systems", "Monitor unusual network activity", "Review open ports"],
    commands: ["ss -tulpn", "nmap -sV localhost", "tail -f /var/log/snort/alert"],
    resolutionChecklist: [
      "Confirm the scan source IP and block it at the perimeter",
      "Review which ports are unnecessarily exposed to the internet",
      "Close or firewall any non-essential open ports",
      "Enable an IDS (Snort, Suricata) if not already active",
      "Treat this as a reconnaissance phase — escalate if attacks follow",
    ],
  },
  "Unauthorized Access": {
    trigger: "unauthorized_access_attempts > 50",
    immediateSteps: ["Reset compromised accounts", "Review authentication logs", "Enable MFA", "Restrict suspicious users", "Audit access permissions"],
    commands: ["last -n 20", "grep sudo /var/log/auth.log | tail -20", "who -a"],
    resolutionChecklist: [
      "Immediately revoke sessions and rotate credentials for impacted accounts",
      "Audit all access logs from the past 24–72 hours",
      "Enable MFA on all accounts, especially privileged users",
      "Conduct a full access permission audit (principle of least privilege)",
      "Notify users whose accounts may have been accessed without consent",
    ],
  },
  "High Network Latency": {
    trigger: "network_latency > 500ms",
    immediateSteps: ["Check network infrastructure", "Analyze bandwidth usage", "Restart network devices", "Verify ISP connectivity", "Monitor packet loss"],
    commands: ["ping -c 20 8.8.8.8", "traceroute google.com", "iftop -i eth0"],
    resolutionChecklist: [
      "Run a traceroute to identify where latency is introduced",
      "Check if a specific network segment or ISP link is degraded",
      "Verify no BGP route changes have occurred",
      "Contact ISP if the problem is outside the infrastructure perimeter",
      "Consider failing over to a secondary network link if available",
    ],
  },
};

export default function PlaybookPage() {
  const [selected, setSelected] = useState(RULES[0].name);
  const [search, setSearch] = useState('');

  const filteredRules = RULES.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.type.toLowerCase().includes(search.toLowerCase())
  );

  const rule = RULES.find(r => r.name === selected);
  const rb = RUNBOOK[selected];

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Playbook Viewer</h1>
        <p className="page-subtitle">
          Step-by-step response procedures for every supported incident type.
        </p>
      </div>

      <div className="playbook-layout">
        {/* Sidebar: rule list */}
        <div className="playbook-sidebar">
          <input
            id="playbook-search"
            className="input"
            placeholder="Search runbooks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="playbook-rule-list">
            {filteredRules.map((r) => (
              <button
                key={r.name}
                id={`playbook-${r.name.replace(/\s+/g, '-').toLowerCase()}`}
                className={`playbook-rule-item ${selected === r.name ? 'active' : ''}`}
                onClick={() => setSelected(r.name)}
              >
                <span className="playbook-rule-name">{r.name}</span>
                <SeverityBadge severity={r.severity} />
              </button>
            ))}
          </div>
        </div>

        {/* Main: runbook detail */}
        <div className="playbook-detail animate-slide-right">
          {rule && rb ? (
            <>
              <div className="card playbook-detail-header">
                <div className="playbook-detail-title-row">
                  <h2 className="playbook-detail-title">{rule.name}</h2>
                  <SeverityBadge severity={rule.severity} />
                </div>
                <div className="playbook-trigger">
                  <span className="playbook-trigger-label">TRIGGER</span>
                  <code className="playbook-trigger-code mono">{rb.trigger}</code>
                </div>
              </div>

              <div className="playbook-sections">
                {/* Immediate Steps */}
                <div className="card playbook-section">
                  <h3 className="playbook-section-title">
                    <span>⚡</span> Immediate Steps
                  </h3>
                  <ol className="playbook-ordered-list">
                    {rb.immediateSteps.map((step, i) => (
                      <li key={i} className="playbook-step">{step}</li>
                    ))}
                  </ol>
                </div>

                {/* Diagnostic Commands */}
                <div className="card playbook-section">
                  <h3 className="playbook-section-title">
                    <span>💻</span> Diagnostic Commands
                  </h3>
                  <div className="code-block">
                    {rb.commands.map((cmd, i) => (
                      <div key={i} className="cmd-line">
                        <span className="cmd-prompt">$ </span>
                        <span className="cmd-text">{cmd}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Checks */}
                <div className="card playbook-section">
                  <h3 className="playbook-section-title">
                    <span>🔍</span> Diagnostic Checks
                  </h3>
                  <ul className="playbook-checks">
                    {rule.checks.map((check, i) => (
                      <li key={i} className="playbook-check-item">
                        <span className="check-arrow">→</span>
                        {check}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Resolution Checklist */}
                <div className="card playbook-section">
                  <h3 className="playbook-section-title">
                    <span>✅</span> Resolution Checklist
                  </h3>
                  <ul className="playbook-resolution">
                    {rb.resolutionChecklist.map((item, i) => (
                      <li key={i} className="playbook-resolution-item">
                        <span className="res-check">☐</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Suggested Action */}
                <div className="card playbook-section playbook-action-card">
                  <h3 className="playbook-section-title">
                    <span>🎯</span> Primary Action
                  </h3>
                  <p className="playbook-action-text">{rule.action}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="playbook-empty">
              <span>📘</span>
              <p>Select an incident type from the left to view its runbook.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

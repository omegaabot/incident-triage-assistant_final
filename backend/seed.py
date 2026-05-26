import json
import os
from datetime import datetime

from backend.database import SessionLocal, init_db
from backend.models import Rule, Playbook, Engineer, Base


HARDCODED_RULES = [
    {"name": "High CPU Usage", "type": "system_monitoring", "condition": "cpu_usage > 90",
     "severity": "HIGH", "message": "CPU usage is critically high", "action": "Restart service or scale infrastructure",
     "checks": ["Identify which process is consuming the most CPU", "Check for infinite loops"],
     "checklist": ["Identify top CPU-consuming process", "Review recent deployments"],
     "false_positive_signals": ["cpu_usage < 95", "status == healthy"]},
    {"name": "High Error Rate", "type": "system_monitoring", "condition": "error_rate > 50",
     "severity": "HIGH", "message": "Too many errors detected", "action": "Check logs and API endpoints",
     "checks": ["Check application logs", "Verify database connectivity"],
     "checklist": ["Pull error logs", "Check DB connection pool"],
     "false_positive_signals": ["error_rate < 60", "status == healthy"]},
    {"name": "Slow Response", "type": "system_monitoring", "condition": "response_time > 1000",
     "severity": "MEDIUM", "message": "Response time is slow", "action": "Optimize database queries",
     "checks": ["Check if response_time is endpoint-specific", "Review slow query logs"],
     "checklist": ["Identify slowest endpoint", "Run EXPLAIN on slow queries"],
     "false_positive_signals": ["response_time < 1200", "cpu_usage < 50"]},
    {"name": "High Memory Usage", "type": "system_monitoring", "condition": "memory_usage > 80",
     "severity": "MEDIUM", "message": "Memory usage is high", "action": "Check memory leaks or restart service",
     "checks": ["Identify consuming process", "Check if memory grows over time"],
     "checklist": ["Identify memory-consuming process", "Check memory trend"],
     "false_positive_signals": ["memory_usage < 85", "status == healthy"]},
    {"name": "Brute Force Attack", "type": "bruteforce_attack", "condition": "failed_login_attempts > 200",
     "severity": "HIGH", "message": "Possible brute force attack detected", "action": "Block suspicious IPs and enable rate limiting",
     "checks": ["Check if attempts are from a single IP", "Verify if any succeeded"],
     "checklist": ["Block attacking IPs", "Enable account lockout", "Force password reset"],
     "false_positive_signals": ["failed_login_attempts < 250", "blocked_ips > 40"]},
    {"name": "DDoS Attack", "type": "ddos_attack", "condition": "requests_per_second > 10000",
     "severity": "HIGH", "message": "Possible DDoS attack detected", "action": "Enable DDoS protection and traffic filtering",
     "checks": ["Check if spike is from a single origin", "Review packet_loss percentage"],
     "checklist": ["Enable CDN-level DDoS protection", "Activate rate limiting", "Blackhole attacking IPs"],
     "false_positive_signals": ["requests_per_second < 15000", "packet_loss < 10"]},
    {"name": "Firewall Breach", "type": "firewall_breach", "condition": "intrusion_attempts > 50",
     "severity": "HIGH", "message": "Firewall intrusion attempts detected", "action": "Review firewall logs and block malicious traffic",
     "checks": ["Identify which rule was bypassed", "Check blocked_connections ratio"],
     "checklist": ["Isolate affected hosts", "Patch firewall rule", "Run vulnerability scan"],
     "false_positive_signals": ["intrusion_attempts < 75", "blocked_connections > 450"]},
    {"name": "Port Scanning Activity", "type": "port_scanning", "condition": "port_scan_attempts > 100",
     "severity": "MEDIUM", "message": "Port scanning activity detected", "action": "Block suspicious IP addresses",
     "checks": ["Determine if single or coordinated", "Check which ports were probed"],
     "checklist": ["Block scanning IPs", "Audit open ports", "Enable IDS/IPS"],
     "false_positive_signals": ["port_scan_attempts < 200", "blocked_ips > 15"]},
    {"name": "Unauthorized Access", "type": "unauthorized_access", "condition": "unauthorized_access_attempts > 50",
     "severity": "HIGH", "message": "Unauthorized access attempts detected", "action": "Review authentication logs and secure accounts",
     "checks": ["Check if any succeeded", "Review suspicious_ip_count"],
     "checklist": ["Revoke active sessions", "Rotate credentials", "Enable MFA"],
     "false_positive_signals": ["unauthorized_access_attempts < 75", "failed_login_attempts < 100"]},
    {"name": "High Network Latency", "type": "network_latency", "condition": "network_latency > 500",
     "severity": "MEDIUM", "message": "Network latency is unusually high", "action": "Check network infrastructure and traffic",
     "checks": ["Run traceroute", "Check if latency is regional"],
     "checklist": ["Run traceroute to key services", "Check bandwidth utilization", "Fail over to backup link"],
     "false_positive_signals": ["network_latency < 700", "packet_loss < 5"]},
]

HARDCODED_PLAYBOOKS = {
    "High CPU Usage": {"trigger": "cpu_usage > 90", "steps": ["Restart service", "Check running processes", "Scale infrastructure"],
                       "commands": ["top -o %CPU", "systemctl status service", "vmstat 1 10"],
                       "checklist": ["Identify process", "Check for infinite loops", "Scale horizontally"]},
    "High Error Rate": {"trigger": "error_rate > 50", "steps": ["Check logs", "Validate API endpoints", "Debug recent changes"],
                        "commands": ["tail -f /var/log/app/error.log", "curl -I https://health"],
                        "checklist": ["Check deployment", "Verify dependencies", "Roll back if needed"]},
    "Slow Response": {"trigger": "response_time > 1000ms", "steps": ["Optimize queries", "Check latency", "Analyze endpoints"],
                      "commands": ["mysqldumpslow -s t slow.log", "curl -w time_total"],
                      "checklist": ["Identify slow endpoints", "Add indexes", "Enable caching"]},
    "High Memory Usage": {"trigger": "memory_usage > 80", "steps": ["Check leaks", "Restart service", "Analyze memory apps"],
                          "commands": ["ps aux --sort=-%mem", "free -h", "jmap -heap"],
                          "checklist": ["Find top consumer", "Check for leaks", "Restart service"]},
    "Brute Force Attack": {"trigger": "failed_login_attempts > 200", "steps": ["Block IPs", "Rate limit", "Review logs", "Enable MFA"],
                           "commands": ["grep 'Failed password' /var/log/auth.log", "iptables -A INPUT -s IP -j DROP"],
                           "checklist": ["Block attacking IPs", "Enable lockout", "Force password reset"]},
    "DDoS Attack": {"trigger": "requests_per_second > 10000", "steps": ["Enable DDoS protection", "Filter traffic", "Block IP ranges"],
                    "commands": ["netstat -ntu | awk '{print $5}' | sort | uniq -c", "iftop -i eth0"],
                    "checklist": ["Enable CDN protection", "Activate rate limiting", "Backhole IPs"]},
    "Firewall Breach": {"trigger": "intrusion_attempts > 50", "steps": ["Review logs", "Block traffic", "Verify rules", "Isolate systems"],
                        "commands": ["grep DENIED /var/log/firewall.log", "iptables -L -v -n"],
                        "checklist": ["Identify breached subnet", "Patch firewall rule", "Isolate hosts"]},
    "Port Scanning Activity": {"trigger": "port_scan_attempts > 100", "steps": ["Block IPs", "Enable IDS", "Review ports"],
                               "commands": ["ss -tulpn", "nmap -sV localhost"],
                               "checklist": ["Block scanning IPs", "Audit open ports", "Enable IDS"]},
    "Unauthorized Access": {"trigger": "unauthorized_access_attempts > 50", "steps": ["Reset accounts", "Review logs", "Enable MFA"],
                            "commands": ["last -n 20", "grep sudo /var/log/auth.log"],
                            "checklist": ["Revoke sessions", "Rotate credentials", "Enable MFA"]},
    "High Network Latency": {"trigger": "network_latency > 500ms", "steps": ["Check infrastructure", "Analyze bandwidth", "Restart devices"],
                             "commands": ["ping -c 20 8.8.8.8", "traceroute google.com"],
                             "checklist": ["Run traceroute", "Check bandwidth", "Fail over to backup"]},
}

HARDCODED_ENGINEERS = [
    {"name": "Ramesh", "team": "Senior SRE Team", "email": "ramesh.sre@company.com", "phone": "+91-9876543210", "escalation_level": "SEV-1"},
    {"name": "Priya", "team": "Cloud Support Team", "email": "priya.support@company.com", "phone": "+91-9123456780", "escalation_level": "SEV-2"},
    {"name": "Monitoring Team", "team": "NOC Team", "email": "noc@company.com", "phone": "+91-9000000000", "escalation_level": "SEV-3"},
]


def seed():
    init_db()
    db = SessionLocal()

    db.query(Rule).delete()
    db.query(Playbook).delete()
    db.query(Engineer).delete()
    db.commit()

    for r in HARDCODED_RULES:
        db.add(Rule(
            name=r["name"], type=r["type"], condition=r["condition"],
            severity=r["severity"], message=r["message"], action=r["action"],
            checks=r.get("checks", []), checklist=r.get("checklist", []),
            false_positive_signals=r.get("false_positive_signals", []),
        ))
    db.commit()

    for name, pb in HARDCODED_PLAYBOOKS.items():
        db.add(Playbook(
            rule_name=name, trigger=pb["trigger"],
            immediate_steps=pb["steps"], commands=pb["commands"],
            resolution_checklist=pb["checklist"],
        ))
    db.commit()

    for eng in HARDCODED_ENGINEERS:
        db.add(Engineer(
            name=eng["name"], team=eng["team"], email=eng["email"],
            phone=eng["phone"], escalation_level=eng["escalation_level"],
        ))
    db.commit()

    db.close()
    print("Database seeded successfully with 10 rules, 10 playbooks, and 3 engineers.")


if __name__ == "__main__":
    seed()

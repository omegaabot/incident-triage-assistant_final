from backend.models import MetricBaseline
from sqlalchemy.orm import Session


METRIC_FIELDS = [
    "cpu_usage", "memory_usage", "error_rate", "response_time",
    "requests_per_second", "network_latency", "packet_loss",
    "failed_login_attempts", "unauthorized_access_attempts",
    "port_scan_attempts", "intrusion_attempts", "bandwidth_usage"
]


def z_score_anomaly(value, mean, stddev, threshold=3.0):
    if stddev == 0:
        return False
    return abs(value - mean) / stddev > threshold


def iqr_anomaly(value, p25, p75, multiplier=1.5):
    iqr = p75 - p25
    if iqr == 0:
        return False
    lower = p25 - multiplier * iqr
    upper = p75 + multiplier * iqr
    return value < lower or value > upper


def rate_of_change_anomaly(current, previous, max_change_pct=300):
    if previous == 0:
        return False
    change_pct = abs(current - previous) / previous * 100
    return change_pct > max_change_pct


def compute_baselines_from_results(results: list) -> dict:
    service_metrics = {}
    for r in results:
        alert = r.alert_data if isinstance(r.alert_data, dict) else {}
        service = alert.get("service", "__unknown__")
        if service not in service_metrics:
            service_metrics[service] = {m: [] for m in METRIC_FIELDS}
        for m in METRIC_FIELDS:
            val = alert.get(m)
            if val is not None and isinstance(val, (int, float)):
                service_metrics[service][m].append(val)

    baselines = []
    for service, metrics in service_metrics.items():
        for metric_name, values in metrics.items():
            if len(values) < 5:
                continue
            values.sort()
            n = len(values)
            mean = sum(values) / n
            variance = sum((v - mean) ** 2 for v in values) / n
            stddev = variance ** 0.5
            p50 = values[int(n * 0.5)] if n > 0 else 0
            p95 = values[int(n * 0.95)] if n > 0 else 0
            p99 = values[int(n * 0.99)] if n > 0 else 0
            min_val = values[0]
            max_val = values[-1]
            baselines.append({
                "service": service,
                "metric_name": metric_name,
                "mean": round(mean, 2),
                "stddev": round(stddev, 2),
                "p50": round(p50, 2),
                "p95": round(p95, 2),
                "p99": round(p99, 2),
                "min_val": round(min_val, 2),
                "max_val": round(max_val, 2),
                "sample_count": n,
            })
    return baselines


def detect_anomalies(alert: dict, baselines: list[MetricBaseline]) -> list[dict]:
    anomalies = []
    bl_map = {}
    for bl in baselines:
        bl_map[(bl.service, bl.metric_name)] = bl

    service = alert.get("service", "__unknown__")
    for metric in METRIC_FIELDS:
        value = alert.get(metric)
        if value is None or not isinstance(value, (int, float)):
            continue
        bl = bl_map.get((service, metric))
        if bl and bl.sample_count >= 5:
            if z_score_anomaly(value, bl.mean, bl.stddev):
                anomalies.append({
                    "metric": metric,
                    "value": value,
                    "mean": bl.mean,
                    "stddev": bl.stddev,
                    "z_score": round(abs(value - bl.mean) / max(bl.stddev, 0.001), 2),
                    "method": "z-score",
                    "severity": "HIGH" if abs(value - bl.mean) / max(bl.stddev, 0.001) > 4 else "MEDIUM",
                })
    return anomalies

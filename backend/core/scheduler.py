from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from backend.database import SessionLocal
from backend.models import MetricBaseline, TriageResult
from backend.core.anomaly import compute_baselines_from_results


def recompute_baselines():
    db = SessionLocal()
    try:
        results = db.query(TriageResult).all()
        if not results:
            return

        raw_baselines = compute_baselines_from_results(results)

        db.query(MetricBaseline).delete()

        for b in raw_baselines:
            baseline = MetricBaseline(
                service=b["service"],
                metric_name=b["metric_name"],
                mean=b["mean"],
                stddev=b["stddev"],
                p50=b["p50"],
                p95=b["p95"],
                p99=b["p99"],
                min_val=b["min_val"],
                max_val=b["max_val"],
                sample_count=b["sample_count"],
                window_hours=168,
                updated_at=datetime.utcnow(),
            )
            db.add(baseline)
        db.commit()
    finally:
        db.close()


scheduler = BackgroundScheduler()
scheduler.add_job(
    recompute_baselines,
    IntervalTrigger(hours=1),
    id="recompute_baselines",
    name="Recompute metric baselines from triage history",
    replace_existing=True,
)

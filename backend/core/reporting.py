import csv
import io
import math
from datetime import datetime, timedelta
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Flowable, Table, TableStyle)
from reportlab.graphics.shapes import Drawing, String, Line, Rect, Circle
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics import renderPDF
from sqlalchemy.orm import Session
from backend.models import TriageResult, Rule


BG_PAGE = HexColor("#FFFFFF")
BG_CARD = HexColor("#FFFFFF")
BG_HEADER = HexColor("#F3F4F6")
BG_ROW_ALT = HexColor("#F9FAFB")
TEXT_PRIMARY = HexColor("#111827")
TEXT_SECONDARY = HexColor("#4B5563")
TEXT_MUTED = HexColor("#6B7280")
BLUE = HexColor("#2563EB")
BLUE_LIGHT = HexColor("#EFF6FF")
GREEN = HexColor("#059669")
GREEN_LIGHT = HexColor("#ECFDF5")
ORANGE = HexColor("#EA580C")
ORANGE_LIGHT = HexColor("#FFF7ED")
YELLOW = HexColor("#D97706")
YELLOW_LIGHT = HexColor("#FFFBEB")
RED = HexColor("#DC2626")
RED_LIGHT = HexColor("#FEF2F2")
BORDER = HexColor("#E5E7EB")
SEV_COLORS = {"CRITICAL": RED, "HIGH": ORANGE, "MEDIUM": YELLOW, "LOW": GREEN}
SEV_BG = {"CRITICAL": RED_LIGHT, "HIGH": ORANGE_LIGHT, "MEDIUM": YELLOW_LIGHT, "LOW": GREEN_LIGHT}
SEV_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]


def _sev_hex(sev):
    return "#" + SEV_COLORS[sev].hexval() if hasattr(SEV_COLORS[sev], 'hexval') else "#DC2626"


class _SectionHeader(Flowable):
    def __init__(self, text, width):
        Flowable.__init__(self)
        self.text = text
        self.w = width
        self.height = 36

    def draw(self):
        c = self.canv
        c.setFillColor(BG_PAGE)
        c.rect(0, 0, self.w, self.height, fill=1, stroke=0)
        c.setFillColor(BLUE)
        c.rect(0, 8, 3, self.height - 16, fill=1, stroke=0)
        c.setFillColor(TEXT_PRIMARY)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(14, 10, self.text.upper())
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.5)
        c.line(0, 2, self.w, 2)


class _KpiCardRow(Flowable):
    def __init__(self, cards, width):
        Flowable.__init__(self)
        self.cards = cards
        self.w = width
        gap = 10
        self.card_w = (width - gap * 3) / 4
        self.card_h = 70
        self.height = self.card_h

    def draw(self):
        c = self.canv
        gap = 10
        for i, (label, value_str, color, _) in enumerate(self.cards):
            x = i * (self.card_w + gap)
            c.setFillColor(BG_CARD)
            c.roundRect(x, 0, self.card_w, self.card_h, 8, fill=1, stroke=0)
            c.setStrokeColor(BORDER)
            c.setLineWidth(0.5)
            c.roundRect(x, 0, self.card_w, self.card_h, 8, fill=0, stroke=1)
            c.setFillColor(TEXT_PRIMARY)
            c.setFont("Helvetica-Bold", 7.5)
            c.drawString(x + 14, self.card_h - 18, label)
            c.setFillColor(color)
            c.setFont("Helvetica-Bold", 24)
            c.drawString(x + 14, self.card_h - 48, value_str)


class _AlertFeedCard(Flowable):
    def __init__(self, width, service, alert_type, description, severity, is_fp, fp_conf):
        Flowable.__init__(self)
        self.w = width
        self.service = service
        self.alert_type = alert_type
        self.desc = description or alert_type
        self.severity = severity
        self.is_fp = is_fp
        self.fp_conf = fp_conf
        self.card_h = 48
        self.height = self.card_h + 6

    def draw(self):
        c = self.canv
        y = 3
        sev_color = SEV_COLORS.get(self.severity, TEXT_MUTED)
        c.setFillColor(BG_CARD)
        c.roundRect(0, y, self.w, self.card_h, 6, fill=1, stroke=0)
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.5)
        c.roundRect(0, y, self.w, self.card_h, 6, fill=0, stroke=1)
        c.setFillColor(sev_color)
        c.rect(0, y + 6, 3, self.card_h - 12, fill=1, stroke=0)
        c.setFillColor(TEXT_PRIMARY)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(16, y + self.card_h - 16, self.service)
        sev_text = self.severity
        bw = c.stringWidth(sev_text, "Helvetica-Bold", 7.5) + 16
        bx = self.w - bw - 12
        by = y + self.card_h - 20
        c.setFillColor(SEV_BG.get(self.severity, RED_LIGHT))
        c.roundRect(bx, by, bw, 18, 9, fill=1, stroke=0)
        c.setFillColor(sev_color)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(bx + 8, by + 5, sev_text)
        fp_x = bx - 8
        if self.is_fp:
            fp_t = f"FP {self.fp_conf}%"
            fw = c.stringWidth(fp_t, "Helvetica-Bold", 7.5) + 14
            fp_x = bx - fw - 8
            c.setFillColor(GREEN_LIGHT)
            c.roundRect(fp_x, by, fw, 18, 9, fill=1, stroke=0)
            c.setFillColor(GREEN)
            c.setFont("Helvetica-Bold", 7.5)
            c.drawString(fp_x + 7, by + 5, fp_t)
        desc = self.desc if len(self.desc) < 80 else self.desc[:77] + "..."
        c.setFillColor(TEXT_SECONDARY)
        c.setFont("Helvetica", 8)
        c.drawString(16, y + self.card_h - 34, desc)


class _SeverityDoughnut(Flowable):
    def __init__(self, width, sev_counts, total):
        Flowable.__init__(self)
        self.w = width
        self.sev_counts = sev_counts
        self.total = total
        self.height = 150

    def draw(self):
        c = self.canv
        pie_data = []
        pie_labels = []
        for sev in SEV_ORDER:
            cnt = self.sev_counts.get(sev, 0)
            if cnt > 0:
                pie_data.append(cnt)
                pie_labels.append(sev)

        if not pie_data:
            c.setFillColor(TEXT_SECONDARY)
            c.setFont("Helvetica-Bold", 10)
            c.drawString(10, 60, "No data")
            return

        d = Drawing(200, 150)
        pie = Pie()
        pie.x = 35
        pie.y = 20
        pie.width = 110
        pie.height = 110
        pie.data = pie_data
        pie.labels = ["" for _ in pie_data]
        pie.slices.strokeColor = BG_PAGE
        pie.slices.strokeWidth = 3
        for idx in range(len(pie_data)):
            sev_name = pie_labels[idx]
            pie.slices[idx].fillColor = SEV_COLORS[sev_name]
        d.add(pie)
        renderPDF.draw(d, c, 0, 0)

        lx = 195
        ly = self.height - 8
        for sev in SEV_ORDER:
            cnt = self.sev_counts.get(sev, 0)
            pct = round(cnt / max(self.total, 1) * 100, 1)
            color = SEV_COLORS[sev]
            c.setFillColor(color)
            c.roundRect(lx, ly - 4, 10, 10, 2, fill=1, stroke=0)
            c.setFillColor(TEXT_PRIMARY)
            c.setFont("Helvetica-Bold", 8)
            c.drawString(lx + 16, ly - 3, sev.title())
            c.setFillColor(TEXT_PRIMARY)
            c.setFont("Helvetica-Bold", 8)
            c.drawString(lx + 80, ly - 3, f"{cnt} ({pct}%)")
            ly -= 24


class _BarChart(Flowable):
    def __init__(self, width, items, bar_color, max_label_w=100):
        Flowable.__init__(self)
        self.w = width
        self.items = items
        self.bar_color = bar_color
        self.max_label_w = max_label_w
        self.bar_h = 18
        self.gap = 8
        self.height = max(len(items) * (self.bar_h + self.gap) + 20, 40)

    def draw(self):
        c = self.canv
        if not self.items:
            return
        vals = [v for _, v in self.items]
        max_val = max(vals) if vals else 1
        avail_w = self.w - self.max_label_w - 56
        y = self.height - self.bar_h - 8
        for label, value in self.items:
            pct = (value / max_val) * 100
            bar_w = max(3, (pct / 100) * avail_w)
            c.setFillColor(TEXT_PRIMARY)
            c.setFont("Helvetica-Bold", 8)
            c.drawString(2, y + 4, label[:22])
            c.setStrokeColor(BORDER)
            c.setLineWidth(0.5)
            c.roundRect(self.max_label_w, y, avail_w, self.bar_h, 4, fill=0, stroke=1)
            c.setFillColor(self.bar_color)
            c.roundRect(self.max_label_w, y, bar_w, self.bar_h, 4, fill=1, stroke=0)
            c.setFillColor(TEXT_PRIMARY)
            c.setFont("Helvetica-Bold", 8)
            c.drawString(self.max_label_w + avail_w + 8, y + 4, str(value))
            y -= self.bar_h + self.gap


class _CompactTable(Flowable):
    def __init__(self, w, headers, rows, col_widths):
        Flowable.__init__(self)
        self.w = w
        self.headers = headers
        self.rows = rows
        self.col_widths = col_widths
        self.row_h = 18
        self.header_h = 22
        self.height = len(rows) * self.row_h + self.header_h + 10

    def draw(self):
        c = self.canv
        total_w = sum(self.col_widths)
        col_x = []
        x = 0
        for cw in self.col_widths:
            col_x.append(x)
            x += cw
        c.setFillColor(BG_HEADER)
        c.roundRect(0, self.height - self.header_h - 4, total_w, self.header_h, 6, fill=1, stroke=0)
        c.setFillColor(TEXT_PRIMARY)
        c.setFont("Helvetica-Bold", 7.5)
        for j, h in enumerate(self.headers):
            c.drawString(col_x[j] + 8, self.height - self.header_h + 5, h)
        for i, row in enumerate(self.rows):
            y = self.height - self.header_h - 6 - (i + 1) * self.row_h
            if i % 2 == 1:
                c.setFillColor(BG_ROW_ALT)
                c.rect(0, y, total_w, self.row_h, fill=1, stroke=0)
            for j, val in enumerate(row):
                c.setFillColor(TEXT_PRIMARY)
                c.setFont("Helvetica", 7.5)
                if j == 3 and val in SEV_COLORS:
                    c.setFillColor(SEV_COLORS[val])
                    c.setFont("Helvetica-Bold", 7.5)
                if j == 5:
                    c.setFillColor(GREEN if val else TEXT_MUTED)
                    c.setFont("Helvetica-Bold", 7.5) if val else c.setFont("Helvetica", 7.5)
                c.drawString(col_x[j] + 8, y + 4, str(val))


def generate_csv_report(db: Session, days: int = 7) -> str:
    since = datetime.utcnow() - timedelta(days=days)
    results = db.query(TriageResult).filter(TriageResult.timestamp >= since).order_by(TriageResult.timestamp.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Service", "Type", "Severity", "Risk Score", "Priority", "FP", "FP Confidence", "Engineer", "Escalation", "Matched Rules", "Timestamp"])

    for r in results:
        writer.writerow([
            r.id,
            r.alert_data.get("service", "") if isinstance(r.alert_data, dict) else "",
            r.alert_data.get("type", "") if isinstance(r.alert_data, dict) else "",
            r.final_severity,
            r.risk_score,
            r.priority_score,
            "Yes" if r.is_false_positive else "No",
            r.fp_confidence,
            r.engineer_name,
            r.escalation_level,
            ", ".join(r.matched_rule_names or []),
            r.timestamp.strftime("%Y-%m-%d %H:%M:%S") if r.timestamp else "",
        ])

    return output.getvalue()


def generate_summary_stats(db: Session, days: int = 7) -> dict:
    since = datetime.utcnow() - timedelta(days=days)
    results = db.query(TriageResult).filter(TriageResult.timestamp >= since).all()
    rules_count = db.query(Rule).count()

    total = len(results)
    critical = sum(1 for r in results if r.final_severity == "CRITICAL")
    high = sum(1 for r in results if r.final_severity == "HIGH")
    medium = sum(1 for r in results if r.final_severity == "MEDIUM")
    low = sum(1 for r in results if r.final_severity == "LOW")
    false_positives = sum(1 for r in results if r.is_false_positive)
    avg_risk = sum(r.risk_score for r in results) / max(total, 1)

    severity_dist = {"CRITICAL": critical, "HIGH": high, "MEDIUM": medium, "LOW": low}

    service_counts = {}
    type_counts = {}
    for r in results:
        ad = r.alert_data if isinstance(r.alert_data, dict) else {}
        svc = ad.get("service", "unknown")
        service_counts[svc] = service_counts.get(svc, 0) + 1
        at = ad.get("type", "unknown")
        type_counts[at] = type_counts.get(at, 0) + 1

    top_rules = {}
    for r in results:
        for name in (r.matched_rule_names or []):
            top_rules[name] = top_rules.get(name, 0) + 1
    top_rules = dict(sorted(top_rules.items(), key=lambda x: x[1], reverse=True)[:10])

    return {
        "period_days": days,
        "total_alerts": total,
        "severity_distribution": severity_dist,
        "false_positives": false_positives,
        "fp_rate": round(false_positives / max(total, 1) * 100, 1),
        "avg_risk_score": round(avg_risk, 1),
        "top_services": dict(sorted(service_counts.items(), key=lambda x: x[1], reverse=True)[:10]),
        "top_types": dict(sorted(type_counts.items(), key=lambda x: x[1], reverse=True)[:10]),
        "top_matched_rules": top_rules,
        "rules_count": rules_count if rules_count > 0 else 10,
    }


def generate_pdf_report(db: Session, days: int = 7) -> io.BytesIO:
    since = datetime.utcnow() - timedelta(days=days)
    results = db.query(TriageResult).filter(TriageResult.timestamp >= since).order_by(TriageResult.timestamp.desc()).all()
    stats = generate_summary_stats(db, days)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=20*mm, bottomMargin=18*mm, leftMargin=18*mm, rightMargin=18*mm,
    )
    pw = A4[0] - 36*mm
    elements = []

    # ── 1. HEADER ──
    elements.append(Spacer(1, 12))

    class _HeaderRow(Flowable):
        def __init__(self, w):
            Flowable.__init__(self)
            self.w = w
            self.height = 50

        def draw(self):
            c = self.canv
            c.setFillColor(BG_CARD)
            c.roundRect(0, 0, self.w, self.height, 8, fill=1, stroke=0)
            c.setStrokeColor(BORDER)
            c.setLineWidth(0.5)
            c.roundRect(0, 0, self.w, self.height, 8, fill=0, stroke=1)
            c.setFillColor(TEXT_PRIMARY)
            c.setFont("Helvetica-Bold", 20)
            c.drawString(16, self.height - 20, "Sentinel Command Center Report")
            badge_w = c.stringWidth("Generated Report", "Helvetica-Bold", 8) + 24
            badge_x = self.w - badge_w - 14
            badge_y = self.height / 2 - 10
            c.setFillColor(BLUE_LIGHT)
            c.roundRect(badge_x, badge_y, badge_w, 20, 10, fill=1, stroke=0)
            c.setStrokeColor(BLUE)
            c.setLineWidth(0.5)
            c.roundRect(badge_x, badge_y, badge_w, 20, 10, fill=0, stroke=1)
            c.setFillColor(BLUE)
            c.setFont("Helvetica-Bold", 8)
            c.drawString(badge_x + 12, badge_y + 6, "Generated Report")

    elements.append(_HeaderRow(pw))
    elements.append(Spacer(1, 8))

    subtitle_style = ParagraphStyle("hSub", fontName="Helvetica-Bold", fontSize=10, textColor=TEXT_SECONDARY, spaceAfter=4, leading=14)
    elements.append(Paragraph(
        f'Incident analysis &middot; {stats["total_alerts"]} alerts processed &middot; Last {days} days',
        subtitle_style
    ))

    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    meta_style = ParagraphStyle("hMeta", fontName="Helvetica", fontSize=8, textColor=TEXT_MUTED, spaceAfter=14, leading=11)
    elements.append(Paragraph(
        f'Report Period: Last {days}d &nbsp;&#8226;&nbsp; Generated: {now_str} &nbsp;&#8226;&nbsp; Total Sessions: {stats["total_alerts"]}',
        meta_style
    ))
    elements.append(Spacer(1, 6))

    # ── 2. KPI CARDS ──
    sev = stats["severity_distribution"]
    crit_high = sev["CRITICAL"] + sev["HIGH"]
    kpi_cards = [
        ("Total Alerts", str(stats["total_alerts"]), BLUE, 0),
        ("Critical / High", str(crit_high), RED, 0),
        ("False Positives", str(stats["false_positives"]), GREEN, 0),
        ("Active Rules", str(stats["rules_count"]), ORANGE, 0),
    ]
    elements.append(_KpiCardRow(kpi_cards, pw))
    elements.append(Spacer(1, 20))

    # ── 3. ALERT FEED ──
    if results:
        elements.append(_SectionHeader("Alert Feed", pw))
        elements.append(Spacer(1, 6))
        for r in results[:6]:
            ad = r.alert_data if isinstance(r.alert_data, dict) else {}
            svc = ad.get("service", "N/A")
            atype = ad.get("type", "N/A")
            desc = ad.get("description", ad.get("type", ""))
            elements.append(_AlertFeedCard(pw, svc, atype, desc, r.final_severity,
                                          r.is_false_positive, r.fp_confidence))
            elements.append(Spacer(1, 4))
        elements.append(Spacer(1, 10))

    # ── 4. SEVERITY DISTRIBUTION + ALERTS OVER TIME ──
    elements.append(_SectionHeader("Severity Distribution &amp; Trends", pw))
    elements.append(Spacer(1, 6))

    donut = _SeverityDoughnut(pw * 0.48, sev, stats["total_alerts"])
    donut_w = pw * 0.48

    timeline = alerts_over_time(db, days)
    bar_items = [(d["date"][-5:], d["total"]) for d in timeline[-10:]] if timeline else []
    bar_chart = _BarChart(pw * 0.48, bar_items, BLUE, max_label_w=44) if bar_items else Spacer(1, 10)
    bar_chart_w = pw * 0.48

    class _TwoColumn(Flowable):
        def __init__(self, left_f, right_f, lw, rw, h):
            Flowable.__init__(self)
            self.left = left_f
            self.right = right_f
            self.lw = lw
            self.rw = rw
            self.height = h

        def draw(self):
            self.left.canv = self.canv
            self.left.draw()
            self.canv.saveState()
            self.canv.translate(self.lw + 20, 0)
            self.right.canv = self.canv
            self.right.draw()
            self.canv.restoreState()

    col_h = max(donut.height, bar_chart.height if hasattr(bar_chart, 'height') else 40)
    elements.append(_TwoColumn(donut, bar_chart, donut_w, bar_chart_w, col_h))
    elements.append(Spacer(1, 20))

    # ── 5. TOP SERVICES ──
    if stats["top_services"]:
        elements.append(_SectionHeader("Top Affected Services", pw))
        elements.append(Spacer(1, 6))
        svc_items = list(stats["top_services"].items())
        elements.append(_BarChart(pw, svc_items, BLUE))
        elements.append(Spacer(1, 16))

    # ── 6. RULES & ALERT TYPES ──
    if stats["top_matched_rules"] or stats["top_types"]:
        elements.append(_SectionHeader("Rules &amp; Alert Types", pw))
        elements.append(Spacer(1, 6))

        rule_items = list(stats["top_matched_rules"].items())
        type_items = [(t.replace("_", " ").title(), c) for t, c in stats["top_types"].items()]
        rules_chart = _BarChart(pw * 0.48, rule_items, BLUE, max_label_w=88) if rule_items else Spacer(1, 10)
        types_chart = _BarChart(pw * 0.48, type_items, ORANGE, max_label_w=88) if type_items else Spacer(1, 10)
        rch = rules_chart.height if hasattr(rules_chart, 'height') else 40
        tch = types_chart.height if hasattr(types_chart, 'height') else 40
        elements.append(_TwoColumn(rules_chart, types_chart, pw * 0.48, pw * 0.48, max(rch, tch)))
        elements.append(Spacer(1, 20))

    # ── 7. DETAILED LOG ──
    if results:
        elements.append(_SectionHeader("Detailed Alert Log", pw))
        elements.append(Spacer(1, 6))
        log_items = []
        for r in results[:25]:
            ad = r.alert_data if isinstance(r.alert_data, dict) else {}
            svc = ad.get("service", "N/A")
            atype = ad.get("type", "N/A")
            log_items.append((str(r.id), svc[:14], atype[:16], r.final_severity, str(r.risk_score), "FP" if r.is_false_positive else ""))

        col_widths = [26, 74, 90, 56, 36, 30]
        headers = ["ID", "Service", "Type", "Severity", "Risk", "FP"]
        elements.append(_CompactTable(pw, headers, log_items, col_widths))
        elements.append(Spacer(1, 14))

    # ── FOOTER ──
    elements.append(Spacer(1, 10))
    footer_style = ParagraphStyle("f", fontName="Helvetica", fontSize=7.5, textColor=TEXT_MUTED, alignment=TA_CENTER)
    elements.append(Paragraph(
        "Incident Triage Assistant &middot; Sentinel Command Center &middot; Automated SOC Report &nbsp;&#8226;&nbsp; Page <page/>",
        footer_style
    ))

    doc.build(elements)
    buf.seek(0)
    return buf


def alerts_over_time(db: Session, days: int = 7) -> list[dict]:
    since = datetime.utcnow() - timedelta(days=days)
    results = db.query(TriageResult).filter(TriageResult.timestamp >= since).order_by(TriageResult.timestamp.asc()).all()

    daily = {}
    for r in results:
        day = r.timestamp.strftime("%Y-%m-%d") if r.timestamp else "unknown"
        if day not in daily:
            daily[day] = {"date": day, "total": 0, "CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "FP": 0}
        daily[day]["total"] += 1
        daily[day][r.final_severity] = daily[day].get(r.final_severity, 0) + 1
        if r.is_false_positive:
            daily[day]["FP"] += 1

    return [daily[d] for d in sorted(daily.keys())]

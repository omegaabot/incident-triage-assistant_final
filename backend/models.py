from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON
from backend.database import Base


class Rule(Base):
    __tablename__ = "rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    condition = Column(String, nullable=False)
    severity = Column(String, nullable=False)
    message = Column(String, nullable=False)
    action = Column(String, nullable=False)
    checks = Column(JSON, default=list)
    checklist = Column(JSON, default=list)
    false_positive_signals = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)


class Playbook(Base):
    __tablename__ = "playbooks"

    id = Column(Integer, primary_key=True, index=True)
    rule_name = Column(String, nullable=False)
    trigger = Column(String, nullable=False)
    immediate_steps = Column(JSON, default=list)
    commands = Column(JSON, default=list)
    resolution_checklist = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)


class Engineer(Base):
    __tablename__ = "engineers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    team = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    escalation_level = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class TriageResult(Base):
    __tablename__ = "triage_results"

    id = Column(Integer, primary_key=True, index=True)
    alert_data = Column(JSON, nullable=False)
    final_severity = Column(String, nullable=False)
    escalation_level = Column(String, nullable=False)
    risk_score = Column(Integer, default=0)
    priority_score = Column(Integer, default=0)
    is_false_positive = Column(Boolean, default=False)
    fp_confidence = Column(Integer, default=0)
    engineer_name = Column(String, nullable=True)
    matched_rule_names = Column(JSON, default=list)
    timestamp = Column(DateTime, default=datetime.utcnow)

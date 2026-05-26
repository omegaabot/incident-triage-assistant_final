from pydantic import BaseModel
from typing import Optional


class AlertInput(BaseModel):
    type: str
    service: str
    status: Optional[str] = "unknown"


class RuleCreate(BaseModel):
    name: str
    type: str
    condition: str
    severity: str
    message: str
    action: str
    checks: list = []
    checklist: list = []
    false_positive_signals: list = []


class PlaybookCreate(BaseModel):
    rule_name: str
    trigger: str
    immediate_steps: list = []
    commands: list = []
    resolution_checklist: list = []

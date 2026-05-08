# Incident Triage Assistant

## Overview
A CLI-based tool to analyze system alerts and classify severity using rule-based logic.

## Features
- Rule-based alert processing
- Severity classification (LOW, MEDIUM, HIGH)
- Priority scoring
- Multi-alert processing
- Runbook integration
- Report generation

## Project Structure
- src/ → main code
- data/ → sample alerts
- rules/ → rules config
- runbook/ → troubleshooting steps
- output/ → generated reports

## How to Run
```bash
cd src
python triage.py

import { useState } from 'react';
import SeverityBadge from './SeverityBadge';
import './TriageReport.css';

function ChecklistItem({ text, index }) {
  const [done, setDone] = useState(false);
  return (
    <div className={`checklist-item ${done ? 'done' : ''}`}>
      <button
        className={`checklist-checkbox ${done ? 'checked' : ''}`}
        onClick={() => setDone(!done)}
        id={`check-${index}`}
      >
        {done && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </button>
      <span className="checklist-label">{text}</span>
    </div>
  );
}

function InfoRow({ label, value, mono, colorClass }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className={`info-value ${mono ? 'mono' : ''} ${colorClass || ''}`}>{value}</span>
    </div>
  );
}

export default function TriageReport({ result }) {
  const [activeTab, setActiveTab] = useState('overview');
  const {
    alert,
    matchedRules,
    finalSeverity,
    riskScore,
    escalationLevel,
    engineer,
    priorityScore,
    fpResult,
    timestamp,
  } = result;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'issues', label: `Issues (${matchedRules.length})` },
    { id: 'checklist', label: 'Checklist' },
    { id: 'engineer', label: 'On-Call' },
  ];

  const getSevColor = (sev) => {
    if (sev === 'CRITICAL') return 'text-critical';
    if (sev === 'HIGH') return 'text-high';
    if (sev === 'MEDIUM') return 'text-medium';
    return 'text-low';
  };

  return (
    <div className="triage-report animate-slide-right">
      {/* Report Header */}
      <div className={`report-header report-header--${finalSeverity.toLowerCase()}`}>
        <div className="report-header-top">
          <div className="report-title-group">
            <span className="report-label">TRIAGE REPORT</span>
            <h2 className="report-alert-id mono">{alert.alert_id || alert.id}</h2>
          </div>
          <SeverityBadge severity={finalSeverity} />
        </div>

        <div className="report-meta-grid">
          <div className="report-meta-item">
            <span className="report-meta-label">Service</span>
            <span className="report-meta-value">{alert.service}</span>
          </div>
          <div className="report-meta-item">
            <span className="report-meta-label">Type</span>
            <span className="report-meta-value" style={{ textTransform: 'capitalize' }}>
              {alert.type?.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="report-meta-item">
            <span className="report-meta-label">Environment</span>
            <span className="report-meta-value">{alert.environment?.toUpperCase()}</span>
          </div>
          <div className="report-meta-item">
            <span className="report-meta-label">Escalation</span>
            <span className={`report-meta-value report-escalation ${fpResult?.isFalseAlert ? 'text-low' : getSevColor(finalSeverity)}`}>
              {escalationLevel}
            </span>
          </div>
        </div>

        {/* FP banner */}
        {fpResult?.isFalseAlert && (
          <div className="fp-banner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <strong>Possible False Positive</strong> · Confidence: {fpResult.confidence}%
            {fpResult.reasons?.length > 0 && (
              <span className="fp-reasons"> · {fpResult.reasons[0]}</span>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="report-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            className={`report-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="report-content">
        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="animate-fade-in">
            <div className="card report-card">
              <h3 className="section-title">Incident Summary</h3>
              <div className="info-grid">
                <InfoRow label="Alert ID" value={alert.alert_id || alert.id} mono />
                <InfoRow label="Timestamp" value={alert.timestamp || timestamp} mono />
                <InfoRow label="Source System" value={alert.source_system || 'N/A'} />
                <InfoRow label="Datacenter" value={alert.datacenter || 'N/A'} />
                <InfoRow label="Risk Score" value={`${riskScore} / 120`} colorClass={getSevColor(finalSeverity)} />
                <InfoRow label="Priority Score" value={priorityScore} />
                <InfoRow label="Matched Rules" value={matchedRules.length} />
                <InfoRow label="Status" value={alert.status} />
              </div>
            </div>

            {alert.description && (
              <div className="card report-card">
                <h3 className="section-title">Description</h3>
                <p className="report-description">{alert.description}</p>
              </div>
            )}

            {/* Metrics */}
            <div className="card report-card">
              <h3 className="section-title">Alert Metrics</h3>
              <div className="metrics-grid">
                {Object.entries(alert)
                  .filter(([k]) => !['alert_id', 'id', 'timestamp', 'environment', 'datacenter',
                    'source_system', 'description', 'type', 'service', 'status', 'label'].includes(k))
                  .map(([key, val]) => (
                    <div key={key} className="metric-chip">
                      <span className="metric-key">{key.replace(/_/g, ' ')}</span>
                      <span className="metric-val mono">{val}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* False Positive Detail */}
            <div className={`card report-card fp-card ${fpResult?.isFalseAlert ? 'fp-card--positive' : ''}`}>
              <h3 className="section-title">False Positive Analysis</h3>
              <div className="fp-status">
                <span className={`fp-verdict ${fpResult?.isFalseAlert ? 'text-low' : 'text-critical'}`}>
                  {fpResult?.isFalseAlert
                    ? '🛡️ Likely False Positive'
                    : '🚨 Valid Security Incident'}
                </span>
                <span className="mono" style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                  Confidence: {fpResult?.confidence || 0}%
                </span>
              </div>
              {fpResult?.reasons?.length > 0 && (
                <ul className="fp-reason-list">
                  {fpResult.reasons.map((r, i) => (
                    <li key={i} className="fp-reason-item">{r}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ISSUES */}
        {activeTab === 'issues' && (
          <div className="animate-fade-in">
            {matchedRules.length === 0 ? (
              <div className="report-empty">
                <span>✅</span>
                <p>No rules matched — system appears healthy or alert is a false positive.</p>
              </div>
            ) : (
              matchedRules.map((rule, i) => (
                <div key={i} className="card report-card issue-card">
                  <div className="issue-header">
                    <h3 className="issue-name">{rule.name}</h3>
                    <SeverityBadge severity={rule.severity} />
                  </div>
                  <p className="issue-message">{rule.message}</p>
                  <div className="issue-action">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                    {rule.action}
                  </div>
                  {rule.checks?.length > 0 && (
                    <>
                      <hr className="divider" />
                      <h4 className="section-title">Diagnostic Checks</h4>
                      <ul className="checks-list">
                        {rule.checks.map((check, ci) => (
                          <li key={ci} className="check-item">
                            <span className="check-bullet">→</span>
                            {check}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* CHECKLIST */}
        {activeTab === 'checklist' && (
          <div className="animate-fade-in">
            {matchedRules.length === 0 ? (
              <div className="report-empty">
                <span>✅</span>
                <p>No checklist items — no rules matched.</p>
              </div>
            ) : (
              matchedRules.map((rule, ri) => (
                <div key={ri} className="card report-card">
                  <div className="checklist-rule-header">
                    <h3 className="section-title" style={{ marginBottom: 0 }}>{rule.name}</h3>
                    <SeverityBadge severity={rule.severity} />
                  </div>
                  <div className="checklist-items">
                    {rule.checklist?.map((item, ci) => (
                      <ChecklistItem key={ci} text={item} index={`${ri}-${ci}`} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ENGINEER */}
        {activeTab === 'engineer' && (
          <div className="animate-fade-in">
            <div className="card report-card engineer-card">
              <h3 className="section-title">On-Call Engineer</h3>
              <div className="engineer-avatar">
                <span>{engineer.name?.charAt(0) || '?'}</span>
              </div>
              <div className="info-grid">
                <InfoRow label="Name" value={engineer.name} />
                <InfoRow label="Team" value={engineer.team} />
                <InfoRow label="Email" value={engineer.email} mono />
                <InfoRow label="Phone" value={engineer.phone} mono />
                <InfoRow label="Escalation Level" value={escalationLevel} colorClass={getSevColor(finalSeverity)} />
              </div>
              {!fpResult?.isFalseAlert && (
                <div className="notification-banner">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.9 1.11h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  Notification would be sent for a real incident ({escalationLevel})
                </div>
              )}
              {fpResult?.isFalseAlert && (
                <div className="notification-banner notification-banner--skipped">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                  </svg>
                  Notification skipped — False Positive detected
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

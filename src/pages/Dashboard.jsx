import { useMemo } from 'react';
import { SAMPLE_ALERTS, triageAlert } from '../triageEngine';
import SeverityBadge from '../components/SeverityBadge';
import StatCard from '../components/StatCard';
import './Dashboard.css';

function getSeverityColor(severity) {
  if (severity === 'CRITICAL') return 'var(--critical)';
  if (severity === 'HIGH') return 'var(--high)';
  if (severity === 'MEDIUM') return 'var(--medium)';
  return 'var(--low)';
}

export default function Dashboard({ triageHistory, onNavigate }) {
  // Pre-triage all sample alerts for dashboard stats
  const preTriaged = useMemo(() =>
    SAMPLE_ALERTS.map((a) => ({ ...triageAlert(a), alert: a })),
    []
  );

  const recent = triageHistory.length > 0 ? triageHistory : preTriaged;

  const stats = useMemo(() => {
    const total = recent.length;
    const critical = recent.filter(r => r.finalSeverity === 'CRITICAL').length;
    const high = recent.filter(r => r.finalSeverity === 'HIGH').length;
    const falsePositives = recent.filter(r => r.fpResult?.isFalseAlert).length;
    return { total, critical, high, falsePositives };
  }, [recent]);

  const recentAlerts = recent.slice(0, 6);

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header dashboard-header">
        <div>
          <h1 className="page-title">
            <span className="title-accent">Sentinel</span> Command Center
          </h1>
          <p className="page-subtitle">
            Real-time incident analysis · Rules Engine v2 · {new Date().toLocaleString()}
          </p>
        </div>
        <button
          id="btn-new-triage"
          className="btn btn-primary"
          onClick={() => onNavigate('triage')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Triage
        </button>
      </div>

      {/* Stats */}
      <div className="grid-4 dashboard-stats">
        <StatCard
          id="stat-total"
          label="Total Alerts"
          value={stats.total}
          icon="📊"
          color="var(--primary)"
        />
        <StatCard
          id="stat-critical"
          label="Critical / High"
          value={`${stats.critical + stats.high}`}
          icon="🚨"
          color="var(--critical)"
          glowColor="var(--critical-glow)"
        />
        <StatCard
          id="stat-fp"
          label="False Positives"
          value={stats.falsePositives}
          icon="🛡️"
          color="var(--low)"
        />
        <StatCard
          id="stat-rules"
          label="Active Rules"
          value="10"
          icon="⚡"
          color="var(--tertiary)"
        />
      </div>

      {/* Severity Overview */}
      <div className="grid-2 dashboard-panels">
        {/* Alert Feed */}
        <div className="card dashboard-feed">
          <div className="section-header">
            <h2 className="section-title">Live Alert Feed</h2>
            <span className="live-indicator">
              <span className="status-dot status-dot--live" />
              Live
            </span>
          </div>
          <div className="alert-feed">
            {recentAlerts.map((r, i) => (
              <div
                key={`${r.alert?.alert_id || r.alert?.id || 'alert'}-${i}`}
                className="alert-feed-item animate-slide-up"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div
                  className="alert-severity-bar"
                  style={{ background: getSeverityColor(r.finalSeverity) }}
                />
                <div className="alert-feed-content">
                  <div className="alert-feed-top">
                    <span className="alert-feed-id mono">
                      {r.alert?.alert_id || r.alert?.id}
                    </span>
                    <SeverityBadge severity={r.finalSeverity} />
                  </div>
                  <p className="alert-feed-service">
                    {r.alert?.service} · {r.alert?.type?.replace(/_/g, ' ')}
                  </p>
                  <p className="alert-feed-desc">{r.alert?.description}</p>
                </div>
                {r.fpResult?.isFalseAlert && (
                  <span className="fp-tag">FP</span>
                )}
              </div>
            ))}
          </div>
          <button
            className="btn btn-ghost btn-sm dashboard-view-all"
            onClick={() => onNavigate('triage')}
          >
            Triage a new alert →
          </button>
        </div>

        {/* Severity Distribution */}
        <div className="card dashboard-distribution">
          <h2 className="section-title">Severity Distribution</h2>
          <div className="severity-dist-list">
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => {
              const count = recent.filter(r => r.finalSeverity === sev).length;
              const pct = recent.length ? Math.round((count / recent.length) * 100) : 0;
              return (
                <div key={sev} className="severity-dist-row">
                  <SeverityBadge severity={sev} />
                  <div className="progress-bar-track" style={{ flex: 1 }}>
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${pct}%`,
                        background: getSeverityColor(sev),
                      }}
                    />
                  </div>
                  <span className="severity-dist-count mono">
                    {count}
                    <span className="severity-dist-pct"> ({pct}%)</span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* Alert Type Breakdown */}
          <hr className="divider" />
          <h2 className="section-title" style={{ marginTop: 0 }}>Alert Type Breakdown</h2>
          <div className="type-breakdown">
            {[...new Set(recent.map(r => r.alert?.type))].map((type) => {
              const count = recent.filter(r => r.alert?.type === type).length;
              return (
                <div key={type} className="type-badge">
                  <span className="type-name">{type?.replace(/_/g, ' ')}</span>
                  <span className="type-count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dashboard-quick-actions">
        <h2 className="section-title">Quick Actions</h2>
        <div className="quick-action-grid">
          {[
            { icon: '🔍', label: 'Triage Alert', desc: 'Analyze a new incident payload', page: 'triage' },
            { icon: '📘', label: 'View Playbook', desc: 'Browse runbooks by incident type', page: 'playbook' },
            { icon: '⚙️', label: 'Rules Engine', desc: 'View all triage rules and conditions', page: 'rules' },
            { icon: '🕐', label: 'View History', desc: 'Browse past triage sessions', page: 'history' },
          ].map((action) => (
            <button
              key={action.page}
              id={`quick-${action.page}`}
              className="quick-action-card"
              onClick={() => onNavigate(action.page)}
            >
              <span className="quick-action-icon">{action.icon}</span>
              <span className="quick-action-label">{action.label}</span>
              <span className="quick-action-desc">{action.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

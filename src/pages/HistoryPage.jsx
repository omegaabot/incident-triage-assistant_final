import { useState } from 'react';
import SeverityBadge from '../components/SeverityBadge';
import TriageReport from '../components/TriageReport';
import './HistoryPage.css';

export default function HistoryPage({ triageHistory, onNavigate }) {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');

  const filtered = triageHistory.filter(r => {
    const q = search.toLowerCase();
    return (
      r.alert?.alert_id?.toLowerCase().includes(q) ||
      r.alert?.service?.toLowerCase().includes(q) ||
      r.alert?.type?.toLowerCase().includes(q) ||
      r.finalSeverity?.toLowerCase().includes(q)
    );
  });

  const selectedResult = selected !== null ? filtered[selected] : null;

  function getTimeDiff(ts) {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Triage History</h1>
          <p className="page-subtitle">
            {triageHistory.length} sessions recorded this session
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => onNavigate('triage')}
        >
          + New Triage
        </button>
      </div>

      {triageHistory.length === 0 ? (
        <div className="history-empty">
          <div className="history-empty-icon">🕐</div>
          <h3>No triage sessions yet</h3>
          <p>
            Run a triage analysis on the Triage Alert page to see results here.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => onNavigate('triage')}
          >
            Go to Triage
          </button>
        </div>
      ) : (
        <div className="history-layout">
          {/* List */}
          <div className="history-sidebar">
            <input
              id="history-search"
              className="input"
              placeholder="Search history..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="history-list">
              {filtered.length === 0 ? (
                <p className="history-no-results">No matching results</p>
              ) : (
                filtered.map((r, i) => (
                  <button
                    key={i}
                    id={`history-item-${i}`}
                    className={`history-item ${selected === i ? 'active' : ''}`}
                    onClick={() => setSelected(i)}
                  >
                    <div className="history-item-top">
                      <span className="history-item-id mono">
                        {r.alert?.alert_id || r.alert?.id}
                      </span>
                      <SeverityBadge severity={r.finalSeverity} />
                    </div>
                    <p className="history-item-service">
                      {r.alert?.service} · {r.alert?.type?.replace(/_/g, ' ')}
                    </p>
                    <div className="history-item-footer">
                      <span className="history-item-time">
                        {getTimeDiff(r.timestamp)}
                      </span>
                      {r.fpResult?.isFalseAlert && (
                        <span className="fp-tag">False Positive</span>
                      )}
                      <span className="history-item-esc badge badge-info">
                        {r.escalationLevel}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Detail panel */}
          <div className="history-detail">
            {selectedResult ? (
              <TriageReport result={selectedResult} />
            ) : (
              <div className="history-select-hint">
                <span>👈</span>
                <p>Select a triage session from the list to view the full report.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

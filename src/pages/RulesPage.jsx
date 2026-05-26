import { useState } from 'react';
import { RULES } from '../triageEngine';
import SeverityBadge from '../components/SeverityBadge';
import './RulesPage.css';

export default function RulesPage() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [expandedRule, setExpandedRule] = useState(null);

  const types = [...new Set(RULES.map(r => r.type))];

  const filtered = RULES.filter(r => {
    const matchSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.type.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || r.type === filterType;
    return matchSearch && matchType;
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Rules Engine</h1>
        <p className="page-subtitle">
          {RULES.length} active rules across {types.length} incident categories
        </p>
      </div>

      {/* Stats Bar */}
      <div className="rules-stats-bar">
        <div className="rules-stat">
          <span className="rules-stat-val">{RULES.length}</span>
          <span className="rules-stat-label">Total Rules</span>
        </div>
        <div className="rules-stat">
          <span className="rules-stat-val" style={{ color: 'var(--critical)' }}>
            {RULES.filter(r => r.severity === 'HIGH').length}
          </span>
          <span className="rules-stat-label">HIGH Severity</span>
        </div>
        <div className="rules-stat">
          <span className="rules-stat-val" style={{ color: 'var(--medium)' }}>
            {RULES.filter(r => r.severity === 'MEDIUM').length}
          </span>
          <span className="rules-stat-label">MEDIUM Severity</span>
        </div>
        <div className="rules-stat">
          <span className="rules-stat-val" style={{ color: 'var(--cyber-blue)' }}>
            {types.length}
          </span>
          <span className="rules-stat-label">Rule Types</span>
        </div>
      </div>

      {/* Filters */}
      <div className="rules-filters">
        <input
          id="rules-search"
          className="input rules-search"
          placeholder="Search rules..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="rules-type-filters">
          <button
            className={`btn btn-ghost btn-sm ${filterType === 'all' ? 'filter-active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            All
          </button>
          {types.map((type) => (
            <button
              key={type}
              className={`btn btn-ghost btn-sm ${filterType === type ? 'filter-active' : ''}`}
              onClick={() => setFilterType(type)}
            >
              {type.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Rules Grid */}
      <div className="rules-grid">
        {filtered.map((rule) => {
          const isExpanded = expandedRule === rule.name;
          return (
            <div
              key={rule.name}
              id={`rule-${rule.name.replace(/\s+/g, '-').toLowerCase()}`}
              className={`card rule-card ${isExpanded ? 'expanded' : ''}`}
            >
              <button
                className="rule-card-header"
                onClick={() => setExpandedRule(isExpanded ? null : rule.name)}
              >
                <div className="rule-card-left">
                  <h3 className="rule-name">{rule.name}</h3>
                  <span className="rule-type mono">{rule.type.replace(/_/g, '_')}</span>
                </div>
                <div className="rule-card-right">
                  <SeverityBadge severity={rule.severity} />
                  <svg
                    className={`rule-chevron ${isExpanded ? 'open' : ''}`}
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </button>

              {/* Condition */}
              <div className="rule-condition">
                <span className="rule-condition-label">CONDITION</span>
                <code className="rule-condition-code mono">
                  {rule.condition.toString().match(/=> (.+)$/)?.[1] || rule.condition.toString()}
                </code>
              </div>

              {/* Action */}
              <p className="rule-action">{rule.action}</p>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="rule-expanded animate-fade-in">
                  <hr className="divider" />

                  <div className="rule-detail-grid">
                    <div>
                      <h4 className="section-title">Checklist Items</h4>
                      <ul className="rule-checklist">
                        {rule.checklist.map((item, i) => (
                          <li key={i} className="rule-checklist-item">
                            <span className="rule-check-bullet">☐</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="section-title">False Positive Signals</h4>
                      <div className="rule-fp-signals">
                        {rule.false_positive_signals.map((sig, i) => (
                          <div key={i} className="rule-fp-signal">
                            <span className="rule-fp-field mono">{sig.field}</span>
                            <span className="rule-fp-op">{sig.op}</span>
                            <span className="rule-fp-val mono">{sig.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <h4 className="section-title" style={{ marginTop: 'var(--space-md)' }}>Diagnostic Checks</h4>
                  <ul className="rule-checks-expanded">
                    {rule.checks.map((check, i) => (
                      <li key={i} className="rule-check-expanded-item">
                        <span style={{ color: 'var(--cyber-blue)', fontWeight: 700 }}>→</span>
                        {check}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="rules-empty">
          <span>🔍</span>
          <p>No rules match your search criteria.</p>
        </div>
      )}
    </div>
  );
}

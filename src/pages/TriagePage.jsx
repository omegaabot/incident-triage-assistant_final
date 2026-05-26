import { useState, useCallback } from 'react';
import { triageAlert, SAMPLE_ALERTS } from '../triageEngine';
import SeverityBadge from '../components/SeverityBadge';
import TriageReport from '../components/TriageReport';
import './TriagePage.css';

const DEFAULT_JSON = JSON.stringify(SAMPLE_ALERTS[0], null, 2);

export default function TriagePage({ addToHistory }) {
  const [jsonInput, setJsonInput] = useState(DEFAULT_JSON);
  const [jsonError, setJsonError] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedSample, setSelectedSample] = useState(SAMPLE_ALERTS[0].id);

  const handleSampleSelect = useCallback((sampleId) => {
    const sample = SAMPLE_ALERTS.find(a => a.id === sampleId);
    if (sample) {
      setJsonInput(JSON.stringify(sample, null, 2));
      setSelectedSample(sampleId);
      setResult(null);
      setJsonError(null);
    }
  }, []);

  const handleAnalyze = useCallback(() => {
    setJsonError(null);
    setLoading(true);

    // Simulate async for UX
    setTimeout(() => {
      try {
        const alert = JSON.parse(jsonInput);
        const triageResult = triageAlert(alert);
        setResult(triageResult);
        addToHistory(triageResult);
      } catch (e) {
        setJsonError(e.message || 'Invalid JSON payload');
      } finally {
        setLoading(false);
      }
    }, 600);
  }, [jsonInput, addToHistory]);

  const handleClear = () => {
    setJsonInput('');
    setResult(null);
    setJsonError(null);
    setSelectedSample(null);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Incident Triage</h1>
        <p className="page-subtitle">
          Paste an alert JSON payload to classify severity, match rules, and generate a response checklist.
        </p>
      </div>

      <div className="triage-layout">
        {/* Left: Input Panel */}
        <div className="triage-input-panel">
          {/* Sample Selector */}
          <div className="card triage-samples">
            <h2 className="section-title">Sample Scenarios</h2>
            <div className="sample-grid">
              {SAMPLE_ALERTS.map((sample) => {
                const preResult = triageAlert(sample);
                return (
                  <button
                    key={sample.id}
                    id={`sample-${sample.id}`}
                    className={`sample-btn ${selectedSample === sample.id ? 'active' : ''}`}
                    onClick={() => handleSampleSelect(sample.id)}
                  >
                    <span className="sample-btn-label">{sample.label}</span>
                    <SeverityBadge severity={preResult.finalSeverity} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* JSON Editor */}
          <div className="card triage-editor">
            <div className="editor-header">
              <div className="editor-header-left">
                <span className="editor-lang-badge mono">JSON</span>
                <h2 className="section-title" style={{ marginBottom: 0 }}>Alert Payload</h2>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={handleClear}>
                Clear
              </button>
            </div>

            <textarea
              id="alert-json-input"
              className="input triage-textarea"
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value);
                setJsonError(null);
              }}
              placeholder='{ "type": "system_monitoring", "cpu_usage": 95, ... }'
              spellCheck={false}
            />

            {jsonError && (
              <div className="triage-error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {jsonError}
              </div>
            )}

            <button
              id="btn-analyze"
              className="btn btn-primary triage-analyze-btn"
              onClick={handleAnalyze}
              disabled={loading || !jsonInput.trim()}
            >
              {loading ? (
                <>
                  <svg className="spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Analyzing...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  Run Triage Analysis
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Result Panel */}
        <div className="triage-result-panel">
          {result ? (
            <TriageReport result={result} />
          ) : (
            <div className="triage-empty">
              <div className="triage-empty-icon">🔍</div>
              <h3>Awaiting Analysis</h3>
              <p>Select a sample scenario or paste a custom alert JSON, then click "Run Triage Analysis".</p>
              <div className="triage-empty-hints">
                <div className="hint-item">
                  <span className="hint-bullet" style={{ background: 'var(--critical)' }} />
                  Classifies severity (CRITICAL / HIGH / MEDIUM / LOW)
                </div>
                <div className="hint-item">
                  <span className="hint-bullet" style={{ background: 'var(--cyber-blue)' }} />
                  Matches against 10 rule types
                </div>
                <div className="hint-item">
                  <span className="hint-bullet" style={{ background: 'var(--low)' }} />
                  Detects false positives with confidence scoring
                </div>
                <div className="hint-item">
                  <span className="hint-bullet" style={{ background: 'var(--tertiary)' }} />
                  Generates triage checklist and assigns on-call engineer
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

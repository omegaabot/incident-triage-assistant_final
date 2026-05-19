export default function SeverityBadge({ severity }) {
  const map = {
    CRITICAL: 'badge-critical',
    HIGH: 'badge-high',
    MEDIUM: 'badge-medium',
    LOW: 'badge-low',
    'NO-ESCALATION': 'badge-low',
  };
  const cls = map[severity] || 'badge-info';

  const dots = {
    CRITICAL: '●',
    HIGH: '●',
    MEDIUM: '◆',
    LOW: '●',
  };

  return (
    <span className={`badge ${cls}`}>
      <span style={{ fontSize: '8px' }}>{dots[severity] || '●'}</span>
      {severity}
    </span>
  );
}

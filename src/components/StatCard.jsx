import './StatCard.css';

export default function StatCard({ id, label, value, icon, color, glowColor }) {
  return (
    <div
      id={id}
      className="stat-card card"
      style={glowColor ? { boxShadow: `0 0 20px ${glowColor}` } : {}}
    >
      <div className="stat-card-top">
        <span className="stat-card-label">{label}</span>
        <span className="stat-card-icon">{icon}</span>
      </div>
      <div className="stat-card-value" style={{ color }}>
        {value}
      </div>
      <div className="stat-card-bar">
        <div className="stat-card-bar-fill" style={{ background: color }} />
      </div>
    </div>
  );
}

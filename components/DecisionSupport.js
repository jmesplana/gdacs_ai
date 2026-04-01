import React from 'react';

const decisionToneMap = {
  Monitor: { bg: '#e0f2fe', text: '#0c4a6e', border: '#7dd3fc' },
  Prepare: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  'Pre-position': { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' },
  Escalate: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  Delay: { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
  'No-go': { bg: '#1f2937', text: '#ffffff', border: '#111827' }
};

export function getDecisionLabel(score = 0, blockers = {}) {
  const normalizedScore = Number.isFinite(score) ? score : 0;
  if (blockers.noGo) return 'No-go';
  if (blockers.delay) return 'Delay';
  if (normalizedScore >= 70) return 'Escalate';
  if (normalizedScore >= 50) return 'Pre-position';
  if (normalizedScore >= 30) return 'Prepare';
  return 'Monitor';
}

export function getDecisionTone(label = 'Monitor') {
  return decisionToneMap[label] || decisionToneMap.Monitor;
}

export function RiskBar({
  value = 0,
  label = null,
  sublabel = null,
  height = 12,
  showScale = true
}) {
  const safeValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

  return (
    <div>
      {(label || sublabel) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>{label}</div>
          {sublabel && <div style={{ fontSize: '12px', color: '#64748b' }}>{sublabel}</div>}
        </div>
      )}
      <div style={{
        position: 'relative',
        height: `${height}px`,
        borderRadius: '999px',
        background: 'linear-gradient(90deg, #10b981 0%, #f59e0b 55%, #ef4444 100%)',
        overflow: 'visible'
      }}>
        <div style={{
          position: 'absolute',
          left: `${safeValue}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '0',
          height: '0',
          borderLeft: '7px solid transparent',
          borderRight: '7px solid transparent',
          borderTop: '12px solid #0f172a',
          filter: 'drop-shadow(0 1px 2px rgba(15, 23, 42, 0.25))'
        }} />
      </div>
      {showScale && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '8px',
          marginTop: '6px',
          fontSize: '11px',
          fontWeight: 700,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.03em'
        }}>
          <span>Low</span>
          <span style={{ textAlign: 'center' }}>Moderate</span>
          <span style={{ textAlign: 'center' }}>High</span>
          <span style={{ textAlign: 'right' }}>Critical</span>
        </div>
      )}
    </div>
  );
}

export function DecisionBadge({ label }) {
  const tone = getDecisionTone(label);
  return (
    <span style={{
      background: tone.bg,
      color: tone.text,
      border: `1px solid ${tone.border}`,
      borderRadius: '999px',
      padding: '6px 10px',
      fontWeight: 800,
      fontSize: '12px'
    }}>
      {label}
    </span>
  );
}

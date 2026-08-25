import { useEffect, useState } from 'react';

/**
 * DataFreshnessBar — a compact, per-layer "honest source state" indicator.
 *
 * Inspired by the God's Eye View pattern of always keeping each data layer's
 * source and freshness state visible (live / cached / delayed / unavailable),
 * which matters even more for humanitarian decisions riding on the data.
 *
 * Purely presentational: it reads state the app already tracks and renders a
 * chip per layer. Layers with state `off` (toggled off / not loaded) are hidden
 * so the bar stays quiet until there's something to report.
 */

const STATE_STYLES = {
  live: { dot: '#2e7d32', bg: '#e8f5e9', text: '#1b5e20', label: 'Live' },
  cached: { dot: '#f59e0b', bg: '#fef3c7', text: '#92400e', label: 'Cached' },
  loading: { dot: '#2D5A7B', bg: '#e3edf5', text: '#2D5A7B', label: 'Loading…' },
  unavailable: { dot: '#d32f2f', bg: '#ffebee', text: '#b71c1c', label: 'Unavailable' },
};

function formatAge(timestamp) {
  if (!timestamp) return null;
  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return null;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function LayerChip({ layer }) {
  const { name, state, count, timestamp, detail } = layer;
  const style = STATE_STYLES[state] || STATE_STYLES.unavailable;
  const age = formatAge(timestamp);

  const title = [
    `${name}: ${style.label}`,
    typeof count === 'number' ? `${count} record${count === 1 ? '' : 's'}` : null,
    age ? `updated ${age}` : null,
    detail || null,
  ].filter(Boolean).join(' · ');

  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: style.bg,
        color: style.text,
        padding: '4px 9px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        fontFamily: "'Inter', sans-serif",
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          backgroundColor: style.dot,
          flexShrink: 0,
          boxShadow: state === 'loading' ? `0 0 0 0 ${style.dot}` : 'none',
          animation: state === 'loading' ? 'aidstackPulse 1.2s ease-in-out infinite' : 'none',
        }}
      />
      <span>{name}</span>
      {typeof count === 'number' && count > 0 && (
        <span style={{ opacity: 0.75, fontWeight: 500 }}>{count.toLocaleString()}</span>
      )}
      {age && state !== 'loading' && (
        <span style={{ opacity: 0.6, fontWeight: 500 }}>· {age}</span>
      )}
    </span>
  );
}

export default function DataFreshnessBar({ layers = [] }) {
  // Re-render periodically so relative "age" labels stay current.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const visible = layers.filter((l) => l && l.state && l.state !== 'off');
  if (visible.length === 0) return null;

  return (
    <div
      role="status"
      aria-label="Data source freshness"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      <style>{`@keyframes aidstackPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }`}</style>
      {visible.map((layer) => (
        <LayerChip key={layer.name} layer={layer} />
      ))}
    </div>
  );
}

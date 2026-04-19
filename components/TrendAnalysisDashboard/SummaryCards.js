import React from 'react';

export default function SummaryCards({ summary, trends }) {
  const cards = [];

  // ACLED trend card
  if (summary?.dataAvailable?.acled) {
    const acledChange = trends?.acledChange;
    const isPositive = acledChange > 0;
    const isNegative = acledChange < 0;

    cards.push({
      title: 'ACLED Events',
      value: summary.currentPeriod?.acledEvents || 0,
      change: acledChange,
      changeLabel: acledChange !== null
        ? `${isPositive ? '+' : ''}${acledChange}%`
        : 'No change',
      icon: '⚠️',
      available: true
    });
  }

  // Facility trend card
  if (summary?.dataAvailable?.facilities) {
    cards.push({
      title: 'Facilities',
      value: summary.currentPeriod?.facilities || 0,
      change: 0,
      changeLabel: 'Monitoring',
      icon: '🏥',
      available: true
    });
  }

  // Disaster count card
  if (summary?.dataAvailable?.disasters) {
    cards.push({
      title: 'Active Disasters',
      value: summary.currentPeriod?.disasters || 0,
      change: 0,
      changeLabel: 'Active',
      icon: '🌪️',
      available: true
    });
  }

  if (cards.length === 0) {
    return null;
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: '12px',
      marginBottom: '20px'
    }}>
      {cards.map((card, index) => {
        const isPositive = card.change > 0;
        const isNegative = card.change < 0;

        return (
          <div
            key={index}
            style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <div style={{
                fontSize: '11px',
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 700,
                fontFamily: "'Inter', sans-serif"
              }}>
                {card.title}
              </div>
              <span style={{ fontSize: '18px' }}>{card.icon}</span>
            </div>

            <div style={{
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--aidstack-navy)',
              fontFamily: "'Space Grotesk', sans-serif",
              marginBottom: '6px'
            }}>
              {card.value.toLocaleString()}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontFamily: "'Inter', sans-serif"
            }}>
              {card.change !== 0 && card.change !== null && (
                <span style={{
                  color: isPositive ? '#ef4444' : isNegative ? '#10b981' : '#64748b',
                  fontWeight: 600
                }}>
                  {isPositive ? '↑' : isNegative ? '↓' : '—'}
                </span>
              )}
              <span style={{
                color: isPositive ? '#ef4444' : isNegative ? '#10b981' : '#64748b',
                fontWeight: 600
              }}>
                {card.changeLabel}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

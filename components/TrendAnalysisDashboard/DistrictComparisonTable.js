import React, { useState, useMemo } from 'react';
import EmptyState from './EmptyState';

export default function DistrictComparisonTable({ data }) {
  const [sortConfig, setSortConfig] = useState({ key: 'riskScore', direction: 'desc' });

  // Handle sorting
  const handleSort = (key) => {
    setSortConfig((prevConfig) => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Sort data based on current sort configuration
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const sorted = [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      // Handle string comparisons (district names)
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      // Handle numeric comparisons
      const aNum = Number(aValue) || 0;
      const bNum = Number(bValue) || 0;

      return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
    });

    return sorted;
  }, [data, sortConfig]);

  // Get risk score color
  const getRiskScoreColor = (score) => {
    const numScore = Number(score) || 0;
    if (numScore >= 0 && numScore < 2) return '#10b981'; // green (low risk)
    if (numScore >= 2 && numScore < 4) return '#f59e0b'; // yellow (medium risk)
    if (numScore >= 4 && numScore <= 10) return '#ef4444'; // red (high risk)
    return '#64748b'; // gray fallback
  };

  // Get risk score background color
  const getRiskScoreBackground = (score) => {
    const numScore = Number(score) || 0;
    if (numScore >= 0 && numScore < 2) return '#d1fae5'; // light green
    if (numScore >= 2 && numScore < 4) return '#fef3c7'; // light yellow
    if (numScore >= 4 && numScore <= 10) return '#fee2e2'; // light red
    return '#f1f5f9'; // light gray fallback
  };

  // Render sort indicator
  const SortIndicator = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕</span>;
    }
    return (
      <span style={{ marginLeft: '4px' }}>
        {sortConfig.direction === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  // Handle empty or null data
  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon="📊"
        title="No District Data Available"
        message="Upload district boundaries and facilities to see comparison data"
      />
    );
  }

  const columns = [
    { key: 'district', label: 'District', align: 'left' },
    { key: 'facilities', label: 'Facilities', align: 'center' },
    { key: 'acledEvents', label: 'ACLED Events', align: 'center' },
    { key: 'disasters', label: 'Disasters', align: 'center' },
    { key: 'riskScore', label: 'Risk Score', align: 'center' }
  ];

  return (
    <div style={{
      background: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      overflow: 'hidden'
    }}>
      <div style={{
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: "'Inter', sans-serif",
          fontSize: '13px',
          minWidth: '600px'
        }}>
          <thead>
            <tr style={{
              background: '#f8fafc',
              borderBottom: '2px solid #e2e8f0'
            }}>
              {columns.map((column) => (
                <th
                  key={column.key}
                  onClick={() => handleSort(column.key)}
                  style={{
                    padding: '14px 16px',
                    textAlign: column.align,
                    fontWeight: 700,
                    color: '#475569',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontSize: '11px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'background 0.2s ease',
                    position: 'relative',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                  }}
                >
                  {column.label}
                  <SortIndicator columnKey={column.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, index) => (
              <tr
                key={index}
                style={{
                  background: index % 2 === 0 ? 'white' : '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  transition: 'background 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = index % 2 === 0 ? 'white' : '#f8fafc';
                }}
              >
                <td style={{
                  padding: '14px 16px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: '#1e293b'
                }}>
                  {row.district || 'Unknown'}
                </td>
                <td style={{
                  padding: '14px 16px',
                  textAlign: 'center',
                  color: '#475569'
                }}>
                  {(row.facilities || 0).toLocaleString()}
                </td>
                <td style={{
                  padding: '14px 16px',
                  textAlign: 'center',
                  color: '#475569'
                }}>
                  {(row.acledEvents || 0).toLocaleString()}
                </td>
                <td style={{
                  padding: '14px 16px',
                  textAlign: 'center',
                  color: '#475569'
                }}>
                  {(row.disasters || 0).toLocaleString()}
                </td>
                <td style={{
                  padding: '14px 16px',
                  textAlign: 'center'
                }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '12px',
                    color: getRiskScoreColor(row.riskScore),
                    background: getRiskScoreBackground(row.riskScore)
                  }}>
                    {typeof row.riskScore === 'number'
                      ? row.riskScore.toFixed(1)
                      : (Number(row.riskScore) || 0).toFixed(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile scroll hint */}
      <div style={{
        display: 'none',
        padding: '8px',
        textAlign: 'center',
        fontSize: '11px',
        color: '#94a3b8',
        background: '#f8fafc',
        borderTop: '1px solid #e2e8f0',
        fontFamily: "'Inter', sans-serif"
      }}
      className="mobile-scroll-hint">
        Scroll horizontally to see all columns
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .mobile-scroll-hint {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}

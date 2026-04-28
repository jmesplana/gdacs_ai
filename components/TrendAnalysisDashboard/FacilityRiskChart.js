import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import EmptyState from './EmptyState';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function FacilityRiskChart({ data, title = 'Current Site Status' }) {
  // Handle null or empty data
  if (!data || !data.current || data.current.length === 0) {
    return (
      <EmptyState
        icon="📊"
        title="No Site Status Available"
        message="Upload sites and run impact assessment to see current impacted vs not impacted status"
      />
    );
  }

  const chartData = useMemo(() => {
    const labels = data.current.map(item => item.label || item.date);
    const impacted = data.current.map(item => item.impacted || 0);
    const safe = data.current.map(item => item.safe || 0);

    return {
      labels,
      datasets: [
        {
          label: 'Impacted',
          data: impacted,
          backgroundColor: '#ef4444',
          borderColor: '#ef4444',
          borderWidth: 1,
          stack: 'stack0'
        },
        {
          label: 'Not Impacted',
          data: safe,
          backgroundColor: '#10b981',
          borderColor: '#10b981',
          borderWidth: 1,
          stack: 'stack0'
        }
      ]
    };
  }, [data]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            family: "'Inter', sans-serif",
            size: 12,
            weight: 600
          },
          color: '#334155',
          padding: 12,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      title: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: {
          family: "'Inter', sans-serif",
          size: 13,
          weight: 600
        },
        bodyFont: {
          family: "'Inter', sans-serif",
          size: 12
        },
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          title: function(context) {
            return 'Current site status';
          },
          label: function(context) {
            const label = context.dataset.label || '';
            const value = context.parsed.y || 0;
            const total = data.totalFacilities || 0;
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            return `${label}: ${value} (${percentage}%)`;
          },
          footer: function(context) {
            const total = context.reduce((sum, item) => sum + (item.parsed.y || 0), 0);
            return `Total: ${total}`;
          }
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        beginAtZero: true,
        grid: {
          color: '#f1f5f9',
          drawBorder: false
        },
        ticks: {
          font: {
            family: "'Inter', sans-serif",
            size: 11
          },
          color: '#64748b',
          precision: 0
        },
        border: {
          display: false
        },
        title: {
          display: true,
          text: 'Number of Sites',
          font: {
            family: "'Inter', sans-serif",
            size: 12,
            weight: 600
          },
          color: '#475569'
        }
      },
      y: {
        stacked: true,
        grid: {
          display: false
        },
        ticks: {
          font: {
            family: "'Inter', sans-serif",
            size: 11
          },
          color: '#64748b'
        },
        border: {
          color: '#e2e8f0'
        }
      }
    },
    interaction: {
      mode: 'index',
      intersect: false
    }
  }), [data.totalFacilities]);

  return (
    <div style={{
      background: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      marginBottom: '20px'
    }}>
      <div style={{
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <h3 style={{
          fontSize: '14px',
          fontWeight: 700,
          color: 'var(--aidstack-navy)',
          fontFamily: "'Inter', sans-serif",
          margin: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          {title}
        </h3>
        {data.totalFacilities && (
          <div style={{
            fontSize: '11px',
            color: '#64748b',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 500
          }}>
            Total: {data.totalFacilities} sites
          </div>
        )}
      </div>

      <div style={{
        marginBottom: '14px',
        fontSize: '12px',
        color: '#475569',
        lineHeight: 1.5
      }}>
        {data.impactDistribution?.impacted > 0
          ? `This is a current snapshot of site impact status based on the app's disaster and ACLED proximity assessment. ${data.impactDistribution.impacted} of ${data.totalFacilities} sites are currently marked as impacted in the selected area.`
          : `No sites are currently marked as impacted in the selected area. This view reflects current impact status, not a historical site-risk trend.`}
      </div>

      <div style={{
        height: '220px',
        position: 'relative'
      }}>
        <Bar data={chartData} options={options} />
      </div>

      {data.impactDistribution && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid #e2e8f0'
        }}>
          <div style={{
            textAlign: 'center',
            padding: '8px'
          }}>
            <div style={{
              fontSize: '11px',
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
              marginBottom: '4px'
            }}>
              Impacted
            </div>
            <div style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#ef4444',
              fontFamily: "'Space Grotesk', sans-serif"
            }}>
              {data.impactDistribution.impacted || 0}
            </div>
          </div>

          <div style={{
            textAlign: 'center',
            padding: '8px'
          }}>
            <div style={{
              fontSize: '11px',
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
              marginBottom: '4px'
            }}>
              Not Impacted
            </div>
            <div style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#10b981',
              fontFamily: "'Space Grotesk', sans-serif"
            }}>
              {data.impactDistribution.safe || 0}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

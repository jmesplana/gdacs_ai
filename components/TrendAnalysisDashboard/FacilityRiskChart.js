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

export default function FacilityRiskChart({ data, title = 'Facility Risk Distribution Over Time' }) {
  // Handle null or empty data
  if (!data || !data.daily || data.daily.length === 0) {
    return (
      <EmptyState
        icon="📊"
        title="No Risk Data Available"
        message="Upload facilities and analyze disasters to see risk distribution over time"
      />
    );
  }

  const chartData = useMemo(() => {
    const labels = data.daily.map(item => item.label || item.date);
    const highRisk = data.daily.map(item => item.high || 0);
    const mediumRisk = data.daily.map(item => item.medium || 0);
    const lowRisk = data.daily.map(item => item.low || 0);
    const unassessed = data.daily.map(item => item.unassessed || 0);

    return {
      labels,
      datasets: [
        {
          label: 'High Risk',
          data: highRisk,
          backgroundColor: '#ef4444',
          borderColor: '#ef4444',
          borderWidth: 1,
          stack: 'stack0'
        },
        {
          label: 'Medium Risk',
          data: mediumRisk,
          backgroundColor: '#f59e0b',
          borderColor: '#f59e0b',
          borderWidth: 1,
          stack: 'stack0'
        },
        {
          label: 'Low Risk',
          data: lowRisk,
          backgroundColor: '#10b981',
          borderColor: '#10b981',
          borderWidth: 1,
          stack: 'stack0'
        },
        {
          label: 'Unassessed',
          data: unassessed,
          backgroundColor: '#94a3b8',
          borderColor: '#94a3b8',
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
            return context[0].label;
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
        grid: {
          display: false
        },
        ticks: {
          font: {
            family: "'Inter', sans-serif",
            size: 11
          },
          color: '#64748b',
          maxRotation: 45,
          minRotation: 0
        },
        border: {
          color: '#e2e8f0'
        }
      },
      y: {
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
          text: 'Number of Facilities',
          font: {
            family: "'Inter', sans-serif",
            size: 12,
            weight: 600
          },
          color: '#475569'
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
        justifyContent: 'space-between'
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
            Total: {data.totalFacilities} facilities
          </div>
        )}
      </div>

      <div style={{
        height: '320px',
        position: 'relative'
      }}>
        <Bar data={chartData} options={options} />
      </div>

      {data.riskDistribution && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
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
              High Risk
            </div>
            <div style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#ef4444',
              fontFamily: "'Space Grotesk', sans-serif"
            }}>
              {data.riskDistribution.high || 0}
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
              Medium Risk
            </div>
            <div style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#f59e0b',
              fontFamily: "'Space Grotesk', sans-serif"
            }}>
              {data.riskDistribution.medium || 0}
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
              Low Risk
            </div>
            <div style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#10b981',
              fontFamily: "'Space Grotesk', sans-serif"
            }}>
              {data.riskDistribution.low || 0}
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
              Unassessed
            </div>
            <div style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#94a3b8',
              fontFamily: "'Space Grotesk', sans-serif"
            }}>
              {data.riskDistribution.unassessed || 0}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

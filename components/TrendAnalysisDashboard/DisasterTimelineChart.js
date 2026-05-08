import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import EmptyState from './EmptyState';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function DisasterTimelineChart({ data, title }) {
  const chartItems = Array.isArray(data) ? data : [];

  const chartData = useMemo(() => ({
    labels: chartItems.map(item => item.label),
    datasets: [
      {
        label: 'Disasters',
        data: chartItems.map(item => item.count),
        backgroundColor: '#ff6b35',
        borderColor: '#ff6b35',
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      }
    ]
  }), [chartItems]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        titleFont: {
          family: "'Inter', sans-serif",
          size: 12,
          weight: 600
        },
        bodyFont: {
          family: "'Inter', sans-serif",
          size: 12
        },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: function(context) {
            const value = context.parsed.y || 0;
            return `${value} ${value === 1 ? 'Disaster' : 'Disasters'}`;
          },
          afterBody: function(context) {
            const item = chartItems[context[0].dataIndex];
            if (!item?.disasters?.length) return [];

            return [
              'Types:',
              ...item.disasters.slice(0, 6).map(disaster => `- ${disaster}`)
            ];
          }
        }
      }
    },
    scales: {
      x: {
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
      },
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
          font: {
            family: "'Inter', sans-serif",
            size: 11
          },
          color: '#64748b'
        },
        grid: {
          color: '#f1f5f9',
          drawBorder: false
        },
        border: {
          display: false
        }
      }
    }
  }), [chartItems]);

  // Handle null/empty data after hooks so hook order stays stable across renders
  if (chartItems.length === 0) {
    return (
      <EmptyState
        icon="📊"
        title="No Timeline Data Available"
        message="Upload disaster data or adjust your date range to view the timeline"
      />
    );
  }

  return (
    <div style={{
      background: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      marginBottom: '20px'
    }}>
      {title && (
        <div style={{
          fontSize: '14px',
          fontWeight: 700,
          color: '#334155',
          marginBottom: '16px',
          fontFamily: "'Inter', sans-serif",
          letterSpacing: '-0.01em'
        }}>
          {title}
        </div>
      )}

      <div style={{ height: '300px', position: 'relative' }}>
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}

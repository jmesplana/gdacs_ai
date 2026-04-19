import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import EmptyState from './EmptyState';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function AcledTrendsChart({ data, title }) {
  // Handle null/empty data
  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon="📊"
        title="No Trend Data Available"
        message="Upload ACLED data and select a time range to view trends"
      />
    );
  }

  // Prepare chart data
  const chartData = {
    labels: data.map(item => item.label || item.date),
    datasets: [
      {
        label: title || 'ACLED Events',
        data: data.map(item => item.count),
        fill: true,
        backgroundColor: 'rgba(30, 41, 59, 0.1)',
        borderColor: '#1e293b',
        borderWidth: 2,
        pointBackgroundColor: '#1e293b',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#1e293b',
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 2,
        tension: 0.3
      }
    ]
  };

  // Chart options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: title || 'ACLED Events Over Time',
        font: {
          family: "'Inter', sans-serif",
          size: 14,
          weight: 600
        },
        color: '#1e293b',
        padding: {
          top: 0,
          bottom: 16
        }
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
        displayColors: false,
        callbacks: {
          label: function(context) {
            const value = context.parsed.y;
            return `Events: ${value.toLocaleString()}`;
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
          display: false
        }
      },
      y: {
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
          padding: 8,
          callback: function(value) {
            return value.toLocaleString();
          }
        },
        border: {
          display: false
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };

  return (
    <div style={{
      background: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      marginBottom: '20px'
    }}>
      <div style={{ height: '300px', position: 'relative' }}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}

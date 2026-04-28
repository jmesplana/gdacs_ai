import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import EmptyState from './EmptyState';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function AcledTrendsChart({ data, title, granularity = 'daily' }) {
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

  const eventTypeTotals = {};
  data.forEach((item) => {
    Object.entries(item.eventTypes || {}).forEach(([type, count]) => {
      eventTypeTotals[type] = (eventTypeTotals[type] || 0) + count;
    });
  });

  const topEventTypes = Object.entries(eventTypeTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([type]) => type);

  const chartColors = ['#dc2626', '#f97316', '#eab308', '#0f766e'];

  const chartData = {
    labels: data.map(item => item.label || item.date),
    datasets: [
      ...topEventTypes.map((type, index) => ({
        type: 'bar',
        label: type,
        data: data.map((item) => item.eventTypes?.[type] || 0),
        backgroundColor: chartColors[index % chartColors.length],
        borderRadius: 4,
        borderSkipped: false,
        stack: 'events',
        yAxisID: 'y',
        barPercentage: 0.9,
        categoryPercentage: 0.8,
        order: 2
      })),
      {
        type: 'line',
        label: title || 'ACLED Events',
        data: data.map(item => item.count),
        fill: false,
        backgroundColor: 'rgba(30, 41, 59, 0.1)',
        borderColor: '#1e293b',
        borderWidth: 3,
        pointBackgroundColor: '#1e293b',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#1e293b',
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 2,
        tension: 0.3,
        yAxisID: 'yLine',
        order: 1
      }
    ]
  };

  // Chart options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
          color: '#475569',
          font: {
            family: "'Inter', sans-serif",
            size: 11
          }
        }
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
        displayColors: true,
        callbacks: {
          title: function(context) {
            const point = data[context[0].dataIndex];
            const totalFatalities = point?.fatalities || 0;
            return totalFatalities > 0
              ? `${context[0].label} • ${totalFatalities.toLocaleString()} fatalities reported`
              : context[0].label;
          },
          label: function(context) {
            const value = context.parsed.y;
            if (context.dataset.type === 'line') {
              return `Total events: ${value.toLocaleString()}`;
            }
            return `${context.dataset.label}: ${value.toLocaleString()}`;
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
          color: '#64748b'
        },
        border: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        stacked: true,
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
      },
      yLine: {
        beginAtZero: true,
        position: 'right',
        grid: {
          display: false,
          drawBorder: false
        },
        ticks: {
          display: false
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
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '14px',
        flexWrap: 'wrap'
      }}>
        <div style={{ fontSize: '12px', color: '#475569' }}>
          Stacked bars show event-type composition. The line shows total {granularity === 'weekly' ? 'weekly' : 'daily'} events.
        </div>
      </div>
      <div style={{ height: '300px', position: 'relative' }}>
        <Chart type="bar" data={chartData} options={options} />
      </div>
    </div>
  );
}

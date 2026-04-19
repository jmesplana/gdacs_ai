import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import EmptyState from './EmptyState';

export default function DisasterTimelineChart({ data, title }) {
  // Handle null/empty data
  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon="📊"
        title="No Timeline Data Available"
        message="Upload disaster data or adjust your date range to view the timeline"
      />
    );
  }

  // Custom tooltip to show disaster details
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div style={{
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          fontFamily: "'Inter', sans-serif"
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#334155',
            marginBottom: '6px'
          }}>
            {item.label}
          </div>
          <div style={{
            fontSize: '14px',
            fontWeight: 700,
            color: '#ff6b35',
            marginBottom: '8px'
          }}>
            {item.count} {item.count === 1 ? 'Disaster' : 'Disasters'}
          </div>
          {item.disasters && item.disasters.length > 0 && (
            <div style={{
              fontSize: '11px',
              color: '#64748b',
              borderTop: '1px solid #f1f5f9',
              paddingTop: '6px',
              marginTop: '6px'
            }}>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                Types:
              </div>
              {item.disasters.map((disaster, idx) => (
                <div key={idx} style={{ marginBottom: '2px' }}>
                  • {disaster}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    return null;
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

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          margin={{
            top: 10,
            right: 10,
            left: -20,
            bottom: 0
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#f1f5f9"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{
              fontSize: 11,
              fill: '#64748b',
              fontFamily: "'Inter', sans-serif"
            }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis
            tick={{
              fontSize: 11,
              fill: '#64748b',
              fontFamily: "'Inter', sans-serif"
            }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            allowDecimals={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(255, 107, 53, 0.05)' }}
          />
          <Bar
            dataKey="count"
            radius={[6, 6, 0, 0]}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill="#ff6b35"
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

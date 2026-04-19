import React from 'react';

export default function EmptyState({ icon, title, message }) {
  return (
    <div style={{
      padding: '32px',
      textAlign: 'center',
      color: '#666',
      background: '#f8fafc',
      borderRadius: '12px',
      border: '1px dashed #cbd5e1',
      margin: '12px 0'
    }}>
      <div style={{
        fontSize: '48px',
        marginBottom: '16px',
        opacity: 0.5
      }}>
        {icon}
      </div>
      <div style={{
        fontSize: '14px',
        fontWeight: 600,
        marginBottom: '8px',
        color: '#334155',
        fontFamily: "'Inter', sans-serif"
      }}>
        {title}
      </div>
      <div style={{
        fontSize: '12px',
        color: '#64748b',
        fontFamily: "'Inter', sans-serif"
      }}>
        {message}
      </div>
    </div>
  );
}

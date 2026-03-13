import React, { useEffect } from 'react';

const TOAST_STYLES = {
  success: { border: '#10B981', icon: '✓', iconBg: '#10B981' },
  error:   { border: '#EF4444', icon: '✕', iconBg: '#EF4444' },
  warning: { border: '#F59E0B', icon: '!', iconBg: '#F59E0B' },
  info:    { border: '#3B82F6', icon: 'i', iconBg: '#3B82F6' },
};

function Toast({ id, type = 'info', message, onDismiss }) {
  const style = TOAST_STYLES[type] || TOAST_STYLES.info;

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), 5000);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      background: 'white',
      borderLeft: `4px solid ${style.border}`,
      borderRadius: '6px',
      padding: '12px 14px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
      minWidth: '280px',
      maxWidth: '380px',
      fontFamily: "'Inter', sans-serif",
      animation: 'toast-in 0.2s ease',
    }}>
      <span style={{
        background: style.iconBg,
        color: 'white',
        borderRadius: '50%',
        width: '20px',
        height: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11px',
        fontWeight: 700,
        flexShrink: 0,
        marginTop: '1px',
      }}>{style.icon}</span>
      <span style={{ fontSize: '14px', color: '#0F172A', lineHeight: '1.5', flex: 1 }}>{message}</span>
      <button
        onClick={() => onDismiss(id)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#94A3B8', fontSize: '20px', lineHeight: 1,
          padding: '0', flexShrink: 0, marginTop: '-2px',
        }}
      >×</button>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || !toasts.length) return null;
  return (
    <>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <Toast {...t} onDismiss={onDismiss} />
          </div>
        ))}
      </div>
    </>
  );
}

// Hook for using toasts
export function useToast() {
  const [toasts, setToasts] = React.useState([]);

  const addToast = React.useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = React.useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, dismissToast };
}

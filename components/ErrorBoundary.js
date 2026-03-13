import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled app error:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100vh', fontFamily: "'Inter', sans-serif",
          background: '#F8FAFC',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '400px', padding: '40px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{
              color: '#1A365D', fontFamily: "'Space Grotesk', sans-serif",
              marginBottom: '12px', fontSize: '22px',
            }}>
              Something went wrong
            </h2>
            <p style={{ color: '#475569', marginBottom: '24px', fontSize: '14px', lineHeight: '1.6' }}>
              An unexpected error occurred. Your uploaded data is safe in your browser cache and will reload when you refresh.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#FF6B35', color: 'white', border: 'none',
                borderRadius: '6px', padding: '12px 28px',
                fontSize: '14px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Refresh page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

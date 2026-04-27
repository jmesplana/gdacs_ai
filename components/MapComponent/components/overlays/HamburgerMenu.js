import { useState } from 'react';

const sectionLabelStyle = {
  padding: '10px 16px 6px',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#6b7280',
  fontFamily: "'Inter', sans-serif",
  backgroundColor: '#fafafa'
};

const menuButtonBaseStyle = {
  width: '100%',
  padding: '14px 20px',
  backgroundColor: 'white',
  border: 'none',
  borderBottom: '1px solid #f0f0f0',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  fontSize: '15px',
  fontFamily: "'Space Grotesk', sans-serif",
  fontWeight: 600,
  color: 'var(--aidstack-navy)',
  transition: 'background-color 0.2s ease'
};

const HamburgerMenu = ({
  onLogisticsClick,
  onHelpClick,
  playbackEnabled,
  onPlaybackClick,
  logisticsEnabled = false,
  hasDistricts = false
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleMenuClick = (callback) => {
    callback();
    setIsOpen(false); // Close menu after selection
  };

  const renderMenuButton = ({
    onClick,
    label,
    icon,
    disabled = false,
    active = false,
    activeBackground = '#f8f9fa',
    activeTextColor = 'var(--aidstack-navy)',
    iconColor = 'var(--aidstack-teal)',
    title
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        ...menuButtonBaseStyle,
        backgroundColor: active ? activeBackground : 'white',
        color: disabled ? '#999' : active ? activeTextColor : 'var(--aidstack-navy)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = active ? activeBackground : '#f8f9fa';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = active ? activeBackground : 'white';
      }}
    >
      <span style={{ marginRight: '12px', color: disabled ? '#999' : iconColor, display: 'inline-flex', alignItems: 'center' }}>
        {icon}
      </span>
      {label}
    </button>
  );

  return (
    <>
      {/* Hamburger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Menu"
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 2000,
          backgroundColor: 'var(--aidstack-navy)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          padding: '12px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          width: '48px',
          height: '48px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--aidstack-teal)';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--aidstack-navy)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {isOpen ? (
          // X icon when open
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        ) : (
          // Hamburger icon when closed
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          {/* Backdrop to close menu when clicking outside */}
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1999,
              backgroundColor: 'transparent'
            }}
          />

          {/* Menu panel */}
          <div
            style={{
              position: 'absolute',
              top: '80px',
              right: '20px',
              zIndex: 2000,
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              minWidth: '220px',
              border: '1px solid rgba(0,0,0,0.1)',
              animation: 'slideDown 0.2s ease-out'
            }}
          >
            <div style={sectionLabelStyle}>Analysis</div>
            {renderMenuButton({
              onClick: () => handleMenuClick(onLogisticsClick),
              label: 'Logistics Assessment',
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="3" width="15" height="13"></rect>
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                  <circle cx="5.5" cy="18.5" r="2.5"></circle>
                  <circle cx="18.5" cy="18.5" r="2.5"></circle>
                </svg>
              ),
              disabled: !hasDistricts,
              active: logisticsEnabled,
              activeBackground: 'rgba(102, 126, 234, 0.10)',
              activeTextColor: '#667eea',
              iconColor: hasDistricts ? '#667eea' : '#999',
              title: !hasDistricts ? 'Upload a district shapefile to enable logistics assessment' : 'Analyze logistics accessibility'
            })}

            <div style={sectionLabelStyle}>Map Tools</div>
            {renderMenuButton({
              onClick: () => handleMenuClick(onPlaybackClick),
              label: playbackEnabled ? 'Stop Playback' : 'Timeline Playback',
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              ),
              active: playbackEnabled,
              activeBackground: 'rgba(0, 186, 188, 0.10)',
              activeTextColor: 'var(--aidstack-teal)'
            })}

            {/* Help */}
            <button
              onClick={() => handleMenuClick(onHelpClick)}
              style={{
                width: '100%',
                padding: '16px 20px',
                backgroundColor: 'white',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                fontSize: '15px',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                color: 'var(--aidstack-navy)',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '12px', color: 'var(--aidstack-orange)' }}>
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              Help
            </button>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
};

export default HamburgerMenu;

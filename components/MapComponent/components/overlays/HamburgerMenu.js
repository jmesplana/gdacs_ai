import { useState } from 'react';
import { DRAWING_COLORS } from '../../constants/mapConstants';
import OperationTypeSelector from '../../../OperationTypeSelector';
import { getOperationType } from '../../../../config/operationTypes';

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
  onControlPanelClick,
  onFilterClick,
  onCampaignDashboardClick,
  onLogisticsClick,
  onHelpClick,
  drawingEnabled,
  onDrawClick,
  drawingColor,
  setDrawingColor,
  onUndoDrawing,
  onClearDrawings,
  drawingsCount,
  operationType,
  onOperationTypeChange,
  playbackEnabled,
  onPlaybackClick,
  logisticsEnabled = false,
  hasDistricts = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showDrawingTools, setShowDrawingTools] = useState(false);
  const hasOperationType = Boolean(operationType);

  // Get operation config for dynamic labels
  const opConfig = getOperationType(operationType);

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
            {/* Operation Type Selector */}
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#fbfbfc',
              borderBottom: '1px solid #f0f0f0'
            }}>
              <div style={{
                marginBottom: '8px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                fontFamily: "'Inter', sans-serif",
                display: 'flex',
                alignItems: 'center',
                letterSpacing: '0.04em'
              }}>
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', color: 'var(--aidstack-teal)' }}>
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                  Operation Type
                </span>
              </div>
              <OperationTypeSelector
                selectedType={operationType}
                onTypeChange={onOperationTypeChange}
                compact={true}
              />
            </div>

            <div style={sectionLabelStyle}>Setup</div>
            {renderMenuButton({
              onClick: () => handleMenuClick(onControlPanelClick),
              label: 'Workspace',
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
              )
            })}
            {renderMenuButton({
              onClick: () => handleMenuClick(onFilterClick),
              label: 'Filters',
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                </svg>
              )
            })}

            <div style={sectionLabelStyle}>Analysis</div>
            {renderMenuButton({
              onClick: () => handleMenuClick(onCampaignDashboardClick),
              label: hasOperationType ? `${opConfig.name} Dashboard` : 'Operation Dashboard',
              icon: (
                <>
                  {hasOperationType && <span style={{ fontSize: '18px' }}>{opConfig.icon}</span>}
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
                    <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
                  </svg>
                </>
              ),
              disabled: !hasOperationType,
              title: hasOperationType ? `${opConfig.name} dashboard` : 'Select an operation type first'
            })}
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

            {/* Draw Tools */}
            <button
              onClick={() => {
                onDrawClick();
                setShowDrawingTools(!showDrawingTools);
              }}
              style={{
                width: '100%',
                padding: '16px 20px',
                backgroundColor: drawingEnabled ? 'rgba(255, 107, 53, 0.1)' : 'white',
                border: 'none',
                borderBottom: '1px solid #f0f0f0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                fontSize: '15px',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                color: drawingEnabled ? 'var(--aidstack-orange)' : 'var(--aidstack-navy)',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = drawingEnabled ? 'rgba(255, 107, 53, 0.15)' : '#f8f9fa'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = drawingEnabled ? 'rgba(255, 107, 53, 0.1)' : 'white'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '12px', color: 'var(--aidstack-orange)' }}>
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              </svg>
              {drawingEnabled ? 'Hide Drawing' : 'Draw on Map'}
            </button>

            {/* Drawing Tools Panel - Shows when drawing is enabled */}
            {drawingEnabled && showDrawingTools && (
              <div style={{
                backgroundColor: '#f8f9fa',
                padding: '16px',
                borderBottom: '1px solid #f0f0f0'
              }}>
                <div style={{
                  marginBottom: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--aidstack-navy)',
                  textTransform: 'uppercase',
                  fontFamily: "'Inter', sans-serif"
                }}>
                  Drawing Color
                </div>
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                  marginBottom: '12px'
                }}>
                  {DRAWING_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDrawingColor(color);
                      }}
                      style={{
                        width: '28px',
                        height: '28px',
                        backgroundColor: color,
                        border: drawingColor === color ? '3px solid var(--aidstack-navy)' : '2px solid #ddd',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      title={`Select ${color}`}
                    />
                  ))}
                </div>
                <div style={{
                  display: 'flex',
                  gap: '8px'
                }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUndoDrawing();
                    }}
                    disabled={drawingsCount === 0}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: drawingsCount > 0 ? 'white' : '#e0e0e0',
                      color: drawingsCount > 0 ? 'var(--aidstack-navy)' : '#999',
                      border: `1px solid ${drawingsCount > 0 ? 'var(--aidstack-slate-light)' : '#ccc'}`,
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 600,
                      cursor: drawingsCount > 0 ? 'pointer' : 'not-allowed'
                    }}
                  >
                    Undo
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearDrawings();
                    }}
                    disabled={drawingsCount === 0}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: drawingsCount > 0 ? '#dc2626' : '#e0e0e0',
                      color: drawingsCount > 0 ? 'white' : '#999',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 600,
                      cursor: drawingsCount > 0 ? 'pointer' : 'not-allowed'
                    }}
                  >
                    Clear All
                  </button>
                </div>
              </div>
            )}

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

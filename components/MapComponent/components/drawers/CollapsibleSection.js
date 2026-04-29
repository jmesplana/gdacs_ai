import { useEffect, useState } from 'react';

const CollapsibleSection = ({
  title,
  icon,
  count,
  color = 'var(--aidstack-navy)',
  children,
  defaultExpanded = false,
  forceExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (forceExpanded) {
      setIsExpanded(true);
    }
  }, [forceExpanded]);

  return (
    <div style={{
      marginBottom: '15px',
      border: `1px solid ${color}20`,
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: 'white'
    }}>
      {/* Header - Always visible */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '15px',
          backgroundColor: `${color}08`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'background-color 0.2s',
          borderBottom: isExpanded ? `1px solid ${color}20` : 'none'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${color}15`}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `${color}08`}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {icon && (
            <div style={{ color: color }}>
              {icon}
            </div>
          )}
          <span style={{
            fontWeight: 'bold',
            fontSize: '15px',
            color: 'var(--aidstack-navy)',
            fontFamily: "'Space Grotesk', sans-serif"
          }}>
            {title}
          </span>
          {count !== undefined && (
            <span style={{
              backgroundColor: color,
              color: 'white',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '600',
              fontFamily: "'Inter', sans-serif"
            }}>
              {count}
            </span>
          )}
        </div>

        {/* Expand/Collapse Icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transition: 'transform 0.2s',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      {/* Content - Collapsible */}
      {isExpanded && (
        <div style={{
          padding: '15px',
          animation: 'slideDown 0.2s ease-out'
        }}>
          {children}
        </div>
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
    </div>
  );
};

export default CollapsibleSection;

import { useState, useEffect } from 'react';
import { getStorageStats } from '../lib/dataStore';

/**
 * Storage Status Panel
 * Displays cached data statistics and provides clear cache functionality
 */
export default function StorageStatusPanel({ onClear }) {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState({
    districts: 0,
    worldpop: 0,
    osm: 0,
    acled: 0,
    selectedDistricts: 0,
    enabledLayers: 0
  });
  const [isClearing, setIsClearing] = useState(false);

  // Load storage stats when panel opens
  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  const loadStats = async () => {
    const storageStats = await getStorageStats();
    setStats(storageStats);
  };

  const handleClearCache = async () => {
    if (!window.confirm('Clear all cached data? This will remove districts, WorldPop, OSM, ACLED, facilities, and all settings.')) {
      return;
    }

    setIsClearing(true);
    try {
      if (onClear) {
        await onClear();
      }
      // Reload stats after clearing
      await loadStats();
    } catch (error) {
      console.error('Error clearing cache:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const hasData = stats.districts > 0 || stats.worldpop > 0 || stats.osm > 0 || stats.acled > 0;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 9999
    }}>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          border: 'none',
          background: hasData ? '#10b981' : '#6b7280',
          color: 'white',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 'auto'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title={hasData ? 'Data cached' : 'No cached data'}
      >
        {/* Floppy disk icon */}
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
      </button>

      {/* Expandable panel */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: '70px',
          right: '0',
          width: '320px',
          background: 'white',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
          padding: '16px'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            paddingBottom: '12px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.08)'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 700,
              color: '#1f2937'
            }}>
              Cached Data
            </h3>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                color: '#6b7280',
                cursor: 'pointer',
                padding: '4px',
                lineHeight: 1
              }}
            >
              ×
            </button>
          </div>

          {/* Stats */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginBottom: '16px'
          }}>
            <StatRow label="Districts" value={stats.districts} />
            <StatRow label="WorldPop data" value={stats.worldpop} />
            <StatRow label="OSM features" value={stats.osm} />
            <StatRow label="ACLED events" value={stats.acled} />
            <StatRow label="Selected areas" value={stats.selectedDistricts} />
            <StatRow label="Evidence layers" value={stats.enabledLayers} />
          </div>

          {/* Clear button */}
          <button
            type="button"
            onClick={handleClearCache}
            disabled={isClearing || !hasData}
            style={{
              width: '100%',
              padding: '10px',
              background: hasData ? '#ef4444' : '#e5e7eb',
              color: hasData ? 'white' : '#9ca3af',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: hasData ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease'
            }}
          >
            {isClearing ? 'Clearing...' : 'Clear All Cache'}
          </button>

          {!hasData && (
            <p style={{
              margin: '12px 0 0 0',
              fontSize: '12px',
              color: '#6b7280',
              textAlign: 'center'
            }}>
              No cached data found
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 12px',
      background: value > 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(0, 0, 0, 0.03)',
      borderRadius: '6px'
    }}>
      <span style={{
        fontSize: '13px',
        color: '#4b5563',
        fontWeight: 500
      }}>
        {label}
      </span>
      <span style={{
        fontSize: '14px',
        fontWeight: 700,
        color: value > 0 ? '#059669' : '#9ca3af'
      }}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}

import React, { useState } from 'react';
import { OPERATION_TYPES, getAllOperationTypes } from '../config/operationTypes';

/**
 * Operation Type Selector Component
 * Allows users to select the type of humanitarian operation
 */
const OperationTypeSelector = ({ selectedType, onTypeChange, compact = false }) => {
  const [showDetails, setShowDetails] = useState(false);
  const operationTypes = getAllOperationTypes();
  const selectedConfig = OPERATION_TYPES[Object.keys(OPERATION_TYPES).find(
    key => OPERATION_TYPES[key].id === selectedType
  )] || OPERATION_TYPES.GENERAL;

  if (compact) {
    // Compact dropdown version
    return (
      <div style={{ width: '100%' }}>
        <label style={{
          fontSize: '12px',
          fontWeight: '600',
          color: '#666',
          display: 'block',
          marginBottom: '6px',
          fontFamily: 'Inter, sans-serif'
        }}>
          Operation Type
        </label>
        <select
          value={selectedType}
          onChange={(e) => onTypeChange(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '2px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif',
            backgroundColor: 'white',
            cursor: 'pointer',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => e.target.style.borderColor = '#2196F3'}
          onBlur={(e) => e.target.style.borderColor = '#ddd'}
        >
          {operationTypes.map(type => (
            <option key={type.id} value={type.id}>
              {type.icon} {type.name}
            </option>
          ))}
        </select>
        <div style={{
          fontSize: '11px',
          color: '#999',
          marginTop: '4px',
          fontFamily: 'Inter, sans-serif'
        }}>
          {selectedConfig.description}
        </div>
      </div>
    );
  }

  // Full card-based selector
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '20px',
      border: '1px solid #e0e0e0'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '15px'
      }}>
        <h3 style={{
          fontSize: '16px',
          fontWeight: 'bold',
          margin: 0,
          fontFamily: 'Space Grotesk, sans-serif'
        }}>
          Select Operation Type
        </h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            background: 'none',
            border: 'none',
            color: '#2196F3',
            fontSize: '12px',
            cursor: 'pointer',
            textDecoration: 'underline',
            fontFamily: 'Inter, sans-serif'
          }}
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {/* Selected Type Display */}
      <div style={{
        backgroundColor: '#e3f2fd',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '20px',
        border: '2px solid #2196F3'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '8px'
        }}>
          <span style={{ fontSize: '32px' }}>{selectedConfig.icon}</span>
          <div>
            <div style={{
              fontSize: '18px',
              fontWeight: 'bold',
              fontFamily: 'Space Grotesk, sans-serif',
              color: '#1565c0'
            }}>
              {selectedConfig.name}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#1976d2',
              fontFamily: 'Inter, sans-serif'
            }}>
              {selectedConfig.category}
            </div>
          </div>
        </div>
        <div style={{
          fontSize: '13px',
          color: '#333',
          marginBottom: '10px',
          fontFamily: 'Inter, sans-serif'
        }}>
          {selectedConfig.description}
        </div>

        {showDetails && (
          <div style={{
            borderTop: '1px solid rgba(33, 150, 243, 0.3)',
            paddingTop: '12px',
            marginTop: '12px'
          }}>
            <div style={{ marginBottom: '12px' }}>
              <div style={{
                fontSize: '11px',
                fontWeight: 'bold',
                color: '#1565c0',
                marginBottom: '6px',
                textTransform: 'uppercase',
                fontFamily: 'Inter, sans-serif'
              }}>
                Assessment Method
              </div>
              <div style={{
                fontSize: '12px',
                color: '#333',
                fontFamily: 'Inter, sans-serif'
              }}>
                {selectedConfig.assessmentMethod}
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{
                fontSize: '11px',
                fontWeight: 'bold',
                color: '#1565c0',
                marginBottom: '6px',
                textTransform: 'uppercase',
                fontFamily: 'Inter, sans-serif'
              }}>
                Coverage Target
              </div>
              <div style={{
                fontSize: '12px',
                color: '#333',
                fontFamily: 'Inter, sans-serif'
              }}>
                {(selectedConfig.coverageTarget * 100).toFixed(0)}% target coverage
              </div>
            </div>

            <div>
              <div style={{
                fontSize: '11px',
                fontWeight: 'bold',
                color: '#1565c0',
                marginBottom: '6px',
                textTransform: 'uppercase',
                fontFamily: 'Inter, sans-serif'
              }}>
                Key Supplies
              </div>
              <ul style={{
                margin: 0,
                paddingLeft: '20px',
                fontSize: '11px',
                color: '#555',
                fontFamily: 'Inter, sans-serif'
              }}>
                {selectedConfig.supplies.slice(0, 5).map((supply, idx) => (
                  <li key={idx}>{supply}</li>
                ))}
                {selectedConfig.supplies.length > 5 && (
                  <li style={{ fontStyle: 'italic' }}>
                    +{selectedConfig.supplies.length - 5} more...
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Operation Type Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '10px'
      }}>
        {operationTypes.map(type => (
          <button
            key={type.id}
            onClick={() => onTypeChange(type.id)}
            style={{
              backgroundColor: selectedType === type.id ? '#e3f2fd' : 'white',
              border: selectedType === type.id ? '2px solid #2196F3' : '2px solid #e0e0e0',
              borderRadius: '8px',
              padding: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'center',
              fontFamily: 'Inter, sans-serif'
            }}
            onMouseEnter={(e) => {
              if (selectedType !== type.id) {
                e.currentTarget.style.borderColor = '#2196F3';
                e.currentTarget.style.backgroundColor = '#f5f5f5';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedType !== type.id) {
                e.currentTarget.style.borderColor = '#e0e0e0';
                e.currentTarget.style.backgroundColor = 'white';
              }
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '6px' }}>
              {type.icon}
            </div>
            <div style={{
              fontSize: '11px',
              fontWeight: selectedType === type.id ? 'bold' : '600',
              color: selectedType === type.id ? '#1565c0' : '#333',
              lineHeight: '1.3'
            }}>
              {type.name}
            </div>
          </button>
        ))}
      </div>

      {/* Risk Factors Summary */}
      {showDetails && selectedConfig.riskFactors && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#fff3e0',
          borderRadius: '8px',
          border: '1px solid #ffb74d'
        }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 'bold',
            marginBottom: '10px',
            color: '#e65100',
            fontFamily: 'Space Grotesk, sans-serif'
          }}>
            Key Risk Factors for {selectedConfig.name}
          </div>
          <div style={{
            display: 'grid',
            gap: '8px'
          }}>
            {Object.entries(selectedConfig.riskFactors).map(([key, factor]) => (
              <div key={key} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '11px',
                fontFamily: 'Inter, sans-serif'
              }}>
                <span style={{ color: '#333', fontWeight: '600' }}>
                  {factor.label}
                </span>
                <span style={{
                  backgroundColor: '#ff9800',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  fontWeight: 'bold'
                }}>
                  {(factor.weight * 100).toFixed(0)}% weight
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationTypeSelector;

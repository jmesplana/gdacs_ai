import React from 'react';

const RecommendationsPanel = ({ facility, recommendations, loading, isAIGenerated }) => {
  if (!facility) {
    return null;
  }

  // Function to format and highlight text with risk info
  const formatText = (text) => {
    // First, handle JSON objects
    if (typeof text !== 'string') {
      return String(text);
    }
    
    // Check if text starts with a number followed by dot (like "1. ")
    const isNumberedItem = /^\d+\.\s/.test(text.trim());
    
    // Try to detect if the text is actually a JSON string
    let parsedContent = text;
    try {
      // Check if text appears to be JSON (starts with { or [)
      if ((text.trim().startsWith('{') && text.trim().endsWith('}')) || 
          (text.trim().startsWith('[') && text.trim().endsWith(']'))) {
        // Try to parse it
        const parsedObject = JSON.parse(text);
        
        // Handle different types of parsed content
        if (Array.isArray(parsedObject)) {
          // For arrays, format as a list
          return (
            <ul style={{ margin: '0', paddingLeft: '20px' }}>
              {parsedObject.map((item, idx) => (
                <li key={idx} style={{ marginBottom: '8px' }}>
                  {typeof item === 'object' ? formatJSONObject(item) : formatText(String(item))}
                </li>
              ))}
            </ul>
          );
        } else if (typeof parsedObject === 'object') {
          // For objects, format with nice formatting
          return formatJSONObject(parsedObject);
        }
        
        // If parsing worked but result is a simple value, use it
        parsedContent = parsedObject;
      }
    } catch (e) {
      // Not valid JSON, continue with normal text processing
    }
    
    // Convert to string if somehow not a string
    if (typeof parsedContent !== 'string') {
      parsedContent = String(parsedContent);
    }
    
    // Check if text contains risk keywords
    const highRiskKeywords = ['severe', 'extreme', 'critical', 'high risk', 'immediate', 'urgent', 'evacuate'];
    const containsHighRisk = highRiskKeywords.some(keyword => 
      parsedContent.toLowerCase().includes(keyword)
    );
    
    // Format text: fix any JSON artifacts, convert objects to strings
    let formattedText = parsedContent
      .replace(/^\[|\]$/g, '') // Remove leading/trailing brackets
      .replace(/^"(.+)"$/g, '$1') // Remove extra quotes
      .replace(/[{}]/g, '') // Remove any remaining curly braces
      .replace(/^\d+\.\s+/, '') // Remove leading numbers (e.g., "1. ")
      .trim();
    
    // Return highlighted text if high risk, or normal text
    return containsHighRisk ? (
      <span style={{ 
        color: '#d32f2f', 
        fontWeight: 'bold',
        backgroundColor: 'rgba(211, 47, 47, 0.1)',
        padding: '2px 4px',
        borderRadius: '3px'
      }}>
        {formattedText} ⚠️
      </span>
    ) : formattedText;
  };
  
  // Helper function to format JSON objects nicely
  const formatJSONObject = (obj) => {
    // For empty objects
    if (Object.keys(obj).length === 0) {
      return "No data";
    }
    
    // Handle different object patterns
    
    // Case 1: Object with "Overall Rating" and "Explanation" fields (Risk Rating)
    if (obj.Overall && obj.Explanation) {
      return (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
            {obj.Overall === "High" ? 
              <span style={{ color: '#d32f2f' }}>{obj.Overall} Risk ⚠️</span> : 
              obj.Overall === "Medium" ? 
                <span style={{ color: '#FF9800' }}>{obj.Overall} Risk</span> : 
                <span style={{ color: '#4CAF50' }}>{obj.Overall} Risk</span>
            }
          </div>
          <div>{obj.Explanation}</div>
        </div>
      );
    }
    
    // Case 2: Object with "Recommendations" array
    if (obj.Recommendations && Array.isArray(obj.Recommendations)) {
      return (
        <ul style={{ margin: '0', paddingLeft: '20px' }}>
          {obj.Recommendations.map((item, idx) => (
            <li key={idx} style={{ marginBottom: '8px' }}>
              {formatText(String(item))}
            </li>
          ))}
        </ul>
      );
    }
    
    // Case 3: Object with "Type" and "Description" fields (like scenarios)
    if (obj.Type && obj.Description) {
      return (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            {obj.Type}:
          </div>
          <div>{obj.Description}</div>
        </div>
      );
    }
    
    // General case: Render all key-value pairs
    return (
      <div>
        {Object.entries(obj).map(([key, value], idx) => {
          // Skip rendering "Type" if we've already used it as a header
          if (key === "Type" && obj.Description) return null;
          
          // Regular rendering for other fields
          return (
            <div key={idx} style={{ marginBottom: '8px' }}>
              <strong>{key}: </strong>
              {typeof value === 'object' ? 
                (Array.isArray(value) ? 
                  <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                    {value.map((item, i) => (
                      <li key={i}>{typeof item === 'object' ? formatJSONObject(item) : formatText(String(item))}</li>
                    ))}
                  </ul> : 
                  formatJSONObject(value)
                ) : 
                formatText(String(value))
              }
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="recommendations-container">
      <h2>Recommendations for {facility.name}</h2>
      
      {/* AI badge - only show if explicitly AI generated */}
      {isAIGenerated && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          backgroundColor: '#e3f2fd',
          padding: '6px 12px',
          borderRadius: '4px',
          marginBottom: '15px'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
          </svg>
          <span style={{color: '#0d47a1', fontWeight: 'bold', fontSize: '14px'}}>
            AI-Generated Recommendations
          </span>
        </div>
      )}
      
      
      {loading ? (
        <div className="loading" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0'}}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px', animation: 'spin 1s linear infinite' }}>
            <line x1="12" y1="2" x2="12" y2="6"></line>
            <line x1="12" y1="18" x2="12" y2="22"></line>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
            <line x1="2" y1="12" x2="6" y2="12"></line>
            <line x1="18" y1="12" x2="22" y2="12"></line>
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
          </svg>
          <span>Generating recommendations...</span>
        </div>
      ) : recommendations ? (
        <div>
          {Object.entries(recommendations).map(([category, items]) => {
            // Skip rendering if there are no items or if it's an error, About, or Credits category
            if (category === 'error' || category === 'About' || category === 'Credits' || !items || items.length === 0) return null;
            
            return (
              <div key={category} className="recommendations-section" style={{marginBottom: '20px'}}>
                <h4 style={{
                  borderBottom: '2px solid #f0f0f0',
                  paddingBottom: '8px',
                  fontSize: '16px'
                }}>{category}</h4>
                <div style={{margin: '10px 0'}}>
                  {typeof items === 'object' && !Array.isArray(items) ? (
                    // For complex JSON objects
                    formatText(JSON.stringify(items))
                  ) : Array.isArray(items) ? (
                    // For arrays
                    <ul style={{paddingLeft: '20px', margin: '10px 0', listStyleType: 'disc'}}>
                      {items.map((item, index) => (
                        <li key={index} style={{marginBottom: '10px', lineHeight: '1.5'}}>
                          {formatText(item)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    // For simple strings
                    <div style={{marginBottom: '10px', lineHeight: '1.5'}}>
                      {formatText(String(items))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p>Select an impacted facility to generate AI-powered recommendations.</p>
      )}
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default RecommendationsPanel;
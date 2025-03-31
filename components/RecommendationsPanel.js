import React from 'react';

const RecommendationsPanel = ({ facility, recommendations, loading }) => {
  if (!facility) {
    return null;
  }

  return (
    <div className="recommendations-container">
      <h2>Recommendations for {facility.name}</h2>
      
      {loading ? (
        <div className="loading">Generating recommendations...</div>
      ) : recommendations ? (
        <div>
          {Object.entries(recommendations).map(([category, items]) => {
            // Skip rendering if there are no items or if it's an error
            if (category === 'error' || !items || items.length === 0) return null;
            
            return (
              <div key={category} className="recommendations-section">
                <h4>{category}</h4>
                <ul>
                  {items.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <p>Select an impacted facility to generate AI-powered recommendations.</p>
      )}
    </div>
  );
};

export default RecommendationsPanel;
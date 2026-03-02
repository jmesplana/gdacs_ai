import { useState } from 'react';
import JSZip from 'jszip';

export default function ShapefileUploader({ onDistrictsLoaded }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploaded, setUploaded] = useState(false);
  const [availableFields, setAvailableFields] = useState(null);
  const [selectedField, setSelectedField] = useState(null);
  const [pendingData, setPendingData] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({ step: '', progress: 0 });

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      setError('Please upload a .zip file containing shapefile (.shp, .dbf, .shx). Make sure your file has a .zip extension.');
      return;
    }

    setLoading(true);
    setError(null);
    setUploadProgress({ step: 'Reading ZIP file...', progress: 10 });

    try {
      console.log('Reading shapefile ZIP...');
      const arrayBuffer = await file.arrayBuffer();
      setUploadProgress({ step: 'Extracting files...', progress: 25 });
      const zip = await JSZip.loadAsync(arrayBuffer);

      // Find required files
      let shpFile = null;
      let dbfFile = null;
      let prjFile = null;

      for (const [filename, fileData] of Object.entries(zip.files)) {
        if (filename.toLowerCase().endsWith('.shp')) {
          shpFile = await fileData.async('arraybuffer');
        } else if (filename.toLowerCase().endsWith('.dbf')) {
          dbfFile = await fileData.async('arraybuffer');
        } else if (filename.toLowerCase().endsWith('.prj')) {
          prjFile = await fileData.async('arraybuffer');
          console.log('Found projection file (.prj)');
        }
      }

      if (!shpFile || !dbfFile) {
        throw new Error('Missing required files. Your ZIP must contain:\n• .shp file (geometry)\n• .dbf file (attributes)\n• .prj file (projection - recommended)\n\nTip: Export from QGIS or ArcGIS as a shapefile and ensure all files are zipped together.');
      }

      setUploadProgress({ step: 'Validating files...', progress: 40 });
      console.log('Sending shapefile to API for processing...');

      // Check file sizes
      const totalSize = shpFile.byteLength + dbfFile.byteLength + (prjFile?.byteLength || 0);
      console.log(`Total file size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

      // Vercel Pro has a 100MB limit on request bodies
      if (totalSize > 100 * 1024 * 1024) {
        throw new Error(`Shapefile too large (${(totalSize / 1024 / 1024).toFixed(2)}MB).\n\nMaximum size: 100MB\n\nSolutions:\n• Simplify geometry in QGIS (Vector → Geometry Tools → Simplify)\n• Use a lower resolution version\n• Split into smaller geographic areas\n• Reduce coordinate precision`);
      }

      // Create FormData for multipart upload (more efficient than base64)
      setUploadProgress({ step: 'Uploading to server...', progress: 50 });
      const formData = new FormData();
      formData.append('shpFile', new Blob([shpFile]), 'shapefile.shp');
      formData.append('dbfFile', new Blob([dbfFile]), 'shapefile.dbf');
      if (prjFile) {
        formData.append('prjFile', new Blob([prjFile]), 'shapefile.prj');
      }

      let response;
      try {
        // Create an abort controller for timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

        response = await fetch('/api/process-shapefile', {
          method: 'POST',
          body: formData, // Send as multipart/form-data
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          throw new Error(`Request timeout: The shapefile processing took too long.\n\nSolutions:\n• Use a smaller or simplified shapefile\n• Reduce geometry complexity in QGIS\n• Check your network connection\n\nThe server allows up to 2 minutes for processing.`);
        }
        throw new Error(`Network error: Unable to connect to the server.\n\nPossible causes:\n• Development server may not be running (run: npm run dev)\n• Network connection issues\n• Server timeout (try a smaller shapefile)\n\nTechnical details: ${fetchError.message}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server processing failed (${response.status}).\n\nDetails: ${errorText}\n\nTip: Try a smaller shapefile or contact support if the issue persists.`);
      }

      setUploadProgress({ step: 'Processing geometries...', progress: 75 });
      const data = await response.json();
      console.log(`✅ Loaded ${data.count} administrative boundaries`);

      setUploadProgress({ step: 'Finalizing...', progress: 90 });

      // Show field selection if available fields are returned
      if (data.availableFields && data.availableFields.length > 0) {
        setAvailableFields(data.availableFields);
        setPendingData(data);
        setUploadProgress({ step: 'Complete!', progress: 100 });
        setLoading(false);
      } else {
        // No fields available, just load the data
        setUploadProgress({ step: 'Complete!', progress: 100 });
        onDistrictsLoaded(data.districts);
        setLoading(false);
        setUploaded(true);
      }

    } catch (err) {
      console.error('Error uploading shapefile:', err);
      setError(err.message);
      setLoading(false);
      setUploadProgress({ step: '', progress: 0 });
    }
  };

  const handleFieldSelection = (fieldName) => {
    setSelectedField(fieldName);

    // Re-map the districts using the selected field
    const remappedDistricts = pendingData.districts.map(district => ({
      ...district,
      name: district.properties[fieldName] || district.name,
      properties: {
        ...district.properties,
        displayName: district.properties[fieldName] || district.name
      }
    }));

    onDistrictsLoaded(remappedDistricts);
    setUploaded(true);
    setAvailableFields(null);
    setPendingData(null);
  };

  // If field selection is needed, show field picker
  if (availableFields && availableFields.length > 0) {
    return (
      <div style={{
        padding: '20px',
        backgroundColor: 'var(--aidstack-off-white)',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '2px solid var(--aidstack-teal)'
      }}>
        <h3 style={{
          margin: '0 0 10px 0',
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '18px',
          color: 'var(--aidstack-navy)'
        }}>
          Select Label Field
        </h3>

        <p style={{
          fontSize: '14px',
          color: 'var(--aidstack-slate-medium)',
          marginBottom: '15px'
        }}>
          Choose which field to use as the label on the map:
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '10px',
          marginBottom: '15px'
        }}>
          {availableFields.map(field => (
            <button
              key={field}
              onClick={() => handleFieldSelection(field)}
              style={{
                padding: '12px 16px',
                backgroundColor: 'white',
                border: '2px solid var(--aidstack-slate-light)',
                borderRadius: '6px',
                color: 'var(--aidstack-navy)',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: '600',
                fontFamily: 'Space Grotesk, sans-serif',
                transition: 'all 0.2s',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                e.target.style.borderColor = 'var(--aidstack-teal)';
                e.target.style.backgroundColor = 'var(--aidstack-teal-light)';
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = 'var(--aidstack-slate-light)';
                e.target.style.backgroundColor = 'white';
              }}
            >
              {field}
            </button>
          ))}
        </div>

        <div style={{
          padding: '10px',
          backgroundColor: '#e3f2fd',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#1565c0'
        }}>
          Preview: The first feature will show as "{pendingData?.districts[0]?.properties[availableFields[0]] || 'N/A'}"
        </div>
      </div>
    );
  }

  // If already uploaded, show compact success message
  if (uploaded) {
    return (
      <div style={{
        padding: '12px 16px',
        backgroundColor: '#e8f5e9',
        borderRadius: '8px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        border: '1px solid #4CAF50'
      }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span style={{
          fontSize: '14px',
          color: '#2e7d32',
          fontWeight: '600',
          fontFamily: 'Space Grotesk, sans-serif'
        }}>
          Admin boundaries loaded successfully
        </span>
        <button
          onClick={() => setUploaded(false)}
          style={{
            marginLeft: 'auto',
            padding: '4px 12px',
            backgroundColor: 'white',
            border: '1px solid #4CAF50',
            borderRadius: '4px',
            color: '#2e7d32',
            fontSize: '12px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Upload New
        </button>
      </div>
    );
  }

  return (
    <div style={{
      padding: '20px',
      backgroundColor: 'var(--aidstack-off-white)',
      borderRadius: '8px',
      marginBottom: '20px'
    }}>
      <h3 style={{
        margin: '0 0 10px 0',
        fontFamily: 'Space Grotesk, sans-serif',
        fontSize: '18px',
        color: 'var(--aidstack-navy)'
      }}>
        Upload Admin Level Boundaries
      </h3>

      <p style={{
        fontSize: '14px',
        color: 'var(--aidstack-slate-medium)',
        marginBottom: '15px'
      }}>
        Upload a shapefile (.zip) with administrative boundaries (districts, provinces, etc.) for risk analysis and campaign planning
      </p>

      <div style={{ marginBottom: '10px' }}>
        <input
          type="file"
          accept=".zip"
          onChange={handleFileUpload}
          disabled={loading}
          style={{
            padding: '10px',
            border: '2px solid var(--aidstack-slate-light)',
            borderRadius: '4px',
            backgroundColor: 'white',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        />
      </div>

      {loading && (
        <div style={{
          padding: '15px',
          backgroundColor: '#e3f2fd',
          borderRadius: '8px',
          border: '1px solid #2196F3',
          marginBottom: '10px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '10px'
          }}>
            <div style={{
              width: '20px',
              height: '20px',
              border: '3px solid #2196F3',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginRight: '10px'
            }}></div>
            <span style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#1565c0',
              fontFamily: 'Space Grotesk, sans-serif'
            }}>
              {uploadProgress.step || 'Processing shapefile...'}
            </span>
          </div>

          {/* Progress bar */}
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#bbdefb',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${uploadProgress.progress}%`,
              height: '100%',
              backgroundColor: '#2196F3',
              transition: 'width 0.3s ease',
              borderRadius: '4px'
            }}></div>
          </div>

          <div style={{
            marginTop: '8px',
            fontSize: '12px',
            color: '#1565c0',
            textAlign: 'right',
            fontFamily: 'Inter, sans-serif'
          }}>
            {uploadProgress.progress}% complete
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {error && (
        <div style={{
          padding: '15px',
          backgroundColor: '#ffebee',
          borderRadius: '8px',
          border: '1px solid #f44336',
          marginBottom: '10px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            marginBottom: '8px'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d32f2f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px', flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#c62828',
                marginBottom: '8px',
                fontFamily: 'Space Grotesk, sans-serif'
              }}>
                Upload Failed
              </div>
              <div style={{
                fontSize: '13px',
                color: '#d32f2f',
                whiteSpace: 'pre-line',
                lineHeight: '1.6',
                fontFamily: 'Inter, sans-serif'
              }}>
                {error}
              </div>
            </div>
          </div>

          <button
            onClick={() => setError(null)}
            style={{
              marginTop: '10px',
              padding: '6px 12px',
              backgroundColor: 'white',
              border: '1px solid #f44336',
              borderRadius: '4px',
              color: '#d32f2f',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: '600',
              fontFamily: 'Inter, sans-serif'
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      <div style={{
        marginTop: '10px',
        fontSize: '12px',
        color: 'var(--aidstack-slate-medium)'
      }}>
        <strong>Supported formats:</strong> ESRI Shapefile (.zip containing .shp, .dbf, .prj files)
        <br />
        <strong>Common field names:</strong> NAME, DISTRICT, ADM1_NAME, ADM2_NAME, etc.
        <br />
        <strong>Note:</strong> Include .prj file for proper coordinate projection
      </div>
    </div>
  );
}

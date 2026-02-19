import { useState } from 'react';
import JSZip from 'jszip';

export default function ShapefileUploader({ onDistrictsLoaded }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploaded, setUploaded] = useState(false);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      setError('Please upload a .zip file containing shapefile (.shp, .dbf, .shx)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Reading shapefile ZIP...');
      const arrayBuffer = await file.arrayBuffer();
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
        throw new Error('ZIP must contain both .shp and .dbf files');
      }

      console.log('Sending shapefile to API for processing...');

      // Check file sizes
      const totalSize = shpFile.byteLength + dbfFile.byteLength + (prjFile?.byteLength || 0);
      const estimatedBase64Size = Math.ceil(totalSize * 4/3); // Base64 increases size by ~33%
      console.log(`Total file size: ${(totalSize / 1024 / 1024).toFixed(2)} MB, Estimated upload: ${(estimatedBase64Size / 1024 / 1024).toFixed(2)} MB`);

      // Vercel Pro has a 100MB limit on request bodies
      if (estimatedBase64Size > 75 * 1024 * 1024) {
        throw new Error(`Shapefile too large (${(estimatedBase64Size / 1024 / 1024).toFixed(2)}MB). Maximum size is ~75MB. Try simplifying the geometry in QGIS or use a lower resolution version.`);
      }

      // Convert to base64 for API
      const shpBase64 = Buffer.from(shpFile).toString('base64');
      const dbfBase64 = Buffer.from(dbfFile).toString('base64');
      const prjBase64 = prjFile ? Buffer.from(prjFile).toString('base64') : null;

      const response = await fetch('/api/process-shapefile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shpFile: shpBase64,
          dbfFile: dbfBase64,
          prjFile: prjBase64
        })
      });

      if (!response.ok) {
        throw new Error('Failed to process shapefile');
      }

      const data = await response.json();
      console.log(`✅ Loaded ${data.count} administrative boundaries`);

      onDistrictsLoaded(data.districts);
      setLoading(false);
      setUploaded(true); // Mark as uploaded to hide the uploader

    } catch (err) {
      console.error('Error uploading shapefile:', err);
      setError(err.message);
      setLoading(false);
    }
  };

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
          padding: '10px',
          backgroundColor: 'var(--color-info)',
          color: 'white',
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          Processing shapefile...
        </div>
      )}

      {error && (
        <div style={{
          padding: '10px',
          backgroundColor: 'var(--color-error)',
          color: 'white',
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          Error: {error}
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

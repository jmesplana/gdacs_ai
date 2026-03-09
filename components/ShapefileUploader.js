import { useState } from 'react';
import JSZip from 'jszip';
import * as shapefile from 'shapefile';
import simplify from '@turf/simplify';
import { feature } from '@turf/helpers';
import proj4 from 'proj4';

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
      setUploadProgress({ step: 'Extracting files...', progress: 20 });
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

      // Check file sizes
      const totalSize = shpFile.byteLength + dbfFile.byteLength + (prjFile?.byteLength || 0);
      console.log(`Total file size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

      // Process shapefile CLIENT-SIDE (no server upload!)
      setUploadProgress({ step: 'Parsing shapefile...', progress: 40 });
      console.log('Processing shapefile locally in browser...');

      // Open shapefile using the shapefile library (works in browser!)
      const source = await shapefile.open(shpFile, dbfFile);

      let features = []; // Changed from const to let so we can reassign after reprojection
      let result = await source.read();
      let featureCount = 0;

      while (!result.done) {
        if (result.value) {
          features.push(result.value);
          featureCount++;

          // Update progress periodically
          if (featureCount % 100 === 0) {
            setUploadProgress({
              step: `Parsing features... (${featureCount})`,
              progress: 40 + (featureCount / 1000) * 20 // Estimate
            });
          }
        }
        result = await source.read();
      }

      console.log(`Parsed ${features.length} features from shapefile`);
      setUploadProgress({ step: 'Reprojecting coordinates...', progress: 60 });

      // Read projection from .prj file if available
      let sourceProjection = null;
      if (prjFile) {
        const prjText = new TextDecoder().decode(prjFile);
        console.log('Projection file content:', prjText.substring(0, 200));

        // Try to use the projection from the .prj file
        try {
          sourceProjection = prjText;
          // Test if proj4 can parse it
          proj4(sourceProjection, 'WGS84', [0, 0]);
          console.log('✅ Successfully loaded projection from .prj file');
        } catch (e) {
          console.warn('Could not parse .prj file, will attempt auto-detection:', e.message);
          sourceProjection = null;
        }
      }

      // If no projection or can't parse, try to detect based on coordinate ranges
      if (!sourceProjection && features.length > 0) {
        const firstCoord = getFirstCoordinate(features[0].geometry);
        if (firstCoord) {
          const [x, y] = firstCoord;
          // Check if coordinates look like UTM (large numbers)
          if (Math.abs(x) > 180 || Math.abs(y) > 90) {
            // Assume UTM Zone 36N for Uganda (EPSG:32636)
            sourceProjection = '+proj=utm +zone=36 +datum=WGS84 +units=m +no_defs';
            console.log('🔍 Auto-detected UTM Zone 36N projection for Uganda');
          }
        }
      }

      // Reproject features if needed
      if (sourceProjection) {
        console.log('🔄 Reprojecting coordinates to WGS84...');
        features = features.map(feat => {
          try {
            const reprojectedGeometry = reprojectGeometry(feat.geometry, sourceProjection);
            return {
              ...feat,
              geometry: reprojectedGeometry
            };
          } catch (e) {
            console.error('Error reprojecting feature:', e);
            return feat; // Return original if reprojection fails
          }
        });
        console.log('✅ Reprojection complete');
      }

      setUploadProgress({ step: 'Simplifying geometries...', progress: 70 });

      // Extract all unique field names from the first feature
      const availableFields = features.length > 0
        ? Object.keys(features[0].properties || {})
        : [];
      console.log('Available fields:', availableFields);

      // Process districts locally
      const districts = features.map((feat, idx) => {
        const props = feat.properties || {};
        let geometry = feat.geometry;

        // Try to find district name from common field names
        const districtName = props.NAME || props.DISTRICT || props.District ||
                            props.name || props.district || props.ADM2_EN ||
                            props.ADM2_NAME || props.NAME_2 || `District ${idx + 1}`;

        // Get other useful properties
        const country = props.COUNTRY || props.Country || props.ADM0_NAME || props.NAME_0;
        const region = props.REGION || props.Region || props.ADM1_NAME || props.NAME_1;
        const population = props.POPULATION || props.Population || props.POP;

        // Convert LineString to Polygon by closing the ring
        if (geometry && geometry.type === 'LineString') {
          console.log(`Converting LineString to Polygon for ${districtName}`);
          const coords = geometry.coordinates;
          // Check if first and last points are the same (closed ring)
          const first = coords[0];
          const last = coords[coords.length - 1];
          const isClosed = first[0] === last[0] && first[1] === last[1];

          // If not closed, close it
          const ring = isClosed ? coords : [...coords, first];

          geometry = {
            type: 'Polygon',
            coordinates: [ring]
          };
        }

        // Convert MultiLineString to MultiPolygon
        if (geometry && geometry.type === 'MultiLineString') {
          console.log(`Converting MultiLineString to MultiPolygon for ${districtName}`);
          geometry = {
            type: 'MultiPolygon',
            coordinates: geometry.coordinates.map(lineCoords => {
              const first = lineCoords[0];
              const last = lineCoords[lineCoords.length - 1];
              const isClosed = first[0] === last[0] && first[1] === last[1];
              const ring = isClosed ? lineCoords : [...lineCoords, first];
              return [ring];
            })
          };
        }

        // Simplify geometry to reduce size (tolerance = 0.001 degrees ~ 100m)
        let simplifiedGeometry = geometry;
        if (geometry && (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon')) {
          try {
            const turfFeature = feature(geometry);
            const simplified = simplify(turfFeature, { tolerance: 0.001, highQuality: false });
            simplifiedGeometry = simplified.geometry;
          } catch (e) {
            console.warn(`Could not simplify geometry for ${districtName}:`, e);
          }
        }

        // Calculate bounding box for quick spatial queries
        let bounds = null;
        if (simplifiedGeometry && simplifiedGeometry.coordinates) {
          bounds = calculateBounds(simplifiedGeometry);
        }

        return {
          id: idx,
          name: districtName,
          country,
          region,
          population,
          geometry: simplifiedGeometry,
          bounds,
          properties: props
        };
      });

      console.log(`✅ Processed ${districts.length} administrative boundaries locally`);
      setUploadProgress({ step: 'Finalizing...', progress: 90 });

      // Show field selection if available fields are returned
      if (availableFields && availableFields.length > 0) {
        setAvailableFields(availableFields);
        setPendingData({ districts, count: districts.length, availableFields });
        setUploadProgress({ step: 'Complete!', progress: 100 });
        setLoading(false);
      } else {
        // No fields available, just load the data
        setUploadProgress({ step: 'Complete!', progress: 100 });
        onDistrictsLoaded(districts);
        setLoading(false);
        setUploaded(true);
      }

    } catch (err) {
      console.error('Error processing shapefile:', err);
      setError(err.message);
      setLoading(false);
      setUploadProgress({ step: '', progress: 0 });
    }
  };

  // Helper function to get the first coordinate from a geometry
  function getFirstCoordinate(geometry) {
    if (!geometry || !geometry.coordinates) return null;

    const coords = geometry.coordinates;
    if (geometry.type === 'Point') {
      return coords;
    } else if (geometry.type === 'LineString' || geometry.type === 'MultiPoint') {
      return coords[0];
    } else if (geometry.type === 'Polygon' || geometry.type === 'MultiLineString') {
      return coords[0][0];
    } else if (geometry.type === 'MultiPolygon') {
      return coords[0][0][0];
    }
    return null;
  }

  // Helper function to reproject geometry coordinates
  function reprojectGeometry(geometry, sourceProjection) {
    if (!geometry || !geometry.coordinates) return geometry;

    const reprojectCoords = (coords) => {
      if (typeof coords[0] === 'number') {
        // This is a coordinate pair [x, y]
        try {
          return proj4(sourceProjection, 'WGS84', coords);
        } catch (e) {
          console.error('Error reprojecting coordinate:', coords, e);
          return coords;
        }
      } else {
        // Array of coordinates, recurse
        return coords.map(c => reprojectCoords(c));
      }
    };

    return {
      ...geometry,
      coordinates: reprojectCoords(geometry.coordinates)
    };
  }

  // Helper function to calculate bounding box
  function calculateBounds(geometry) {
    if (!geometry || !geometry.coordinates) return null;

    const coords = [];
    const extractCoords = (arr) => {
      if (Array.isArray(arr[0])) {
        arr.forEach(extractCoords);
      } else {
        coords.push(arr);
      }
    };

    extractCoords(geometry.coordinates);

    if (coords.length === 0) return null;

    const lons = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);

    return {
      minLng: Math.min(...lons),
      maxLng: Math.max(...lons),
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats)
    };
  }

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

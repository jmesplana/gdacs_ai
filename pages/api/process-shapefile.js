import shapefile from 'shapefile';
import proj4 from 'proj4';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', // Shapefiles can be large
    },
    responseLimit: '10mb', // Allow larger responses for shapefile data
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { shpFile, dbfFile, prjFile } = req.body;

    if (!shpFile || !dbfFile) {
      return res.status(400).json({ error: 'Both .shp and .dbf files required' });
    }

    console.log('Processing shapefile...');

    // Decode base64 files
    const shpBuffer = Buffer.from(shpFile, 'base64');
    const dbfBuffer = Buffer.from(dbfFile, 'base64');

    // Check if there's a .prj file for coordinate system info
    let projectionTransform = null;
    if (prjFile) {
      try {
        const prjText = Buffer.from(prjFile, 'base64').toString('utf-8');
        console.log('Found projection file:', prjText.substring(0, 100) + '...');
        // Create transformation from source projection to WGS84
        projectionTransform = proj4(prjText, 'EPSG:4326');
      } catch (err) {
        console.warn('Could not parse projection file:', err.message);
      }
    }

    // Parse shapefile
    const features = [];
    const source = await shapefile.open(shpBuffer, dbfBuffer);

    let result = await source.read();
    while (!result.done) {
      if (result.value) {
        features.push(result.value);
      }
      result = await source.read();
    }

    console.log(`Parsed ${features.length} features from shapefile`);

    // Extract district information (keep geometry for rendering)
    const districts = features.map((feature, idx) => {
      const props = feature.properties || {};
      const geometry = feature.geometry;

      // Try to find district name from common field names
      const districtName = props.NAME || props.DISTRICT || props.District ||
                          props.name || props.district || props.ADM2_EN ||
                          props.ADM2_NAME || props.NAME_2 || `District ${idx + 1}`;

      // Get other useful properties
      const country = props.COUNTRY || props.Country || props.ADM0_NAME || props.NAME_0;
      const region = props.REGION || props.Region || props.ADM1_NAME || props.NAME_1;
      const population = props.POPULATION || props.Population || props.POP;

      // Calculate bounding box for quick spatial queries
      let bounds = null;
      if (geometry && geometry.coordinates) {
        bounds = calculateBounds(geometry);
      }

      // Reproject and simplify geometry
      let processedGeometry = geometry;
      if (projectionTransform) {
        processedGeometry = reprojectGeometry(geometry, projectionTransform);
      }
      processedGeometry = simplifyGeometry(processedGeometry);

      // Recalculate bounds after reprojection
      if (projectionTransform && processedGeometry && processedGeometry.coordinates) {
        bounds = calculateBounds(processedGeometry);
      }

      return {
        id: idx,
        name: districtName,
        country: country,
        region: region,
        population: population,
        geometry: processedGeometry,
        bounds: bounds,
        properties: {
          name: districtName,
          country: country,
          region: region,
          population: population
        }
      };
    });

    res.status(200).json({
      districts: districts,
      count: districts.length,
      type: 'FeatureCollection'
    });

  } catch (error) {
    console.error('Error processing shapefile:', error);
    res.status(500).json({ error: error.message });
  }
}

// Reproject geometry to WGS84
function reprojectGeometry(geometry, transform) {
  if (!geometry || !geometry.coordinates) return geometry;

  const reprojectCoords = (coords) => {
    if (typeof coords[0] === 'number') {
      // This is a coordinate pair [x, y] - reproject to [lng, lat]
      try {
        const [lng, lat] = transform.forward(coords);
        return [lng, lat];
      } catch (err) {
        console.warn('Failed to reproject coordinate:', coords, err.message);
        return coords;
      }
    }
    // Recursively process nested arrays
    return coords.map(reprojectCoords);
  };

  return {
    ...geometry,
    coordinates: reprojectCoords(geometry.coordinates)
  };
}

// Simplify coordinates by reducing precision and sampling points
function simplifyGeometry(geometry) {
  if (!geometry || !geometry.coordinates) return geometry;

  const simplifyCoords = (coords, depth = 0) => {
    if (typeof coords[0] === 'number') {
      // This is a coordinate pair [lng, lat] - reduce precision to 4 decimal places
      return [
        Math.round(coords[0] * 10000) / 10000,
        Math.round(coords[1] * 10000) / 10000
      ];
    }

    // If this is an array of coordinate pairs (polygon ring), sample every 3rd point
    if (coords.length > 0 && typeof coords[0][0] === 'number') {
      // Sample every 3rd point to reduce size, but always keep first and last
      const simplified = coords.filter((_, i) => i === 0 || i === coords.length - 1 || i % 3 === 0);
      return simplified.map(simplifyCoords);
    }

    // Recursively process nested arrays (MultiPolygon, etc.)
    return coords.map(c => simplifyCoords(c, depth + 1));
  };

  return {
    ...geometry,
    coordinates: simplifyCoords(geometry.coordinates)
  };
}

function calculateBounds(geometry) {
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  const processCoordinates = (coords) => {
    if (Array.isArray(coords[0])) {
      coords.forEach(processCoordinates);
    } else {
      const [lng, lat] = coords;
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    }
  };

  if (geometry.coordinates) {
    processCoordinates(geometry.coordinates);
  }

  return {
    minLat, maxLat, minLng, maxLng,
    center: [(minLat + maxLat) / 2, (minLng + maxLng) / 2]
  };
}

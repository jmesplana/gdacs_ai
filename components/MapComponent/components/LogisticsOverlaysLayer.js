import React from 'react';
import { Polyline, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';

const LogisticsOverlaysLayer = ({
  data,
  visible = true,
  showRoads = true,
  showBridges = true,
  showFuel = true,
  showAirports = true
}) => {
  if (!visible || !data) return null;

  const { roadNetwork, fuelAccess, airAccess } = data;

  return (
    <>
      {/* Road Network Overlays */}
      {showRoads && roadNetwork && roadNetwork.roads && (
        <RoadOverlays roads={roadNetwork.roads} />
      )}

      {/* Bridge Markers */}
      {showBridges && roadNetwork && roadNetwork.bridgesAtRisk && (
        <BridgeMarkers bridges={roadNetwork.bridgesAtRisk} />
      )}

      {/* Fuel Station Markers */}
      {showFuel && fuelAccess && (
        <FuelStationMarkers
          operational={fuelAccess.operationalStations || []}
          atRisk={fuelAccess.atRiskStations || []}
        />
      )}

      {/* Airport Markers */}
      {showAirports && airAccess && (
        <AirportMarkers
          operational={airAccess.operationalAirports || []}
          atRisk={airAccess.atRiskAirports || []}
        />
      )}
    </>
  );
};

// Road Overlays Component
const RoadOverlays = ({ roads }) => {
  if (!roads || roads.length === 0) return null;

  return (
    <>
      {roads.map((road, idx) => {
        if (!road.geometry || !road.geometry.coordinates) return null;

        const coordinates = road.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        const blockageProbability = road.blockageProbability || 0;

        // Color based on blockage probability
        let color;
        if (blockageProbability > 0.7) {
          color = '#ef4444'; // Red - Critical
        } else if (blockageProbability > 0.4) {
          color = '#f97316'; // Orange - High risk
        } else if (blockageProbability > 0.2) {
          color = '#eab308'; // Yellow - Moderate risk
        } else {
          color = '#22c55e'; // Green - Passable
        }

        const weight = road.highway === 'motorway' || road.highway === 'trunk' ? 4 : 3;

        return (
          <Polyline
            key={`road-${idx}`}
            positions={coordinates}
            pathOptions={{
              color: color,
              weight: weight,
              opacity: 0.7,
              lineCap: 'round',
              lineJoin: 'round'
            }}
          >
            <Popup>
              <div style={{ minWidth: '200px' }}>
                <strong>{road.name || 'Unnamed Road'}</strong>
                <div style={{ marginTop: '8px', fontSize: '13px' }}>
                  <div>Type: {road.highway || 'unknown'}</div>
                  <div>Status: {blockageProbability > 0.4 ? '⚠️ At Risk' : '✓ Passable'}</div>
                  <div>Blockage Risk: {(blockageProbability * 100).toFixed(0)}%</div>
                  {road.distanceToDisaster !== undefined && (
                    <div>Distance to disaster: {road.distanceToDisaster.toFixed(1)} km</div>
                  )}
                </div>
              </div>
            </Popup>
          </Polyline>
        );
      })}
    </>
  );
};

// Bridge Markers Component
const BridgeMarkers = ({ bridges }) => {
  if (!bridges || bridges.length === 0) return null;

  const bridgeIcon = L.divIcon({
    html: `<div style="
      background: #f97316;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
    ">🌉</div>`,
    className: 'logistics-bridge-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });

  return (
    <>
      {bridges.map((bridge, idx) => {
        if (!bridge.coordinates) return null;

        const position = [bridge.coordinates.latitude, bridge.coordinates.longitude];

        return (
          <Marker
            key={`bridge-${idx}`}
            position={position}
            icon={bridgeIcon}
          >
            <Popup>
              <div style={{ minWidth: '200px' }}>
                <strong>🌉 {bridge.name || `Bridge ${idx + 1}`}</strong>
                <div style={{ marginTop: '8px', fontSize: '13px' }}>
                  <div style={{ color: '#f97316', fontWeight: '600' }}>
                    ⚠️ At Risk
                  </div>
                  <div>Risk Score: {(bridge.riskScore * 100).toFixed(0)}%</div>
                  <div>Distance to disaster: {bridge.distanceToDisaster.toFixed(1)} km</div>
                  {bridge.disaster && (
                    <div style={{ marginTop: '8px', color: '#6b7280' }}>
                      Threatened by: {bridge.disaster.title || bridge.disaster.eventType}
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};

// Fuel Station Markers Component
const FuelStationMarkers = ({ operational, atRisk }) => {
  const operationalIcon = L.divIcon({
    html: `<div style="
      background: #22c55e;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
    ">⛽</div>`,
    className: 'logistics-fuel-operational',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
  });

  const atRiskIcon = L.divIcon({
    html: `<div style="
      background: #eab308;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
    ">⛽</div>`,
    className: 'logistics-fuel-atrisk',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
  });

  return (
    <>
      {/* Operational Fuel Stations */}
      {operational && operational.map((station, idx) => {
        if (!station.coordinates) return null;
        const position = [station.coordinates.latitude, station.coordinates.longitude];

        return (
          <Marker
            key={`fuel-op-${idx}`}
            position={position}
            icon={operationalIcon}
          >
            <Popup>
              <div style={{ minWidth: '180px' }}>
                <strong>⛽ {station.name || `Fuel Station ${idx + 1}`}</strong>
                <div style={{ marginTop: '8px', fontSize: '13px' }}>
                  <div style={{ color: '#22c55e', fontWeight: '600' }}>
                    ✓ Operational
                  </div>
                  <div>Distance to disaster: {station.distanceToDisaster.toFixed(1)} km</div>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* At-Risk Fuel Stations */}
      {atRisk && atRisk.map((station, idx) => {
        if (!station.coordinates) return null;
        const position = [station.coordinates.latitude, station.coordinates.longitude];

        return (
          <Marker
            key={`fuel-risk-${idx}`}
            position={position}
            icon={atRiskIcon}
          >
            <Popup>
              <div style={{ minWidth: '180px' }}>
                <strong>⛽ {station.name || `Fuel Station ${idx + 1}`}</strong>
                <div style={{ marginTop: '8px', fontSize: '13px' }}>
                  <div style={{ color: '#eab308', fontWeight: '600' }}>
                    ⚠️ At Risk
                  </div>
                  <div>Impact Risk: {(station.impactProbability * 100).toFixed(0)}%</div>
                  <div>Distance to disaster: {station.distanceToDisaster.toFixed(1)} km</div>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};

// Airport Markers Component
const AirportMarkers = ({ operational, atRisk }) => {
  const operationalIcon = L.divIcon({
    html: `<div style="
      background: #3b82f6;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    ">✈️</div>`,
    className: 'logistics-airport-operational',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13]
  });

  const atRiskIcon = L.divIcon({
    html: `<div style="
      background: #f97316;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    ">✈️</div>`,
    className: 'logistics-airport-atrisk',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13]
  });

  return (
    <>
      {/* Operational Airports */}
      {operational && operational.map((airport, idx) => {
        if (!airport.coordinates) return null;
        const position = [airport.coordinates.latitude, airport.coordinates.longitude];

        return (
          <Marker
            key={`airport-op-${idx}`}
            position={position}
            icon={operationalIcon}
          >
            <Popup>
              <div style={{ minWidth: '200px' }}>
                <strong>✈️ {airport.name || `Airport ${idx + 1}`}</strong>
                <div style={{ marginTop: '8px', fontSize: '13px' }}>
                  <div style={{ color: '#3b82f6', fontWeight: '600' }}>
                    ✓ Operational
                  </div>
                  <div>Type: {airport.type || 'airport'}</div>
                  <div>Distance to disaster: {airport.distanceToDisaster.toFixed(1)} km</div>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* At-Risk Airports */}
      {atRisk && atRisk.map((airport, idx) => {
        if (!airport.coordinates) return null;
        const position = [airport.coordinates.latitude, airport.coordinates.longitude];

        return (
          <Marker
            key={`airport-risk-${idx}`}
            position={position}
            icon={atRiskIcon}
          >
            <Popup>
              <div style={{ minWidth: '200px' }}>
                <strong>✈️ {airport.name || `Airport ${idx + 1}`}</strong>
                <div style={{ marginTop: '8px', fontSize: '13px' }}>
                  <div style={{ color: '#f97316', fontWeight: '600' }}>
                    ⚠️ At Risk
                  </div>
                  <div>Type: {airport.type || 'airport'}</div>
                  <div>Impact Risk: {(airport.impactProbability * 100).toFixed(0)}%</div>
                  <div>Distance to disaster: {airport.distanceToDisaster.toFixed(1)} km</div>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};

export default LogisticsOverlaysLayer;

from http.server import BaseHTTPRequestHandler
import json
import os
from geopy.distance import geodesic
import pandas as pd
from io import StringIO

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Get content length
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            # Parse the JSON data
            data = json.loads(post_data)
            facilities_csv = data.get('facilities', '')
            disasters = data.get('disasters', [])
            
            # Process the CSV data
            facilities = []
            if facilities_csv:
                csv_io = StringIO(facilities_csv)
                df = pd.read_csv(csv_io)
                
                for _, row in df.iterrows():
                    facilities.append({
                        'name': row['name'],
                        'latitude': row['latitude'],
                        'longitude': row['longitude']
                    })
            
            # Assess impact
            impacted_facilities = assess_impact(facilities, disasters)
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'impactedFacilities': impacted_facilities
            }).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'error': str(e)
            }).encode())
            
        return

def assess_impact(facilities, disasters):
    """
    Assess which facilities are impacted by disasters
    
    Based on disaster type, we use different impact radius:
    - Earthquake: depends on magnitude (larger = bigger radius)
    - Tropical Cyclone: large radius (300km)
    - Flood: medium radius (100km)
    - Volcanic Activity: medium radius (100km)
    - Drought: large radius (regional/no distance check)
    """
    impacted = []
    
    for facility in facilities:
        facility_location = (facility['latitude'], facility['longitude'])
        facility_impacts = []
        
        for disaster in disasters:
            if not disaster['latitude'] or not disaster['longitude']:
                continue
                
            disaster_location = (disaster['latitude'], disaster['longitude'])
            distance = geodesic(facility_location, disaster_location).kilometers
            
            # Determine impact radius based on disaster type
            impact_radius = 0
            
            if disaster['eventType'].lower() == 'eq':  # Earthquake
                # Extract magnitude from title or description
                magnitude = 6.0  # Default magnitude if not found
                title = disaster['title'].lower()
                if 'm=' in title:
                    try:
                        magnitude = float(title.split('m=')[1].split(',')[0])
                    except:
                        pass
                
                # Adjust radius based on magnitude (approximation)
                impact_radius = magnitude * 50  # km
                
            elif disaster['eventType'].lower() == 'tc':  # Tropical Cyclone
                impact_radius = 300  # km
                
            elif disaster['eventType'].lower() == 'fl':  # Flood
                impact_radius = 100  # km
                
            elif disaster['eventType'].lower() == 'vo':  # Volcanic activity
                impact_radius = 100  # km
                
            elif disaster['eventType'].lower() == 'dr':  # Drought
                impact_radius = 500  # km (drought usually affects large areas)
            
            # Check if facility is within impact radius
            if distance <= impact_radius:
                facility_impacts.append({
                    'disaster': disaster,
                    'distance': round(distance, 2)
                })
        
        # If facility has impacts, add to the impacted list
        if facility_impacts:
            impacted.append({
                'facility': facility,
                'impacts': facility_impacts
            })
    
    return impacted
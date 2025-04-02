from http.server import BaseHTTPRequestHandler
import requests
import xml.etree.ElementTree as ET
import json
from datetime import datetime

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
        # Get disaster data from GDACS CAP feed
        disasters = fetch_gdacs_cap_data()
        
        # Send the JSON response
        self.wfile.write(json.dumps(disasters).encode())
        return

def fetch_gdacs_cap_data():
    """Fetch and parse GDACS CAP feed data"""
    
    # GDACS CAP feed URL
    gdacs_url = 'https://www.gdacs.org/xml/gdacs_cap.xml'
    
    try:
        response = requests.get(gdacs_url)
        response.raise_for_status()
        
        # Parse XML
        root = ET.fromstring(response.text)
        
        # Initialize disasters list
        disasters = []
        
        # Namespaces in the CAP feed
        namespaces = {
            'cap': 'urn:oasis:names:tc:emergency:cap:1.2',
            'geo': 'http://www.w3.org/2003/01/geo/wgs84_pos#',
            'gdacs': 'http://www.gdacs.org'
        }
        
        # Extract items from the feed
        for item in root.findall('.//item'):
            title = item.find('title').text if item.find('title') is not None else ''
            description = item.find('description').text if item.find('description') is not None else ''
            pub_date = item.find('pubDate').text if item.find('pubDate') is not None else ''
            link = item.find('link').text if item.find('link') is not None else ''
            guid = item.find('guid').text if item.find('guid') is not None else ''
            
            # Extract geo information
            geo_point = item.find('.//geo:Point', namespaces)
            lat = geo_point.find('./geo:lat', namespaces) if geo_point is not None else None
            lon = geo_point.find('./geo:long', namespaces) if geo_point is not None else None
            
            # Extract CAP information
            cap_alert = item.find('.//cap:alert', namespaces)
            cap_info = cap_alert.find('.//cap:info', namespaces) if cap_alert is not None else None
            
            if cap_info is not None:
                event = cap_info.find('.//cap:event', namespaces)
                severity = cap_info.find('.//cap:severity', namespaces)
                certainty = cap_info.find('.//cap:certainty', namespaces)
                urgency = cap_info.find('.//cap:urgency', namespaces)
                headline = cap_info.find('.//cap:headline', namespaces)
                
                # Extract polygon data if available
                cap_area = cap_info.find('.//cap:area', namespaces)
                polygon = cap_area.find('.//cap:polygon', namespaces) if cap_area is not None else None
                polygon_coordinates = []
                
                if polygon is not None and polygon.text:
                    # Parse polygon coordinates (format: "lat1,lon1 lat2,lon2 ...")
                    points = polygon.text.strip().split(' ')
                    for point in points:
                        coords = point.split(',')
                        if len(coords) == 2:
                            try:
                                lat_coord = float(coords[0])
                                lon_coord = float(coords[1])
                                polygon_coordinates.append([lat_coord, lon_coord])
                            except ValueError:
                                continue
                
                # Extract parameters
                parameters = {}
                for param in cap_info.findall('.//cap:parameter', namespaces):
                    name = param.find('.//cap:valueName', namespaces)
                    value = param.find('.//cap:value', namespaces)
                    if name is not None and value is not None and name.text and value.text:
                        parameters[name.text] = value.text
                
                # Create disaster object
                disaster = {
                    'title': title,
                    'description': description,
                    'pubDate': pub_date,
                    'link': link,
                    'guid': guid,
                    'latitude': float(lat.text) if lat is not None and lat.text else None,
                    'longitude': float(lon.text) if lon is not None and lon.text else None,
                    'eventType': event.text if event is not None else '',
                    'severity': severity.text if severity is not None else '',
                    'certainty': certainty.text if certainty is not None else '',
                    'urgency': urgency.text if urgency is not None else '',
                    'headline': headline.text if headline.text is not None else '',
                    'polygon': polygon_coordinates,
                    'parameters': parameters
                }
                
                disasters.append(disaster)
        
        return disasters
    
    except Exception as e:
        print(f"Error fetching GDACS CAP data: {e}")
        return []
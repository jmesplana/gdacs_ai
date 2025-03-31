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
        
        # Get disaster data from GDACS RSS feed
        disasters = fetch_gdacs_data()
        
        # Send the JSON response
        self.wfile.write(json.dumps(disasters).encode())
        return

def fetch_gdacs_data():
    """Fetch and parse GDACS RSS feed data"""
    
    # GDACS RSS feed URL
    gdacs_url = 'https://www.gdacs.org/xml/rss.xml'
    
    try:
        response = requests.get(gdacs_url)
        response.raise_for_status()
        
        # Parse XML
        root = ET.fromstring(response.text)
        
        # Initialize disasters list
        disasters = []
        
        # Namespaces in the RSS feed
        namespaces = {
            'gdacs': 'http://www.gdacs.org',
            'geo': 'http://www.w3.org/2003/01/geo/wgs84_pos#'
        }
        
        # Extract items from the feed
        for item in root.findall('.//item'):
            title = item.find('title').text if item.find('title') is not None else ''
            description = item.find('description').text if item.find('description') is not None else ''
            pub_date = item.find('pubDate').text if item.find('pubDate') is not None else ''
            link = item.find('link').text if item.find('link') is not None else ''
            
            # Extract geo information
            lat = item.find('.//geo:lat', namespaces)
            lon = item.find('.//geo:long', namespaces)
            
            # Extract severity and other GDACS-specific information
            alert_level = item.find('.//gdacs:alertlevel', namespaces)
            event_type = item.find('.//gdacs:eventtype', namespaces)
            event_name = item.find('.//gdacs:eventname', namespaces)
            
            # Create disaster object
            disaster = {
                'title': title,
                'description': description,
                'pubDate': pub_date,
                'link': link,
                'latitude': float(lat.text) if lat is not None and lat.text else None,
                'longitude': float(lon.text) if lon is not None and lon.text else None,
                'alertLevel': alert_level.text if alert_level is not None else '',
                'eventType': event_type.text if event_type is not None else '',
                'eventName': event_name.text if event_name is not None else ''
            }
            
            disasters.append(disaster)
        
        return disasters
    
    except Exception as e:
        print(f"Error fetching GDACS data: {e}")
        return []
from http.server import BaseHTTPRequestHandler
import json
import os
import openai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set up OpenAI API key
openai.api_key = os.getenv("OPENAI_API_KEY")

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Get content length
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            # Parse the JSON data
            data = json.loads(post_data)
            impacted_facilities = data.get('impactedFacilities', [])
            disasters = data.get('disasters', [])
            
            if not impacted_facilities and not disasters:
                raise ValueError("Missing impacted facilities or disasters data")
            
            # Generate situation report
            sitrep = generate_sitrep(impacted_facilities, disasters)
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'sitrep': sitrep
            }).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'error': str(e)
            }).encode())
            
        return

def generate_sitrep(impacted_facilities, disasters):
    """Generate situation report for all impacted facilities"""
    
    try:
        # Create a comprehensive overview of the situation
        situation_overview = create_situation_overview(impacted_facilities, disasters)
        
        # Create prompt for GPT
        prompt = f"""
You are a disaster management professional tasked with creating a concise Situation Report (SitRep).
Based on the information below, create a formal SitRep that would be suitable for sharing with 
organizational leadership, emergency response teams, and other stakeholders.

SITUATION OVERVIEW:
{situation_overview}

Your SitRep should include:
1. Executive Summary (2-3 sentences overview)
2. Current Situation (Brief description of active disasters)
3. Impacts on Facilities (Summary of affected facilities)
4. Recommended Actions (Prioritized by urgency)
5. Resource Requirements (If applicable)
6. Next Steps

Format your response in markdown for readability. Keep the entire SitRep concise and actionable.
"""

        # Call OpenAI API
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a disaster management professional creating a formal Situation Report."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1500
        )
        
        # Extract the response
        sitrep_text = response.choices[0].message.content.strip()
        
        return sitrep_text
    
    except Exception as e:
        print(f"Error generating SitRep: {e}")
        return f"Error generating Situation Report: {str(e)}"

def create_situation_overview(impacted_facilities, disasters):
    """Create a comprehensive situation overview for the AI prompt"""
    
    overview = f"ACTIVE DISASTERS ({len(disasters)}):\n"
    
    # Group disasters by type
    disaster_types = {}
    for disaster in disasters:
        disaster_type = disaster.get('eventType', 'unknown').lower()
        
        # Map disaster type codes to human-readable names
        disaster_type_names = {
            'eq': 'Earthquake',
            'tc': 'Tropical Cyclone',
            'fl': 'Flood',
            'vo': 'Volcanic Activity',
            'dr': 'Drought'
        }
        
        disaster_type_name = disaster_type_names.get(disaster_type, disaster_type)
        
        if disaster_type_name not in disaster_types:
            disaster_types[disaster_type_name] = []
        
        disaster_types[disaster_type_name].append(disaster)
    
    # Add disaster summaries by type
    for disaster_type, type_disasters in disaster_types.items():
        overview += f"\n{disaster_type} Events ({len(type_disasters)}):\n"
        
        for disaster in type_disasters:
            title = disaster.get('title', 'Unnamed disaster')
            alert_level = disaster.get('alertLevel', 'unknown')
            overview += f"- {title} (Alert Level: {alert_level})\n"
    
    # Add impacted facilities summary
    overview += f"\nIMPACTED FACILITIES ({len(impacted_facilities)}):\n"
    
    for impact in impacted_facilities:
        facility = impact.get('facility', {})
        facility_impacts = impact.get('impacts', [])
        
        facility_name = facility.get('name', 'Unnamed facility')
        overview += f"\n{facility_name}:\n"
        
        for disaster_impact in facility_impacts:
            disaster = disaster_impact.get('disaster', {})
            distance = disaster_impact.get('distance', 'unknown')
            
            disaster_title = disaster.get('title', 'Unnamed disaster')
            overview += f"- Impacted by {disaster_title} ({distance} km away)\n"
    
    return overview
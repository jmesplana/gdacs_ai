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
            facility = data.get('facility', {})
            impacts = data.get('impacts', [])
            
            if not facility or not impacts:
                raise ValueError("Missing facility or impacts data")
            
            # Generate recommendations
            recommendations = generate_recommendations(facility, impacts)
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'recommendations': recommendations
            }).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'error': str(e)
            }).encode())
            
        return

def generate_recommendations(facility, impacts):
    """Generate AI-powered recommendations for impacted facility"""
    try:
        # Prepare prompts for OpenAI
        situation_summary = create_situation_summary(facility, impacts)
        
        # Create prompt for GPT
        prompt = f"""
You are a disaster response and humanitarian aid expert tasked with providing practical recommendations 
for a facility potentially impacted by natural disasters. Based on the information below, provide 
specific, actionable recommendations organized by category.

SITUATION SUMMARY:
{situation_summary}

Please provide recommendations in the following categories:
1. Immediate Safety Measures
2. Resource Mobilization
3. Evacuation Considerations (if needed)
4. Communication Protocols
5. Medium-term Mitigation Strategies

Format your response as a structured JSON with these categories as keys and bullet point arrays as values.
Keep recommendations concise, practical, and specific to the facility and disaster type(s).
Do not use curly braces, brackets, or other JSON formatting symbols within the text content itself - provide clean, readable text for each recommendation.
"""

        # Call OpenAI API
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a disaster response and humanitarian aid expert providing actionable recommendations. Avoid using JSON symbols like {}, [], or quotes within your text content. Provide clean, readable text for humans."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            max_tokens=1000
        )
        
        # Extract the response
        recommendation_text = response.choices[0].message.content.strip()
        
        # Try to parse the JSON response
        try:
            # First try to parse directly
            recommendations = json.loads(recommendation_text)
        except json.JSONDecodeError:
            # If that fails, try to extract JSON portion from text
            try:
                start_idx = recommendation_text.find('{')
                end_idx = recommendation_text.rfind('}') + 1
                if start_idx >= 0 and end_idx > start_idx:
                    json_str = recommendation_text[start_idx:end_idx]
                    recommendations = json.loads(json_str)
                else:
                    # If JSON extraction fails, create structured format manually
                    recommendations = {
                        "Immediate Safety Measures": [recommendation_text],
                        "Resource Mobilization": [],
                        "Evacuation Considerations": [],
                        "Communication Protocols": [],
                        "Medium-term Mitigation Strategies": []
                    }
            except:
                # Last resort fallback
                recommendations = {
                    "Immediate Safety Measures": [recommendation_text],
                    "Resource Mobilization": [],
                    "Evacuation Considerations": [],
                    "Communication Protocols": [],
                    "Medium-term Mitigation Strategies": []
                }
        
        return recommendations
    
    except Exception as e:
        print(f"Error generating recommendations: {e}")
        return {
            "error": str(e),
            "Immediate Safety Measures": ["Unable to generate recommendations. Please ensure OpenAI API key is configured correctly."],
            "Resource Mobilization": [],
            "Evacuation Considerations": [],
            "Communication Protocols": [],
            "Medium-term Mitigation Strategies": []
        }

def create_situation_summary(facility, impacts):
    """Create a situation summary for the AI prompt"""
    
    facility_name = facility.get('name', 'Unnamed facility')
    facility_location = f"{facility.get('latitude', 'unknown')}, {facility.get('longitude', 'unknown')}"
    
    summary = f"Facility '{facility_name}' at coordinates {facility_location} is potentially impacted by the following disasters:\n\n"
    
    for impact in impacts:
        disaster = impact.get('disaster', {})
        distance = impact.get('distance', 'unknown')
        
        disaster_type = disaster.get('eventType', 'unknown')
        disaster_name = disaster.get('eventName', disaster.get('title', 'Unnamed disaster'))
        alert_level = disaster.get('alertLevel', 'unknown')
        
        # Map disaster type codes to human-readable names
        disaster_type_names = {
            'eq': 'Earthquake',
            'tc': 'Tropical Cyclone',
            'fl': 'Flood',
            'vo': 'Volcanic Activity',
            'dr': 'Drought'
        }
        
        disaster_type_name = disaster_type_names.get(disaster_type.lower(), disaster_type)
        
        summary += f"- {disaster_type_name}: {disaster_name}, Alert Level: {alert_level}\n"
        summary += f"  Distance: {distance} km from facility\n"
        summary += f"  Details: {disaster.get('description', 'No details available')}\n\n"
    
    return summary
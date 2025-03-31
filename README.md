# AI Disaster Impact and Response Tool

This application helps humanitarian and disaster response professionals rapidly identify and respond to imminent risks using live GDACS RSS disaster data.

## Features

- **Real-Time Disaster Monitoring**: Automatically fetches and visualizes current global disaster events from GDACS RSS feeds.
- **Facility Impact Assessment**: Upload your organization's facilities via a simple CSV file for automated impact assessment.
- **AI-Powered Response Guidance**: Get actionable recommendations for impacted facilities using OpenAI's GPT model.
- **Automated Situation Reports**: Generate concise, structured situational reports for easy sharing with stakeholders.

## Setup

### Prerequisites

- Node.js (v14 or newer)
- npm or yarn
- An OpenAI API key

### Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/gdacs-facilities-ai.git
   cd gdacs-facilities-ai
   ```

2. Install dependencies:
   ```
   npm install
   # or
   yarn install
   ```

3. Create a `.env.local` file in the root directory with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. Start the development server:
   ```
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment to Vercel

1. Create a Vercel account if you don't have one.
2. Install the Vercel CLI:
   ```
   npm install -g vercel
   ```

3. Deploy to Vercel:
   ```
   vercel
   ```

4. Add your OpenAI API key to the Vercel environment variables.

## Usage

### Step 1: Check Disaster Status
Open the application to view an interactive map with current GDACS disaster data.

### Step 2: Upload Facilities
Prepare your facility data as a CSV with headers: `name, latitude, longitude`.
Use the upload option to load this data into the tool.

### Step 3: Impact Analysis
The application will automatically analyze facility locations against disaster data.
Impacted facilities will be visually flagged on the map.

### Step 4: Receive AI Recommendations
Click on impacted facilities to generate immediate AI-driven summaries and recommended actions.

### Step 5: Generate SitRep
Choose the 'Generate SitRep' option to create and export structured situational reports.

## Data Sources

- [GDACS RSS Feed](https://www.gdacs.org/xml/rss.xml): Global Disaster Alert and Coordination System provides disaster data.

## Technology Stack

- Next.js (React framework)
- Vercel Python API routes
- Leaflet (Interactive maps)
- OpenAI API (AI recommendations)
- GDACS RSS feed (Disaster data)

## License

MIT
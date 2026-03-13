// Debug API endpoint — development only
export default async function handler(req, res) {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ error: 'Not found' });
  }

  // Return system information and mock data for testing
  const mockDisaster = {
    title: "EQ 6.2 M, Indonesia (Indonesia) 2024-03-30 UTC",
    description: "Earthquake of magnitude 6.2M in Indonesia. The earthquake occurred at a depth of 10km.",
    pubDate: "Sat, 30 Mar 2024 10:15:00 UTC",
    link: "https://gdacs.org/report.aspx?eventid=1345678",
    latitude: -0.7893,
    longitude: 131.2461,
    alertLevel: "Orange",
    eventType: "EQ",
    eventName: "Earthquake Indonesia"
  };
  
  res.status(200).json({
    message: "Debug info",
    timestamp: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
    },
    mockDisaster: mockDisaster
  });
}
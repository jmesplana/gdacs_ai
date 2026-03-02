// Simple test endpoint to check if streaming works
export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req, res) {
  console.log('🧪 Test endpoint hit!');

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send immediate response
  res.write(`data: ${JSON.stringify({ content: 'Hello from test!' })}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();

  console.log('✅ Test response sent');
}

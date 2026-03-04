# Web Search Integration for AI Chat

## Overview

The AI chat assistant now has **real-time web search capability** to access current information, recent events, and up-to-date data beyond its training cutoff date.

## How It Works

### Technical Implementation

1. **OpenAI Function Calling**: The system uses OpenAI's function calling feature to enable the AI to decide when web search is needed
2. **DuckDuckGo HTML Search**: Uses DuckDuckGo's HTML interface (no API key required) to perform web searches
3. **Automatic Integration**: The AI automatically searches the web when it detects questions about:
   - Recent events or current statistics
   - Ongoing disasters or humanitarian situations
   - Recent disease outbreaks or conflict events
   - Current best practices or updated guidelines
   - Any information that may have changed since January 2025

### User Experience

When the AI determines it needs current information, it will:
1. Automatically trigger a web search with relevant keywords
2. Display a search indicator: `🔍 Searching the web for: "query"...`
3. Process the search results
4. Incorporate the findings into its response

### Code Location

**File**: `/pages/api/chat.js`

**Key Functions**:
- `performWebSearch(query)` - Executes web searches using DuckDuckGo
- `webSearchTool` - OpenAI function definition for web search
- Streaming and non-streaming handlers with function calling support

## Examples of Use Cases

### 1. Recent Disease Outbreak Information
```
User: "What's the latest on cholera outbreaks in Central African Republic?"
AI: 🔍 Searching the web for: "cholera outbreak Central African Republic 2026"
    [AI processes results and provides current information]
```

### 2. Current WHO Guidelines
```
User: "What are the latest WHO recommendations for flood response?"
AI: 🔍 Searching the web for: "WHO flood response guidelines 2026"
    [AI provides up-to-date guidance]
```

### 3. Ongoing Conflict Events
```
User: "Are there any recent security incidents in this region?"
AI: 🔍 Searching the web for: "security incidents [region] recent"
    [AI provides current security information]
```

### 4. Weather and Climate Data
```
User: "What's the current cyclone forecast for the Indian Ocean?"
AI: 🔍 Searching the web for: "Indian Ocean cyclone forecast 2026"
    [AI provides current meteorological information]
```

## Technical Details

### Search Implementation

```javascript
async function performWebSearch(query) {
  // Uses DuckDuckGo HTML search (no API key needed)
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  // Parses HTML results using regex
  // Returns top 5 results with titles, URLs, and snippets
  // Formatted for AI consumption
}
```

### Function Definition

```javascript
const webSearchTool = {
  type: "function",
  function: {
    name: "search_web",
    description: "Search the web for current information, recent events, statistics...",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query. Be specific and include relevant keywords."
        }
      },
      required: ["query"]
    }
  }
};
```

### Streaming Support

Both streaming and non-streaming modes support function calling:
- **Streaming**: Handles tool calls mid-stream, executes search, continues streaming with results
- **Non-streaming**: Detects tool calls, executes search, makes follow-up API call with results

## Benefits

1. **No API Keys Required**: Uses DuckDuckGo HTML search (free, no rate limits for reasonable use)
2. **Automatic Decision Making**: AI decides when web search is needed
3. **Seamless Integration**: Works with existing chat interface
4. **Real-Time Information**: Access to current events and recent data
5. **Transparent to User**: Shows when searches are being performed

## Limitations

1. **Search Quality**: DuckDuckGo results may not be as comprehensive as Google
2. **HTML Parsing**: Relies on regex parsing which may break if DDG changes their HTML structure
3. **No Content Fetching**: Only retrieves search result snippets, not full page content
4. **Rate Limiting**: Heavy usage may be rate-limited by DuckDuckGo

## Future Enhancements

### Option 1: Brave Search API (Recommended for Production)
```javascript
// More reliable, structured API responses
// Free tier: 2,000 queries/month
const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;
const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${query}`;
```

### Option 2: Content Fetching
```javascript
// Fetch and parse full content from top results
// Provides more detailed information for AI analysis
async function fetchPageContent(url) {
  const response = await fetch(url);
  const html = await response.text();
  // Convert HTML to markdown for AI consumption
  return convertHtmlToMarkdown(html);
}
```

### Option 3: Specialized Search
```javascript
// Add domain-specific searches
// - WHO website only
// - ReliefWeb humanitarian news
// - ACLED conflict data
// - Weather services
```

## Configuration

### Environment Variables (Optional)

To use Brave Search API (recommended for production):
```bash
# .env.local
BRAVE_SEARCH_API_KEY=your_api_key_here
```

### Adjusting Search Behavior

In `/pages/api/chat.js`, you can modify:
- Number of results returned (currently 5)
- Search timeout duration
- User agent string
- Result formatting

## Testing

### Test Web Search Functionality

1. Open the app and start AI chat
2. Ask: "What are the latest WHO guidelines for malaria control in 2026?"
3. Observe the search indicator and AI response
4. Check server logs for search execution

### Server Logs

```bash
npm run dev

# Look for:
# 🔍 Performing web search for: "WHO malaria guidelines 2026"
# ✅ Found 5 web results
# 🔧 AI requested tool calls: [...]
# ✅ Web search completed
```

## Troubleshooting

### Issue: Search Not Triggering

**Possible Causes**:
- AI doesn't detect need for current information
- Try explicit phrases: "latest", "recent", "current", "2026"

**Solution**: Rephrase question to emphasize need for recent data

### Issue: Search Fails

**Error**: "Web search failed: 403"

**Cause**: DuckDuckGo blocking requests (rate limit or bot detection)

**Solutions**:
1. Add delay between requests
2. Switch to Brave Search API
3. Use proxy or rotate user agents

### Issue: No Results Found

**Error**: "No web results found for this query"

**Cause**:
- Query too specific
- Regex not matching DDG's HTML structure

**Solutions**:
1. Check DDG search manually in browser
2. Update regex patterns if HTML changed
3. Fall back to alternative search provider

## Cost Analysis

| Component | Free Tier | Estimated Usage | Cost |
|-----------|-----------|----------------|------|
| **DuckDuckGo HTML** | Unlimited* | ~10-50 searches/day | **$0/month** |
| **Brave Search API** | 2,000/month | ~10-50 searches/day | **$0/month** |
| **OpenAI Function Calls** | Included in API usage | 2-3 calls per search | **~$0.01 per search** |

*Reasonable use assumed; heavy usage may be rate-limited

**Total estimated cost**: ~$0-10/month depending on search frequency

## Credits

- Web search integration: DuckDuckGo
- Function calling: OpenAI GPT-4
- Implementation: John Mark Esplana's GDACS Facilities AI Platform

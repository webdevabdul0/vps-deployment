/**
 * AI Agent Tools - Web Browsing and API Integration
 * Defines all tools available to the AI agent
 */

const Firecrawl = require('@mendable/firecrawl-js').default;

// Initialize Firecrawl
const firecrawl = new Firecrawl({ 
  apiKey: process.env.FIRECRAWL_API_KEY
});

/**
 * Tool Definitions for OpenAI Function Calling
 */
const tools = [
  {
    type: "function",
    function: {
      name: "browse_website",
      description: "Browses a specific webpage and extracts its content. Use this to get real-time information from any page on the practice website. Returns clean, readable content.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The full URL to browse (e.g., https://example.com/services)"
          },
          focus: {
            type: "string",
            description: "Optional: What specific information to focus on (e.g., 'pricing', 'hours', 'contact info')"
          }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_practice_website",
      description: "Searches the entire practice website for specific information. Use this when you need to find information but don't know which page it's on. Examples: 'teeth whitening prices', 'emergency services', 'payment options'",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "What to search for (e.g., 'invisalign cost', 'office hours', 'insurance accepted')"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description: "Books an appointment for a patient. Only call this when you have collected ALL required information: name, email, phone, date, time, and treatment type.",
      parameters: {
        type: "object",
        properties: {
          patientName: {
            type: "string",
            description: "Full name of the patient"
          },
          email: {
            type: "string",
            description: "Email address"
          },
          phone: {
            type: "string",
            description: "Phone number"
          },
          date: {
            type: "string",
            description: "Appointment date in YYYY-MM-DD format"
          },
          time: {
            type: "string",
            description: "Appointment time in HH:MM format (e.g., 14:00)"
          },
          treatmentType: {
            type: "string",
            description: "Type of treatment or service (e.g., 'Cleaning', 'Consultation', 'Emergency')"
          },
          notes: {
            type: "string",
            description: "Optional: Any additional notes or requirements"
          }
        },
        required: ["patientName", "email", "phone", "date", "time", "treatmentType"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_lead",
      description: "Creates a lead for a patient who is enquiring about treatments but not ready to book yet. Use this for treatment enquiries, quote requests, or general interest.",
      parameters: {
        type: "object",
        properties: {
          patientName: {
            type: "string",
            description: "Full name of the patient"
          },
          email: {
            type: "string",
            description: "Email address"
          },
          phone: {
            type: "string",
            description: "Phone number (optional but preferred)"
          },
          treatment: {
            type: "string",
            description: "Treatment they're interested in"
          },
          notes: {
            type: "string",
            description: "Any additional information or questions they have"
          }
        },
        required: ["patientName", "email", "treatment"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "schedule_callback",
      description: "Schedules a callback request. Use this when someone wants the practice to call them back.",
      parameters: {
        type: "object",
        properties: {
          patientName: {
            type: "string",
            description: "Full name of the patient"
          },
          phone: {
            type: "string",
            description: "Phone number to call"
          },
          email: {
            type: "string",
            description: "Email address (optional)"
          },
          reason: {
            type: "string",
            description: "Reason for callback (e.g., 'Question about treatment', 'Pricing enquiry')"
          },
          preferredTime: {
            type: "string",
            description: "When they prefer to be called (e.g., 'Morning', 'After 3pm', 'Anytime')"
          }
        },
        required: ["patientName", "phone", "reason"]
      }
    }
  }
];

/**
 * Browse a specific webpage using Firecrawl
 */
async function browseWebsite(url, focus = null) {
  try {
    console.log(`[AI Agent] Browsing website: ${url}`);
    
    const result = await firecrawl.scrape(url, {
      formats: ['markdown', 'html'],
      onlyMainContent: true,
      timeout: 15000,
      waitFor: 2000 // Wait 2s for dynamic content
    });
    
    // Limit content to prevent token overflow (max ~2000 tokens)
    const content = result.markdown ? result.markdown.substring(0, 8000) : '';
    
    return {
      success: true,
      url,
      title: result.metadata?.title || 'No title',
      description: result.metadata?.description || '',
      content: content,
      focus: focus,
      message: `Successfully retrieved content from ${url}`
    };
    
  } catch (error) {
    console.error(`[AI Agent] Error browsing ${url}:`, error.message);
    return {
      success: false,
      url,
      error: error.message,
      message: `Failed to browse ${url}. The page might be unreachable or protected.`
    };
  }
}

/**
 * Search the entire practice website for specific information
 */
async function searchPracticeWebsite(practiceUrl, query) {
  try {
    console.log(`[AI Agent] Searching website ${practiceUrl} for: ${query}`);
    
    // Common pages to check for dental practices
    const commonPages = [
      practiceUrl,
      `${practiceUrl}/services`,
      `${practiceUrl}/treatments`,
      `${practiceUrl}/pricing`,
      `${practiceUrl}/prices`,
      `${practiceUrl}/about`,
      `${practiceUrl}/contact`,
      `${practiceUrl}/book`,
      `${practiceUrl}/faq`
    ];
    
    // Use Firecrawl's map feature to quickly get site structure
    let pagesToSearch = commonPages;
    
    try {
      const mapResult = await firecrawl.map(practiceUrl, {
        limit: 20
      });
      
      if (mapResult.links && mapResult.links.length > 0) {
        // Filter relevant links based on query
        const relevantLinks = mapResult.links.filter(link => {
          const linkLower = link.toLowerCase();
          const queryWords = query.toLowerCase().split(' ');
          return queryWords.some(word => linkLower.includes(word));
        });
        
        // Combine with common pages, remove duplicates
        pagesToSearch = [...new Set([...commonPages, ...relevantLinks.slice(0, 5)])];
      }
    } catch (mapError) {
      console.log('[AI Agent] Map failed, using common pages only');
    }
    
    // Search through pages
    const results = [];
    
    for (const pageUrl of pagesToSearch.slice(0, 5)) { // Limit to 5 pages
      try {
        const pageContent = await browseWebsite(pageUrl);
        
        if (pageContent.success && pageContent.content) {
          const relevance = calculateRelevance(pageContent.content, query);
          
          if (relevance > 0.2) { // 20% relevance threshold
            results.push({
              url: pageUrl,
              title: pageContent.title,
              snippet: extractRelevantSnippet(pageContent.content, query),
              relevance: relevance
            });
          }
        }
      } catch (error) {
        console.log(`[AI Agent] Skipping ${pageUrl}: ${error.message}`);
      }
    }
    
    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);
    
    if (results.length === 0) {
      return {
        success: false,
        query,
        practiceUrl,
        message: `No relevant information found for "${query}" on the website. The information might not be available or might use different terminology.`
      };
    }
    
    return {
      success: true,
      query,
      practiceUrl,
      results: results.slice(0, 3), // Top 3 results
      message: `Found ${results.length} relevant pages for "${query}"`
    };
    
  } catch (error) {
    console.error(`[AI Agent] Search error:`, error.message);
    return {
      success: false,
      query,
      practiceUrl,
      error: error.message,
      message: `Failed to search the website. Error: ${error.message}`
    };
  }
}

/**
 * Calculate relevance score between content and query
 */
function calculateRelevance(content, query) {
  if (!content || !query) return 0;
  
  const queryWords = query.toLowerCase().split(/\s+/);
  const contentLower = content.toLowerCase();
  
  let matches = 0;
  let totalScore = 0;
  
  for (const word of queryWords) {
    if (word.length < 3) continue; // Skip short words
    
    const count = (contentLower.match(new RegExp(word, 'g')) || []).length;
    if (count > 0) {
      matches++;
      totalScore += Math.min(count, 5); // Cap at 5 mentions per word
    }
  }
  
  return queryWords.length > 0 ? (totalScore / (queryWords.length * 5)) : 0;
}

/**
 * Extract relevant snippet from content based on query
 */
function extractRelevantSnippet(content, query, maxLength = 300) {
  if (!content || !query) return '';
  
  const queryWords = query.toLowerCase().split(/\s+/);
  const sentences = content.split(/[.!?]+/);
  
  let bestSentence = '';
  let maxScore = 0;
  
  for (const sentence of sentences) {
    if (sentence.length < 20) continue; // Skip very short sentences
    
    const sentenceLower = sentence.toLowerCase();
    let score = 0;
    
    for (const word of queryWords) {
      if (word.length >= 3 && sentenceLower.includes(word)) {
        score += 1;
      }
    }
    
    if (score > maxScore) {
      maxScore = score;
      bestSentence = sentence.trim();
    }
  }
  
  // If no good sentence found, return first part
  if (!bestSentence) {
    bestSentence = content.substring(0, maxLength);
  }
  
  // Trim to max length
  if (bestSentence.length > maxLength) {
    bestSentence = bestSentence.substring(0, maxLength) + '...';
  }
  
  return bestSentence;
}

module.exports = {
  tools,
  browseWebsite,
  searchPracticeWebsite
};

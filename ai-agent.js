/**
 * AI Agent - OpenAI GPT-4o-mini Integration
 * Main conversational AI agent with web browsing and API tool calling
 */

const OpenAI = require('openai');
const axios = require('axios');
const { tools, browseWebsite, searchPracticeWebsite } = require('./ai-tools');
const fs = require('fs').promises;
const path = require('path');

// Initialize OpenAI
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

// Internal API base URL (AI agent runs server-side; this should point to THIS server)
// Override via INTERNAL_API_BASE (recommended in production)
const INTERNAL_API_BASE = process.env.INTERNAL_API_BASE || `http://localhost:${process.env.PORT || 3001}`;

/**
 * Load bot configuration
 */
async function loadBotConfig(botId) {
  try {
    const dataPath = path.join(__dirname, 'flossy_data.json');
    const data = await fs.readFile(dataPath, 'utf8');
    const flossyData = JSON.parse(data);
    
    const botConfig = flossyData.bot_configs[botId];
    
    if (!botConfig) {
      throw new Error(`Bot configuration not found for botId: ${botId}`);
    }
    
    return botConfig;
  } catch (error) {
    console.error('[AI Agent] Error loading bot config:', error.message);
    throw error;
  }
}

/**
 * Build system prompt for the AI agent
 */
function buildSystemPrompt(botConfig) {
  const practiceName = botConfig.companyName || 'the practice';
  const website = botConfig.companyWebsite;
  const phone = botConfig.companyPhone || 'the office';
  const email = botConfig.companyOwnerEmail || '';
  
  // Build capabilities based on whether website is available
  let capabilities;
  
  if (website) {
    capabilities = `YOUR CAPABILITIES:
1. **Answer Questions**: When users ask about treatments, services, pricing, hours, or any practice-related information:
   - ALWAYS FIRST browse the homepage: ${website}
   - DO NOT try to guess or construct subpage URLs (like /services, /about, etc.)
   - The homepage contains comprehensive information about treatments and services
   - If the homepage has the info you need, use it directly - don't browse other pages
   - Only use "search_practice_website" if the homepage truly doesn't have the information
   - Never make up information - always verify from the website`;
  } else {
    capabilities = `YOUR CAPABILITIES:
1. **Answer Questions**: When users ask about treatments, services, pricing, hours, or any practice-related information:
   - NOTE: The website URL is not configured, so you cannot browse for information
   - Politely inform users that detailed information can be provided by calling the office
   - Offer to schedule a callback instead`;
  }
  
  return `You are a friendly and helpful dental assistant for ${practiceName}.

PRACTICE INFORMATION:
- Name: ${practiceName}
${website ? `- Website: ${website}` : '- Website: Not available'}
- Phone: ${phone}
${email ? `- Email: ${email}` : ''}

${capabilities}

2. **Book Appointments**: When someone wants to book an appointment:
   - Collect: name, email, phone, preferred date, preferred time, treatment type
   - Ask conversationally - don't use a form-like approach
   - Once you have ALL required info, use "book_appointment" tool
   - Confirm the booking details with the patient

3. **Create Leads**: For treatment enquiries or quote requests:
   - Collect: name, email, phone (optional), treatment interest
   - Use "create_lead" tool
   - Let them know someone will follow up

4. **Schedule Callbacks**: When someone wants to be called back:
   - Collect: name, phone, reason, preferred time
   - Use "schedule_callback" tool

CONVERSATION STYLE:
- Be warm, friendly, and professional
- Use natural language, not robotic phrases
- Ask follow-up questions to understand their needs
- Show empathy, especially for dental anxiety
- Keep responses concise but helpful
- If information isn't on the website, acknowledge that and offer to have someone call them

IMPORTANT RULES:
- ALWAYS browse the website before answering practice-specific questions
- Never make up prices, hours, or treatment information
- If you can't find information, say so and offer alternative help
- Don't book appointments without collecting ALL required fields
- Be patient and conversational when gathering information

Remember: You represent ${practiceName}. Be helpful, accurate, and professional at all times.`;
}

/**
 * Main chat function - handles conversation with AI agent
 */
async function chatWithAgent(botId, userMessage, conversationHistory = []) {
  try {
    // Load bot configuration
    const botConfig = await loadBotConfig(botId);
    
    // Build messages array
    const messages = [
      {
        role: "system",
        content: buildSystemPrompt(botConfig)
      },
      ...conversationHistory,
      {
        role: "user",
        content: userMessage
      }
    ];
    
    // Track tool execution for logging
    let toolExecutionCount = 0;
    const maxToolExecutions = 5; // Prevent infinite loops
    const toolDetails = []; // Store details of each tool execution
    
    // Initial API call
    let response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      tools: tools,
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 1000
    });
    
    let message = response.choices[0].message;
    
    // Handle tool calls (may require multiple rounds)
    while (message.tool_calls && message.tool_calls.length > 0 && toolExecutionCount < maxToolExecutions) {
      // Add assistant's message with tool calls to history
      messages.push({
        role: "assistant",
        content: message.content || null,
        tool_calls: message.tool_calls
      });
      
      // Execute each tool call
      for (const toolCall of message.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        let toolResult;
        const toolStartTime = Date.now();
        
        try {
          switch (functionName) {
            case 'browse_website':
              // Validate URL before calling Firecrawl
              if (!functionArgs.url || functionArgs.url === 'the website' || !functionArgs.url.startsWith('http')) {
                toolResult = {
                  success: false,
                  error: 'Website URL not configured for this practice',
                  message: 'The website URL is not available. Please contact the office directly for information.'
                };
              } else {
                toolResult = await browseWebsite(
                  functionArgs.url,
                  functionArgs.focus
                );
              }
              break;
            
            case 'search_practice_website':
              // Validate website exists
              if (!botConfig.companyWebsite || !botConfig.companyWebsite.startsWith('http')) {
                toolResult = {
                  success: false,
                  error: 'Website URL not configured for this practice',
                  message: 'The website URL is not available. Please contact the office directly for information.'
                };
              } else {
                toolResult = await searchPracticeWebsite(
                  botConfig.companyWebsite,
                  functionArgs.query
                );
              }
              break;
            
            case 'book_appointment':
              toolResult = await executeBookAppointment(botConfig, functionArgs);
              break;
            
            case 'create_lead':
              toolResult = await executeCreateLead(botConfig, functionArgs);
              break;
            
            case 'schedule_callback':
              toolResult = await executeScheduleCallback(botConfig, functionArgs);
              break;
            
            default:
              toolResult = {
                success: false,
                error: `Unknown tool: ${functionName}`
              };
          }
        } catch (error) {
          toolResult = {
            success: false,
            error: error.message
          };
        }
        
        const toolDuration = Date.now() - toolStartTime;
        
        // Store tool details for response
        toolDetails.push({
          name: functionName,
          arguments: functionArgs,
          result: toolResult,
          duration: toolDuration
        });
        
        // Add tool result to messages
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
        });
      }
      
      toolExecutionCount++;
      
      // Get next response from AI with tool results
      response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        tools: tools,
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 1000
      });
      
      message = response.choices[0].message;
    }
    
    // If a tool was called and it failed, do not allow a "success" tone without surfacing the failure.
    // This prevents the model from claiming an appointment/lead/callback was created when the API call failed.
    const failedTools = toolDetails.filter(t => t?.result?.success === false);
    const lastTool = toolDetails[toolDetails.length - 1];

    let finalContent = message.content;
    if (failedTools.length > 0) {
      // Prefer the tool's own user-facing message if provided
      const toolMsg = lastTool?.result?.message || failedTools[0]?.result?.message;
      finalContent = toolMsg || "I couldn't complete that request due to a technical issue. Please try again or contact the practice directly.";
    }

    // Build conversation history for next turn (keep last 10 messages)
    const updatedHistory = [
      ...conversationHistory,
      { role: "user", content: userMessage },
      { role: "assistant", content: finalContent }
    ].slice(-10); // Keep last 5 exchanges (10 messages)
    
    return {
      success: true,
      content: finalContent,
      conversationHistory: updatedHistory,
      toolsUsed: toolExecutionCount,
      toolDetails: toolDetails // Include detailed tool execution info
    };
    
  } catch (error) {
    console.error('[AI Agent] Error:', error);
    return {
      success: false,
      content: "I apologize, but I'm having trouble processing your request right now. Please try again or contact us directly.",
      error: error.message,
      conversationHistory: conversationHistory
    };
  }
}

/**
 * Execute appointment booking
 * Integrates with Flossly API and Google Calendar (via n8n)
 */
async function executeBookAppointment(botConfig, appointmentData) {
  try {
    console.log('[AI Agent] Booking appointment:', appointmentData);
    
    // Parse patient name into first and last name
    const patientName = appointmentData.patientName || '';
    const nameParts = patientName.trim().split(/\s+/);
    const firstName = nameParts[0] || '-';
    const lastName = nameParts.slice(1).join(' ') || '-';
    
    // Get user's timezone
    const userTimezone = 'UTC'; // Default, can be enhanced later
    
    // Prepare appointment data in Flossly API format
    const flosslyPayload = {
      type: 'appointment_booking',
      botId: botConfig.botId,
      patient: {
        firstName: firstName,
        lastName: lastName,
        email: appointmentData.email || '',
        mobile: appointmentData.phone || ''
      },
      appointment: {
        date: appointmentData.date, // YYYY-MM-DD format
        time: appointmentData.time, // HH:MM format
        duration: 30, // Default 30 minutes
        treatmentName: appointmentData.treatmentType || 'Consultation',
        notes: appointmentData.notes || 'Appointment booked via AI chatbot'
      },
      userTimezone: userTimezone,
      timestamp: new Date().toISOString()
    };
    
    // Send to n8n webhook for Google Calendar (non-blocking)
    const webhookUrl = `${INTERNAL_API_BASE}/webhook/appointment-booking`;
    axios.post(webhookUrl, flosslyPayload).catch(err => {
      console.error('[AI Agent] n8n webhook error:', err.message);
    });
    
    // Send to Flossly API endpoint
    const flosslyApiUrl = `${INTERNAL_API_BASE}/api/flossly/appointment`;
    const response = await axios.post(flosslyApiUrl, flosslyPayload, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: (status) => status < 500 // Don't throw on 4xx errors
    });
    
    const result = response.data;
    
    // Check for conflict (409 status or error message)
    const errorMessage = typeof result.error === 'string' ? result.error : 
                        (typeof result.message === 'string' ? result.message : '');
    const isConflict = response.status === 409 || 
                      (errorMessage && errorMessage.includes('already has an appointment'));
    
    // Flossly API returns code: 1 for success, code: 0 for error
    if (result.code === 1 || result.success === true || response.status === 200) {
      return {
        success: true,
        message: `Perfect! I've booked your appointment for ${appointmentData.date} at ${appointmentData.time}. You'll receive a confirmation email shortly.`,
        appointmentId: result.data?.appointmentId || 'APT-' + Date.now(),
        data: result.data
      };
    } else if (isConflict) {
      return {
        success: false,
        conflict: true,
        message: `I'm sorry, but that time slot (${appointmentData.time} on ${appointmentData.date}) is already booked. Would you like to try a different time?`,
        suggestions: result.suggestions || [],
        error: 'Time slot conflict'
      };
    } else {
      return {
        success: false,
        message: result.message || 'Sorry, there was an error booking your appointment. Please try again or contact us directly.',
        error: result.error || 'Booking failed'
      };
    }
    
  } catch (error) {
    console.error('[AI Agent] Appointment booking error:', error);
    return {
      success: false,
      error: error.message,
      message: 'I apologize, but I encountered a technical issue while booking your appointment. Please contact us directly to schedule.'
    };
  }
}

/**
 * Execute lead creation
 * Integrates with Flossly Lead API
 */
async function executeCreateLead(botConfig, leadData) {
  try {
    console.log('[AI Agent] Creating lead:', leadData);
    
    // Prepare lead data for Flossly Lead API
    const flosslyLeadPayload = {
      botId: botConfig.botId,
      botName: botConfig.name || 'AI Assistant',
      type: 'treatment_enquiry',
      customer: {
        email: leadData.email || '',
        name: leadData.patientName || '',
        phone: leadData.phone || ''
      },
      treatment: {
        name: leadData.treatment || 'General Enquiry',
        notes: leadData.notes || ''
      },
      company: {
        name: botConfig.companyName || '',
        ownerEmail: botConfig.companyOwnerEmail || '',
        phone: botConfig.companyPhone || '',
        website: botConfig.companyWebsite || '',
        address: '',
        tagline: '',
        logo: ''
      },
      timestamp: new Date().toISOString()
    };
    
    // Send to Flossly Lead API endpoint
    const flosslyLeadApiUrl = `${INTERNAL_API_BASE}/api/flossly/lead`;
    const response = await axios.post(flosslyLeadApiUrl, flosslyLeadPayload, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: (status) => status < 500 // Don't throw on 4xx errors
    });
    
    const result = response.data;
    
    // Flossly API returns code: 1 for success, code: 0 for error
    if (result.code === 1 || result.success === true || response.status === 200) {
      return {
        success: true,
        message: `Great! I've recorded your interest in ${leadData.treatment}. Our team will reach out to you soon with more information.`,
        leadId: result.data?.leadId || 'LEAD-' + Date.now(),
        data: result.data
      };
    } else {
      return {
        success: false,
        message: result.message || 'Sorry, there was an error recording your enquiry. Please contact us directly.',
        error: result.error || 'Lead creation failed'
      };
    }
    
  } catch (error) {
    console.error('[AI Agent] Lead creation error:', error);
    return {
      success: false,
      error: error.message,
      message: 'I apologize, but I encountered a technical issue while recording your enquiry. Please contact us directly.'
    };
  }
}

/**
 * Execute callback scheduling
 * Integrates with n8n webhook for Gmail notifications
 */
async function executeScheduleCallback(botConfig, callbackData) {
  try {
    console.log('[AI Agent] Scheduling callback:', callbackData);
    
    // Prepare callback data for n8n webhook
    const callbackPayload = {
      botId: botConfig.botId,
      botName: botConfig.name || 'AI Assistant',
      type: 'callback_request',
      customer: {
        name: callbackData.patientName || '',
        email: callbackData.email || '',
        phone: callbackData.phone || ''
      },
      callback: {
        reason: callbackData.reason || 'General enquiry',
        preferredTime: callbackData.preferredTime || 'As soon as possible',
        notes: callbackData.notes || ''
      },
      company: {
        name: botConfig.companyName || '',
        ownerEmail: botConfig.companyOwnerEmail || '',
        phone: botConfig.companyPhone || '',
        website: botConfig.companyWebsite || ''
      },
      timestamp: new Date().toISOString()
    };
    
    // Send to n8n callback webhook endpoint
    const callbackWebhookUrl = `${INTERNAL_API_BASE}/webhook/gmail-callback`;
    const response = await axios.post(callbackWebhookUrl, callbackPayload, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      timeout: 10000 // 10 second timeout
    });
    
    const result = response.data;
    
    // Check for success response (n8n webhook may return different structure)
    if (result.success === true || response.status === 200) {
      return {
        success: true,
        message: `Perfect! I've scheduled a callback for you. Our team will reach out ${callbackData.preferredTime || 'soon'}.`,
        callbackId: result.callbackId || 'CB-' + Date.now(),
        data: result.data
      };
    } else {
      return {
        success: false,
        message: result.message || 'Sorry, there was an error scheduling your callback. Please contact us directly.',
        error: result.error || 'Callback scheduling failed'
      };
    }
    
  } catch (error) {
    console.error('[AI Agent] Callback scheduling error:', error);
    
    // More specific error messages
    if (error.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: 'Connection refused',
        message: 'I apologize, but our callback system is temporarily unavailable. Please call us directly or try again later.'
      };
    } else if (error.code === 'ETIMEDOUT') {
      return {
        success: false,
        error: 'Timeout',
        message: 'The callback request is taking longer than expected. Please try again or contact us directly.'
      };
    } else {
      return {
        success: false,
        error: error.message,
        message: 'I apologize, but I encountered a technical issue while scheduling your callback. Please contact us directly.'
      };
    }
  }
}

/**
 * Streaming chat function - streams responses directly from OpenAI
 */
async function* chatWithAgentStream(botId, userMessage, conversationHistory = []) {
  try {
    // Load bot configuration
    const botConfig = await loadBotConfig(botId);
    
    // Build messages array
    const messages = [
      {
        role: "system",
        content: buildSystemPrompt(botConfig)
      },
      ...conversationHistory,
      {
        role: "user",
        content: userMessage
      }
    ];
    
    // Track tool execution
    let toolExecutionCount = 0;
    const maxToolExecutions = 5;
    const toolDetails = [];
    
    // First call - check for tools (non-streaming)
    let response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      tools: tools,
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 1000,
      stream: false
    });
    
    let message = response.choices[0].message;
    
    // Handle tool calls if any
    while (message.tool_calls && message.tool_calls.length > 0 && toolExecutionCount < maxToolExecutions) {
      messages.push({
        role: "assistant",
        content: message.content || null,
        tool_calls: message.tool_calls
      });
      
      for (const toolCall of message.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        let toolResult;
        const toolStartTime = Date.now();
        
        try {
          switch (functionName) {
            case 'browse_website':
              if (!functionArgs.url || functionArgs.url === 'the website' || !functionArgs.url.startsWith('http')) {
                toolResult = { success: false, error: 'Website URL not configured', message: 'Website URL not available.' };
              } else {
                toolResult = await browseWebsite(functionArgs.url, functionArgs.focus);
              }
              break;
            
            case 'search_practice_website':
              if (!botConfig.companyWebsite || !botConfig.companyWebsite.startsWith('http')) {
                toolResult = { success: false, error: 'Website URL not configured', message: 'Website URL not available.' };
              } else {
                toolResult = await searchPracticeWebsite(botConfig.companyWebsite, functionArgs.query);
              }
              break;
            
            case 'book_appointment':
              toolResult = await executeBookAppointment(botConfig, functionArgs);
              break;
            
            case 'create_lead':
              toolResult = await executeCreateLead(botConfig, functionArgs);
              break;
            
            case 'schedule_callback':
              toolResult = await executeScheduleCallback(botConfig, functionArgs);
              break;
            
            default:
              toolResult = { success: false, error: `Unknown tool: ${functionName}` };
          }
        } catch (error) {
          toolResult = { success: false, error: error.message };
        }
        
        toolDetails.push({
          name: functionName,
          arguments: functionArgs,
          result: toolResult,
          duration: Date.now() - toolStartTime
        });
        
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
        });
      }
      
      toolExecutionCount++;
      
      // Get next response
      response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        tools: tools,
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 1000,
        stream: false
      });
      
      message = response.choices[0].message;
    }
    
    // Add final assistant message to history before streaming
    messages.push({
      role: "assistant",
      content: message.content
    });
    
    // Now stream the response directly from OpenAI
    const streamResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
      stream: true
    });
    
    let fullContent = '';
    
    for await (const chunk of streamResponse) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullContent += delta;
        yield delta; // Yield each chunk directly
      }
    }
    
    // Return metadata at the end
    return {
      success: true,
      content: fullContent,
      conversationHistory: [
        ...conversationHistory,
        { role: "user", content: userMessage },
        { role: "assistant", content: fullContent }
      ].slice(-10),
      toolsUsed: toolExecutionCount,
      toolDetails: toolDetails
    };
    
  } catch (error) {
    console.error('[AI Agent Stream] Error:', error);
    yield "I apologize, but I'm having trouble processing your request right now. Please try again or contact us directly.";
  }
}

module.exports = {
  chatWithAgent,
  chatWithAgentStream,
  loadBotConfig
};

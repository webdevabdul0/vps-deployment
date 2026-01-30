/**
 * AI Agent - OpenAI GPT-4o-mini Integration
 * Main conversational AI agent with web browsing and API tool calling
 */

const OpenAI = require('openai');
const { tools, browseWebsite, searchPracticeWebsite } = require('./ai-tools');
const fs = require('fs').promises;
const path = require('path');

// Initialize OpenAI
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

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
  const website = botConfig.companyWebsite || 'the website';
  const phone = botConfig.companyPhone || 'the office';
  const email = botConfig.companyOwnerEmail || '';
  
  return `You are a friendly and helpful dental assistant for ${practiceName}.

PRACTICE INFORMATION:
- Name: ${practiceName}
- Website: ${website}
- Phone: ${phone}
${email ? `- Email: ${email}` : ''}

YOUR CAPABILITIES:
1. **Answer Questions**: When users ask about treatments, services, pricing, hours, or any practice-related information:
   - ALWAYS use the "search_practice_website" tool to get current information from ${website}
   - If you need specific page information, use "browse_website" with the exact URL
   - Never make up information - always check the website first

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
    console.log(`\n[AI Agent] Processing message for bot ${botId}: "${userMessage}"`);
    
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
      console.log(`[AI Agent] Executing ${message.tool_calls.length} tool(s)...`);
      
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
        
        console.log(`[AI Agent] Calling tool: ${functionName}`, functionArgs);
        
        let toolResult;
        
        try {
          switch (functionName) {
            case 'browse_website':
              toolResult = await browseWebsite(
                functionArgs.url,
                functionArgs.focus
              );
              break;
            
            case 'search_practice_website':
              toolResult = await searchPracticeWebsite(
                botConfig.companyWebsite,
                functionArgs.query
              );
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
          console.error(`[AI Agent] Tool execution error:`, error);
          toolResult = {
            success: false,
            error: error.message
          };
        }
        
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
    
    // Final response
    console.log(`[AI Agent] Final response: "${message.content}"`);
    
    // Build conversation history for next turn (keep last 10 messages)
    const updatedHistory = [
      ...conversationHistory,
      { role: "user", content: userMessage },
      { role: "assistant", content: message.content }
    ].slice(-10); // Keep last 5 exchanges (10 messages)
    
    return {
      success: true,
      content: message.content,
      conversationHistory: updatedHistory,
      toolsUsed: toolExecutionCount
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
 * This will integrate with your existing Flossly API
 */
async function executeBookAppointment(botConfig, appointmentData) {
  console.log('[AI Agent] Booking appointment:', appointmentData);
  
  // TODO: Integrate with actual Flossly API
  // For now, return mock success
  // You'll need to call your existing appointment creation endpoint
  
  try {
    // Example integration:
    // const axios = require('axios');
    // const response = await axios.post('https://api.flossly.com/appointments', {
    //   practice_id: botConfig.flosslyPracticeId,
    //   ...appointmentData
    // }, {
    //   headers: { 'Authorization': `Bearer ${botConfig.flosslyApiKey}` }
    // });
    
    return {
      success: true,
      message: `Appointment booked successfully for ${appointmentData.patientName} on ${appointmentData.date} at ${appointmentData.time}`,
      appointmentId: 'APT-' + Date.now(), // Mock ID
      data: appointmentData
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'Failed to book appointment. Please contact us directly.'
    };
  }
}

/**
 * Execute lead creation
 */
async function executeCreateLead(botConfig, leadData) {
  console.log('[AI Agent] Creating lead:', leadData);
  
  // TODO: Integrate with actual Flossly API
  
  try {
    return {
      success: true,
      message: `Lead created for ${leadData.patientName}. We'll contact you soon about ${leadData.treatment}.`,
      leadId: 'LEAD-' + Date.now(),
      data: leadData
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'Failed to create lead. Please contact us directly.'
    };
  }
}

/**
 * Execute callback scheduling
 */
async function executeScheduleCallback(botConfig, callbackData) {
  console.log('[AI Agent] Scheduling callback:', callbackData);
  
  // TODO: Integrate with actual Flossly API or n8n webhook
  
  try {
    return {
      success: true,
      message: `Callback scheduled for ${callbackData.patientName}. We'll call you ${callbackData.preferredTime || 'soon'}.`,
      callbackId: 'CB-' + Date.now(),
      data: callbackData
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'Failed to schedule callback. Please contact us directly.'
    };
  }
}

module.exports = {
  chatWithAgent,
  loadBotConfig
};

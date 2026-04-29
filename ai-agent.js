/**
 * AI Agent - OpenAI GPT-4o-mini Integration
 * Main conversational AI agent with web browsing and API tool calling
 */

const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const { tools, browseWebsite, searchPracticeWebsite } = require('./ai-tools');
const fs = require('fs').promises;
const path = require('path');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function toClaudeTools(openAiTools) {
  return openAiTools.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters
  }));
}

const claudeTools = toClaudeTools(tools);

// Internal API base URL (AI agent runs server-side; this should point to THIS server)
// Override via INTERNAL_API_BASE (recommended in production)
const INTERNAL_API_BASE = process.env.INTERNAL_API_BASE || `http://localhost:${process.env.PORT || 3001}`;

// Diagnostics: this is a very common root cause when tools "don't run" (they hit the wrong server).
console.log('[AI Agent] INTERNAL_API_BASE =', INTERNAL_API_BASE);
if (/localhost:3003/.test(INTERNAL_API_BASE)) {
  console.warn('[AI Agent] WARNING: INTERNAL_API_BASE is set to localhost:3003. If your widget server runs on 3001 or on https://widget.flossly.ai, tool calls may go to the wrong place.');
}
if (!/^https?:\/\//.test(INTERNAL_API_BASE)) {
  console.warn('[AI Agent] WARNING: INTERNAL_API_BASE does not look like a URL:', INTERNAL_API_BASE);
}

// Safety guard: in production, we should not be calling localhost.
// This prevents the assistant from claiming actions succeeded when requests went to the wrong host.
const NODE_ENV = process.env.NODE_ENV || 'development';
const INTERNAL_API_LOOKS_LOCAL = /^(http:\/\/)?localhost(?::\d+)?/i.test(INTERNAL_API_BASE);
const ACTION_TOOLS_DISABLED = NODE_ENV === 'production' && INTERNAL_API_LOOKS_LOCAL;

if (ACTION_TOOLS_DISABLED) {
  console.error('[AI Agent] CRITICAL: Action tools are DISABLED because NODE_ENV=production and INTERNAL_API_BASE points to localhost:', INTERNAL_API_BASE);
}

function actionToolsDisabledResult(actionName) {
  return {
    success: false,
    error: 'Action tools disabled: misconfigured INTERNAL_API_BASE',
    message: `I can't complete "${actionName}" right now because the server is misconfigured (INTERNAL_API_BASE points to localhost in production). Please contact the site admin to set INTERNAL_API_BASE to the correct public URL (e.g., https://widget.flossly.ai) and try again.`
  };
}

/**
 * Load bot configuration
 */
async function loadBotConfig(botId) {
  try {
    const dataPath = path.join(__dirname, 'flossy_data.json');
    console.log('[AI Agent] loadBotConfig() reading:', dataPath);
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
   - If the user message already contains ALL required fields, call "book_appointment" immediately (do NOT re-ask)
   - If any required field is missing, ask only for the missing field(s)
   - Ask conversationally - don't use a form-like approach
   - Once you have ALL required info, you MUST use the "book_appointment" tool
   - NEVER say an appointment is booked unless the tool returns success
   - Wait for the tool result before confirming to the patient
   - If the tool fails, apologize and offer alternatives

3. **Create Leads**: For treatment enquiries or quote requests:
   - Collect: name, email, phone (optional), treatment interest
   - If the user message already contains name + email + treatment interest, call "create_lead" immediately (do NOT ask extra questions)
   - If any required field is missing, ask only for the missing field(s)
   - You MUST use the "create_lead" tool - never skip this step
   - NEVER say a lead is created unless the tool returns success
   - Wait for the tool result before confirming

4. **Schedule Callbacks**: When someone wants to be called back:
   - Collect: name, phone, email, reason, preferred time
   - Email is REQUIRED for callback confirmation - always ask for it
   - If the user message already contains all required fields, call "schedule_callback" immediately (do NOT re-ask)
   - If any required field is missing, ask only for the missing field(s)
   - You MUST use the "schedule_callback" tool - this is required
   - NEVER say a callback is scheduled unless the tool returns success
   - Wait for the tool result before confirming

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
- **CRITICAL**: You MUST use tools to perform actions. NEVER claim you've done something without calling the appropriate tool
- **CRITICAL**: If you say "I've booked your appointment" or "I've created a lead" or "I've scheduled a callback", you MUST have called the corresponding tool and received a success response
- **CRITICAL**: Do NOT hallucinate or pretend actions are complete. Always wait for tool responses before confirming

Remember: You represent ${practiceName}. Be helpful, accurate, and professional at all times.`;
}

/**
 * Main chat function - handles conversation with AI agent
 */
async function chatWithAgent(botId, userMessage, conversationHistory = [], userTimezone = 'UTC') {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🤖 [AI Agent] NEW CHAT REQUEST');
    console.log('='.repeat(80));
    console.log('Bot ID:', botId);
    console.log('User Message:', userMessage);
    console.log('History Length:', conversationHistory.length);
    
    // Load bot configuration
    const botConfig = await loadBotConfig(botId);
    
    const systemPrompt = buildSystemPrompt(botConfig);
    const claudeMessages = conversationHistory.map(m => ({
      role: m.role === 'system' ? 'user' : m.role,
      content: m.content
    }));
    claudeMessages.push({ role: 'user', content: userMessage });

    // Initial API call
    console.log('📡 [AI Agent] Calling Claude with', claudeMessages.length, 'messages and', claudeTools.length, 'tools available');

    let response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: claudeMessages,
      tools: claudeTools
    });

    let assistantMessage = response.content;
    let toolCalls = assistantMessage.filter(block => block.type === 'tool_use');

    console.log('📨 [AI Agent] Claude Response:');
    console.log('   - Has content:', assistantMessage.some(b => b.type === 'text'));
    console.log('   - Tool calls count:', toolCalls.length);

    // Handle tool calls (may require multiple rounds)
    while (toolCalls.length > 0 && toolExecutionCount < maxToolExecutions) {
      console.log('\n🔧 [AI Agent] TOOL CALLS DETECTED:', toolCalls.length);

      for (const toolCall of toolCalls) {
        const functionName = toolCall.name;
        const functionArgs = toolCall.input;

        console.log(`\n📞 [AI Agent] CALLING TOOL: ${functionName}`);
        console.log('📝 [AI Agent] Tool Arguments:', JSON.stringify(functionArgs, null, 2));

        let toolResult;
        const toolStartTime = Date.now();
        let retryCount = 0;
        const maxRetries = 1;

        const isActionTool = ['book_appointment', 'create_lead', 'schedule_callback'].includes(functionName);

        while (retryCount <= maxRetries) {
          try {
            switch (functionName) {
              case 'browse_website':
                if (!functionArgs.url || functionArgs.url === 'the website' || !functionArgs.url.startsWith('http')) {
                  toolResult = {
                    success: false,
                    error: 'Website URL not configured for this practice',
                    message: 'The website URL is not available. Please contact the office directly for information.'
                  };
                } else {
                  toolResult = await browseWebsite(functionArgs.url, functionArgs.focus);
                }
                break;

              case 'search_practice_website':
                if (!botConfig.companyWebsite || !botConfig.companyWebsite.startsWith('http')) {
                  toolResult = {
                    success: false,
                    error: 'Website URL not configured for this practice',
                    message: 'The website URL is not available. Please contact the office directly for information.'
                  };
                } else {
                  toolResult = await searchPracticeWebsite(botConfig.companyWebsite, functionArgs.query);
                }
                break;

              case 'book_appointment':
                toolResult = ACTION_TOOLS_DISABLED
                  ? actionToolsDisabledResult('book_appointment')
                  : await executeBookAppointment(botConfig, functionArgs);
                break;

              case 'create_lead':
                toolResult = ACTION_TOOLS_DISABLED
                  ? actionToolsDisabledResult('create_lead')
                  : await executeCreateLead(botConfig, functionArgs, conversationHistory);
                break;

              case 'schedule_callback':
                toolResult = ACTION_TOOLS_DISABLED
                  ? actionToolsDisabledResult('schedule_callback')
                  : await executeScheduleCallback(botConfig, functionArgs);
                break;

              default:
                toolResult = { success: false, error: `Unknown tool: ${functionName}` };
            }

            if (toolResult.success || !isActionTool) break;

            if (retryCount < maxRetries && toolResult.error) {
              const isRetryableError =
                toolResult.error.includes('timeout') ||
                toolResult.error.includes('ETIMEDOUT') ||
                toolResult.error.includes('ECONNREFUSED') ||
                toolResult.error.includes('network') ||
                toolResult.error.includes('temporarily unavailable');

              if (isRetryableError) {
                retryCount++;
                console.log(`🔄 [AI Agent] Retrying ${functionName} (attempt ${retryCount + 1}/${maxRetries + 1}) after error: ${toolResult.error}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
              } else {
                break;
              }
            } else {
              break;
            }
          } catch (error) {
            toolResult = { success: false, error: error.message };

            if (retryCount < maxRetries && isActionTool) {
              const isRetryableError =
                error.code === 'ETIMEDOUT' ||
                error.code === 'ECONNREFUSED' ||
                error.message.includes('timeout') ||
                error.message.includes('network');

              if (isRetryableError) {
                retryCount++;
                console.log(`🔄 [AI Agent] Retrying ${functionName} (attempt ${retryCount + 1}/${maxRetries + 1}) after exception: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
              }
            }
            break;
          }
        }

        if (retryCount > 0) {
          console.log(`📊 [AI Agent] Tool ${functionName} completed after ${retryCount} ${retryCount === 1 ? 'retry' : 'retries'}. Final result: ${toolResult.success ? 'SUCCESS' : 'FAILED'}`);
        }

        const toolDuration = Date.now() - toolStartTime;
        console.log(`✅ [AI Agent] TOOL COMPLETED: ${functionName} (${toolDuration}ms)`);
        console.log('📊 [AI Agent] Tool Result:', JSON.stringify(toolResult, null, 2));

        toolDetails.push({
          name: functionName,
          arguments: functionArgs,
          result: toolResult,
          duration: toolDuration
        });

        claudeMessages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: JSON.stringify(toolResult)
          }]
        });
      }

      toolExecutionCount++;
      console.log(`🔄 [AI Agent] Tool execution count: ${toolExecutionCount}/${maxToolExecutions}`);

      response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: claudeMessages,
        tools: claudeTools
      });

      assistantMessage = response.content;
      toolCalls = assistantMessage.filter(block => block.type === 'tool_use');
    }

    const failedTools = toolDetails.filter(t => t?.result?.success === false);
    const lastTool = toolDetails[toolDetails.length - 1];

    console.log(`\n📋 [AI Agent] FINAL SUMMARY:`);
    console.log(`   - Tools called: ${toolExecutionCount}`);
    console.log(`   - Failed tools: ${failedTools.length}`);
    console.log(`   - Tool details:`, toolDetails.map(t => ({ name: t.name, success: t.result?.success })));

    let finalContent = assistantMessage.find(b => b.type === 'text')?.text || '';
    if (failedTools.length > 0) {
      console.log('⚠️ [AI Agent] TOOL FAILURE DETECTED - Overriding AI response');
      const toolMsg = lastTool?.result?.message || failedTools[0]?.result?.message;
      finalContent = toolMsg || "I couldn't complete that request due to a technical issue. Please try again or contact the practice directly.";
    }

    const updatedHistory = [
      ...conversationHistory,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: finalContent }
    ].slice(-10);

    return {
      success: true,
      content: finalContent,
      conversationHistory: updatedHistory,
      toolsUsed: toolExecutionCount,
      toolDetails: toolDetails
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
async function executeBookAppointment(botConfig, appointmentData, userTimezone = 'UTC') {
  try {
    console.log('\n🏥 [APPOINTMENT BOOKING] Starting booking process...');
    console.log('📋 [APPOINTMENT BOOKING] Data received:', JSON.stringify(appointmentData, null, 2));
    
    // Parse patient name into first and last name
    const patientName = appointmentData.patientName || '';
    const nameParts = patientName.trim().split(/\s+/);
    const firstName = nameParts[0] || '-';
    const lastName = nameParts.slice(1).join(' ') || '-';
    
    // userTimezone is now passed as a parameter from the chat request
    console.log('🌍 [APPOINTMENT BOOKING] User timezone:', userTimezone);
    
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
    
    // Send to n8n webhook for Google Calendar (non-blocking, match production widget flow)
    const webhookUrl = `https://n8n.flossly.ai/webhook/appointment-booking`;
    console.log('📤 [APPOINTMENT BOOKING] Sending to n8n webhook:', webhookUrl);
    axios.post(webhookUrl, flosslyPayload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    }).then(response => {
      console.log('✅ [APPOINTMENT→N8N] Webhook response status:', response.status);
    }).catch(err => {
      console.error('❌ [APPOINTMENT BOOKING] n8n webhook error:', err.message);
    });
    
    // Send to Flossly API endpoint (use production URL like traditional widget)
    const flosslyApiUrl = `https://widget.flossly.ai/api/flossly/appointment`;
    console.log('📤 [APPOINTMENT BOOKING] Sending to Flossly API:', flosslyApiUrl);
    console.log('📦 [APPOINTMENT BOOKING] Payload:', JSON.stringify(flosslyPayload, null, 2));
    
    const response = await axios.post(flosslyApiUrl, flosslyPayload, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: (status) => status < 500 // Don't throw on 4xx errors
    });
    
    console.log('📥 [APPOINTMENT BOOKING] API Response Status:', response.status);
    console.log('📥 [APPOINTMENT BOOKING] API Response Data:', JSON.stringify(response.data, null, 2));
    
    const result = response.data;
    
    // Check for conflict (409 status or error message)
    const errorMessage = typeof result.error === 'string' ? result.error : 
                        (typeof result.message === 'string' ? result.message : '');
    const isConflict = response.status === 409 || 
                      (errorMessage && errorMessage.includes('already has an appointment'));
    
    // Flossly API returns code: 1 for success, code: 0 for error
    if (result.code === 1 || result.success === true || response.status === 200) {
      console.log('✅ [APPOINTMENT BOOKING] SUCCESS - Appointment booked!');

      // Also create a lead in Flossly (non-blocking), like production flows
      try {
        const flosslyLeadPayload = {
          botId: botConfig.botId,
          botName: botConfig.name || 'AI Assistant',
          type: 'appointment_booking',
          customer: {
            email: appointmentData.email || '',
            name: appointmentData.patientName || '',
            phone: appointmentData.phone || ''
          },
          treatment: {
            name: appointmentData.treatmentType || 'Consultation',
            notes: appointmentData.notes || ''
          },
          company: {
            name: botConfig.companyName || '',
            ownerEmail: botConfig.companyOwnerEmail || '',
            phone: botConfig.companyPhone || '',
            website: botConfig.companyWebsite || ''
          },
          timestamp: new Date().toISOString()
        };
        const flosslyLeadApiUrl = `https://widget.flossly.ai/api/flossly/lead`;
        console.log('📤 [APPOINTMENT→LEAD] Creating lead at:', flosslyLeadApiUrl);
        console.log('📦 [APPOINTMENT→LEAD] Payload:', JSON.stringify(flosslyLeadPayload, null, 2));
        axios.post(flosslyLeadApiUrl, flosslyLeadPayload, { headers: { 'Content-Type': 'application/json' } })
          .then(r => console.log('✅ [APPOINTMENT→LEAD] Lead creation response status:', r.status))
          .catch(e => console.error('❌ [APPOINTMENT→LEAD] Lead creation error:', e.message));
      } catch (e) {
        console.error('❌ [APPOINTMENT→LEAD] Exception building/sending lead:', e.message);
      }

      return {
        success: true,
        message: `Perfect! I've booked your appointment for ${appointmentData.date} at ${appointmentData.time}. You'll receive a confirmation email shortly.`,
        appointmentId: result.data?.appointmentId || 'APT-' + Date.now(),
        data: result.data
      };
    } else if (isConflict) {
      console.log('⚠️ [APPOINTMENT BOOKING] CONFLICT - Time slot already booked');
      return {
        success: false,
        conflict: true,
        message: `I'm sorry, but that time slot (${appointmentData.time} on ${appointmentData.date}) is already booked. Would you like to try a different time?`,
        suggestions: result.suggestions || [],
        error: 'Time slot conflict'
      };
    } else {
      console.log('❌ [APPOINTMENT BOOKING] FAILED - API returned error');
      return {
        success: false,
        message: result.message || 'Sorry, there was an error booking your appointment. Please try again or contact us directly.',
        error: result.error || 'Booking failed'
      };
    }
    
  } catch (error) {
    console.error('❌ [APPOINTMENT BOOKING] EXCEPTION:', error.message);
    console.error('❌ [APPOINTMENT BOOKING] Stack:', error.stack);
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
async function executeCreateLead(botConfig, leadData, conversationHistory = []) {
  try {
    console.log('\n📝 [LEAD CREATION] Starting lead creation process...');
    console.log('📋 [LEAD CREATION] Data received:', JSON.stringify(leadData, null, 2));
    
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

    if (conversationHistory && conversationHistory.length > 0) {
      flosslyLeadPayload.chatHistory = conversationHistory
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({
          role: m.role === 'assistant' ? 'bot' : 'user',
          message: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        }));
    }

    // Send to Flossly Lead API endpoint (use production URL like traditional widget)
    const flosslyLeadApiUrl = `https://widget.flossly.ai/api/flossly/lead`;
    console.log('📤 [LEAD CREATION] Sending to Flossly Lead API:', flosslyLeadApiUrl);
    console.log('📦 [LEAD CREATION] Payload:', JSON.stringify(flosslyLeadPayload, null, 2));
    
    const response = await axios.post(flosslyLeadApiUrl, flosslyLeadPayload, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: (status) => status < 500 // Don't throw on 4xx errors
    });
    
    console.log('📥 [LEAD CREATION] API Response Status:', response.status);
    console.log('📥 [LEAD CREATION] API Response Data:', JSON.stringify(response.data, null, 2));
    
    const result = response.data;
    
    // Flossly API returns code: 1 for success, code: 0 for error
    if (result.code === 1 || result.success === true || response.status === 200) {
      console.log('✅ [LEAD CREATION] SUCCESS - Lead created!');
      return {
        success: true,
        message: `Great! I've recorded your interest in ${leadData.treatment}. Our team will reach out to you soon with more information.`,
        leadId: result.data?.leadId || 'LEAD-' + Date.now(),
        data: result.data
      };
    } else {
      console.log('❌ [LEAD CREATION] FAILED - API returned error');
      return {
        success: false,
        message: result.message || 'Sorry, there was an error recording your enquiry. Please contact us directly.',
        error: result.error || 'Lead creation failed'
      };
    }
    
  } catch (error) {
    console.error('❌ [LEAD CREATION] EXCEPTION:', error.message);
    console.error('❌ [LEAD CREATION] Stack:', error.stack);
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
    console.log('\n📞 [CALLBACK SCHEDULING] Starting callback scheduling process...');
    console.log('📋 [CALLBACK SCHEDULING] Data received:', JSON.stringify(callbackData, null, 2));
    
    // Validate required fields - email is REQUIRED for n8n workflow
    if (!callbackData.email || callbackData.email.trim() === '') {
      console.log('❌ [CALLBACK SCHEDULING] VALIDATION FAILED - Email is required');
      return {
        success: false,
        error: 'Email is required for callback confirmation',
        message: 'I need your email address to send you a callback confirmation. Could you please provide your email?'
      };
    }
    
    if (!callbackData.patientName || !callbackData.phone) {
      console.log('❌ [CALLBACK SCHEDULING] VALIDATION FAILED - Missing required fields');
      return {
        success: false,
        error: 'Missing required fields',
        message: 'I need your name and phone number to schedule a callback. Could you please provide them?'
      };
    }
    
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
    
    // Send to n8n callback webhook endpoint (match production widget flow)
    const callbackWebhookUrl = `https://n8n.flossly.ai/webhook/gmail-callback`;
    console.log('📤 [CALLBACK SCHEDULING] Sending to n8n webhook:', callbackWebhookUrl);
    console.log('📦 [CALLBACK SCHEDULING] Payload:', JSON.stringify(callbackPayload, null, 2));
    
    const response = await axios.post(callbackWebhookUrl, callbackPayload, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      timeout: 10000 // 10 second timeout
    });
    
    console.log('📥 [CALLBACK SCHEDULING] API Response Status:', response.status);
    console.log('📥 [CALLBACK SCHEDULING] API Response Data:', JSON.stringify(response.data, null, 2));
    
    const result = response.data;
    
    // Determine success based on body, not just HTTP 200.
    // Our server returns HTTP 200 even when n8n fails, with { success:false, ... }.
    const isSuccess = result?.success === true || result?.code === 1;

    if (isSuccess) {
      console.log('✅ [CALLBACK SCHEDULING] SUCCESS - Callback scheduled!');

      // Also create a lead in Flossly (non-blocking), like production flows
      try {
        const flosslyLeadPayload = {
          botId: botConfig.botId,
          botName: botConfig.name || 'AI Assistant',
          type: 'callback_request',
          customer: {
            email: callbackData.email || '',
            name: callbackData.patientName || '',
            phone: callbackData.phone || ''
          },
          treatment: {
            name: callbackData.reason || 'Callback Request',
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
        const flosslyLeadApiUrl = `https://widget.flossly.ai/api/flossly/lead`;
        console.log('📤 [CALLBACK→LEAD] Creating lead at:', flosslyLeadApiUrl);
        console.log('📦 [CALLBACK→LEAD] Payload:', JSON.stringify(flosslyLeadPayload, null, 2));
        axios.post(flosslyLeadApiUrl, flosslyLeadPayload, { headers: { 'Content-Type': 'application/json' } })
          .then(r => console.log('✅ [CALLBACK→LEAD] Lead creation response status:', r.status))
          .catch(e => console.error('❌ [CALLBACK→LEAD] Lead creation error:', e.message));
      } catch (e) {
        console.error('❌ [CALLBACK→LEAD] Exception building/sending lead:', e.message);
      }

      return {
        success: true,
        message: `Perfect! I've scheduled a callback for you. Our team will reach out ${callbackData.preferredTime || 'soon'}.`,
        callbackId: result.callbackId || result.data?.callbackId || 'CB-' + Date.now(),
        data: result.data
      };
    }

    console.log('❌ [CALLBACK SCHEDULING] FAILED - Downstream returned unsuccessful response');
    return {
      success: false,
      message: result?.message || 'Sorry, there was an error scheduling your callback. Please contact us directly.',
      error: result?.error || 'Callback scheduling failed',
      statusCode: response.status
    };
    
  } catch (error) {
    console.error('❌ [CALLBACK SCHEDULING] EXCEPTION:', error.message);
    console.error('❌ [CALLBACK SCHEDULING] Stack:', error.stack);
    
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
 * Streaming chat function - streams responses directly from Anthropic Claude
 */
async function* chatWithAgentStream(botId, userMessage, conversationHistory = []) {
  try {
    const botConfig = await loadBotConfig(botId);

    const systemPrompt = buildSystemPrompt(botConfig);
    const claudeMessages = conversationHistory.map(m => ({
      role: m.role === 'system' ? 'user' : m.role,
      content: m.content
    }));
    claudeMessages.push({ role: 'user', content: userMessage });

    let toolExecutionCount = 0;
    const maxToolExecutions = 5;
    const toolDetails = [];

    let response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: claudeMessages,
      tools: claudeTools
    });

    let assistantMessage = response.content;
    let toolCalls = assistantMessage.filter(block => block.type === 'tool_use');

    while (toolCalls.length > 0 && toolExecutionCount < maxToolExecutions) {
      for (const toolCall of toolCalls) {
        const functionName = toolCall.name;
        const functionArgs = toolCall.input;

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
              toolResult = ACTION_TOOLS_DISABLED
                ? actionToolsDisabledResult('book_appointment')
                : await executeBookAppointment(botConfig, functionArgs, userTimezone);
              break;

            case 'create_lead':
              toolResult = ACTION_TOOLS_DISABLED
                ? actionToolsDisabledResult('create_lead')
                : await executeCreateLead(botConfig, functionArgs, conversationHistory);
              break;

            case 'schedule_callback':
              toolResult = ACTION_TOOLS_DISABLED
                ? actionToolsDisabledResult('schedule_callback')
                : await executeScheduleCallback(botConfig, functionArgs);
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

        claudeMessages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: JSON.stringify(toolResult)
          }]
        });
      }

      toolExecutionCount++;

      response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: claudeMessages,
        tools: claudeTools
      });

      assistantMessage = response.content;
      toolCalls = assistantMessage.filter(block => block.type === 'tool_use');
    }

    claudeMessages.push({
      role: 'assistant',
      content: assistantMessage.find(b => b.type === 'text')?.text || ''
    });

    const stream = await anthropic.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: claudeMessages
    });

    let fullContent = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullContent += event.delta.text;
        yield event.delta.text;
      }
    }

    return {
      success: true,
      content: fullContent,
      conversationHistory: [
        ...conversationHistory,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: fullContent }
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

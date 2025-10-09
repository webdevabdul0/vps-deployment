/**
 * Flossy Chat Widget - VPS Deployment Version
 * Host this file on your VPS at: https://your-domain.com/widget.js
 * 
 * Optimized for shared VPS environments running n8n
 */
(function() {
    'use strict';
    
    // Prevent multiple loads
    if (window.flossyWidgetLoaded) return;
    window.flossyWidgetLoaded = true;
    
    // Get configuration from embed script
    const config = window.flossyConfig || {};
    
    // Default configuration
    const defaultConfig = {
        botId: 'default-bot',
        name: 'Assistant',
        companyName: 'Your Company',
        avatar: 'https://ui-avatars.com/api/?name=Bot&background=8FE3A8&color=fff&size=40&bold=true',
        themeColor: '#8FE3A8',
        position: 'right',
        sideSpacing: 25,
        bottomSpacing: 25,
        showDesktop: true,
        showMobile: true,
        openingMessages: [
            { text: 'Hi! How can I help you today?', showAvatar: true }
        ],
        appointmentGreeting: 'Hello! 👋 I can help you book an appointment at our clinic.\nWhat\'s your full name?',
        privacyPolicyUrl: '',
        companyOwnerEmail: '',
        companyPhone: '',
        companyWebsite: '',
        webhookUrl: 'https://n8n.flossly.ai/webhook/appointment-booking',
        gmailBrochureUrl: 'https://n8n.flossly.ai/webhook/gmail-brochure',
        gmailCallbackUrl: 'https://n8n.flossly.ai/webhook/gmail-callback',
        
        appointmentFlow: {
            fields: [
                { name: 'fullName', type: 'text', label: 'Full Name', required: true },
                { name: 'contact', type: 'email', label: 'Email Address', required: true },
                { name: 'phone', type: 'tel', label: 'Phone Number', required: true },
                { name: 'preferredDate', type: 'date', label: 'Preferred Date', required: true },
                { name: 'preferredTime', type: 'time', label: 'Preferred Time', required: true }
            ]
        },
        
        treatmentFlow: {
            options: [],
            webhookUrl: 'https://n8n.flossly.ai/webhook/gmail-brochure'
        },
        
        callbackFlow: {
            fields: [
                { name: 'name', type: 'text', label: 'Full Name', required: true },
                { name: 'email', type: 'email', label: 'Email Address', required: true },
                { name: 'phone', type: 'tel', label: 'Phone Number', required: true },
                { name: 'reason', type: 'text', label: 'Reason for Callback', required: true },
                { name: 'timing', type: 'text', label: 'Preferred Time', required: true }
            ]
        }
    };
    
    // Merge configurations
    const botConfig = { ...defaultConfig, ...config };
    
    // Widget state
    let isOpen = false;
    let initialized = false;
    let currentFormStep = -1;
    let formData = {};
    let isTyping = false;
    
    // New workflow states
    let currentWorkflow = null;
    let selectedTreatment = null;
    let showTreatmentOptions = false;
    let showCallbackForm = false;
    let callbackData = {};
    let currentCallbackField = -1;
    let showCallbackInput = false;
    let callbackInput = '';
    
    // Treatment chat states
    let showTreatmentChat = false;
    let treatmentChatInput = '';
    let treatmentChatMessages = [];
    let treatmentUserEmail = '';
    let selectedTreatmentOption = null;
    
    // Lightweight CSS (minified for performance)
    const styles = `
        @keyframes flossySlideIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes flossyFadeIn{from{opacity:0}to{opacity:1}}
        @keyframes flossyTyping{0%,60%{opacity:1}30%{opacity:0.3}}
        @keyframes flossyPulse{0%,100%{opacity:1}50%{opacity:0.5}}
        .flossy-widget *{box-sizing:border-box}
        .flossy-widget{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
        .flossy-slide-in{animation:flossySlideIn 0.6s ease-out}
        .flossy-fade-in{animation:flossyFadeIn 0.3s ease-out}
        .flossy-typing{animation:flossyTyping 1.5s infinite}
        .flossy-pulse{animation:flossyPulse 2s infinite}
        .flossy-widget::-webkit-scrollbar{width:6px}
        .flossy-widget::-webkit-scrollbar-track{background:#f1f1f1}
        .flossy-widget::-webkit-scrollbar-thumb{background:#c1c1c1;border-radius:3px}
        .flossy-form-field{margin:10px 0;padding:10px 12px;border:2px solid #e5e7eb;border-radius:12px;font-size:14px;transition:all 0.2s ease;width:100%;background:white;outline:none;color:#374151;min-width:200px}
        .flossy-form-field:focus{outline:none;border-color:${botConfig.themeColor};box-shadow:0 0 0 2px ${botConfig.themeColor}20;transform:scale(1.01)}
        .flossy-form-container{display:flex;gap:8px;align-items:center;width:100%;max-width:100%}
        .flossy-form-field-wrapper{flex:1;min-width:0}
        .flossy-form-send-btn{width:40px;height:40px;border-radius:12px;background:${botConfig.themeColor};color:white;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s ease;transform:scale(1);box-shadow:0 1px 3px rgba(0,0,0,0.1);flex-shrink:0}
        .flossy-form-send-btn:hover{transform:scale(1.05);box-shadow:0 2px 6px rgba(0,0,0,0.15)}
        .flossy-submit-btn{background:${botConfig.themeColor};color:white;border:none;padding:10px 20px;border-radius:12px;cursor:pointer;font-weight:bold;transition:all 0.3s ease}
        .flossy-submit-btn:hover{opacity:0.9;transform:translateY(-1px)}
        .flossy-submit-btn:disabled{opacity:0.6;cursor:not-allowed;transform:none}
        .flossy-close-btn:hover{background:rgba(255,255,255,0.3) !important}
        .flossy-send-btn:hover{transform:scale(1.05);box-shadow:0 4px 8px rgba(0,0,0,0.15) !important}
        .flossy-input:focus{border-color:${botConfig.themeColor} !important;box-shadow:0 0 0 2px ${botConfig.themeColor}20 !important;transform:scale(1.01) !important}
        .flossy-send-btn:hover{transform:scale(1.05) !important;box-shadow:0 2px 6px rgba(0,0,0,0.15) !important}
    `;
    
    // Inject styles efficiently
    if (!document.getElementById('flossy-styles')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'flossy-styles';
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }
    
    // Create widget container
    const widget = document.createElement('div');
    widget.className = 'flossy-widget';
    widget.id = `flossy-chat-widget-${botConfig.botId}`;
    widget.style.cssText = `
        position:fixed;
        bottom:${botConfig.bottomSpacing}px;
        ${botConfig.position === 'left' ? 'left' : 'right'}:${botConfig.sideSpacing}px;
        z-index:10000;
    `;
    
    // Create chat bubble (optimized HTML)
    const bubble = document.createElement('div');
    bubble.style.cssText = `
        width:64px;height:64px;background:${botConfig.themeColor};border-radius:50%;
        cursor:pointer;display:flex;align-items:center;justify-content:center;
        box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:transform 0.3s ease;position:relative;
    `;
    bubble.innerHTML = `
        <svg width="32" height="32" fill="none" stroke="white" viewBox="0 0 24 24" style="stroke-width:2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
        </svg>
        <div style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;background:#ef4444;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;animation:flossyPulse 2s infinite;">
            <span style="color:white;font-size:10px;font-weight:bold;">1</span>
        </div>
    `;
    
    // Create chat window
    const chatWindow = document.createElement('div');
    chatWindow.style.cssText = `
        position:absolute;bottom:80px;${botConfig.position === 'left' ? 'left' : 'right'}:0;
        width:350px;height:500px;background:white;border-radius:20px;
        box-shadow:0 20px 25px rgba(0,0,0,0.15),0 10px 10px rgba(0,0,0,0.04);display:none;flex-direction:column;overflow:hidden;border:1px solid #f3f4f6;
    `;
    
    // Create header
    const header = document.createElement('div');
    header.style.cssText = `background:${botConfig.themeColor};color:white;padding:24px;display:flex;align-items:center;gap:12px;border-bottom:1px solid rgba(255,255,255,0.1);`;
    header.innerHTML = `
        <div style="position:relative;">
            <img src="${botConfig.avatar}" alt="Bot" style="width:40px;height:40px;border-radius:50%;border:2px solid rgba(255,255,255,0.3);">
            <div style="position:absolute;bottom:-2px;right:-2px;width:12px;height:12px;background:#10b981;border-radius:50%;border:2px solid white;"></div>
        </div>
        <div style="flex:1;">
            <div style="font-weight:600;font-size:18px;color:white;margin-bottom:2px;">${botConfig.name}</div>
            <div style="font-size:14px;color:rgba(255,255,255,0.8);">Online now</div>
        </div>
        <button class="flossy-close-btn" style="background:rgba(255,255,255,0.2);border:none;color:white;font-size:16px;cursor:pointer;padding:8px;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;transition:background-color 0.2s;">×</button>
    `;
    
    // Create messages container
    const messagesContainer = document.createElement('div');
    messagesContainer.className = 'flossy-messages';
    messagesContainer.style.cssText = `flex:1;padding:24px;overflow-y:auto;background:rgba(249,250,251,0.3);`;
    
    // Create input area
    const inputArea = document.createElement('div');
    inputArea.style.cssText = `padding:16px;border-top:1px solid #f3f4f6;background:white;display:none;`;
    inputArea.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center;">
            <input class="flossy-input" type="text" placeholder="Type your message here..." 
                   style="flex:1;padding:8px 12px;border:2px solid #e5e7eb;border-radius:12px;font-size:12px;color:#374151;background:white;outline:none;transition:all 0.2s ease;transform:scale(1);" />
            <button class="flossy-send-btn" style="width:40px;height:40px;border-radius:12px;background:${botConfig.themeColor};color:white;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s ease;transform:scale(1);box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="stroke-width:2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" transform="rotate(90 12 12)"/>
                </svg>
            </button>
        </div>
    `;
    
    // Assemble widget
    chatWindow.appendChild(header);
    chatWindow.appendChild(messagesContainer);
    chatWindow.appendChild(inputArea);
    widget.appendChild(bubble);
    widget.appendChild(chatWindow);
    
    // Core functions
    function toggleChat() {
        isOpen = !isOpen;
        chatWindow.style.display = isOpen ? 'flex' : 'none';
        if (isOpen && !initialized) {
            setTimeout(initializeChat, 100);
            initialized = true;
        }
    }
    
    function initializeChat() {
        messagesContainer.innerHTML = '';
        currentFormStep = -1;
        formData = {};
        currentWorkflow = null;
        selectedTreatment = null;
        showTreatmentOptions = false;
        showCallbackForm = false;
        callbackData = {};
        currentCallbackField = -1;
        showCallbackInput = false;
        callbackInput = '';
        showTreatmentChat = false;
        treatmentChatInput = '';
        treatmentChatMessages = [];
        treatmentUserEmail = '';
        selectedTreatmentOption = null;
        
        botConfig.openingMessages.forEach((msg, index) => {
            setTimeout(() => {
                addBotMessage(msg.text, msg.showAvatar);
                if (index === botConfig.openingMessages.length - 1) {
                    setTimeout(showAppointmentOptions, 1000);
                }
            }, index * 1200);
        });
    }
    
    function addBotMessage(text, showAvatar = true) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'flossy-slide-in';
        messageDiv.style.cssText = 'display:flex;gap:12px;margin-bottom:16px;align-items:flex-start;';
        messageDiv.innerHTML = `
            ${showAvatar ? `<img src="${botConfig.avatar}" alt="Bot" style="width:32px;height:32px;border-radius:50%;flex-shrink:0;">` : '<div style="width:32px;"></div>'}
            <div style="flex:1;">
                <div style="background:white;color:#374151;padding:12px 16px;border-radius:20px;border-radius-top-left:6px;box-shadow:0 1px 2px rgba(0,0,0,0.05);border:1px solid #f3f4f6;margin-bottom:4px;max-width:280px;font-size:14px;">${text}</div>
                <div style="font-size:11px;color:#9ca3af;margin-left:4px;">Just now</div>
            </div>
        `;
        messagesContainer.appendChild(messageDiv);
        scrollToBottom();
    }
    
    function addUserMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'flossy-slide-in';
        messageDiv.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:16px;';
        messageDiv.innerHTML = `
            <div style="max-width:80%;">
                <div style="background:${botConfig.themeColor};color:white;padding:12px 16px;border-radius:20px;border-radius-top-right:6px;margin-bottom:4px;box-shadow:0 1px 2px rgba(0,0,0,0.1);font-size:14px;">${text}</div>
                <div style="font-size:11px;color:#9ca3af;text-align:right;margin-right:4px;">Just now</div>
            </div>
        `;
        messagesContainer.appendChild(messageDiv);
        scrollToBottom();
    }
    
    function showTypingIndicator() {
        if (isTyping) return;
        isTyping = true;
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'flossy-typing-indicator flossy-slide-in';
        typingDiv.style.cssText = 'display:flex;gap:12px;margin-bottom:16px;align-items:flex-start;';
        typingDiv.innerHTML = `
            <img src="${botConfig.avatar}" alt="Bot" style="width:32px;height:32px;border-radius:50%;flex-shrink:0;">
            <div style="background:white;padding:12px 16px;border-radius:20px;border-radius-top-left:6px;box-shadow:0 1px 2px rgba(0,0,0,0.05);border:1px solid #f3f4f6;">
                <div style="display:flex;gap:4px;">
                    <div class="flossy-typing" style="width:6px;height:6px;background:#9ca3af;border-radius:50%;display:inline-block;"></div>
                    <div class="flossy-typing" style="width:6px;height:6px;background:#9ca3af;border-radius:50%;display:inline-block;animation-delay:0.2s;"></div>
                    <div class="flossy-typing" style="width:6px;height:6px;background:#9ca3af;border-radius:50%;display:inline-block;animation-delay:0.4s;"></div>
                </div>
            </div>
        `;
        messagesContainer.appendChild(typingDiv);
        scrollToBottom();
        
        return typingDiv;
    }
    
    function hideTypingIndicator() {
        const typingDiv = messagesContainer.querySelector('.flossy-typing-indicator');
        if (typingDiv) {
            typingDiv.remove();
        }
        isTyping = false;
    }
    
    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    function showAppointmentOptions() {
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'flossy-slide-in';
        optionsDiv.style.cssText = 'margin-bottom:16px;';
        
        let optionsHTML = '<div style="margin-bottom:12px;font-weight:bold;color:#374151;">Please select an option:</div>';
        const appointmentOptions = [
            { text: 'Request an appointment', type: 'appointment' },
            { text: 'Learn about treatments', type: 'treatment' },
            { text: 'Request a callback', type: 'callback' }
        ];
        appointmentOptions.forEach(option => {
            optionsHTML += `
                <div class="flossy-option" data-type="${option.type}" data-text="${option.text}" 
                     style="background:#f8fafc;border:1px solid #e5e7eb;padding:12px;border-radius:12px;margin-bottom:8px;cursor:pointer;transition:all 0.3s ease;display:flex;align-items:center;gap:12px;">
                    <div style="width:20px;height:20px;border-radius:50%;border:2px solid ${botConfig.themeColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <div style="width:12px;height:12px;border-radius:50%;background:${botConfig.themeColor};opacity:0;transform:scale(0);transition:all 0.2s ease;"></div>
                    </div>
                    <span style="font-size:14px;color:#374151;font-weight:500;">${option.text}</span>
                </div>
            `;
        });
        optionsDiv.innerHTML = optionsHTML;
        messagesContainer.appendChild(optionsDiv);
        scrollToBottom();
        
        // Add event listeners
        optionsDiv.querySelectorAll('.flossy-option').forEach(option => {
            option.addEventListener('click', function() {
                const type = this.getAttribute('data-type');
                const text = this.getAttribute('data-text');
                selectOption(type, text);
            });
            option.addEventListener('mouseenter', function() {
                this.style.borderColor = '#d1d5db';
                this.style.transform = 'scale(1.02)';
                this.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                const innerCircle = this.querySelector('div div');
                innerCircle.style.opacity = '1';
                innerCircle.style.transform = 'scale(1)';
            });
            option.addEventListener('mouseleave', function() {
                this.style.borderColor = '#e5e7eb';
                this.style.transform = 'scale(1)';
                this.style.boxShadow = 'none';
                const innerCircle = this.querySelector('div div');
                innerCircle.style.opacity = '0';
                innerCircle.style.transform = 'scale(0)';
            });
        });
    }
    
    function selectOption(type, text) {
        // Remove options
        const optionsDiv = messagesContainer.querySelector('.flossy-slide-in:last-child');
        if (optionsDiv) optionsDiv.remove();
        
        addUserMessage(text);
        
        if (type === 'appointment') {
            currentWorkflow = 'appointment';
            const typingDiv = showTypingIndicator();
            setTimeout(() => {
                hideTypingIndicator();
                addBotMessage(botConfig.appointmentGreeting);
                setTimeout(() => {
                    startAppointmentFlow();
                }, 1000);
            }, 1500);
        } else if (type === 'treatment') {
            currentWorkflow = 'treatment';
            const typingDiv = showTypingIndicator();
            setTimeout(() => {
                hideTypingIndicator();
                addBotMessage('Hi! I\'m here to answer questions about our dental treatments. What treatment are you interested in learning more about?');
                setTimeout(() => {
                    showTreatmentOptionsUI();
                }, 1000);
            }, 1500);
        } else if (type === 'callback') {
            currentWorkflow = 'callback';
            const typingDiv = showTypingIndicator();
            setTimeout(() => {
                hideTypingIndicator();
                addBotMessage('You\'d like a callback from our team—happy to arrange that! Could you please provide your name and the best phone number to reach you?');
                setTimeout(() => {
                    startCallbackFlow();
                }, 1000);
            }, 1500);
        }
    }
    
    function startAppointmentFlow() {
        currentFormStep = 0;
        formData = {};
        showNextFormField();
    }
    
    function showNextFormField() {
        if (currentFormStep >= botConfig.appointmentFlow.fields.length) {
            if (currentWorkflow === 'treatment') {
                completeTreatment();
            } else {
                completeAppointment();
            }
            return;
        }
        
        const field = botConfig.appointmentFlow.fields[currentFormStep];
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'flossy-form-container flossy-slide-in';
        fieldDiv.style.cssText = 'margin-bottom:16px;';
        
        let inputType = field.type;
        let placeholder = `Enter your ${field.label.toLowerCase()}`;
        
        if (field.type === 'email') {
            placeholder = 'example@email.com';
        } else if (field.type === 'tel') {
            placeholder = '+1 (555) 123-4567';
        } else if (field.type === 'date') {
            placeholder = 'Select date';
        } else if (field.type === 'time') {
            placeholder = 'Select time';
        }
        
        fieldDiv.innerHTML = `
            <div class="flossy-form-container">
                <div class="flossy-form-field-wrapper">
                    <input class="flossy-form-field" type="${inputType}" placeholder="${placeholder}" 
                           ${field.required ? 'required' : ''}>
                </div>
                <button class="flossy-form-send-btn" type="button">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="stroke-width:2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" transform="rotate(90 12 12)"/>
                    </svg>
                </button>
            </div>
        `;
        
        messagesContainer.appendChild(fieldDiv);
        scrollToBottom();
        
        const input = fieldDiv.querySelector('.flossy-form-field');
        const sendBtn = fieldDiv.querySelector('.flossy-form-send-btn');
        
        // Focus the input
        setTimeout(() => input.focus(), 100);
        
        function submitField() {
            const value = input.value.trim();
            if (!value && field.required) {
                input.style.borderColor = '#ef4444';
                input.focus();
                return;
            }
            
            // Store the value
            formData[field.name] = value;
            
            // Remove the form field
            fieldDiv.remove();
            
            // Add user message
            addUserMessage(value);
            
            // Show bot response
            const typingDiv = showTypingIndicator();
            setTimeout(() => {
                hideTypingIndicator();
                
                let response = '';
                if (field.name === 'fullName') {
                    if (currentWorkflow === 'treatment') {
                        response = `Thanks ${value}! 😊`;
                    } else {
                        response = `Thanks ${value}! 😊`;
                    }
                } else if (field.name === 'contact') {
                    if (currentWorkflow === 'treatment') {
                        response = `Perfect! I've got your contact info.`;
                        if (botConfig.privacyPolicyUrl) {
                            response += `\n\nWe take privacy and your data very seriously and do not share it. See our <a href="${botConfig.privacyPolicyUrl}" target="_blank" style="color:${botConfig.themeColor};">privacy policy</a>.`;
                        }
                        response += `\n\nI'll also need your phone number for follow-up.`;
                    } else {
                        response = `Perfect! I have your email as ${value}.`;
                        if (botConfig.privacyPolicyUrl) {
                            response += `\n\nWe take privacy and your data very seriously and do not share it. See our <a href="${botConfig.privacyPolicyUrl}" target="_blank" style="color:${botConfig.themeColor};">privacy policy</a>.`;
                        }
                    }
                } else if (field.name === 'phone') {
                    if (currentWorkflow === 'treatment') {
                        response = `Thank you! We'll send the details shortly. If you'd like a call from our team, just type 'callback.'`;
                    } else {
                        response = `Great! I have your phone number.`;
                    }
                } else if (field.name === 'preferredDate') {
                    response = `Excellent! You'd like to book for ${value}.`;
                } else if (field.name === 'preferredTime') {
                    response = `Perfect! Let me check availability for ${value}.`;
                }
                
                addBotMessage(response);
                
                // Move to next field
                currentFormStep++;
                
                // For treatment flow, after phone field, complete treatment first
                if (currentWorkflow === 'treatment' && field.name === 'phone') {
                    setTimeout(() => {
                        completeTreatment();
                    }, 1000);
                } else {
                    setTimeout(() => {
                        showNextFormField();
                    }, 1000);
                }
            }, 800);
        }
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                submitField();
            }
        });
        
        sendBtn.addEventListener('click', () => {
            if (input.value.trim()) {
                submitField();
            }
        });
    }
    
    function completeAppointment() {
        const typingDiv = showTypingIndicator();
        
        // Get user's timezone
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // Send to webhook
        sendToWebhook({
            type: 'appointment_booking',
            botId: botConfig.botId,
            formData: formData,
            userTimezone: userTimezone,
            timestamp: new Date().toISOString()
        }, (response) => {
            hideTypingIndicator();
            
            if (response.success) {
                // Show confirmation message
                const confirmationMessage = '✅ I\'ve reserved your appointment for [chosen date/time].\nYou\'ll receive a confirmation email shortly.\nWould you also like directions to our clinic?'
                    .replace('[chosen date/time]', `${formData.preferredDate} at ${formData.preferredTime}`);
                
                addBotMessage(confirmationMessage);
                
                setTimeout(() => {
                    addBotMessage("Is there anything else I can help you with today? 😊");
                    setTimeout(() => {
                        showAppointmentOptions();
                    }, 1000);
                }, 2000);
            } else if (response.conflict) {
                // Show conflict message and suggestions
                addBotMessage("❌ " + response.message);
                
                setTimeout(() => {
                    showAppointmentSuggestions(response.suggestions, response.availableSlots);
                }, 1000);
            } else {
                // Show error message
                addBotMessage("❌ " + (response.message || "Sorry, there was an error booking your appointment. Please try again."));
                
                setTimeout(() => {
                    addBotMessage("Would you like to try booking again?");
                    showAppointmentOptions();
                }, 2000);
            }
        });
    }
    
    function completeTreatment() {
        const typingDiv = showTypingIndicator();
        
        // Send to treatment webhook
        sendToTreatmentWebhook({
            botId: botConfig.botId,
            botName: botConfig.name,
            type: 'brochure_request',
            treatment: {
                name: selectedTreatment.name,
                description: selectedTreatment.description,
                brochureUrl: selectedTreatment.brochureUrl || '',
                hasBrochureUrl: !!(selectedTreatment.brochureUrl && selectedTreatment.brochureUrl.trim())
            },
            customer: {
                email: formData.contact,
                name: formData.fullName,
                phone: formData.phone
            },
            company: {
                name: botConfig.companyName,
                ownerEmail: botConfig.companyOwnerEmail,
                phone: botConfig.companyPhone || '',
                website: botConfig.companyWebsite || '',
                address: '',
                tagline: '',
                logo: ''
            }
        }, (response) => {
            hideTypingIndicator();
            
            if (response.success) {
                addBotMessage("✅ Perfect! I've sent you the brochure details. Our team will contact you shortly with more information.");
                
                setTimeout(() => {
                    addBotMessage("If you'd like a call from our team, just type 'callback.'");
                    setTimeout(() => {
                        showCallbackInputField();
                    }, 1000);
                }, 2000);
            } else {
                addBotMessage("❌ " + (response.message || "Sorry, there was an error sending the brochure. Please try again."));
                
                setTimeout(() => {
                    addBotMessage("Would you like to try again?");
                    showAppointmentOptions();
                }, 2000);
            }
        });
    }
    
    // Treatment workflow functions
    function showTreatmentOptionsUI() {
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'flossy-slide-in';
        optionsDiv.style.cssText = 'margin-bottom:16px;';
        
        let optionsHTML = '<div style="margin-bottom:12px;font-weight:bold;color:#374151;">Please select a treatment:</div>';
        botConfig.treatmentFlow.options.forEach((option, index) => {
            optionsHTML += `
                <div class="flossy-treatment-option" data-treatment='${JSON.stringify(option)}' 
                     style="background:#f8fafc;border:1px solid #e5e7eb;padding:12px;border-radius:12px;margin-bottom:8px;cursor:pointer;transition:all 0.3s ease;display:flex;align-items:flex-start;gap:12px;">
                    <div style="width:20px;height:20px;border-radius:50%;border:2px solid ${botConfig.themeColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;">
                        <div style="width:12px;height:12px;border-radius:50%;background:${botConfig.themeColor};opacity:0;transform:scale(0);transition:all 0.2s ease;"></div>
                    </div>
                    <div style="flex:1;">
                        <div style="font-size:14px;color:#374151;font-weight:500;margin-bottom:2px;">${option.name}</div>
                        <div style="font-size:12px;color:#6b7280;">${option.description}</div>
                    </div>
                </div>
            `;
        });
        optionsDiv.innerHTML = optionsHTML;
        messagesContainer.appendChild(optionsDiv);
        scrollToBottom();
        
        // Add event listeners
        optionsDiv.querySelectorAll('.flossy-treatment-option').forEach(option => {
            option.addEventListener('click', function() {
                const treatment = JSON.parse(this.getAttribute('data-treatment'));
                selectTreatment(treatment);
            });
            option.addEventListener('mouseenter', function() {
                this.style.borderColor = '#d1d5db';
                this.style.transform = 'scale(1.02)';
                this.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                const innerCircle = this.querySelector('div div');
                innerCircle.style.opacity = '1';
                innerCircle.style.transform = 'scale(1)';
            });
            option.addEventListener('mouseleave', function() {
                this.style.borderColor = '#e5e7eb';
                this.style.transform = 'scale(1)';
                this.style.boxShadow = 'none';
                const innerCircle = this.querySelector('div div');
                innerCircle.style.opacity = '0';
                innerCircle.style.transform = 'scale(0)';
            });
        });
    }
    
    function selectTreatment(treatment) {
        selectedTreatment = treatment;
        
        // Remove treatment options
        const optionsDiv = messagesContainer.querySelector('.flossy-slide-in:last-child');
        if (optionsDiv) optionsDiv.remove();
        
        addUserMessage(treatment.name);
        
        // Show treatment info and options
        const typingDiv = showTypingIndicator();
        setTimeout(() => {
            hideTypingIndicator();
            addBotMessage(`${treatment.description}. Would you like me to send you a detailed brochure via email or help you schedule a free consultation with our dentist?`);
            
            setTimeout(() => {
                showTreatmentActionOptions();
            }, 1000);
        }, 1500);
    }
    
    function showTreatmentActionOptions() {
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'flossy-slide-in';
        optionsDiv.style.cssText = 'margin-bottom:16px;';
        
        let optionsHTML = '<div style="margin-bottom:12px;font-weight:bold;color:#374151;">Please select an option:</div>';
        optionsHTML += `
            <div class="flossy-treatment-action" data-action="brochure" 
                 style="background:#f8fafc;border:1px solid #e5e7eb;padding:12px;border-radius:12px;margin-bottom:8px;cursor:pointer;transition:all 0.3s ease;display:flex;align-items:center;gap:12px;">
                <div style="width:20px;height:20px;border-radius:50%;border:2px solid ${botConfig.themeColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <div style="width:12px;height:12px;border-radius:50%;background:${botConfig.themeColor};opacity:0;transform:scale(0);transition:all 0.2s ease;"></div>
                </div>
                <span style="font-size:14px;color:#374151;font-weight:500;">Send me the brochure</span>
            </div>
            <div class="flossy-treatment-action" data-action="consultation" 
                 style="background:#f8fafc;border:1px solid #e5e7eb;padding:12px;border-radius:12px;margin-bottom:8px;cursor:pointer;transition:all 0.3s ease;display:flex;align-items:center;gap:12px;">
                <div style="width:20px;height:20px;border-radius:50%;border:2px solid ${botConfig.themeColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <div style="width:12px;height:12px;border-radius:50%;background:${botConfig.themeColor};opacity:0;transform:scale(0);transition:all 0.2s ease;"></div>
                </div>
                <span style="font-size:14px;color:#374151;font-weight:500;">Schedule a consultation</span>
            </div>
        `;
        optionsDiv.innerHTML = optionsHTML;
        messagesContainer.appendChild(optionsDiv);
        scrollToBottom();
        
        // Add event listeners
        optionsDiv.querySelectorAll('.flossy-treatment-action').forEach(option => {
            option.addEventListener('click', function() {
                const action = this.getAttribute('data-action');
                handleTreatmentAction(action);
            });
            option.addEventListener('mouseenter', function() {
                this.style.borderColor = '#d1d5db';
                this.style.transform = 'scale(1.02)';
                this.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                const innerCircle = this.querySelector('div div');
                innerCircle.style.opacity = '1';
                innerCircle.style.transform = 'scale(1)';
            });
            option.addEventListener('mouseleave', function() {
                this.style.borderColor = '#e5e7eb';
                this.style.transform = 'scale(1)';
                this.style.boxShadow = 'none';
                const innerCircle = this.querySelector('div div');
                innerCircle.style.transform = 'scale(0)';
            });
        });
    }
    
    function handleTreatmentAction(action) {
        // Remove action options
        const optionsDiv = messagesContainer.querySelector('.flossy-slide-in:last-child');
        if (optionsDiv) optionsDiv.remove();
        
        addUserMessage(action === 'brochure' ? 'Send me the brochure' : 'Schedule a consultation');
        
        if (action === 'brochure') {
            // Use existing form data if available, otherwise collect it
            if (formData.fullName && formData.contact && formData.phone) {
                // We already have the details, proceed directly
                const typingDiv = showTypingIndicator();
                setTimeout(() => {
                    hideTypingIndicator();
                    addBotMessage('Perfect! I have your details. Let me send you the brochure information.');
                    setTimeout(() => {
                        completeTreatment();
                    }, 1000);
                }, 1500);
            } else {
                // Collect missing details
                const typingDiv = showTypingIndicator();
                setTimeout(() => {
                    hideTypingIndicator();
                    addBotMessage('Please share your name and preferred contact method so we can follow up with information tailored to your needs.');
                    setTimeout(() => {
                        startTreatmentFormFlow();
                    }, 1000);
                }, 1500);
            }
        } else if (action === 'consultation') {
            // Switch to appointment booking
            const typingDiv = showTypingIndicator();
            setTimeout(() => {
                hideTypingIndicator();
                addBotMessage(`Great! I'll help you schedule a consultation for ${selectedTreatment.name}. Let me switch you to our appointment booking system.`);
                setTimeout(() => {
                    currentWorkflow = 'appointment';
                    addBotMessage(botConfig.appointmentGreeting);
                    setTimeout(() => {
                        startAppointmentFlow();
                    }, 1000);
                }, 1000);
            }, 1500);
        }
    }
    
    function startTreatmentFormFlow() {
        currentFormStep = 0;
        formData = {};
        showNextFormField();
    }
    
    // Callback workflow functions
    function startCallbackFlow() {
        currentCallbackField = 0;
        callbackData = {};
        showNextCallbackField();
    }
    
    function showNextCallbackField() {
        if (currentCallbackField >= botConfig.callbackFlow.fields.length) {
            completeCallback();
            return;
        }
        
        const field = botConfig.callbackFlow.fields[currentCallbackField];
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'flossy-form-container flossy-slide-in';
        fieldDiv.style.cssText = 'margin-bottom:16px;';
        
        let inputType = field.type;
        let placeholder = `Enter your ${field.label.toLowerCase()}`;
        
        if (field.type === 'tel') {
            placeholder = '+1 (555) 123-4567';
        }
        
        fieldDiv.innerHTML = `
            <div class="flossy-form-container">
                <div class="flossy-form-field-wrapper">
                    <input class="flossy-form-field" type="${inputType}" placeholder="${placeholder}" 
                           ${field.required ? 'required' : ''}>
                </div>
                <button class="flossy-form-send-btn" type="button">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="stroke-width:2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" transform="rotate(90 12 12)"/>
                    </svg>
                </button>
            </div>
        `;
        
        messagesContainer.appendChild(fieldDiv);
        scrollToBottom();
        
        const input = fieldDiv.querySelector('.flossy-form-field');
        const sendBtn = fieldDiv.querySelector('.flossy-form-send-btn');
        
        // Focus the input
        setTimeout(() => input.focus(), 100);
        
        function submitCallbackField() {
            const value = input.value.trim();
            if (!value && field.required) {
                input.style.borderColor = '#ef4444';
                input.focus();
                return;
            }
            
            // Store the value
            callbackData[field.name] = value;
            
            // Remove the form field
            fieldDiv.remove();
            
            // Add user message
            addUserMessage(value);
            
            // Show bot response
            const typingDiv = showTypingIndicator();
            setTimeout(() => {
                hideTypingIndicator();
                
                let response = '';
                if (field.name === 'name') {
                    response = `Thanks ${value}! 😊`;
                } else if (field.name === 'email') {
                    response = `Great! I've got your email: ${value}`;
                } else if (field.name === 'phone') {
                    response = `Perfect! I've got your contact info.`;
                } else if (field.name === 'reason') {
                    response = `Got it! ${value} is a great reason to call.`;
                } else if (field.name === 'timing') {
                    response = `Excellent! We've scheduled your callback for ${value}.`;
                }
                
                addBotMessage(response);
                
                // Move to next field
                currentCallbackField++;
                setTimeout(() => {
                    showNextCallbackField();
                }, 1000);
            }, 800);
        }
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                submitCallbackField();
            }
        });
        
        sendBtn.addEventListener('click', () => {
            if (input.value.trim()) {
                submitCallbackField();
            }
        });
    }
    
    function showCallbackInputField() {
        const inputDiv = document.createElement('div');
        inputDiv.className = 'flossy-callback-input flossy-slide-in';
        inputDiv.style.cssText = 'margin-bottom:16px;';
        
        inputDiv.innerHTML = `
            <div class="flossy-form-container">
                <div class="flossy-form-field-wrapper">
                    <input class="flossy-form-field" type="text" placeholder="Type 'callback' to request a call back" 
                           style="font-size:14px;padding:10px 12px;">
                </div>
                <button class="flossy-form-send-btn" type="button">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="stroke-width:2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" transform="rotate(90 12 12)"/>
                    </svg>
                </button>
            </div>
        `;
        
        messagesContainer.appendChild(inputDiv);
        scrollToBottom();
        
        const input = inputDiv.querySelector('.flossy-form-field');
        const sendBtn = inputDiv.querySelector('.flossy-form-send-btn');
        
        // Focus the input
        setTimeout(() => input.focus(), 100);
        
        function handleCallbackInput() {
            const value = input.value.trim();
            if (!value) return;
            
            // Remove the input field
            inputDiv.remove();
            
            // Add user message
            addUserMessage(value);
            
            const lowerMessage = value.toLowerCase();
            
            if (lowerMessage.includes('callback')) {
                // Switch to callback flow
                const typingDiv = showTypingIndicator();
                setTimeout(() => {
                    hideTypingIndicator();
                    addBotMessage('You\'d like a callback from our team—happy to arrange that! Could you please provide your name and the best phone number to reach you?');
                    setTimeout(() => {
                        currentWorkflow = 'callback';
                        startCallbackFlow();
                    }, 1000);
                }, 1000);
            } else {
                // Complete treatment flow
                const typingDiv = showTypingIndicator();
                setTimeout(() => {
                    hideTypingIndicator();
                    addBotMessage('Thank you for your interest! We\'ll be in touch soon with more information.');
                    setTimeout(() => {
                        addBotMessage('Is there anything else I can help you with today? 😊');
                        setTimeout(() => {
                            showAppointmentOptions();
                        }, 1000);
                    }, 2000);
                }, 1000);
            }
        }
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                handleCallbackInput();
            }
        });
        
        sendBtn.addEventListener('click', () => {
            if (input.value.trim()) {
                handleCallbackInput();
            }
        });
    }
    
    function completeCallback() {
        const typingDiv = showTypingIndicator();
        
        // Send to callback webhook
        sendToCallbackWebhook({
            botId: botConfig.botId,
            botName: botConfig.name,
            type: 'callback_request',
            customer: {
                name: callbackData.name,
                phone: callbackData.phone,
                email: callbackData.email
            },
            callback: {
                reason: callbackData.reason,
                preferredTime: callbackData.timing,
                urgency: 'Normal',
                status: 'pending'
            },
            company: {
                name: botConfig.companyName,
                ownerEmail: botConfig.companyOwnerEmail,
                phone: botConfig.companyPhone || '',
                website: botConfig.companyWebsite || '',
                address: '',
                tagline: '',
                logo: ''
            }
        }, (response) => {
            hideTypingIndicator();
            
            if (response.success) {
                addBotMessage('We\'ve scheduled your callback for [chosen time]. One of our team members will be in touch. Thank you for reaching out!'.replace('[chosen time]', callbackData.timing));
                
                setTimeout(() => {
                    addBotMessage("Is there anything else I can help you with today? 😊");
                    setTimeout(() => {
                        showAppointmentOptions();
                    }, 1000);
                }, 2000);
            } else {
                addBotMessage("❌ " + (response.message || "Sorry, there was an error scheduling your callback. Please try again."));
                
                setTimeout(() => {
                    addBotMessage("Would you like to try scheduling again?");
                    showAppointmentOptions();
                }, 2000);
            }
        });
    }
    
    function showAppointmentSuggestions(suggestions, availableSlots) {
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'flossy-suggestions flossy-slide-in';
        suggestionsDiv.style.cssText = 'margin-bottom:16px;';
        
        let suggestionsHTML = '<div style="margin-bottom:12px;font-weight:bold;color:#374151;">Here are some available times:</div>';
        
        // Show smart suggestions first
        if (suggestions && suggestions.length > 0) {
            suggestions.forEach((suggestion, index) => {
                suggestionsHTML += `
                    <div class="flossy-suggestion" data-time="${suggestion.time}" data-date="${formData.preferredDate}"
                         style="background:#f8fafc;border:1px solid #e5e7eb;padding:12px;border-radius:12px;margin-bottom:8px;cursor:pointer;transition:all 0.3s ease;display:flex;align-items:center;gap:12px;">
                        <div style="width:20px;height:20px;border-radius:50%;border:2px solid ${botConfig.themeColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                            <div style="width:12px;height:12px;border-radius:50%;background:${botConfig.themeColor};opacity:0;transform:scale(0);transition:all 0.2s ease;"></div>
                        </div>
                        <div style="flex:1;">
                            <div style="font-size:14px;color:#374151;font-weight:500;margin-bottom:2px;">${suggestion.displayTime}</div>
                            <div style="font-size:12px;color:#6b7280;">${suggestion.message}</div>
                        </div>
                    </div>
                `;
            });
        }
        
        // Show available slots if we have them
        if (availableSlots && availableSlots.length > 0) {
            suggestionsHTML += '<div style="margin-top:16px;margin-bottom:8px;font-weight:bold;color:#374151;">Or choose from all available times:</div>';
            
            availableSlots.slice(0, 6).forEach(slot => {
                suggestionsHTML += `
                    <div class="flossy-slot" data-time="${slot.time}" data-date="${formData.preferredDate}"
                         style="background:#f0f9ff;border:1px solid #0ea5e9;padding:8px 12px;border-radius:8px;margin-bottom:6px;cursor:pointer;transition:all 0.3s ease;display:inline-block;margin-right:8px;font-size:12px;color:#0369a1;">
                        ${slot.displayTime}
                    </div>
                `;
            });
        }
        
        suggestionsDiv.innerHTML = suggestionsHTML;
        messagesContainer.appendChild(suggestionsDiv);
        scrollToBottom();
        
        // Add event listeners for suggestions
        suggestionsDiv.querySelectorAll('.flossy-suggestion, .flossy-slot').forEach(suggestion => {
            suggestion.addEventListener('click', function() {
                const selectedTime = this.getAttribute('data-time');
                const selectedDate = this.getAttribute('data-date');
                
                // Update form data with selected time
                formData.preferredTime = selectedTime;
                formData.preferredDate = selectedDate;
                
                // Remove suggestions
                suggestionsDiv.remove();
                
                // Show confirmation
                addUserMessage(`I'd like to book for ${selectedDate} at ${selectedTime}`);
                
                // Book the appointment
                const typingDiv = showTypingIndicator();
                
                // Get user's timezone
                const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                
                sendToWebhook({
                    type: 'appointment_booking',
                    botId: botConfig.botId,
                    formData: formData,
                    userTimezone: userTimezone,
                    timestamp: new Date().toISOString()
                }, (response) => {
                    hideTypingIndicator();
                    
                    if (response.success) {
                        addBotMessage("✅ Perfect! Your appointment has been booked successfully. You'll receive a confirmation email shortly.");
                        
                        setTimeout(() => {
                            addBotMessage("Is there anything else I can help you with today? 😊");
                        }, 2000);
                    } else {
                        addBotMessage("❌ Sorry, that time slot is no longer available. Please try another time.");
                        setTimeout(() => {
                            showAppointmentSuggestions(response.suggestions, response.availableSlots);
                        }, 1000);
                    }
                });
            });
            
            // Add hover effects
            suggestion.addEventListener('mouseenter', function() {
                this.style.borderColor = '#d1d5db';
                this.style.transform = 'scale(1.02)';
                this.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                const innerCircle = this.querySelector('div div');
                if (innerCircle) {
                    innerCircle.style.opacity = '1';
                    innerCircle.style.transform = 'scale(1)';
                }
            });
            
            suggestion.addEventListener('mouseleave', function() {
                this.style.borderColor = this.classList.contains('flossy-slot') ? '#0ea5e9' : '#e5e7eb';
                this.style.transform = 'scale(1)';
                this.style.boxShadow = 'none';
                const innerCircle = this.querySelector('div div');
                if (innerCircle) {
                    innerCircle.style.opacity = '0';
                    innerCircle.style.transform = 'scale(0)';
                }
            });
        });
    }
    
    function sendToWebhook(data, callback) {
        if (!botConfig.webhookUrl) return;
        
        fetch(botConfig.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(result => {
            if (callback) callback(result);
        })
        .catch(err => {
            console.log('Webhook error:', err);
            if (callback) {
                callback({
                    success: false,
                    message: 'Network error. Please try again.'
                });
            }
        });
    }
    
    function sendToTreatmentWebhook(data, callback) {
        if (!botConfig.gmailBrochureUrl) {
            console.log('No treatment webhook URL configured');
            return;
        }
        
        console.log('Sending treatment webhook:', data);
        
        fetch(botConfig.gmailBrochureUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
            mode: 'cors'
        })
        .then(response => {
            console.log('Treatment webhook response status:', response.status);
            console.log('Treatment webhook response headers:', response.headers);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // Check if response has content
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return response.json();
            } else {
                // If no JSON content, return success response
                console.log('No JSON response, treating as success');
                return { success: true, message: 'Request processed successfully' };
            }
        })
        .then(result => {
            console.log('Treatment webhook result:', result);
            if (callback) callback(result);
        })
        .catch(err => {
            console.error('Treatment webhook error details:', err);
            console.error('Error name:', err.name);
            console.error('Error message:', err.message);
            console.error('Error stack:', err.stack);
            if (callback) {
                callback({
                    success: false,
                    message: 'Network error: ' + err.message
                });
            }
        });
    }
    
    function sendToCallbackWebhook(data, callback) {
        if (!botConfig.gmailCallbackUrl) {
            console.log('No callback webhook URL configured');
            return;
        }
        
        console.log('Sending callback webhook:', data);
        
        fetch(botConfig.gmailCallbackUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
            mode: 'cors'
        })
        .then(response => {
            console.log('Callback webhook response status:', response.status);
            console.log('Callback webhook response headers:', response.headers);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // Check if response has content
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return response.json();
            } else {
                // If no JSON content, return success response
                console.log('No JSON response, treating as success');
                return { success: true, message: 'Request processed successfully' };
            }
        })
        .then(result => {
            console.log('Callback webhook result:', result);
            if (callback) callback(result);
        })
        .catch(err => {
            console.error('Callback webhook error details:', err);
            console.error('Error name:', err.name);
            console.error('Error message:', err.message);
            console.error('Error stack:', err.stack);
            if (callback) {
                callback({
                    success: false,
                    message: 'Network error: ' + err.message
                });
            }
        });
    }
    
    // Event listeners
    bubble.addEventListener('click', toggleChat);
    bubble.addEventListener('mouseenter', () => {
        bubble.style.transform = 'scale(1.1)';
        bubble.style.boxShadow = '0 8px 25px rgba(0,0,0,0.25)';
    });
    bubble.addEventListener('mouseleave', () => {
        bubble.style.transform = 'scale(1)';
        bubble.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    });
    
    header.querySelector('.flossy-close-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleChat();
    });
    
    // Input handling
    const input = inputArea.querySelector('.flossy-input');
    const sendBtn = inputArea.querySelector('.flossy-send-btn');
    
    function sendMessage() {
        const message = input.value.trim();
        if (message) {
            addUserMessage(message);
            input.value = '';
            
            // Check if user typed "callback" during treatment flow
            if (currentWorkflow === 'treatment' && message.toLowerCase().includes('callback')) {
                const typingDiv = showTypingIndicator();
                setTimeout(() => {
                    hideTypingIndicator();
                    addBotMessage('You\'d like a callback from our team—happy to arrange that! Could you please provide your name and the best phone number to reach you?');
                    setTimeout(() => {
                        currentWorkflow = 'callback';
                        startCallbackFlow();
                    }, 1000);
                }, 1000);
            } else {
                const typingDiv = showTypingIndicator();
                setTimeout(() => {
                    hideTypingIndicator();
                    addBotMessage(`Thanks for your message: "${message}". How else can I help?`);
                }, 1000);
            }
        }
    }
    
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => e.key === 'Enter' && sendMessage());
    
    // Device visibility
    function checkDeviceVisibility() {
        const isMobile = window.innerWidth <= 768;
        const shouldShow = isMobile ? botConfig.showMobile : botConfig.showDesktop;
        widget.style.display = shouldShow ? 'block' : 'none';
    }
    
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(checkDeviceVisibility, 100);
    });
    
    checkDeviceVisibility();
    document.body.appendChild(widget);
    
    // Expose minimal API
    window.flossyWidget = {
        open: () => !isOpen && toggleChat(),
        close: () => isOpen && toggleChat(),
        toggle: toggleChat
    };
})();
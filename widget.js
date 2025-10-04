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
        appointmentOptions: [
            { text: 'Request an appointment', type: 'appointment' }
        ],
        appointmentGreeting: 'Hello! I can help you book an appointment.',
        confirmationMessages: {
            success: '✅ I\'ve reserved your appointment. You\'ll receive a confirmation email shortly.',
            unavailable: '❌ That time isn\'t available. Please choose another time.'
        },
        privacyPolicyUrl: '',
        webhookUrl: 'https://your-domain.com/webhook/appointment',
        appointmentFlow: {
            fields: [
                { name: 'fullName', type: 'text', label: 'Full Name', required: true },
                { name: 'contact', type: 'email', label: 'Email Address', required: true },
                { name: 'phone', type: 'tel', label: 'Phone Number', required: true },
                { name: 'preferredDate', type: 'date', label: 'Preferred Date', required: true },
                { name: 'preferredTime', type: 'time', label: 'Preferred Time', required: true }
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
        .flossy-form-field{margin:10px 0;padding:12px 16px;border:2px solid #e5e7eb;border-radius:12px;font-size:16px;transition:all 0.3s ease;width:100%}
        .flossy-form-field:focus{outline:none;border-color:${botConfig.themeColor};box-shadow:0 0 0 3px ${botConfig.themeColor}20;transform:scale(1.02)}
        .flossy-submit-btn{background:${botConfig.themeColor};color:white;border:none;padding:10px 20px;border-radius:12px;cursor:pointer;font-weight:bold;transition:all 0.3s ease}
        .flossy-submit-btn:hover{opacity:0.9;transform:translateY(-1px)}
        .flossy-submit-btn:disabled{opacity:0.6;cursor:not-allowed;transform:none}
        .flossy-close-btn:hover{background:rgba(255,255,255,0.3) !important}
        .flossy-send-btn:hover{transform:scale(1.05);box-shadow:0 4px 8px rgba(0,0,0,0.15) !important}
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
    inputArea.style.cssText = `padding:24px;border-top:1px solid #f3f4f6;background:white;`;
    inputArea.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center;">
            <div style="flex:1;background:#f3f4f6;border-radius:20px;padding:12px 16px;">
                <input class="flossy-input" type="text" placeholder="Type your message..." style="width:100%;background:transparent;border:none;outline:none;font-size:14px;color:#374151;" />
            </div>
            <button class="flossy-send-btn" style="background:${botConfig.themeColor};color:white;border:none;padding:12px;border-radius:50%;cursor:pointer;width:40px;height:40px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="stroke-width:2">
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
        botConfig.appointmentOptions.forEach(option => {
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
            const typingDiv = showTypingIndicator();
            setTimeout(() => {
                hideTypingIndicator();
                addBotMessage(botConfig.appointmentGreeting);
                setTimeout(() => {
                    startAppointmentFlow();
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
            completeAppointment();
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
            <input class="flossy-form-field" type="${inputType}" placeholder="${placeholder}" 
                   ${field.required ? 'required' : ''}>
        `;
        
        messagesContainer.appendChild(fieldDiv);
        scrollToBottom();
        
        const input = fieldDiv.querySelector('.flossy-form-field');
        
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
                    response = `Thanks ${value}! 😊`;
                } else if (field.name === 'contact') {
                    response = `Perfect! I have your email as ${value}.`;
                    if (botConfig.privacyPolicyUrl) {
                        response += `\n\nWe take privacy and your data very seriously and do not share it. See our <a href="${botConfig.privacyPolicyUrl}" target="_blank" style="color:${botConfig.themeColor};">privacy policy</a>.`;
                    }
                } else if (field.name === 'phone') {
                    response = `Great! I have your phone number.`;
                } else if (field.name === 'preferredDate') {
                    response = `Excellent! You'd like to book for ${value}.`;
                } else if (field.name === 'preferredTime') {
                    response = `Perfect! Let me check availability for ${value}.`;
                }
                
                addBotMessage(response);
                
                // Move to next field
                currentFormStep++;
                setTimeout(() => {
                    showNextFormField();
                }, 1000);
            }, 800);
        }
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                submitField();
            }
        });
    }
    
    function completeAppointment() {
        const typingDiv = showTypingIndicator();
        
        // Send to webhook
        sendToWebhook({
            type: 'appointment_booking',
            botId: botConfig.botId,
            formData: formData,
            timestamp: new Date().toISOString()
        });
        
        setTimeout(() => {
            hideTypingIndicator();
            
            // Show confirmation message
            const confirmationMessage = botConfig.confirmationMessages.success
                .replace('[chosen date/time]', `${formData.preferredDate} at ${formData.preferredTime}`);
            
            addBotMessage(confirmationMessage);
            
            setTimeout(() => {
                addBotMessage("Is there anything else I can help you with today? 😊");
            }, 2000);
        }, 2000);
    }
    
    function sendToWebhook(data) {
        if (!botConfig.webhookUrl) return;
        
        fetch(botConfig.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        }).catch(err => console.log('Webhook error:', err));
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
            
            const typingDiv = showTypingIndicator();
            setTimeout(() => {
                hideTypingIndicator();
                addBotMessage(`Thanks for your message: "${message}". How else can I help?`);
            }, 1000);
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
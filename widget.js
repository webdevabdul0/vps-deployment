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
    webhookUrl: 'https://your-domain.com/webhook/appointment'
  };

  // Merge configurations
  const botConfig = { ...defaultConfig, ...config };

  // Lightweight CSS (minified for performance)
  const styles = `
    @keyframes flossySlideIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    @keyframes flossyFadeIn{from{opacity:0}to{opacity:1}}
    .flossy-widget *{box-sizing:border-box}
    .flossy-widget{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
    .flossy-slide-in{animation:flossySlideIn 0.3s ease-out}
    .flossy-fade-in{animation:flossyFadeIn 0.3s ease-out}
    .flossy-widget::-webkit-scrollbar{width:6px}
    .flossy-widget::-webkit-scrollbar-track{background:#f1f1f1}
    .flossy-widget::-webkit-scrollbar-thumb{background:#c1c1c1;border-radius:3px}
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
    width:60px;height:60px;background:${botConfig.themeColor};border-radius:50%;
    cursor:pointer;display:flex;align-items:center;justify-content:center;
    box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:transform 0.3s ease;position:relative;
  `;
  bubble.innerHTML = `<svg width="24" height="24" fill="white" viewBox="0 0 24 24"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg><div style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;background:#ef4444;border-radius:50%;display:flex;align-items:center;justify-content:center;"><span style="color:white;font-size:10px;font-weight:bold;">1</span></div>`;

  // Create chat window
  const chatWindow = document.createElement('div');
  chatWindow.style.cssText = `
    position:absolute;bottom:70px;${botConfig.position === 'left' ? 'left' : 'right'}:0;
    width:350px;height:500px;background:white;border-radius:16px;
    box-shadow:0 10px 25px rgba(0,0,0,0.2);display:none;flex-direction:column;overflow:hidden;
  `;

  // Create header
  const header = document.createElement('div');
  header.style.cssText = `background:${botConfig.themeColor};color:white;padding:16px;display:flex;align-items:center;gap:12px;`;
  header.innerHTML = `<img src="${botConfig.avatar}" alt="Bot" style="width:40px;height:40px;border-radius:50%;border:2px solid rgba(255,255,255,0.3);"><div style="flex:1;"><div style="font-weight:600;font-size:16px;">${botConfig.name}</div><div style="font-size:12px;opacity:0.8;">Online now</div></div><button class="flossy-close-btn" style="background:rgba(255,255,255,0.2);border:none;color:white;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px;">×</button>`;

  // Create messages container
  const messagesContainer = document.createElement('div');
  messagesContainer.className = 'flossy-messages';
  messagesContainer.style.cssText = `flex:1;padding:16px;overflow-y:auto;background:#f9fafb;`;

  // Create input area
  const inputArea = document.createElement('div');
  inputArea.style.cssText = `padding:16px;border-top:1px solid #e5e7eb;background:white;`;
  inputArea.innerHTML = `<div style="display:flex;gap:8px;align-items:center;"><input type="text" placeholder="Type a message..." class="flossy-input" style="flex:1;padding:12px 16px;border:1px solid #d1d5db;border-radius:24px;outline:none;font-size:14px;"><button class="flossy-send-btn" style="width:40px;height:40px;background:${botConfig.themeColor};border:none;border-radius:50%;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;"><svg width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="m12 19 9 2-9-18-9 18 9-2zm0 0v-8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></button></div>`;

  // Assemble widget
  chatWindow.appendChild(header);
  chatWindow.appendChild(messagesContainer);
  chatWindow.appendChild(inputArea);
  widget.appendChild(bubble);
  widget.appendChild(chatWindow);

  // Widget state
  let isOpen = false;
  let initialized = false;

  // Core functions (optimized for performance)
  function toggleChat() {
    isOpen = !isOpen;
    chatWindow.style.display = isOpen ? 'flex' : 'none';
    if (isOpen && !initialized) {
      setTimeout(initializeChat, 100); // Defer initialization
      initialized = true;
    }
  }

  function initializeChat() {
    messagesContainer.innerHTML = '';
    botConfig.openingMessages.forEach((msg, index) => {
      setTimeout(() => {
        addBotMessage(msg.text, msg.showAvatar);
        if (index === botConfig.openingMessages.length - 1) {
          setTimeout(showAppointmentOptions, 1000);
        }
      }, index * 1200); // Slightly faster for better UX
    });
  }

  function addBotMessage(text, showAvatar = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'flossy-slide-in';
    messageDiv.style.cssText = 'display:flex;gap:8px;margin-bottom:16px;';
    messageDiv.innerHTML = `${showAvatar ? `<img src="${botConfig.avatar}" alt="Bot" style="width:32px;height:32px;border-radius:50%;flex-shrink:0;">` : '<div style="width:32px;"></div>'}<div style="background:white;padding:12px 16px;border-radius:16px;border-top-left-radius:4px;max-width:250px;box-shadow:0 1px 2px rgba(0,0,0,0.1);"><div style="font-size:14px;color:#374151;line-height:1.4;">${text}</div><div style="font-size:11px;color:#9ca3af;margin-top:4px;">Just now</div></div>`;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function addUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'flossy-slide-in';
    messageDiv.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:16px;';
    messageDiv.innerHTML = `<div style="background:${botConfig.themeColor};color:white;padding:12px 16px;border-radius:16px;border-top-right-radius:4px;max-width:250px;"><div style="font-size:14px;line-height:1.4;">${text}</div><div style="font-size:11px;opacity:0.8;margin-top:4px;">Just now</div></div>`;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function showAppointmentOptions() {
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'flossy-slide-in';
    optionsDiv.style.cssText = 'margin-bottom:16px;';
    
    let optionsHTML = '<div style="font-size:14px;color:#6b7280;margin-bottom:12px;padding-left:40px;">Please select an option:</div>';
    botConfig.appointmentOptions.forEach(option => {
      optionsHTML += `<div class="flossy-option" data-type="${option.type}" data-text="${option.text}" style="margin:8px 0;margin-left:40px;padding:12px 16px;background:${botConfig.themeColor}15;border:1px solid ${botConfig.themeColor}30;border-radius:12px;cursor:pointer;transition:all 0.2s;font-size:14px;color:${botConfig.themeColor};">${option.text}</div>`;
    });
    
    optionsDiv.innerHTML = optionsHTML;
    messagesContainer.appendChild(optionsDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Add event listeners
    optionsDiv.querySelectorAll('.flossy-option').forEach(option => {
      option.addEventListener('click', function() {
        const type = this.getAttribute('data-type');
        const text = this.getAttribute('data-text');
        selectOption(type, text);
      });
      option.addEventListener('mouseenter', function() {
        this.style.transform = 'scale(1.02)';
        this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      });
      option.addEventListener('mouseleave', function() {
        this.style.transform = 'scale(1)';
        this.style.boxShadow = 'none';
      });
    });
  }

  function selectOption(type, text) {
    // Remove options
    const optionsDiv = messagesContainer.querySelector('.flossy-slide-in:last-child');
    if (optionsDiv) optionsDiv.remove();

    addUserMessage(text);

    if (type === 'appointment') {
      setTimeout(() => {
        addBotMessage(botConfig.appointmentGreeting);
        setTimeout(() => {
          // Send to webhook (optimized fetch)
          sendToWebhook({
            type: 'appointment_request',
            botId: botConfig.botId,
            userSelection: text,
            timestamp: new Date().toISOString()
          });
          addBotMessage('I\'ll help you book an appointment. Please wait while I connect you...');
        }, 1000);
      }, 500);
    }
  }

  // Optimized webhook function
  function sendToWebhook(data) {
    if (!botConfig.webhookUrl) return;
    
    fetch(botConfig.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch(err => console.log('Webhook error:', err)); // Silent fail for UX
  }

  // Event listeners (optimized)
  bubble.addEventListener('click', toggleChat);
  bubble.addEventListener('mouseenter', () => bubble.style.transform = 'scale(1.1)');
  bubble.addEventListener('mouseleave', () => bubble.style.transform = 'scale(1)');
  
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
      setTimeout(() => addBotMessage(`Thanks for your message: "${message}". How else can I help?`), 1000);
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keypress', (e) => e.key === 'Enter' && sendMessage());

  // Device visibility (optimized)
  function checkDeviceVisibility() {
    const isMobile = window.innerWidth <= 768;
    const shouldShow = isMobile ? botConfig.showMobile : botConfig.showDesktop;
    widget.style.display = shouldShow ? 'block' : 'none';
  }

  // Throttled resize listener for performance
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

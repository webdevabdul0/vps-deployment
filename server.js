/**
 * Flossy Chat Widget Server - Optimized for Shared VPS
 * Lightweight Express server designed to run alongside n8n
 */

// Load environment variables
require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const { google } = require('googleapis');
const fs = require('fs');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001; // Different port from n8n (usually 5678)

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://widget.flossly.ai/oauth2/callback';

// Validate required environment variables
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error('❌ Missing required environment variables:');
  console.error('   GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set');
  console.error('   Please check your .env file or environment variables');
  process.exit(1);
}

// Initialize Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

// Simple JSON file storage
const DATA_FILE = './flossy_data.json';

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({
    clients: {},
    google_tokens: {},
    appointments: []
  }, null, 2));
}

// Helper functions for JSON storage
const readData = () => {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data file:', error);
    return { clients: {}, google_tokens: {}, appointments: [] };
  }
};

const writeData = (data) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing data file:', error);
    return false;
  }
};

// Helper function to generate available time slots
function generateAvailableSlots(date, events, duration, userTimezone = 'UTC') {
  const slots = [];
  const startHour = 9; // 9 AM
  const endHour = 17; // 5 PM
  const interval = 30; // 30 minutes
  
  // Convert events to time ranges in the user's timezone
  const busyTimes = events.map(event => {
    const start = new Date(event.start.dateTime || event.start.date);
    const end = new Date(event.end.dateTime || event.end.date);
    
    // Convert to user's timezone for comparison
    const startInUserTz = new Date(start.toLocaleString("en-US", {timeZone: userTimezone}));
    const endInUserTz = new Date(end.toLocaleString("en-US", {timeZone: userTimezone}));
    
    return {
      start: startInUserTz.getTime(),
      end: endInUserTz.getTime()
    };
  });
  
  console.log('Slot generation for user timezone:', {
    date,
    userTimezone,
    busyTimes: busyTimes.map(bt => ({
      start: new Date(bt.start).toLocaleString("en-US", {timeZone: userTimezone}),
      end: new Date(bt.end).toLocaleString("en-US", {timeZone: userTimezone})
    }))
  });
  
  // Generate slots from 9 AM to 5 PM in the user's timezone
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += interval) {
      const slotTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      // Create slot time in user's timezone
      const slotStart = new Date(`${date}T${slotTime}:00`);
      const slotEnd = new Date(slotStart.getTime() + duration * 60000);
      
      // Check if this slot conflicts with any existing events
      const isAvailable = !busyTimes.some(busy => {
        return (slotStart.getTime() < busy.end && slotEnd.getTime() > busy.start);
      });
      
      if (isAvailable) {
        slots.push({
          time: slotTime,
          displayTime: formatTime(hour, minute),
          available: true
        });
      }
    }
  }
  
  return slots;
}

// Helper function to format time for display
function formatTime(hour, minute) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

// Helper function to generate smart appointment suggestions
function generateSmartSuggestions(preferredDate, preferredTime, availableSlots, existingEvents) {
  const suggestions = [];
  const preferredDateTime = new Date(`${preferredDate}T${preferredTime}`);
  
  // Find the closest available times
  const sortedSlots = availableSlots
    .map(slot => ({
      ...slot,
      timeValue: new Date(`${preferredDate}T${slot.time}`).getTime()
    }))
    .sort((a, b) => Math.abs(a.timeValue - preferredDateTime.getTime()) - Math.abs(b.timeValue - preferredDateTime.getTime()));
  
  // Add top 3 closest suggestions
  const topSuggestions = sortedSlots.slice(0, 3);
  
  topSuggestions.forEach((slot, index) => {
    const timeDiff = Math.abs(slot.timeValue - preferredDateTime.getTime());
    const hoursDiff = Math.round(timeDiff / (1000 * 60 * 60));
    const minutesDiff = Math.round(timeDiff / (1000 * 60));
    
    let message = '';
    if (minutesDiff < 60) {
      message = `How about ${slot.displayTime}? (${minutesDiff} minutes ${slot.timeValue > preferredDateTime.getTime() ? 'later' : 'earlier'})`;
    } else {
      message = `How about ${slot.displayTime}? (${hoursDiff} hour${hoursDiff > 1 ? 's' : ''} ${slot.timeValue > preferredDateTime.getTime() ? 'later' : 'earlier'})`;
    }
    
    suggestions.push({
      time: slot.time,
      displayTime: slot.displayTime,
      message: message,
      priority: index + 1
    });
  });
  
  // Add alternative day suggestions if we have very few slots
  if (availableSlots.length < 3) {
    const tomorrow = new Date(preferredDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    suggestions.push({
      time: '09:00',
      displayTime: '9:00 AM',
      message: `We have more availability tomorrow (${tomorrow.toLocaleDateString()}). Would you like to book for tomorrow?`,
      priority: 4,
      alternativeDay: true
    });
  }
  
  return suggestions;
}

// Middleware (optimized for performance)
app.use(compression()); // Gzip compression
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000', 
      'http://localhost:4173',
      'https://widget.flossly.ai',
      'https://flossly.ai',
      'http://213.165.249.205:3001',
      'https://213.165.249.205:3001'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins for now
    }
  },
  methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
  credentials: true
}));

// JSON parsing with size limit (prevent abuse)
app.use(express.json({ limit: '1mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Serve widget.js with aggressive caching
app.get('/widget.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=7200'); // 1hr browser, 2hr CDN
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Vary', 'Accept-Encoding');
  
  // Serve compressed if available
  res.sendFile(path.join(__dirname, 'widget.js'));
});

// Health check (lightweight)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage().rss / 1024 / 1024 // MB
  });
});

// No encryption for now - store tokens as plain text

// Google OAuth endpoints
app.get('/oauth2/authorize/:clientId', (req, res) => {
  const { clientId } = req.params;
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    prompt: 'consent',
    state: clientId // Pass client ID in state for callback
  });
  
  res.json({ authUrl });
});

app.get('/oauth2/callback', async (req, res) => {
  console.log('=== OAUTH CALLBACK HIT ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Query params:', req.query);
  console.log('Headers:', req.headers);
  
  const { code, state } = req.query;
  const clientId = state;
  
  console.log('OAuth callback received:', { code: code ? 'present' : 'missing', state, clientId });
  console.log('Full request URL:', req.url);
  
  if (!code || !clientId) {
    console.error('Missing authorization code or client ID:', { code: !!code, clientId: !!clientId });
    return res.status(400).json({ error: 'Missing authorization code or client ID' });
  }
  
  try {
    console.log('Attempting to exchange authorization code for tokens...');
    const { tokens } = await oauth2Client.getToken(code);
    console.log('Tokens received successfully:', { 
      hasAccessToken: !!tokens.access_token, 
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expiry_date 
    });
    
    // Store tokens in JSON file (no encryption for now)
    console.log('Storing tokens in JSON file for clientId:', clientId);
    const data = readData();
    console.log('Current data before storing:', JSON.stringify(data, null, 2));
    
    data.google_tokens[clientId] = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      scope: tokens.scope,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('Data after adding tokens:', JSON.stringify(data, null, 2));
    
    if (writeData(data)) {
      console.log('Tokens stored successfully for clientId:', clientId);
      console.log('Final data file contents:', JSON.stringify(readData(), null, 2));
      
      // Send HTML response that communicates with parent window
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Google Calendar Connected</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .container {
              text-align: center;
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .success { color: #10b981; font-size: 48px; margin-bottom: 20px; }
            .message { color: #374151; font-size: 18px; margin-bottom: 10px; }
            .subtitle { color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✅</div>
            <div class="message">Google Calendar Connected Successfully!</div>
            <div class="subtitle">You can close this window and return to your bot builder.</div>
          </div>
          <script>
            // Notify parent window of success
            if (window.opener) {
              window.opener.postMessage({
                type: 'GOOGLE_OAUTH_SUCCESS',
                clientId: '${clientId}'
              }, '*');
            }
            
            // Auto-close after 2 seconds
            setTimeout(() => {
              window.close();
            }, 2000);
          </script>
        </body>
        </html>
      `);
    } else {
      console.error('Failed to write data to file');
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Error</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .container {
              text-align: center;
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .error { color: #ef4444; font-size: 48px; margin-bottom: 20px; }
            .message { color: #374151; font-size: 18px; margin-bottom: 10px; }
            .subtitle { color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error">❌</div>
            <div class="message">Failed to store tokens</div>
            <div class="subtitle">Please try again.</div>
          </div>
          <script>
            // Notify parent window of error
            if (window.opener) {
              window.opener.postMessage({
                type: 'GOOGLE_OAUTH_ERROR',
                error: 'Failed to store tokens'
              }, '*');
            }
            
            // Auto-close after 3 seconds
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
        </html>
      `);
    }
    
  } catch (error) {
    console.error('OAuth error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      response: error.response?.data
    });
    res.status(500).json({ 
      error: 'Failed to exchange authorization code',
      details: error.message 
    });
  }
});

// Disconnect Google Calendar
app.delete('/api/calendar/disconnect/:clientId', (req, res) => {
  const { clientId } = req.params;
  
  try {
    const data = readData();
    if (data.google_tokens[clientId]) {
      delete data.google_tokens[clientId];
      if (writeData(data)) {
        console.log('Google Calendar disconnected for clientId:', clientId);
        res.json({ success: true, message: 'Google Calendar disconnected successfully' });
      } else {
        res.status(500).json({ error: 'Failed to save changes' });
      }
    } else {
      res.status(404).json({ error: 'No Google Calendar connection found' });
    }
  } catch (error) {
    console.error('Error disconnecting Google Calendar:', error);
    res.status(500).json({ error: 'Failed to disconnect Google Calendar' });
  }
});

// Check Google Calendar connection status
app.get('/api/calendar/status/:clientId', (req, res) => {
  const { clientId } = req.params;
  
  try {
    const data = readData();
    const tokenData = data.google_tokens[clientId];
    
    if (!tokenData) {
      return res.json({ connected: false });
    }
    
    // Check if token is expired
    const now = Date.now();
    const isExpired = tokenData.expiry_date && now >= tokenData.expiry_date;
    
    res.json({
      connected: true,
      expired: isExpired,
      scope: tokenData.scope,
      connectedAt: tokenData.created_at
    });
  } catch (error) {
    console.error('Error checking calendar status:', error);
    res.status(500).json({ error: 'Failed to check calendar status' });
  }
});

// Refresh Google Calendar token
app.post('/api/calendar/refresh/:clientId', async (req, res) => {
  const { clientId } = req.params;
  
  db.get(
    'SELECT * FROM google_tokens WHERE client_id = ?',
    [clientId],
    async (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'No tokens found for client' });
      }
      
      try {
        const refreshToken = decrypt(row.refresh_token);
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        // Update tokens in database
        const encryptedAccessToken = encrypt(credentials.access_token);
        const encryptedRefreshToken = credentials.refresh_token ? 
          encrypt(credentials.refresh_token) : row.refresh_token;
        
        db.run(
          `UPDATE google_tokens 
           SET access_token = ?, refresh_token = ?, expiry_date = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE client_id = ?`,
          [encryptedAccessToken, encryptedRefreshToken, credentials.expiry_date, clientId],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Failed to update tokens' });
            }
            
            res.json({ success: true, message: 'Token refreshed successfully' });
          }
        );
        
      } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: 'Failed to refresh token' });
      }
    }
  );
});

// Create Google Calendar event
app.post('/api/calendar/create-event/:clientId', async (req, res) => {
  const { clientId } = req.params;
  const { customerName, customerEmail, customerPhone, appointmentDate, appointmentTime, duration = 60, userTimezone = 'UTC' } = req.body;
  
  if (!customerName || !customerEmail || !appointmentDate || !appointmentTime) {
    return res.status(400).json({ error: 'Missing required appointment details' });
  }
  
  try {
    const data = readData();
    const tokenData = data.google_tokens[clientId];
    
    if (!tokenData) {
      return res.status(404).json({ error: 'Google Calendar not connected' });
    }
    
    // Set up OAuth2 client
    oauth2Client.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token
    });
    
    // Create calendar service
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Parse appointment date and time in user's timezone
    // Create the datetime string in the user's timezone format
    const startDateTimeStr = `${appointmentDate}T${appointmentTime}:00`;
    const endDateTimeStr = `${appointmentDate}T${String(parseInt(appointmentTime.split(':')[0]) + Math.floor(duration / 60)).padStart(2, '0')}:${String((parseInt(appointmentTime.split(':')[1]) + (duration % 60)) % 60).padStart(2, '0')}:00`;
    
    console.log('Creating event with:', {
      userTimezone,
      startDateTimeStr,
      endDateTimeStr,
      duration
    });
    
    // Create event in user's timezone
    const event = {
      summary: `Appointment - ${customerName}`,
      description: `Appointment booked via chatbot\n\nCustomer: ${customerName}\nEmail: ${customerEmail}\nPhone: ${customerPhone}`,
      start: {
        dateTime: startDateTimeStr,
        timeZone: userTimezone,
      },
      end: {
        dateTime: endDateTimeStr,
        timeZone: userTimezone,
      },
      attendees: [
        { email: customerEmail, displayName: customerName }
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 30 }, // 30 minutes before
        ],
      },
    };
    
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });
    
    res.json({
      success: true,
      message: 'Appointment created successfully',
      eventId: response.data.id,
      eventLink: response.data.htmlLink
    });
    
  } catch (error) {
    console.error('Calendar API error:', error);
    
    // If token is expired, try to refresh
    if (error.code === 401) {
      try {
        const data = readData();
        const tokenData = data.google_tokens[clientId];
        
        if (!tokenData || !tokenData.refresh_token) {
          return res.status(401).json({ error: 'Google Calendar authentication expired. Please reconnect.' });
        }
        
        oauth2Client.setCredentials({ refresh_token: tokenData.refresh_token });
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        // Update tokens in data
        data.google_tokens[clientId] = {
          ...tokenData,
          access_token: credentials.access_token,
          updated_at: new Date().toISOString()
        };
        writeData(data);
        
        // Retry the calendar event creation
        oauth2Client.setCredentials({ access_token: credentials.access_token });
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        
        // Create the datetime string in the user's timezone format
        const startDateTimeStr = `${appointmentDate}T${appointmentTime}:00`;
        const endDateTimeStr = `${appointmentDate}T${String(parseInt(appointmentTime.split(':')[0]) + Math.floor(duration / 60)).padStart(2, '0')}:${String((parseInt(appointmentTime.split(':')[1]) + (duration % 60)) % 60).padStart(2, '0')}:00`;
        
        const event = {
          summary: `Appointment - ${customerName}`,
          description: `Appointment booked via chatbot\n\nCustomer: ${customerName}\nEmail: ${customerEmail}\nPhone: ${customerPhone}`,
          start: { 
            dateTime: startDateTimeStr, 
            timeZone: userTimezone
          },
          end: { 
            dateTime: endDateTimeStr, 
            timeZone: userTimezone
          },
          attendees: [{ email: customerEmail, displayName: customerName }],
          reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 24 * 60 }, { method: 'popup', minutes: 30 }] },
        };
        
        const response = await calendar.events.insert({
          calendarId: 'primary',
          resource: event,
        });
        
        res.json({
          success: true,
          message: 'Appointment created successfully (after token refresh)',
          eventId: response.data.id,
          eventLink: response.data.htmlLink
        });
        
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        res.status(401).json({ error: 'Google Calendar authentication expired. Please reconnect.' });
      }
    } else {
      res.status(500).json({ error: 'Failed to create calendar event' });
    }
  }
});

// Check Google Calendar availability
app.get('/api/calendar/availability/:clientId', async (req, res) => {
  const { clientId } = req.params;
  const { date, duration = 60, userTimezone = 'UTC' } = req.query;
  
  try {
    const data = readData();
    const tokenData = data.google_tokens[clientId];
    
    if (!tokenData) {
      return res.status(404).json({ error: 'Google Calendar not connected' });
    }
    
    // Set up OAuth2 client
    oauth2Client.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token
    });
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Get start and end of day in UTC to avoid timezone issues
    const startOfDay = new Date(date + 'T00:00:00.000Z');
    const endOfDay = new Date(date + 'T23:59:59.999Z');
    
    // Fetch existing events for the day
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });
    
    const events = response.data.items || [];
    
    // Generate available time slots (9 AM to 5 PM, 30-minute intervals)
    // Use the user's timezone for slot generation
    console.log('Availability check debug:', {
      date,
      userTimezone,
      eventsCount: events.length,
      existingEvents: events.map(e => ({
        start: e.start.dateTime || e.start.date,
        end: e.end.dateTime || e.end.date,
        summary: e.summary
      }))
    });
    
    const availableSlots = generateAvailableSlots(date, events, parseInt(duration), userTimezone);
    
    res.json({
      success: true,
      date: date,
      availableSlots: availableSlots,
      existingEvents: events.map(event => ({
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        summary: event.summary
      }))
    });
    
  } catch (error) {
    console.error('Availability check error:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// Get smart appointment suggestions
app.post('/api/calendar/suggestions/:clientId', async (req, res) => {
  const { clientId } = req.params;
  const { preferredDate, preferredTime, duration = 60, userTimezone = 'UTC' } = req.body;
  
  try {
    const data = readData();
    const tokenData = data.google_tokens[clientId];
    
    if (!tokenData) {
      return res.status(404).json({ error: 'Google Calendar not connected' });
    }
    
    // Check availability for the preferred date
    const availabilityResponse = await axios.get(`http://localhost:${PORT}/api/calendar/availability/${clientId}`, {
      params: { date: preferredDate, duration, userTimezone }
    });
    
    const { availableSlots, existingEvents } = availabilityResponse.data;
    
    // Check if preferred time is available
    const preferredDateTime = new Date(`${preferredDate}T${preferredTime}`);
    const isPreferredTimeAvailable = availableSlots.some(slot => {
      const slotTime = new Date(`${preferredDate}T${slot.time}`);
      return Math.abs(slotTime.getTime() - preferredDateTime.getTime()) < 30 * 60 * 1000; // 30 minutes tolerance
    });
    
    // Generate smart suggestions
    const suggestions = generateSmartSuggestions(preferredDate, preferredTime, availableSlots, existingEvents);
    
    res.json({
      success: true,
      preferredTimeAvailable: isPreferredTimeAvailable,
      suggestions: suggestions,
      availableSlots: availableSlots.slice(0, 10) // Limit to first 10 slots
    });
    
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

// Gmail Brochure webhook endpoint
app.post('/webhook/gmail-brochure', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { botId, type, treatment, customer, company } = req.body;
    
    console.log(`[${new Date().toISOString()}] Gmail Brochure webhook:`, {
      botId,
      type,
      treatment: treatment?.name,
      customer: customer?.email,
      company: company?.name,
      ip: req.ip
    });
    
    // Forward to n8n Gmail workflow
    try {
      const n8nResponse = await axios.post('https://n8n.flossly.ai/webhook/gmail-brochure', req.body, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      const responseTime = Date.now() - startTime;
      
      res.json({
        success: true,
        message: 'Brochure request processed successfully',
        n8nResponse: n8nResponse.data,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      });
      
    } catch (n8nError) {
      console.error('n8n Gmail Brochure webhook error:', n8nError.response?.data || n8nError.message);
      
      const responseTime = Date.now() - startTime;
      
      res.json({
        success: false,
        message: 'Brochure request received but email service is temporarily unavailable',
        error: n8nError.response?.data?.error || 'n8n service unavailable',
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Gmail Brochure webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// Gmail Callback webhook endpoint
app.post('/webhook/gmail-callback', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { botId, type, customer, callback, company } = req.body;
    
    console.log(`[${new Date().toISOString()}] Gmail Callback webhook:`, {
      botId,
      type,
      customer: customer?.name,
      callback: callback?.reason,
      company: company?.name,
      ip: req.ip
    });
    
    // Forward to n8n Gmail workflow
    try {
      const n8nResponse = await axios.post('https://n8n.flossly.ai/webhook/gmail-callback', req.body, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      const responseTime = Date.now() - startTime;
      
      res.json({
        success: true,
        message: 'Callback request processed successfully',
        n8nResponse: n8nResponse.data,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      });
      
    } catch (n8nError) {
      console.error('n8n Gmail Callback webhook error:', n8nError.response?.data || n8nError.message);
      
      const responseTime = Date.now() - startTime;
      
      res.json({
        success: false,
        message: 'Callback request received but email service is temporarily unavailable',
        error: n8nError.response?.data?.error || 'n8n service unavailable',
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Gmail Callback webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// Webhook endpoint for appointment bookings
app.post('/webhook/appointment-booking', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { botId, type, formData, timestamp } = req.body;
    
    // Log for debugging
    console.log(`[${new Date().toISOString()}] Appointment webhook:`, {
      botId,
      type,
      formData: formData ? Object.keys(formData) : 'none',
      ip: req.ip
    });
    
    // If it's an appointment booking with form data
    if (type === 'appointment_booking' && formData && formData.fullName && formData.contact && formData.preferredDate && formData.preferredTime) {
      try {
        // Get user timezone from request or default to UTC
        const userTimezone = req.body.userTimezone || 'UTC';
        
        console.log('Using user timezone:', userTimezone);
        // First check availability
        const availabilityResponse = await axios.get(`http://localhost:${PORT}/api/calendar/availability/${botId}`, {
          params: { 
            date: formData.preferredDate, 
            duration: 60,
            userTimezone: userTimezone
          }
        });
        
        const { availableSlots } = availabilityResponse.data;
        const preferredDateTime = new Date(`${formData.preferredDate}T${formData.preferredTime}`);
        
        // Check if preferred time is available
        const isTimeAvailable = availableSlots.some(slot => {
          const slotTime = new Date(`${formData.preferredDate}T${slot.time}`);
          return Math.abs(slotTime.getTime() - preferredDateTime.getTime()) < 30 * 60 * 1000;
        });
        
        if (!isTimeAvailable) {
          // Generate alternative suggestions
          const suggestionsResponse = await axios.post(`http://localhost:${PORT}/api/calendar/suggestions/${botId}`, {
            preferredDate: formData.preferredDate,
            preferredTime: formData.preferredTime,
            duration: 60,
            userTimezone: userTimezone
          });
          
          const responseTime = Date.now() - startTime;
          
          return res.json({
            success: false,
            message: 'Sorry, that time slot is not available.',
            conflict: true,
            suggestions: suggestionsResponse.data.suggestions,
            availableSlots: suggestionsResponse.data.availableSlots,
            responseTime: `${responseTime}ms`,
            timestamp: new Date().toISOString()
          });
        }
        
        // Create Google Calendar event
        const calendarResponse = await axios.post(`http://localhost:${PORT}/api/calendar/create-event/${botId}`, {
          customerName: formData.fullName,
          customerEmail: formData.contact,
          customerPhone: formData.phone || '',
          appointmentDate: formData.preferredDate,
          appointmentTime: formData.preferredTime,
          duration: 60,
          userTimezone: userTimezone
        });
        
        // Store appointment in local data (check for duplicates first)
        const data = readData();
        
        // Check if appointment already exists for this time slot
        const existingAppointment = data.appointments.find(apt => 
          apt.botId === botId && 
          apt.appointmentDate === formData.preferredDate && 
          apt.appointmentTime === formData.preferredTime &&
          apt.customerEmail === formData.contact
        );
        
        if (existingAppointment) {
          console.log('Appointment already exists, skipping duplicate creation');
          const responseTime = Date.now() - startTime;
          
          return res.json({
            success: true,
            message: 'Appointment already exists!',
            appointmentId: existingAppointment.id,
            calendarEvent: calendarResponse.data,
            responseTime: `${responseTime}ms`,
            timestamp: new Date().toISOString()
          });
        }
        
        const appointmentId = `apt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        data.appointments.push({
          id: appointmentId,
          botId: botId,
          customerName: formData.fullName,
          customerEmail: formData.contact,
          customerPhone: formData.phone || '',
          appointmentDate: formData.preferredDate,
          appointmentTime: formData.preferredTime,
          status: 'confirmed',
          googleEventId: calendarResponse.data.eventId,
          createdAt: new Date().toISOString()
        });
        
        writeData(data);
        
        const responseTime = Date.now() - startTime;
        
        res.json({
          success: true,
          message: 'Appointment booked successfully! You will receive a confirmation email shortly.',
          appointmentId: appointmentId,
          calendarEvent: calendarResponse.data,
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString()
        });
        
      } catch (calendarError) {
        console.error('Calendar booking error:', calendarError.response?.data || calendarError.message);
        
        const responseTime = Date.now() - startTime;
        
        res.json({
          success: false,
          message: 'Appointment request received but Google Calendar is not connected. Please contact us directly.',
          botId: botId,
          calendarError: calendarError.response?.data?.error || 'Calendar not connected',
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      // For non-appointment requests or incomplete data
      const responseTime = Date.now() - startTime;
      
      res.json({
        success: true,
        message: 'Request received',
        botId: botId,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// Metrics endpoint (for monitoring)
app.get('/metrics', (req, res) => {
  const memUsage = process.memoryUsage();
  
  res.json({
    uptime: process.uptime(),
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
    },
    cpu: process.cpuUsage(),
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Flossy Widget Server running on port ${PORT}`);
  console.log(`📦 Widget URL: http://localhost:${PORT}/widget.js`);
  console.log(`🔗 Appointment Webhook: http://localhost:${PORT}/webhook/appointment-booking`);
  console.log(`📧 Gmail Brochure Webhook: http://localhost:${PORT}/webhook/gmail-brochure`);
  console.log(`📞 Gmail Callback Webhook: http://localhost:${PORT}/webhook/gmail-callback`);
  console.log(`📊 Health Check: http://localhost:${PORT}/health`);
  console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
  
  // Memory usage info
  const memUsage = process.memoryUsage();
  console.log(`💾 Initial Memory Usage: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);
});

module.exports = app;

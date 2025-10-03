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
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3001/oauth2/callback';

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

// Middleware (optimized for performance)
app.use(compression()); // Gzip compression
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173', '*'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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
  const { code, state } = req.query;
  const clientId = state;
  
  console.log('OAuth callback received:', { code: code ? 'present' : 'missing', state, clientId });
  
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
    data.google_tokens[clientId] = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      scope: tokens.scope,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    if (writeData(data)) {
      console.log('Tokens stored successfully for clientId:', clientId);
      
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
              }, window.location.origin);
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
              }, window.location.origin);
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
  const { customerName, customerEmail, customerPhone, appointmentDate, appointmentTime, duration = 60 } = req.body;
  
  if (!customerName || !customerEmail || !appointmentDate || !appointmentTime) {
    return res.status(400).json({ error: 'Missing required appointment details' });
  }
  
  db.get(
    'SELECT * FROM google_tokens WHERE client_id = ?',
    [clientId],
    async (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Google Calendar not connected' });
      }
      
      try {
        // Decrypt and set credentials
        const accessToken = decrypt(row.access_token);
        oauth2Client.setCredentials({ access_token: accessToken });
        
        // Create calendar service
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        
        // Parse appointment date and time
        const startDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
        const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
        
        // Create event
        const event = {
          summary: `Appointment - ${customerName}`,
          description: `Appointment booked via chatbot\n\nCustomer: ${customerName}\nEmail: ${customerEmail}\nPhone: ${customerPhone}`,
          start: {
            dateTime: startDateTime.toISOString(),
            timeZone: 'UTC',
          },
          end: {
            dateTime: endDateTime.toISOString(),
            timeZone: 'UTC',
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
        
        // Store appointment in database
        const appointmentId = crypto.randomUUID();
        db.run(
          `INSERT INTO appointments 
           (id, client_id, customer_name, customer_email, customer_phone, appointment_date, appointment_time, google_event_id, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
          [appointmentId, clientId, customerName, customerEmail, customerPhone, appointmentDate, appointmentTime, response.data.id],
          function(err) {
            if (err) {
              console.error('Database error:', err);
            }
          }
        );
        
        res.json({
          success: true,
          message: 'Appointment created successfully',
          eventId: response.data.id,
          appointmentId: appointmentId,
          eventLink: response.data.htmlLink
        });
        
      } catch (error) {
        console.error('Calendar API error:', error);
        
        // If token is expired, try to refresh
        if (error.code === 401) {
          try {
            const refreshToken = decrypt(row.refresh_token);
            oauth2Client.setCredentials({ refresh_token: refreshToken });
            const { credentials } = await oauth2Client.refreshAccessToken();
            
            // Update tokens and retry
            const encryptedAccessToken = encrypt(credentials.access_token);
            db.run(
              `UPDATE google_tokens SET access_token = ?, updated_at = CURRENT_TIMESTAMP WHERE client_id = ?`,
              [encryptedAccessToken, clientId]
            );
            
            // Retry the calendar event creation
            oauth2Client.setCredentials({ access_token: credentials.access_token });
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
            
            const startDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
            const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
            
            const event = {
              summary: `Appointment - ${customerName}`,
              description: `Appointment booked via chatbot\n\nCustomer: ${customerName}\nEmail: ${customerEmail}\nPhone: ${customerPhone}`,
              start: { dateTime: startDateTime.toISOString(), timeZone: 'UTC' },
              end: { dateTime: endDateTime.toISOString(), timeZone: 'UTC' },
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
    }
  );
});

// Webhook endpoint for appointment bookings
app.post('/webhook/appointment', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { botId, type, userSelection, timestamp, formData } = req.body;
    
    // Log for debugging (you can remove in production)
    console.log(`[${new Date().toISOString()}] Appointment webhook:`, {
      botId,
      type,
      userSelection,
      ip: req.ip
    });
    
    // If it's an appointment booking with form data, create Google Calendar event
    if (type === 'appointment' && formData && formData.fullName && formData.contact && formData.preferredDate && formData.preferredTime) {
      try {
        // Create Google Calendar event
        const calendarResponse = await axios.post(`http://localhost:${PORT}/api/calendar/create-event/${botId}`, {
          customerName: formData.fullName,
          customerEmail: formData.contact,
          customerPhone: formData.phone || '',
          appointmentDate: formData.preferredDate,
          appointmentTime: formData.preferredTime,
          duration: 60 // Default 1 hour appointment
        });
        
        const responseTime = Date.now() - startTime;
        
        res.json({
          success: true,
          message: 'Appointment booked successfully!',
          botId: botId,
          calendarEvent: calendarResponse.data,
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString()
        });
        
      } catch (calendarError) {
        console.error('Calendar booking error:', calendarError.response?.data || calendarError.message);
        
        // If calendar is not connected, still log the appointment
        const responseTime = Date.now() - startTime;
        
        res.json({
          success: true,
          message: 'Appointment request received (Google Calendar not connected)',
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
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook/appointment`);
  console.log(`📊 Health Check: http://localhost:${PORT}/health`);
  console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
  
  // Memory usage info
  const memUsage = process.memoryUsage();
  console.log(`💾 Initial Memory Usage: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);
});

module.exports = app;

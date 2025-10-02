/**
 * Flossy Chat Widget Server - Optimized for Shared VPS
 * Lightweight Express server designed to run alongside n8n
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3001; // Different port from n8n (usually 5678)

// Middleware (optimized for performance)
app.use(compression()); // Gzip compression
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
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

// Webhook endpoint for appointment bookings
app.post('/webhook/appointment', (req, res) => {
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
    
    // Here you can:
    // 1. Forward to n8n webhook
    // 2. Save to database
    // 3. Send email notifications
    // 4. Integrate with calendar systems
    
    // Example: Forward to n8n (if running on same VPS)
    // You can make HTTP request to n8n webhook here
    
    const responseTime = Date.now() - startTime;
    
    res.json({
      success: true,
      message: 'Appointment request received',
      botId: botId,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    });
    
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

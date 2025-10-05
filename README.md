# 🚀 Flossy Chat Widget - VPS Deployment Package

## 📁 What's in this folder

This folder contains **everything you need** to deploy the Flossy chat widget on your VPS alongside n8n.

```
vps-deployment/
├── widget.js              # Optimized chat widget (upload to VPS)
├── server.js              # Lightweight Express server (upload to VPS)
├── package.json           # Dependencies (upload to VPS)
├── ecosystem.config.js    # PM2 configuration (upload to VPS)
├── RESOURCE-ANALYSIS.md   # Detailed resource usage analysis
└── README.md             # This file
```

## 🎯 Quick Start

### 1. **Upload to your VPS**
```bash
# On your VPS, create directory
mkdir -p /var/www/flossy-widget
cd /var/www/flossy-widget

# Upload all files from this folder to /var/www/flossy-widget/
```

### 2. **Install dependencies**
```bash
npm install
```

### 3. **Start with PM2**
```bash
pm2 start ecosystem.config.js
pm2 save
```

### 4. **Configure Nginx** (add to your existing config)
```nginx
# Add this location block to your existing nginx config
location /widget.js {
    proxy_pass http://localhost:3001;
    add_header Access-Control-Allow-Origin *;
}

location /webhook/appointment {
    proxy_pass http://localhost:3001;
}
```

### 5. **Update Bot Builder**
In your `BotBuilder.jsx`, change:
```javascript
js.src="https://your-actual-domain.com/widget.js";
```

## 💾 Resource Usage

### **Memory**: ~30-50MB (optimized for shared VPS)
### **CPU**: <1% idle, 2-5% under load
### **Disk**: <100MB total

**Perfect for running alongside n8n on 1GB+ VPS!**

## 🔧 Configuration

### **Port Configuration**
- Widget server runs on port **3001** (different from n8n's 5678)
- Change in `ecosystem.config.js` if needed

### **Memory Limits**
- Automatically restarts if memory exceeds 150MB
- Node.js heap limited to 128MB for efficiency

### **Logging**
- Logs saved to `/var/log/flossy-widget/`
- Automatic log rotation
- View logs: `pm2 logs flossy-widget`

## 🔗 Integration with n8n

### **Webhook Integration**
The widget server provides a webhook endpoint that can forward data to your n8n workflows:

```
POST /webhook/appointment
```

**Example payload:**
```json
{
  "botId": "dental-clinic-123",
  "type": "appointment_request",
  "userSelection": "Request an appointment",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### **Forward to n8n**
In `server.js`, you can modify the webhook handler to forward requests to your n8n instance:

```javascript
// Example: Forward to n8n webhook
app.post('/webhook/appointment', async (req, res) => {
  // Forward to n8n
  await fetch('https://n8n.flipthatpdf.site/webhook/your-n8n-webhook-id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body)
  });
  
  res.json({ success: true });
});
```

## 📊 Monitoring

### **Health Check**
```bash
curl http://localhost:3001/health
```

### **Resource Metrics**
```bash
curl http://localhost:3001/metrics
```

### **PM2 Monitoring**
```bash
pm2 monit           # Real-time monitoring
pm2 logs flossy-widget  # View logs
pm2 restart flossy-widget  # Restart if needed
```

## 🛠 Maintenance

### **Update Widget**
1. Upload new `widget.js` file
2. Restart: `pm2 restart flossy-widget`

### **View Logs**
```bash
pm2 logs flossy-widget --lines 100
```

### **Check Status**
```bash
pm2 status
```

## 🔒 Security

### **Firewall**
- Only expose ports 22 (SSH), 80 (HTTP), 443 (HTTPS)
- Widget server runs on internal port 3001

### **CORS**
- Configured to allow cross-domain widget loading
- Secure headers included

### **Rate Limiting**
- Consider adding rate limiting for production use
- Example with express-rate-limit

## 🚨 Troubleshooting

### **Widget not loading**
1. Check PM2 status: `pm2 status`
2. Check logs: `pm2 logs flossy-widget`
3. Test health: `curl http://localhost:3001/health`
4. Check Nginx config

### **High memory usage**
1. Check metrics: `curl http://localhost:3001/metrics`
2. Restart if needed: `pm2 restart flossy-widget`
3. Check for memory leaks in logs

### **n8n integration issues**
1. Verify webhook URL in bot configuration
2. Check n8n webhook endpoint is accessible
3. Test webhook manually with curl

## 📞 Support

### **Useful Commands**
```bash
# Check all processes
pm2 status

# Monitor resources
pm2 monit

# View logs
pm2 logs flossy-widget

# Restart widget
pm2 restart flossy-widget

# Check system resources
htop
free -h
df -h
```

---

## 🎉 You're Ready!

This deployment package is **optimized for shared VPS environments** and will run efficiently alongside your n8n installation.

**Total setup time: ~15 minutes**
**Resource impact: Minimal (~50MB RAM)**
**Performance: Professional grade**

Your chat widget is now ready to serve embed scripts to any website! 🚀
# vps-deployment

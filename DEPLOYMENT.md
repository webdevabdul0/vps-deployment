# 🚀 Google Calendar Server Deployment Guide

## 📋 **Pre-Deployment Checklist**

### **1. Environment Variables Setup**

#### **Local Development**
```bash
# Copy the example file
cp .env.example .env

# Edit with your credentials
nano .env
```

#### **Production (VPS)**
```bash
# On your VPS, create production environment file
cp .env.production.example .env.production

# Edit with your production credentials
nano .env.production
```

### **2. Required Environment Variables**

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
REDIRECT_URI=https://yourdomain.com/oauth2/callback

# Server Configuration
PORT=3001
NODE_ENV=production
```

## 🔧 **Deployment Steps**

### **Step 1: Upload Files to VPS**

```bash
# Upload the entire vps-deployment folder to your VPS
scp -r vps-deployment/ user@your-vps-ip:/path/to/deployment/
```

### **Step 2: Install Dependencies**

```bash
# On your VPS
cd /path/to/deployment/vps-deployment
npm install --production
```

### **Step 3: Configure Environment**

```bash
# Create production environment file
cp .env.production.example .env.production

# Edit with your production credentials
nano .env.production
```

### **Step 4: Update Google OAuth Settings**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Edit your OAuth 2.0 Client ID
4. Add authorized redirect URI: `https://yourdomain.com/oauth2/callback`

### **Step 5: Configure nginx**

Add these location blocks to your nginx config:

```nginx
# Google Calendar API
location /api/calendar/ {
    proxy_pass http://localhost:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Google OAuth
location /oauth2/ {
    proxy_pass http://localhost:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### **Step 6: Start the Server**

```bash
# Using PM2
pm2 start ecosystem.config.js

# Or manually
NODE_ENV=production node server.js
```

## 🧪 **Testing Deployment**

### **Test Health Check**
```bash
curl https://yourdomain.com/api/calendar/health
```

### **Test OAuth Flow**
```bash
curl https://yourdomain.com/oauth2/authorize/test-bot-123
```

### **Test Calendar Status**
```bash
curl https://yourdomain.com/api/calendar/status/test-bot-123
```

## 🔒 **Security Notes**

- ✅ **Never commit .env files** to git
- ✅ **Use HTTPS** in production
- ✅ **Keep credentials secure** on VPS
- ✅ **Regularly rotate** Google OAuth secrets
- ✅ **Monitor logs** for suspicious activity

## 📊 **Monitoring**

### **PM2 Commands**
```bash
# Check status
pm2 status

# View logs
pm2 logs flossy-widget

# Restart service
pm2 restart flossy-widget

# Monitor resources
pm2 monit
```

### **Health Endpoints**
- `GET /health` - Server health check
- `GET /metrics` - Performance metrics

## 🔄 **Updates**

### **Deploy Updates**
```bash
# Pull latest code
git pull origin main

# Install new dependencies
npm install --production

# Restart service
pm2 restart flossy-widget
```

## 🚨 **Troubleshooting**

### **Common Issues**

1. **Port already in use**
   ```bash
   # Check what's using port 3001
   lsof -i :3001
   ```

2. **Environment variables not loading**
   ```bash
   # Check if .env.production exists
   ls -la .env.production
   ```

3. **Google OAuth errors**
   - Check redirect URI matches exactly
   - Verify client ID and secret are correct
   - Ensure HTTPS is used in production

4. **Permission errors**
   ```bash
   # Fix file permissions
   chmod 644 .env.production
   chmod +x server.js
   ```

## 📞 **Support**

If you encounter issues:
1. Check PM2 logs: `pm2 logs flossy-widget`
2. Verify environment variables are loaded
3. Test individual endpoints
4. Check nginx configuration

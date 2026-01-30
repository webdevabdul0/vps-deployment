# 📁 Where Bot Configurations Are Saved

## 🎯 Quick Answer

**When you save a bot in Bot Builder, it's saved in TWO places:**

### 1. **Main Database** (Primary Storage) ✅
- **Location**: `dev.flossly.ai` MySQL database
- **API Endpoint**: `POST /api/chatbot/save`
- **Storage**: Permanent, production database
- **Access**: Via authenticated API calls

### 2. **VPS Cache** (Fast Access) ✅
- **Location**: `vps-deployment/flossy_data.json`
- **Purpose**: Widget loads config quickly from here
- **Storage**: Local JSON file on VPS server
- **Synced**: Automatically when you save in Bot Builder

---

## 📍 File Locations

```
Your Project/
├── vps-deployment/
│   ├── flossy_data.json          ← Bot configs cached here (JSON file)
│   ├── .env                       ← API keys here
│   ├── server.js                  ← Server that reads configs
│   ├── widget.js                  ← Widget loads config from server
│   └── ai-agent.js                ← AI reads config from flossy_data.json
│
└── Backend Database (MySQL)       ← Main storage at dev.flossly.ai
    └── chatbot_configs table      ← Permanent storage
```

---

## 🌐 Company Website URL Configuration

### Where to Set It: **In Bot Builder UI**

**Location in UI:**
1. Open Bot Builder → http://localhost:5173
2. Go to **"Basic Settings"** section (first accordion)
3. Look for **"Company Website"** field
4. Enter your practice website URL

**Field Location in Code:**
```jsx
// In src/BotBuilder.jsx, line 47
const [companyWebsite, setCompanyWebsite] = useState('');

// Saved in bot config, line 387
companyWebsite: companyWebsite,

// Input field at approximately line 1673
<input
  type="url"
  value={companyWebsite}
  onChange={(e) => setCompanyWebsite(e.target.value)}
  placeholder="https://yourpractice.com"
/>
```

---

## ❓ Is Website URL Compulsory?

### **For Traditional Bot (aiMode: false)**: ❌ **NO**
- Bot works fine without it
- Only used for display/reference

### **For AI Agent (aiMode: true)**: ⚠️ **HIGHLY RECOMMENDED**
- **Not technically required** (won't crash)
- **But AI can't browse without it**
- AI will say: "I couldn't find that information" for all questions
- **Best practice**: Always set it when using AI mode

---

## 📝 How Saving Works (Step by Step)

### When You Click "Save Bot" in Builder:

```
1. Bot Builder (React)
   ↓
2. Call botConfigService.saveBotConfig()
   ↓
3. POST to dev.flossly.ai/api/chatbot/save
   ↓
4. Save to MySQL database (MAIN storage)
   ↓
5. POST to widget.flossly.ai/api/bot-config/{botId}
   ↓
6. Save to vps-deployment/flossy_data.json (CACHE)
   ↓
7. Widget can now load config instantly
```

---

## 📄 flossy_data.json Structure

```json
{
  "bot_configs": {
    "bot-123-abc": {
      "botId": "bot-123-abc",
      "companyName": "Smile Dental",
      "companyWebsite": "https://smiledental.com",  ← HERE!
      "companyPhone": "+1234567890",
      "companyOwnerEmail": "info@smiledental.com",
      "aiMode": true,                                ← AI enabled?
      "themeColor": "#0061FB",
      "openingMessages": [...],
      ...
    }
  },
  "bot_tokens": { ... },
  "google_tokens": { ... },
  "appointments": []
}
```

---

## 🔍 How to Check Where Your Bot is Saved

### Option 1: Check VPS Cache
```bash
cd vps-deployment
cat flossy_data.json | grep -A 5 "your-bot-id"
```

### Option 2: Check via API
```bash
# Get bot config from main database
curl -X GET https://dev.flossly.ai/api/chatbot/get \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Get bot config from VPS cache
curl https://widget.flossly.ai/api/bot-config/your-bot-id
```

### Option 3: Check in Bot Builder
- Open Bot Builder
- Your config auto-loads when you log in
- If it loads, it's saved! ✅

---

## 🛠️ Manual Configuration (If Needed)

### To Manually Edit Bot Config:

**Edit `vps-deployment/flossy_data.json`:**

```json
{
  "bot_configs": {
    "your-bot-id": {
      "botId": "your-bot-id",
      "companyName": "Your Practice",
      "companyWebsite": "https://yourpractice.com",  ← Add this
      "aiMode": true,                                 ← Enable AI
      ...
    }
  }
}
```

**Important:** This only updates the VPS cache. Main database won't be updated. Best to use Bot Builder UI!

---

## 🚀 Quick Setup Checklist

When setting up a bot with AI:

- [ ] **Company Name**: Set in Basic Settings
- [ ] **Company Website**: **IMPORTANT** - Set in Basic Settings
- [ ] **Company Phone**: Set in Basic Settings  
- [ ] **Company Email**: Set in Basic Settings
- [ ] **AI Mode**: Enable (will be in AI Agent section)
- [ ] **Click Save**: Saves to both database and VPS cache

---

## 💡 Pro Tips

### 1. **Website URL Format**
```
✅ Good: https://smiledental.com
✅ Good: https://www.smiledental.com
❌ Bad: smiledental.com (missing https://)
❌ Bad: www.smiledental.com (missing https://)
```

### 2. **What If Website Changes?**
- Just update the field in Bot Builder
- Click Save
- AI will browse the new URL immediately

### 3. **Testing Without Website**
- AI can still work for general questions
- Just won't be able to browse for practice-specific info
- Will default to saying "I don't have that information"

---

## 🔄 Sync Status

**Bot Builder → Database → VPS Cache** = Always in sync! ✅

When you save in Bot Builder:
1. Main database updated (permanent)
2. VPS cache updated (fast access)
3. Widget loads from VPS cache
4. AI reads from VPS cache

Everything stays synchronized automatically!

---

## 🐛 Troubleshooting

### "AI can't find information on my website"

**Check:**
```bash
# 1. Is companyWebsite set?
cd vps-deployment
cat flossy_data.json | grep companyWebsite

# 2. Can you browse it manually?
curl -I https://yourpractice.com

# 3. Test AI browsing
node -e "
const {browseWebsite} = require('./ai-tools');
browseWebsite('https://yourpractice.com').then(console.log);
"
```

### "Bot config not saving"

**Check:**
1. Are you logged in to Bot Builder?
2. Check browser console for errors
3. Check server logs: `pm2 logs widget-server`
4. Verify `flossy_data.json` has write permissions

---

## 📊 Summary

| Question | Answer |
|----------|--------|
| **Where is bot saved?** | MySQL database (main) + flossy_data.json (cache) |
| **Where to set website URL?** | Bot Builder → Basic Settings → Company Website |
| **Is website URL required?** | No, but HIGHLY recommended for AI mode |
| **Can I edit flossy_data.json?** | Yes, but use Bot Builder UI for best results |
| **How does AI use the website?** | Reads `companyWebsite` from config, then browses it |
| **What if I don't set website?** | Traditional bot works fine, AI can't browse |

---

**Bottom Line:** Always set `companyWebsite` in Bot Builder's Basic Settings if you want AI to browse your practice website! 🌐

# 🚀 AI Agent Quick Start Guide

## ✅ Installation Complete!

All AI Agent components have been successfully implemented. Here's what you need to do to start using it:

---

## 📋 3-Step Setup

### Step 1: Get API Keys (5 minutes)

#### OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Sign up or log in
3. Click **"Create new secret key"**
4. Copy the key (starts with `sk-...`)
5. **Cost**: Pay-as-you-go (~$0.007 per conversation)

#### Firecrawl API Key
1. Go to https://firecrawl.dev
2. Sign up (free account)
3. Get API key from dashboard (starts with `fc-...`)
4. **Cost**: Free tier includes 500 pages/month

---

### Step 2: Configure Environment (2 minutes)

Edit `vps-deployment/.env` and add:

```bash
# AI Agent Configuration
OPENAI_API_KEY=sk-your_actual_key_here
FIRECRAWL_API_KEY=fc-your_actual_key_here
```

**Or create the file if it doesn't exist:**

```bash
cd vps-deployment
cp .env.example .env
nano .env  # or use your favorite editor
```

---

### Step 3: Test & Enable (3 minutes)

#### Test the AI Agent

```bash
cd vps-deployment
node test-ai-agent.js
```

**Expected output:**
```
╔════════════════════════════════════════════════════════════════╗
║                  AI AGENT TEST SUITE                           ║
╚════════════════════════════════════════════════════════════════╝

⚙️  TEST 0: Environment Variables Check
✓ OPENAI_API_KEY: sk-proj-...
✓ FIRECRAWL_API_KEY: fc-...
✓ All API keys present!

🌐 TEST 1: Browse Website Capability
✓ Success: Website browsed successfully
📄 Title: Example Domain
📝 Content Preview: This domain is for use in illustrative examples...

🔍 TEST 2: Search Website Capability
✓ Success: Found 1 relevant pages

🤖 TEST 3: AI Conversation (Mock Bot)
👤 User: Hello! What are your office hours?
🤖 Assistant: [AI browses website and responds]
```

#### Enable AI for Your Bot

**Option A: Via Bot Builder UI**
1. Open Bot Builder
2. Load your bot
3. Find the AI Agent section
4. Toggle "Enable AI Mode" to ON
5. Click "Save Bot"

**Option B: Manually enable in flossy_data.json**

Edit `vps-deployment/flossy_data.json`:

```json
{
  "bot_configs": {
    "your-bot-id": {
      "botId": "your-bot-id",
      "companyName": "Your Practice Name",
      "companyWebsite": "https://yourpractice.com",
      "companyPhone": "+1234567890",
      "aiMode": true,   ← ADD THIS LINE
      ...rest of config...
    }
  }
}
```

**Option C: Via API**

```bash
curl -X PUT https://widget.flossly.ai/api/ai/config/YOUR_BOT_ID \
  -H "Content-Type: application/json" \
  -d '{"aiMode": true}'
```

---

## 🎯 Test a Real Conversation

### Using curl:

```bash
curl -X POST https://widget.flossly.ai/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "botId": "your-bot-id",
    "message": "What are your office hours?",
    "conversationHistory": []
  }'
```

### Using your website:

1. Add the widget script to your website
2. Open the chat
3. Type: "What services do you offer?"
4. **The AI will browse your website and respond!**

---

## 🧪 Example Conversations

Once enabled, users can chat naturally:

```
User: Do you offer teeth whitening?
AI:   [Searches website] Yes! We offer professional teeth 
      whitening treatments...

User: How much does it cost?
AI:   [Browses pricing page] Our teeth whitening starts at $399...

User: Can I book an appointment?
AI:   I'd be happy to help you book! What's your name?

User: John Smith
AI:   Thanks John! What's your email address?
      [Continues collecting info, then books appointment]
```

---

## 📊 What's Included

### ✅ Core Features Implemented

- **🌐 Web Browsing**: AI can visit any page on your website
- **🔍 Intelligent Search**: Finds relevant information across your site
- **📅 Appointment Booking**: Books appointments via conversation
- **📧 Lead Creation**: Captures treatment enquiries
- **📞 Callback Scheduling**: Schedules callback requests
- **💬 Natural Conversation**: Understands context and follow-up questions
- **🔄 Conversation Memory**: Remembers previous messages

### 📁 Files Created

```
vps-deployment/
├── ai-agent.js              ← Main AI agent logic
├── ai-tools.js              ← Web browsing & tool definitions
├── test-ai-agent.js         ← Test script
├── AI-AGENT-SETUP.md        ← Detailed setup guide
├── QUICK-START.md           ← This file
└── .env.example             ← Updated with AI keys

Modified files:
├── server.js                ← Added AI endpoints
├── widget.js                ← Added AI mode support
└── package.json             ← Added OpenAI & Firecrawl
```

---

## 💰 Cost Breakdown

### OpenAI GPT-4o-mini
- **Per conversation**: ~$0.007 (less than 1 cent!)
- **1000 conversations**: ~$7/month
- **10,000 conversations**: ~$70/month

### Firecrawl
- **Free tier**: 500 pages/month (usually enough!)
- **Paid tier**: $29/month for 5000 pages

**Example:** A practice with 500 patient conversations/month:
- OpenAI: $3.50/month
- Firecrawl: $0 (free tier)
- **Total: $3.50/month** 🎉

---

## 🐛 Troubleshooting

### "API keys not configured"
```bash
cd vps-deployment
cat .env  # Check if keys are present
```

### "Bot still uses old flow"
1. Verify `aiMode: true` in bot config
2. Clear browser cache
3. Restart server: `pm2 restart widget-server`

### "AI can't find information"
1. Check `companyWebsite` is set in bot config
2. Try browsing manually: `node test-ai-agent.js`
3. Verify website is publicly accessible

### Need help?
- See detailed guide: `AI-AGENT-SETUP.md`
- Check logs: `pm2 logs widget-server`
- Review code: `ai-agent.js` and `ai-tools.js`

---

## 🎉 You're Ready!

**Next steps:**
1. ✅ Get API keys from OpenAI & Firecrawl
2. ✅ Add them to `.env`
3. ✅ Run `node test-ai-agent.js`
4. ✅ Enable AI mode for your bot
5. ✅ Test with real questions!

The AI agent will:
- Browse your website automatically
- Answer questions accurately
- Book appointments naturally
- Create leads and callbacks
- Remember conversation context

**Everything is set up and ready to go! Just add your API keys and start chatting!** 🚀

---

## 📚 Documentation

- **Quick Start**: `QUICK-START.md` (this file)
- **Detailed Setup**: `AI-AGENT-SETUP.md`
- **API Reference**: Check `server.js` endpoints
- **Code Examples**: See `test-ai-agent.js`

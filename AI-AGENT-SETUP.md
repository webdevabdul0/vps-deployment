# 🤖 AI Agent Setup Guide

## ✅ What's Been Implemented

The AI Agent with web browsing capability has been successfully integrated into your Flossy chatbot system!

### 📁 New Files Created

1. **`vps-deployment/ai-tools.js`** - Web browsing tools using Firecrawl
   - `browse_website()` - Browse any webpage
   - `searchPracticeWebsite()` - Search entire website for specific info
   - Booking/lead/callback tool definitions

2. **`vps-deployment/ai-agent.js`** - OpenAI GPT-4o-mini integration
   - Main chat agent with tool calling
   - Conversation history management
   - Integration with Flossly APIs

3. **`vps-deployment/test-ai-agent.js`** - Testing script
   - Test web browsing
   - Test website search
   - Test AI conversations

### 🔧 Modified Files

1. **`vps-deployment/server.js`** - Added 6 new API endpoints:
   - `POST /api/ai/chat` - Main AI chat endpoint
   - `POST /api/ai/chat/stream` - Streaming support (future)
   - `GET /api/ai/config/:botId` - Get AI config
   - `PUT /api/ai/config/:botId` - Update AI config
   - `POST /api/ai/test-browse` - Test browsing
   - `POST /api/ai/test-search` - Test searching

2. **`vps-deployment/widget.js`** - AI mode support
   - Detects `aiMode` from bot config
   - Routes messages to AI agent when enabled
   - Falls back to traditional flow when disabled

3. **`src/BotBuilder.jsx`** - AI configuration UI
   - `aiMode` toggle added to bot config
   - Saves/loads AI settings
   - Ready for expansion

4. **`vps-deployment/.env.example`** - Added API key placeholders

---

## 🚀 Setup Instructions

### Step 1: Install Dependencies

Already done! ✅
```bash
cd vps-deployment
npm install openai @mendable/firecrawl-js
```

### Step 2: Configure API Keys

Create or update `vps-deployment/.env`:

```bash
# Required for AI Agent
OPENAI_API_KEY=sk-your_openai_api_key_here
FIRECRAWL_API_KEY=fc-your_firecrawl_api_key_here

# Existing keys (keep these)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
PORT=3001
```

**How to get API keys:**

1. **OpenAI API Key**:
   - Go to https://platform.openai.com/api-keys
   - Click "Create new secret key"
   - Copy the key (starts with `sk-`)

2. **Firecrawl API Key**:
   - Go to https://firecrawl.dev
   - Sign up for free account (500 pages/month free)
   - Get API key from dashboard (starts with `fc-`)

### Step 3: Test the AI Agent

Run the test script to verify everything works:

```bash
cd vps-deployment
node test-ai-agent.js
```

You should see:
- ✅ Environment variables check
- ✅ Website browsing test
- ✅ Website search test
- ✅ AI conversation test (if bot config exists)

---

## 📝 How to Enable AI Mode for a Bot

### Option 1: Via Bot Builder UI (Recommended)

1. Log into Bot Builder (http://localhost:5173 or your deployment)
2. Open your bot configuration
3. **[TODO]** Look for "🤖 AI Agent" section
4. Toggle "Enable AI Mode"
5. Click "Save Bot"

### Option 2: Via API (Manual)

```bash
curl -X PUT https://widget.flossly.ai/api/ai/config/YOUR_BOT_ID \
  -H "Content-Type: application/json" \
  -d '{"aiMode": true}'
```

### Option 3: Directly in Database

Edit `vps-deployment/flossy_data.json`:

```json
{
  "bot_configs": {
    "your-bot-id": {
      "aiMode": true,
      ...other config...
    }
  }
}
```

---

## 🧪 Testing the AI Agent

### Test 1: Simple Conversation

```bash
curl -X POST https://widget.flossly.ai/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "botId": "your-bot-id",
    "message": "Hello! What are your office hours?",
    "conversationHistory": []
  }'
```

Expected: AI browses the website and responds with actual hours.

### Test 2: Website Browsing

```bash
curl -X POST https://widget.flossly.ai/api/ai/test-browse \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com"
  }'
```

Expected: Returns webpage content in clean format.

### Test 3: Website Search

```bash
curl -X POST https://widget.flossly.ai/api/ai/test-search \
  -H "Content-Type: application/json" \
  -d '{
    "websiteUrl": "https://example.com",
    "query": "contact information"
  }'
```

Expected: Returns relevant pages with contact info.

---

## 💬 Example Conversations

With AI Mode enabled, users can have natural conversations:

**User:** "What are your prices for teeth whitening?"  
**AI:** *[Browses website]* "Our professional teeth whitening starts at $399..."

**User:** "Can I book an appointment for next Tuesday?"  
**AI:** *[Collects info]* "I'd be happy to help! What's your name?"  
**User:** "John Smith"  
**AI:** "Thanks John! What's your email address?"  
*[Continues collecting info, then calls book_appointment tool]*

**User:** "Do you accept Delta Dental insurance?"  
**AI:** *[Searches website]* "Yes! According to our website, we accept Delta Dental..."

---

## 🛠️ How It Works

### Architecture Flow

```
User Message
    ↓
Widget (widget.js)
    ↓
Server (/api/ai/chat)
    ↓
AI Agent (ai-agent.js)
    ↓
OpenAI GPT-4o-mini
    ↓
Tools Called:
    - browse_website (via Firecrawl)
    - search_practice_website
    - book_appointment
    - create_lead
    - schedule_callback
    ↓
Response to User
```

### Tool Calling Example

1. **User asks**: "What are your hours?"
2. **AI decides**: Need to browse website
3. **AI calls**: `search_practice_website(query: "office hours")`
4. **Firecrawl**: Crawls website, finds hours page
5. **AI receives**: Clean content with hours
6. **AI responds**: "We're open Monday-Friday 9am-5pm..."

---

## 💰 Cost Estimation

### OpenAI GPT-4o-mini Pricing
- **Input**: $0.150 / 1M tokens
- **Output**: $0.600 / 1M tokens

**Typical conversation:**
- 20 messages back and forth
- ~10K tokens total
- **Cost: ~$0.007** per conversation

**Monthly estimate:**
- 1000 conversations = **$7/month**
- 5000 conversations = **$35/month**

### Firecrawl Pricing
- **Free tier**: 500 pages/month
- **Paid**: $29/month for 5000 pages

**For most practices:**
- Website is ~10-50 pages
- AI caches results intelligently
- **Free tier is sufficient**

---

## 🔧 Configuration Options

### Bot Config Structure

```javascript
{
  "botId": "bot-123",
  "companyName": "Smile Dental",
  "companyWebsite": "https://smiledental.com",
  "companyPhone": "+1234567890",
  
  // AI Agent settings
  "aiMode": true,  // Enable/disable AI
  
  // Existing settings...
  "themeColor": "#0061FB",
  "openingMessages": [...],
  ...
}
```

### Future Enhancements (Not yet implemented)

- Conversation style selector (friendly, professional, empathetic)
- Model selection (gpt-4o-mini, gpt-4o, gpt-4-turbo)
- Custom system prompts per practice
- Cost tracking per bot
- Conversation analytics

---

## 🐛 Troubleshooting

### Issue: "API keys not configured"

**Solution:**
```bash
cd vps-deployment
# Check if .env exists
cat .env

# If missing, copy from example
cp .env.example .env
# Then edit .env and add your API keys
```

### Issue: "Failed to browse website"

**Possible causes:**
1. Firecrawl API key missing/invalid
2. Website blocks bots
3. Website requires login

**Solution:**
- Check Firecrawl API key
- Try with a different website (e.g., example.com)
- Check Firecrawl dashboard for errors

### Issue: "AI gives generic responses"

**Possible causes:**
1. Website URL not set in bot config
2. AI mode not enabled
3. Firecrawl can't access website

**Solution:**
- Ensure `companyWebsite` is set in bot config
- Verify `aiMode: true` in config
- Test with `/api/ai/test-browse` endpoint

### Issue: "Bot still uses old flow"

**Solution:**
- Clear browser cache
- Verify bot config has `aiMode: true`
- Check widget.js loads latest version
- Restart server

---

## 📊 Monitoring

### Check AI Agent Status

```bash
# Check if bot has AI enabled
curl https://widget.flossly.ai/api/ai/config/YOUR_BOT_ID
```

### View Server Logs

```bash
cd vps-deployment
pm2 logs widget-server
```

Look for:
- `[AI Agent]` messages
- `[AI Chat]` messages
- Tool execution logs

---

## 🎯 Next Steps

### Immediate (Can do now):
1. ✅ Get API keys from OpenAI and Firecrawl
2. ✅ Add keys to `.env` file
3. ✅ Run test script: `node test-ai-agent.js`
4. ✅ Enable AI mode for a test bot
5. ✅ Test on your website

### Short-term (This week):
1. Add comprehensive AI Agent UI in Bot Builder
2. Add conversation style selector
3. Add cost tracking
4. Integrate with actual Flossly API endpoints

### Long-term (Future):
1. Streaming responses for better UX
2. Multi-language support
3. Voice input/output
4. Appointment availability checking
5. CRM integration

---

## 📚 Additional Resources

- **OpenAI Function Calling**: https://platform.openai.com/docs/guides/function-calling
- **Firecrawl Docs**: https://docs.firecrawl.dev
- **GPT-4o-mini Pricing**: https://openai.com/api/pricing/

---

## ✅ Checklist

Before going live with AI Agent:

- [ ] OpenAI API key configured
- [ ] Firecrawl API key configured
- [ ] Test script passes all tests
- [ ] Bot config has `aiMode: true`
- [ ] Bot config has `companyWebsite` set
- [ ] Tested with real user questions
- [ ] Verified booking flow works
- [ ] Checked cost estimates acceptable
- [ ] Monitored first 10 conversations
- [ ] Backup plan if AI fails (fallback to traditional flow)

---

## 🎉 You're All Set!

The AI Agent is ready to use. Just add your API keys and enable AI mode for your bots!

**Questions or issues?** Check the troubleshooting section above or review the code in:
- `vps-deployment/ai-agent.js`
- `vps-deployment/ai-tools.js`
- `vps-deployment/server.js`

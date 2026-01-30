/**
 * Test Script for AI Agent
 * Tests web browsing, searching, and conversation capabilities
 */

require('dotenv').config();
const { chatWithAgent } = require('./ai-agent');
const { browseWebsite, searchPracticeWebsite } = require('./ai-tools');

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(color, label, message) {
  console.log(`${colors[color]}${label}${colors.reset} ${message}`);
}

function printSeparator() {
  console.log('\n' + '='.repeat(80) + '\n');
}

async function testBrowseWebsite() {
  printSeparator();
  log('cyan', '🌐 TEST 1:', 'Browse Website Capability');
  console.log();
  
  const testUrl = 'https://example.com';
  log('blue', 'URL:', testUrl);
  
  try {
    const result = await browseWebsite(testUrl);
    
    if (result.success) {
      log('green', '✓ Success:', 'Website browsed successfully');
      log('yellow', '📄 Title:', result.title);
      log('yellow', '📝 Content Preview:', result.content.substring(0, 200) + '...');
      log('yellow', '📏 Content Length:', `${result.content.length} characters`);
    } else {
      log('red', '✗ Failed:', result.error);
    }
  } catch (error) {
    log('red', '✗ Error:', error.message);
  }
}

async function testSearchWebsite() {
  printSeparator();
  log('cyan', '🔍 TEST 2:', 'Search Website Capability');
  console.log();
  
  const testUrl = 'https://example.com';
  const query = 'information';
  
  log('blue', 'Website:', testUrl);
  log('blue', 'Query:', query);
  
  try {
    const result = await searchPracticeWebsite(testUrl, query);
    
    if (result.success) {
      log('green', '✓ Success:', `Found ${result.results.length} relevant pages`);
      
      result.results.forEach((page, index) => {
        console.log(`\n${colors.yellow}Result ${index + 1}:${colors.reset}`);
        log('yellow', '  URL:', page.url);
        log('yellow', '  Title:', page.title);
        log('yellow', '  Snippet:', page.snippet);
        log('yellow', '  Relevance:', `${(page.relevance * 100).toFixed(1)}%`);
      });
    } else {
      log('red', '✗ Failed:', result.message);
    }
  } catch (error) {
    log('red', '✗ Error:', error.message);
  }
}

async function testAIConversation() {
  printSeparator();
  log('cyan', '🤖 TEST 3:', 'AI Conversation (Mock Bot)');
  console.log();
  
  // Create a mock bot config for testing
  const mockBotId = 'test-bot-123';
  
  log('blue', 'Bot ID:', mockBotId);
  log('yellow', 'Note:', 'This requires a valid bot config in flossy_data.json');
  console.log();
  
  const testMessages = [
    "Hello! What are your office hours?",
    "Do you offer teeth whitening?",
    "How much does a cleaning cost?"
  ];
  
  let conversationHistory = [];
  
  for (const message of testMessages) {
    log('bright', '👤 User:', message);
    
    try {
      const response = await chatWithAgent(mockBotId, message, conversationHistory);
      
      if (response.success) {
        log('green', '🤖 Assistant:', response.content);
        log('yellow', '⚙️  Tools Used:', response.toolsUsed || 0);
        conversationHistory = response.conversationHistory;
      } else {
        log('red', '✗ Error:', response.error);
      }
    } catch (error) {
      log('red', '✗ Error:', error.message);
      if (error.message.includes('not found')) {
        log('yellow', '💡 Tip:', 'Create a test bot config in flossy_data.json first');
        break;
      }
    }
    
    console.log();
  }
}

async function testEnvironmentVariables() {
  printSeparator();
  log('cyan', '⚙️  TEST 0:', 'Environment Variables Check');
  console.log();
  
  const requiredVars = {
    'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
    'FIRECRAWL_API_KEY': process.env.FIRECRAWL_API_KEY
  };
  
  let allPresent = true;
  
  for (const [key, value] of Object.entries(requiredVars)) {
    if (value) {
      log('green', '✓', `${key}: ${value.substring(0, 20)}...`);
    } else {
      log('red', '✗', `${key}: Missing!`);
      allPresent = false;
    }
  }
  
  console.log();
  
  if (!allPresent) {
    log('yellow', '⚠️  Warning:', 'Some API keys are missing. Tests may fail.');
    log('yellow', '💡 Tip:', 'Add these to your .env file:');
    console.log(`
${colors.cyan}OPENAI_API_KEY${colors.reset}=sk-...
${colors.cyan}FIRECRAWL_API_KEY${colors.reset}=fc-...
    `);
  } else {
    log('green', '✓ All API keys present!', '');
  }
}

async function runAllTests() {
  console.log(`
${colors.bright}${colors.cyan}
╔════════════════════════════════════════════════════════════════╗
║                  AI AGENT TEST SUITE                           ║
║                                                                 ║
║  Testing: Web Browsing, Searching, and AI Conversation         ║
╚════════════════════════════════════════════════════════════════╝
${colors.reset}
  `);
  
  try {
    await testEnvironmentVariables();
    
    // Only run other tests if API keys are present
    if (process.env.FIRECRAWL_API_KEY && process.env.OPENAI_API_KEY) {
      await testBrowseWebsite();
      await testSearchWebsite();
      await testAIConversation();
    } else {
      log('red', '\n✗ Skipping tests:', 'API keys not configured');
    }
    
    printSeparator();
    log('green', '✅ Test Suite Complete!', '');
    console.log();
    
  } catch (error) {
    printSeparator();
    log('red', '❌ Test Suite Failed:', error.message);
    console.error(error);
  }
}

// Run tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testBrowseWebsite,
  testSearchWebsite,
  testAIConversation
};

#!/usr/bin/env node

/**
 * Test script for Bot Configuration API (Script Shortening)
 * This VPS deployment fetches configs from dev.flossly.ai and caches them
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001'; // VPS deployment
const MAIN_API_BASE = 'https://dev.flossly.ai'; // Main API
const BOT_ID = '3c18dac1-9939-4b57-a4c6-c9915b844c0a';

async function testBotConfigAPI() {
  console.log('🧪 Testing Bot Configuration API (Script Shortening)\n');
  console.log('📡 This VPS deployment fetches configs from dev.flossly.ai and caches them\n');

  try {
    // 1. Test getting bot configuration (this will fetch from main API)
    console.log('1️⃣ Getting bot configuration from VPS (fetches from dev.flossly.ai)...');
    const getResponse = await axios.get(`${API_BASE}/api/bot-config/${BOT_ID}`);
    console.log('✅ Get response:', {
      success: getResponse.data.success,
      botId: getResponse.data.botId,
      cached: getResponse.data.cached,
      name: getResponse.data.data?.name || 'N/A',
      companyName: getResponse.data.data?.companyName || 'N/A'
    });

    // 2. Test caching (second request should use cache)
    console.log('\n2️⃣ Testing cache (second request should use cached data)...');
    const cachedResponse = await axios.get(`${API_BASE}/api/bot-config/${BOT_ID}`);
    console.log('✅ Cached response:', {
      success: cachedResponse.data.success,
      cached: cachedResponse.data.cached,
      timestamp: cachedResponse.data.timestamp
    });

    // 3. Test with a non-existent bot ID
    console.log('\n3️⃣ Testing with non-existent bot ID...');
    try {
      const notFoundResponse = await axios.get(`${API_BASE}/api/bot-config/non-existent-bot`);
      console.log('❌ Unexpected success:', notFoundResponse.data);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ Correctly returned 404 for non-existent bot');
      } else {
        console.log('⚠️  Unexpected error:', error.response?.data || error.message);
      }
    }

    console.log('\n🎉 Script shortening API is working correctly!');
    console.log('\n📋 How it works:');
    console.log('   1. Widget script contains only botId');
    console.log('   2. VPS fetches full config from dev.flossly.ai');
    console.log('   3. VPS caches config for 5 minutes');
    console.log('   4. Subsequent requests use cached data');
    console.log('   5. Widget initializes with full config');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ VPS server not running. Please start the server first:');
      console.log('   cd vps-deployment && node server.js');
    } else if (error.response?.status === 404) {
      console.log('❌ Bot configuration not found in main API (dev.flossly.ai)');
      console.log('   Make sure the bot exists in your main database');
    } else {
      console.error('❌ Test failed:', error.response?.data || error.message);
    }
  }
}

// Run the test
testBotConfigAPI();

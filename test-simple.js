import fetch from 'node-fetch';

async function testSimple() {
  try {
    console.log('🧪 Testing simple request...');
    
    // Test health first
    const healthResponse = await fetch('http://localhost/health');
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData.status);
    
    // Test agent with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch('http://localhost/api/agents/customer-identification/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'こんにちは' }],
        sessionId: 'test-session-123'
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log('✅ Response status:', response.status);
    console.log('✅ Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const text = await response.text();
      console.log('📝 Response text:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));
    }
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('⏰ Request timed out - this might be normal for streaming');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

testSimple();


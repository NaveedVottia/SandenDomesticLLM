import fetch from 'node-fetch';

async function testAgent() {
  try {
    console.log('🧪 Testing customer-identification agent...');
    
    const response = await fetch('http://localhost/api/agents/customer-identification/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'こんにちは' }],
        sessionId: 'test-session-123'
      })
    });

    if (!response.ok) {
      console.error('❌ Response not OK:', response.status, response.statusText);
      return;
    }

    console.log('✅ Response received, status:', response.status);
    
    // Read the response text
    const responseText = await response.text();
    console.log('🎯 Agent response:', responseText);
    
  } catch (error) {
    console.error('❌ Error testing agent:', error.message);
  }
}

testAgent();

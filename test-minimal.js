import fetch from 'node-fetch';

async function testMinimal() {
  try {
    console.log('🧪 Testing minimal agent request...');
    
    // Test with a very simple request
    const response = await fetch('http://localhost/api/agents/customer-identification/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hello' }],
        sessionId: 'test-123'
      })
    });
    
    console.log('✅ Response status:', response.status);
    
    if (response.ok) {
      // Try to read just the first chunk
      const reader = response.body.getReader();
      const { value } = await reader.read();
      if (value) {
        const text = new TextDecoder().decode(value);
        console.log('📝 First chunk:', text);
      } else {
        console.log('📝 No data received');
      }
      reader.releaseLock();
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testMinimal();


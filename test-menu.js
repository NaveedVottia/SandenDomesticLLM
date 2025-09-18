import fetch from 'node-fetch';

async function testMenu() {
  try {
    console.log('🧪 Testing customer identification menu...');
    
    const response = await fetch('http://localhost/api/agents/customer-identification/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: '修理サービスについて教えてください' }],
        sessionId: 'test-menu-123'
      })
    });
    
    console.log('✅ Response status:', response.status);
    
    if (response.ok) {
      const text = await response.text();
      console.log('📝 Menu response:', text.substring(0, 500) + (text.length > 500 ? '...' : ''));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testMenu();

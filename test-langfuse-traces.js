#!/usr/bin/env node

import { readFileSync } from 'fs';

// Load environment variables
const envContent = readFileSync('server.env', 'utf-8');
const envLines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
envLines.forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    process.env[key.trim()] = value.trim();
  }
});

console.log('🔍 Testing Langfuse trace creation with SDK...');

try {
  // Import the Langfuse integration
  const { langfuse } = await import('./dist/integrations/langfuse.js');
  
  console.log('✅ Langfuse integration loaded');
  
  // Test connection first
  const connectionTest = await langfuse.testConnection();
  console.log('🔧 Connection test result:', connectionTest);
  
  if (connectionTest) {
    // Create a test trace
    const traceId = await langfuse.startTrace('E2E Test Trace', {
      testType: 'E2E',
      sessionId: 'test-session-' + Date.now(),
      uiUrl: 'https://demo.dev-maestra.vottia.me/sanden-dev'
    });
    
    console.log('📊 Test trace created:', traceId);
    
    // Log a tool execution
    await langfuse.logToolExecution(traceId, 'test-tool', 
      { input: 'test input' }, 
      { output: 'test output' },
      { agent: 'test-agent' }
    );
    
    console.log('🔧 Tool execution logged');
    
    // End the trace
    await langfuse.endTrace(traceId, { 
      finalResult: 'success',
      totalSteps: 1 
    });
    
    console.log('✅ Trace completed successfully');
    console.log(`🌐 View trace in Langfuse: https://langfuse.demo.dev-maestra.vottia.me/traces/${traceId}`);
    
  } else {
    console.error('❌ Langfuse connection test failed');
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Stack:', error.stack);
}

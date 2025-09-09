import dotenv from 'dotenv';
import { Langfuse } from 'langfuse';

dotenv.config({ path: 'server.env' });

const client = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST
});

async function testPrompts() {
  try {
    console.log('Testing available prompts...');
    console.log('Environment check:');
    console.log('LANGFUSE_PUBLIC_KEY:', process.env.LANGFUSE_PUBLIC_KEY ? 'present' : 'missing');
    console.log('LANGFUSE_SECRET_KEY:', process.env.LANGFUSE_SECRET_KEY ? 'present' : 'missing');
    console.log('LANGFUSE_HOST:', process.env.LANGFUSE_HOST || 'missing');
    
    // Try to get the customer-identification prompt
    try {
      const prompt = await client.getPrompt('customer-identification');
      console.log('customer-identification prompt found:', !!prompt);
      console.log('Content length:', prompt?.prompt?.length || 0);
      if (prompt?.prompt) {
        console.log('First 200 chars:', prompt.prompt.substring(0, 200));
      }
    } catch (error) {
      console.log('customer-identification prompt error:', error.message);
    }
    
    // Try other known prompts
    const knownPrompts = ['repair-scheduling', 'repair-agent', 'repair-history-ticket', 'error-messages'];
    for (const promptName of knownPrompts) {
      try {
        const prompt = await client.getPrompt(promptName);
        console.log(promptName + ' prompt found:', !!prompt, 'length:', prompt?.prompt?.length || 0);
      } catch (error) {
        console.log(promptName + ' prompt error:', error.message);
      }
    }
  } catch (error) {
    console.error('General error:', error.message);
  }
}

testPrompts();
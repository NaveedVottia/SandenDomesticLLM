import { Langfuse } from 'langfuse';
import dotenv from 'dotenv';

dotenv.config({ path: './server.env' });

async function downloadPrompts() {
  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
  });

  const promptNames = [
    'Domestic-repair-agent',
    'Domestic-repair-history-ticket',
    'Domestic-customer-identification',
    'Domestic-repair-scheduling',
    'Domestic-orchestrator'
  ];

  console.log('🔍 Downloading current prompts from Langfuse...\n');

  for (const promptName of promptNames) {
    try {
      console.log(`📋 ${promptName}:`);
      const prompt = await langfuse.getPrompt(promptName, undefined, { cacheTtlSeconds: 1 });

      if (prompt?.prompt) {
        console.log(`   Version: ${prompt.version}`);
        console.log(`   Content:`);
        console.log(`   ${'-'.repeat(50)}`);
        console.log(`   ${prompt.prompt.replace(/\n/g, '\n   ')}`);
        console.log(`   ${'-'.repeat(50)}`);
      } else {
        console.log(`   ❌ No prompt found for ${promptName}`);
      }
      console.log('');
    } catch (error) {
      console.log(`   ❌ Error downloading ${promptName}: ${error.message}`);
      console.log('');
    }
  }

  await langfuse.shutdown();
}

downloadPrompts().catch(console.error);

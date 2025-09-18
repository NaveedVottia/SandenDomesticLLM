import { Langfuse } from 'langfuse';
import dotenv from 'dotenv';

dotenv.config({ path: './server.env' });

async function listAllLangfusePrompts() {
  console.log('📋 Listing all prompts in Langfuse...\n');

  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
  });

  try {
    // Try to get a list of all prompts (this might not work with the current API)
    console.log('🔍 Attempting to list all prompts...');

    // Let's try to get multiple prompts to see what's available
    const promptNames = [
      'Domestic-repair-agent',
      'Domestic-repair-history-ticket',
      'Domestic-customer-identification',
      'Domestic-orchestrator',
      'Domestic-repair-scheduling'
    ];

    console.log('📋 Available prompts in your Langfuse instance:\n');

    for (const promptName of promptNames) {
      try {
        const prompt = await langfuse.getPrompt(promptName, undefined, { cacheTtlSeconds: 0 });
        if (prompt) {
          console.log(`✅ ${promptName}`);
          console.log(`   Version: ${prompt.version}`);
          console.log(`   Length: ${prompt.prompt.length} characters`);
          console.log(`   Last updated: ${prompt.createdAt || 'Unknown'}`);
          console.log('');
        } else {
          console.log(`❌ ${promptName} - Not found`);
        }
      } catch (error) {
        console.log(`❌ ${promptName} - Error: ${error.message}`);
      }
    }

    console.log('🔗 Langfuse Dashboard URL:');
    console.log(`   https://langfuse.demo.dev-maestra.vottia.me`);
    console.log('');
    console.log('📝 To manually update prompts:');
    console.log('   1. Go to the Langfuse dashboard URL above');
    console.log('   2. Navigate to the Prompts section');
    console.log('   3. Find and edit each prompt manually');
    console.log('   4. Copy the updated content from the scripts we created');

  } catch (error) {
    console.log(`❌ Error listing prompts: ${error.message}`);
    console.log('');
    console.log('🔗 Alternative: Access Langfuse dashboard directly:');
    console.log(`   https://langfuse.demo.dev-maestra.vottia.me`);
    console.log('');
    console.log('📝 Manual update process:');
    console.log('   1. Log in to Langfuse dashboard');
    console.log('   2. Go to Prompts section');
    console.log('   3. Edit each prompt with the concise versions');
  }

  await langfuse.shutdownAsync();
}

listAllLangfusePrompts().catch(console.error);

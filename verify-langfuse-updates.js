import { Langfuse } from 'langfuse';
import dotenv from 'dotenv';

dotenv.config({ path: './server.env' });

async function verifyLangfuseUpdates() {
  console.log('🔍 Verifying Langfuse prompt updates...\n');

  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
  });

  const promptNames = [
    'Domestic-repair-agent',
    'Domestic-repair-history-ticket',
    'Domestic-customer-identification',
    'Domestic-orchestrator'
  ];

  console.log('📋 Checking all prompt versions and tags:\n');

  for (const promptName of promptNames) {
    try {
      console.log(`🔍 ${promptName}:`);

      // Get the prompt with production label
      const prompt = await langfuse.getPrompt(promptName, undefined, { cacheTtlSeconds: 0 });

      if (prompt) {
        console.log(`   Current Version: ${prompt.version}`);
        console.log(`   Tags: ${prompt.tags ? prompt.tags.join(', ') : 'None'}`);
        console.log(`   Labels: ${prompt.labels ? prompt.labels.join(', ') : 'None'}`);
        console.log(`   Created: ${prompt.createdAt ? new Date(prompt.createdAt).toLocaleString() : 'Unknown'}`);

        // Check if it has our force-update tag
        if (prompt.tags && prompt.tags.includes('force-update-2025')) {
          console.log(`   ✅ Has force-update-2025 tag`);
        } else {
          console.log(`   ❌ Missing force-update-2025 tag`);
        }

        // Show first 200 characters of the prompt
        const preview = prompt.prompt.substring(0, 200).replace(/\n/g, ' ');
        console.log(`   Preview: ${preview}...`);
      } else {
        console.log(`   ❌ No prompt found`);
      }

      console.log('');
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      console.log('');
    }
  }

  console.log('🔄 Attempting to create a new version with explicit versioning...\n');

  // Try to create a new version with explicit versioning
  try {
    const testPrompt = await langfuse.createPrompt({
      name: "Domestic-repair-agent",
      prompt: "TEST PROMPT - Version check " + Date.now(),
      labels: ["test"],
      config: {},
      tags: ["version-test-2025"]
    });

    console.log(`✅ Test prompt created successfully`);
    console.log(`   Version: ${testPrompt.version || 'Not returned'}`);
    console.log(`   ID: ${testPrompt.id || 'Not returned'}`);
  } catch (error) {
    console.log(`❌ Test prompt creation failed: ${error.message}`);
  }

  await langfuse.shutdownAsync();
  console.log('\n🎯 Verification complete. Check your Langfuse dashboard for the updated prompts.');
}

verifyLangfuseUpdates().catch(console.error);

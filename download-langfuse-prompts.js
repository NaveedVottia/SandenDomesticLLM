import { Langfuse } from 'langfuse';

const langfuse = new Langfuse({
  publicKey: 'pk-lf-a8ce11f0-3641-447e-b71f-e025fc0c7ddb',
  secretKey: 'sk-lf-d60ec2a6-4294-4e6b-956e-9c81514afce3',
  baseUrl: 'https://langfuse.demo.dev-maestra.vottia.me'
});

const prompts = [
  'customer-identification',
  'repair-agent',
  'repair-history-ticket',
  'repair-scheduling',
  'error-messages'
];

async function downloadPrompts() {
  console.log('Downloading prompts from Langfuse...\n');

  for (const promptName of prompts) {
    try {
      console.log(`Fetching prompt: ${promptName}`);
      const promptClient = await langfuse.getPrompt(promptName, undefined, { cacheTtlSeconds: 0 });

      if (promptClient?.prompt) {
        console.log(`✅ ${promptName} (v${promptClient.version}): ${promptClient.prompt.length} chars`);
        console.log('--- PROMPT CONTENT ---');
        console.log(promptClient.prompt);
        console.log('--- END PROMPT ---\n');
      } else {
        console.log(`❌ ${promptName}: No prompt content found\n`);
      }
    } catch (error) {
      console.error(`❌ Failed to fetch ${promptName}:`, error.message, '\n');
    }
  }

  await langfuse.shutdown();
}

downloadPrompts().catch(console.error);

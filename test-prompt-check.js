import { Langfuse } from "langfuse";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve("./server.env") });

async function checkPrompt() {
  console.log("🔍 Langfuse Connection Test:");
  console.log("LANGFUSE_PUBLIC_KEY:", process.env.LANGFUSE_PUBLIC_KEY ? "✅ Set" : "❌ Missing");
  console.log("LANGFUSE_SECRET_KEY:", process.env.LANGFUSE_SECRET_KEY ? "✅ Set" : "❌ Missing");
  console.log("LANGFUSE_HOST:", process.env.LANGFUSE_HOST);

  try {
    const langfuse = new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_HOST,
    });

    console.log("✅ Langfuse client created");

    const promptClient = await langfuse.getPrompt("customer-identification", undefined, { cacheTtlSeconds: 0 });
    console.log("✅ Prompt loaded, version:", promptClient.version);
    console.log("📝 Prompt length:", promptClient.prompt.length);
    console.log("📋 Prompt content preview (first 500 chars):");
    console.log("---");
    console.log(promptClient.prompt.substring(0, 500));
    console.log("---");

    // Check for critical keywords
    const hasCustRule = promptClient.prompt.includes("CUST");
    const hasToolRule = promptClient.prompt.includes("lookupCustomerFromDatabase");
    const hasDelegationRule = promptClient.prompt.includes("delegateTo");

    console.log("🔍 Prompt Analysis:");
    console.log("CUST detection rule:", hasCustRule ? "✅ PRESENT" : "❌ MISSING");
    console.log("Tool usage rule:", hasToolRule ? "✅ PRESENT" : "❌ MISSING");
    console.log("Delegation rule:", hasDelegationRule ? "✅ PRESENT" : "❌ MISSING");

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

checkPrompt();

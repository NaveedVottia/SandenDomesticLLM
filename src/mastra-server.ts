import express, { Request, Response } from "express";
import cors from "cors";
import type { CorsOptions } from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { mastraPromise } from "./mastra/index.js";
import { loadLangfusePrompt } from "./mastra/prompts/langfuse.js";

// Load environment variables FIRST with absolute path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server.env
const envPath = path.resolve(__dirname, "../server.env");
console.log("🔍 Loading environment from:", envPath);
dotenv.config({ path: envPath });

// Verify CORS_ORIGIN is loaded
console.log("🔍 CORS_ORIGIN:", process.env.CORS_ORIGIN ? "✅ Set" : "❌ Missing");

console.log("🔍 Environment variables loaded:");
console.log(`LANGFUSE_HOST: ${process.env.LANGFUSE_HOST ? '✅ Set' : '❌ Missing'}`);
console.log(`LANGFUSE_PUBLIC_KEY: ${process.env.LANGFUSE_PUBLIC_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`LANGFUSE_SECRET_KEY: ${process.env.LANGFUSE_SECRET_KEY ? '✅ Set' : '❌ Missing'}`);

// Session management for conversation context
interface SessionData {
  customerId?: string;
  customerProfile?: any;
  currentAgent?: string;
  conversationStep?: string;
  lastInteraction?: number;
}

const sessionStore = new Map<string, SessionData>();

// Load error messages from Langfuse
let errorMessages = {
  streamingError: "",
  systemError: "",
  retryError: ""
};

(async () => {
  try {
    const errorPrompt = await loadLangfusePrompt("error-messages", { cacheTtlMs: 0, label: "production" });
    if (errorPrompt) {
      // Parse error messages from Langfuse prompt
      const lines = errorPrompt.split('\n').filter(line => line.trim());
      for (const line of lines) {
        if (line.includes('streamingError:')) {
          errorMessages.streamingError = line.split('streamingError:')[1]?.trim() || "";
        } else if (line.includes('systemError:')) {
          errorMessages.systemError = line.split('systemError:')[1]?.trim() || "";
        } else if (line.includes('retryError:')) {
          errorMessages.retryError = line.split('retryError:')[1]?.trim() || "";
        }
      }
      console.log(`[Langfuse] ✅ Loaded error messages from Langfuse`);
    } else {
      console.warn(`[Langfuse] ⚠️ No error messages prompt available in Langfuse`);
    }
  } catch (error) {
    console.warn(`[Langfuse] ⚠️ Failed to load error messages prompt:`, error);
  }
})();

// Helper function to get or create session
function getSession(sessionId: string): SessionData {
  if (!sessionStore.has(sessionId)) {
    sessionStore.set(sessionId, {
      lastInteraction: Date.now()
    });
  }
  return sessionStore.get(sessionId)!;
}

// Helper function to get session ID from request
function getSessionId(req: Request): string {
  // Try to get session ID from headers, query params, or body
  const sessionId = req.headers['x-session-id'] as string || 
                   req.query.sessionId as string || 
                   req.body.sessionId as string ||
                   `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return sessionId;
}

// Create Express app
const app = express();

// Set server timeout to 40 seconds for Zapier calls
app.use((req, res, next) => {
  // Set timeout to 40 seconds for all requests
  req.setTimeout(40000);
  res.setTimeout(40000);
  next();
});

// Middleware
const corsAllowedOrigins = (process.env.CORS_ORIGIN || "").split(",").map(o => o.trim()).filter(Boolean);
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Allow non-browser or same-origin requests
    if (corsAllowedOrigins.length === 0) return callback(null, true);
    if (corsAllowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  // If not specified, cors will reflect Access-Control-Request-Headers, which is safer for dynamic headers
  allowedHeaders: undefined,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
// Explicitly handle preflight requests for all routes (Express 5 compatible)
app.options(/.*/, cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get("/health", async (req: Request, res: Response) => {
  try {
    console.log("🔍 Health check: Checking Mastra instance...");

    // Add timeout to mastraPromise to prevent hanging
    const mastraPromiseWithTimeout = Promise.race([
      mastraPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Mastra initialization timeout')), 10000)
      )
    ]);

    const mastra = await mastraPromiseWithTimeout as any;
    console.log("mastra type:", typeof mastra);
    console.log("mastra.agents:", mastra.agents);
    console.log("mastra.getAgentById:", typeof mastra.getAgentById);

    // Test agent access
    const knownAgentIds = [
      'customer-identification',
      'repair-agent',
      'repair-history-ticket',
      'repair-scheduling'
    ];

    console.log("Trying known agent IDs:", knownAgentIds);
    for (const agentId of knownAgentIds) {
      try {
        const agent = mastra.getAgentById(agentId);
        if (agent) {
          console.log(`✅ Found agent: ${agentId}`);
        } else {
          console.log(`❌ Agent not found: ${agentId}`);
        }
      } catch (error) {
        console.log(`❌ Error accessing agent ${agentId}:`, error);
      }
    }

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      agents: knownAgentIds,
      mastra: "initialized"
    });
  } catch (error) {
    console.error("❌ Health check failed:", error);
    res.status(500).json({ 
      status: "unhealthy", 
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    });
  }
});

// Helper function to get agent by ID
async function getAgentById(agentId: string) {
  try {
    const mastra = await mastraPromise;
    return mastra.getAgentById(agentId);
  } catch (error) {
    console.error(`❌ Error getting agent ${agentId}:`, error);
    return null;
  }
}

// Helper function to encode chunks for Mastra f0ed protocol
function encodeChunk(chunk: string): string {
  // Escape newlines to maintain valid JSON format for streaming
  return chunk.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

// Stream Mastra response using f0ed protocol
async function streamMastraResponse(stream: any, res: Response): Promise<number> {
  let totalLength = 0;
  
  try {
    for await (const chunk of stream.textStream) {
      if (typeof chunk === 'string' && chunk.trim()) {
        totalLength += chunk.length;
        // Send the entire chunk as one unit to preserve formatting
        res.write(`0:"${encodeChunk(chunk)}"\n`);
      }
    }
  } catch (error) {
    console.error("❌ Error streaming response:", error);
    const fallback = errorMessages.streamingError || "申し訳ございませんが、エラーが発生しました。";
    totalLength = fallback.length;
    res.write(`0:"${encodeChunk(fallback)}"\n`);
  }

  // If nothing was streamed, emit an empty line to satisfy protocol
  if (totalLength === 0) {
    const msg = "";
    res.write(`0:"${encodeChunk(msg)}"\n`);
  }

  return totalLength;
}

// Prepare headers for Mastra streaming protocol
function prepareStreamHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Hint for some proxies (e.g., Nginx) to not buffer
  res.setHeader('X-Accel-Buffering', 'no');
  // Flush headers immediately
  try { res.flushHeaders(); } catch {}
}

// Write message id line and flush
function writeMessageId(res: Response, messageId: string): void {
  res.write(`f:{"messageId":"${messageId}"}\n`);
  try { (res as any).flush?.(); } catch {}
}

// Write finish metadata (e:/d:) and flush
function writeFinish(res: Response, fullTextLength: number): void {
  res.write(`e:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":${fullTextLength}},"isContinued":false}\n`);
  res.write(`d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":${fullTextLength}}}\n`);
  try { (res as any).flush?.(); } catch {}
}

// Heartbeat to prevent intermediary/proxy timeouts during long model calls
function startKeepalive(res: Response, intervalMs: number = 10000): NodeJS.Timeout {
  return setInterval(() => {
    try {
      res.write(`0:""\n`);
    } catch {}
  }, intervalMs);
}

// Simple test endpoint without streaming
app.post("/api/agents/customer-identification/test", async (req: Request, res: Response) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const sessionId = getSessionId(req);
    const session = getSession(sessionId);
    
    console.log(`🔍 Test endpoint with ${messages.length} messages`);
    
    const agent = await getAgentById("customer-identification");
    if (!agent) {
      return res.status(500).json({ error: "Agent 'customer-identification' not found" });
    }
    
    const resolvedAgent = await agent;
    console.log("🔍 Resolved agent for test");
    console.log("🔍 Agent methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(resolvedAgent)));
    console.log("🔍 Agent type:", typeof resolvedAgent);
    
    // Try to execute without streaming
    if (typeof resolvedAgent.streamLegacy === 'function') {
      console.log("🔍 Testing streamLegacy method...");
      const stream = await resolvedAgent.streamLegacy(messages);
      console.log("🔍 Stream created, trying to read...");
      
      // Try to read from the stream
      let result = "";
      for await (const chunk of stream.textStream) {
        if (typeof chunk === 'string') {
          result += chunk;
        }
      }
      
      return res.json({ success: true, result: result });
    } else if (typeof resolvedAgent.execute === 'function') {
      const result = await resolvedAgent.execute(messages);
      return res.json({ success: true, result: result });
    } else if (typeof resolvedAgent.run === 'function') {
      const result = await resolvedAgent.run(messages);
      return res.json({ success: true, result: result });
    } else {
      return res.status(500).json({ error: "Agent does not have execute or run method", methods: Object.getOwnPropertyNames(Object.getPrototypeOf(resolvedAgent)) });
    }
    
  } catch (error: unknown) {
    console.error("❌ [Test endpoint] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

// SDK5-compatible streaming endpoint (keeps SDK4 backend, outputs SDK5 format)
app.post("/api/agents/customer-identification/stream/vnext/ui", async (req: Request, res: Response) => {
  try {
    console.log("🔍 SDK5-compatible streaming request received (SDK4 backend)");

    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const sessionId = getSessionId(req);
    const session = getSession(sessionId);

    console.log(`🔍 Processing SDK5 request with ${messages.length} messages (using streamVNext)`);

    const agent = await getAgentById("customer-identification");
    if (!agent) {
      return res.status(500).json({ error: "Agent 'customer-identification' not found" });
    }

    const resolvedAgent = await agent;
    console.log("🔍 Resolved agent methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(resolvedAgent)));

    // Use streamLegacy for V1 models (like Claude Sonnet) and manually convert to SDK5 format
    // streamVNext doesn't work with V1 models, so we use the legacy approach
    if (typeof resolvedAgent.streamLegacy === 'function') {
      console.log("🔍 Falling back to streamLegacy with manual SDK5 conversion...");

      const stream = await resolvedAgent.streamLegacy(messages);

      console.log("✅ StreamLegacy succeeded, converting to SDK5 format");

      // Convert SDK4 stream to SDK5-compatible format
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send SDK5-compatible message format
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Send initial message metadata (SDK5 format)
      res.write(`f:{"messageId":"${messageId}"}\n`);

      try {
        // Stream the text content
        for await (const chunk of stream.textStream) {
          if (typeof chunk === 'string' && chunk.trim()) {
            // Send data chunks (SDK5 format)
            res.write(`0:"${chunk.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"\n`);
          }
        }

        // Send completion (SDK5 format)
        res.write(`e:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0},"isContinued":false}\n`);
        res.write(`d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n`);

      } catch (streamError) {
        console.error("❌ Stream processing error:", streamError);
        res.write(`e:{"finishReason":"error","usage":{"promptTokens":0,"completionTokens":0},"isContinued":false}\n`);
      }

      res.end();
      return;

    } else {
      console.log("⚠️ Agent does not support streamVNext or streamLegacy");
      return res.status(500).json({ error: "Agent does not support streaming" });
    }

  } catch (error: unknown) {
    console.error("❌ [SDK5 endpoint] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

// Main endpoint for the customer identification agent (main entry point - legacy SDK v4)
app.post("/api/agents/customer-identification/stream", async (req: Request, res: Response) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const sessionId = getSessionId(req);
    const session = getSession(sessionId);
    
    // Extract resourceId and threadId from request body (legacy Mastra Memory approach)
    const resourceId = req.body?.resourceId || session.customerId || sessionId;
    const threadId = req.body?.threadId || `thread-${sessionId}`;
    
    console.log(`🔍 Processing request with ${messages.length} messages`);
    console.log(`🔍 Session ID: ${sessionId}`);
    console.log(`🔍 Resource ID: ${resourceId}`);
    console.log(`🔍 Thread ID: ${threadId}`);
    console.log(`🔍 Current session:`, JSON.stringify(session, null, 2));
    console.log(`🔍 Request body:`, JSON.stringify(req.body, null, 2));
    
    // Normalize messages to handle complex UI format
    const normalizedMessages = messages.map((msg: any) => {
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        // Extract text from content array format
        const textContent = msg.content
          .filter((item: any) => item.type === 'text' && item.text)
          .map((item: any) => item.text)
          .join(' ');
        return { role: 'user', content: textContent };
      } else if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        // Extract text from assistant content array format
        const textContent = msg.content
          .filter((item: any) => item.type === 'text' && item.text)
          .map((item: any) => item.text)
          .join(' ');
        return { role: 'assistant', content: textContent };
      }
      return msg;
    });
    
    console.log(`🔍 Normalized messages:`, JSON.stringify(normalizedMessages, null, 2));
    
    // Determine which agent to use based on session state and user input
    let targetAgentId = "customer-identification";
    const userInput = normalizedMessages[normalizedMessages.length - 1]?.content || "";
    
    // If customer is already identified and user selects a menu option, route to appropriate agent
    if (session.customerId && session.conversationStep === "menu") {
      if (userInput === "1" || userInput.includes("修理履歴") || userInput.includes("repair history")) {
        // Keep using customer-identification agent but it will use directRepairHistory tool
        targetAgentId = "customer-identification";
        session.conversationStep = "repair-history";
        console.log(`🔍 Using customer-identification agent with directRepairHistory tool for customer: ${session.customerId}`);
      } else if (userInput === "2" || userInput.includes("製品") || userInput.includes("product")) {
        targetAgentId = "repair-agent";
        session.conversationStep = "product-selection";
        console.log(`🔍 Routing to repair-agent for customer: ${session.customerId}`);
      } else if (userInput === "3" || userInput.includes("予約") || userInput.includes("scheduling")) {
        targetAgentId = "repair-scheduling";
        session.conversationStep = "scheduling";
        console.log(`🔍 Routing to repair-scheduling for customer: ${session.customerId}`);
      }
    }
    
    // If customer is identified for the first time, update session
    if (!session.customerId && userInput.match(/CUST\d+/)) {
      session.customerId = userInput;
      session.conversationStep = "menu";
      console.log(`🔍 Customer identified: ${session.customerId}`);
    }
    
    // Update session timestamp
    session.lastInteraction = Date.now();
    
    const agent = await getAgentById(targetAgentId);
    if (!agent) {
      return res.status(500).json({ error: `Agent '${targetAgentId}' not found` });
    }
    
    // Set headers for streaming response
    prepareStreamHeaders(res);
    // Emit message id early to satisfy UI expectation and keep connection active
    const earlyMessageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    writeMessageId(res, earlyMessageId);
    // Small keepalive to start f0ed stream early
    res.write(`0:""\n`);

    // Start keepalive before model call
    const keepaliveTimer = startKeepalive(res);

    // Execute the agent using Mastra's stream method with resourceId and threadId
    const resolvedAgent = await agent; // Resolve the agent promise first
    console.log("🔍 Resolved agent methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(resolvedAgent)));
    console.log("🔍 Resolved agent type:", typeof resolvedAgent);
    console.log("🔍 Resolved agent stream method:", typeof resolvedAgent.stream);
    
    // Try different methods based on Mastra documentation with memory IDs
    let stream;
    let result;

    // First try streamLegacy method with error handling
    if (typeof resolvedAgent.streamLegacy === 'function') {
      try {
        console.log("🔍 Trying streamLegacy method...");
        stream = await resolvedAgent.streamLegacy(normalizedMessages, {
          resourceId: resourceId,
          threadId: threadId
        });
        console.log("✅ StreamLegacy method succeeded");
      } catch (streamError) {
        console.log("⚠️ StreamLegacy method failed:", streamError instanceof Error ? streamError.message : String(streamError));
        stream = null; // Reset stream to null so we try fallbacks
      }
    }
    
    // If streamLegacy failed, try stream method
    if (!stream && typeof resolvedAgent.stream === 'function') {
      try {
        console.log("🔍 Trying stream method...");
        stream = await resolvedAgent.stream(normalizedMessages, {
          resourceId: resourceId,
          threadId: threadId
        });
        console.log("✅ Stream method succeeded");
      } catch (streamError) {
        console.log("⚠️ Stream method failed:", streamError instanceof Error ? streamError.message : String(streamError));
        stream = null; // Reset stream to null so we try fallbacks
      }
    }

    // If stream failed or doesn't exist, try execute method
    if (!stream && typeof resolvedAgent.execute === 'function') {
      try {
        console.log("🔍 Trying execute method...");
        result = await resolvedAgent.execute(normalizedMessages, {
          resourceId: resourceId,
          threadId: threadId
        });
        console.log("✅ Execute method succeeded, result type:", typeof result);

        // Convert result to stream format for Mastra f0ed protocol
        stream = {
          textStream: (async function* () {
            if (typeof result === 'string') {
              console.log("🔍 Yielding string result:", result.substring(0, 50) + "...");
              yield result;
            } else if (result && typeof result === 'object' && result.text) {
              console.log("🔍 Yielding object.text result:", result.text.substring(0, 50) + "...");
              yield result.text;
            } else if (result && typeof result === 'object' && result.content) {
              console.log("🔍 Yielding object.content result:", result.content.substring(0, 50) + "...");
              yield result.content;
            } else {
              console.log("🔍 Yielding JSON result:", JSON.stringify(result).substring(0, 50) + "...");
              yield JSON.stringify(result);
            }
          })()
        };
      } catch (executeError) {
        console.log("❌ Execute method failed:", executeError instanceof Error ? executeError.message : String(executeError));
      }
    }

    // If execute failed, try run method as last resort
    if (!stream && typeof resolvedAgent.run === 'function') {
      try {
        console.log("🔍 Trying run method...");
        result = await resolvedAgent.run(normalizedMessages, {
          resourceId: resourceId,
          threadId: threadId
        });
        console.log("✅ Run method succeeded, result type:", typeof result);

        // Convert result to stream format for Mastra f0ed protocol
        stream = {
          textStream: (async function* () {
            if (typeof result === 'string') {
              console.log("🔍 Yielding string result:", result.substring(0, 50) + "...");
              yield result;
            } else if (result && typeof result === 'object' && result.text) {
              console.log("🔍 Yielding object.text result:", result.text.substring(0, 50) + "...");
              yield result.text;
            } else if (result && typeof result === 'object' && result.content) {
              console.log("🔍 Yielding object.content result:", result.content.substring(0, 50) + "...");
              yield result.content;
            } else {
              console.log("🔍 Yielding JSON result:", JSON.stringify(result).substring(0, 50) + "...");
              yield JSON.stringify(result);
            }
          })()
        };
      } catch (runError) {
        console.log("❌ Run method failed:", runError instanceof Error ? runError.message : String(runError));
        throw new Error(`All agent methods failed: ${runError instanceof Error ? runError.message : String(runError)}`);
      }
    }

    if (!stream) {
      throw new Error(`Agent does not have working stream, execute, or run method. Available methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(resolvedAgent)).join(', ')}`);
    }
    
    // Message id already sent early
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const fullTextLength = await streamMastraResponse(stream, res);
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    
    console.log(`✅ Response complete, length: ${fullTextLength} characters`);
    console.log(`✅ Updated session:`, JSON.stringify(session, null, 2));
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /customer-identification/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

// Session-aware workflow endpoint with AI SDK v5 compatibility
app.post("/api/agents/repair-workflow-orchestrator/stream", async (req: Request, res: Response) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const sessionId = getSessionId(req);
    const session = getSession(sessionId);

    // Extract resourceId and threadId from request body (legacy Mastra Memory approach)
    const resourceId = req.body?.resourceId || session.customerId || sessionId;
    const threadId = req.body?.threadId || `thread-${sessionId}`;

    // Extract user input from messages
    const userMessage = messages.find((msg: any) => msg.role === 'user');
    const userInput = userMessage?.content || '';

    // Extract test parameters from request body
    const testCaseId = req.body?.testCaseId || `workflow_test_${Date.now()}`;
    const evaluationMode = req.body?.evaluationMode !== false; // Default to true

    console.log(`🔍 [Workflow Endpoint] Processing with session-aware workflow`);
    console.log(`🔍 User input: "${userInput}"`);
    console.log(`🔍 Test case ID: ${testCaseId}`);
    console.log(`🔍 Evaluation mode: ${evaluationMode}`);

    // Import our session-aware workflow
    const { runCustomerIdentificationWorkflow } = await import('./mastra/workflows/sanden/customer-identification-workflow.js');

    // Run the session-aware workflow with session continuity
    const workflowResult = await runCustomerIdentificationWorkflow(userInput, {
      sessionId, // Pass sessionId for continuity
      testCaseId,
      evaluationMode
    });

    console.log(`✅ [Workflow Endpoint] Workflow completed: ${workflowResult.success}`);
    console.log(`📊 Session ID: ${workflowResult.sessionId}`);
    console.log(`🎯 Evaluation complete: ${workflowResult.evaluationComplete}`);

    // Convert workflow result to AI SDK v5 format
    const responseContent = workflowResult.response;
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Send AI SDK v5 formatted response
    res.write(`f:{"messageId":"${messageId}"}\n`);

    // Stream the response content in chunks
    const chunks = responseContent.match(/.{1,50}/g) || [responseContent];
    for (const chunk of chunks) {
      res.write(`0:"${chunk.replace(/"/g, '\\"')}"\n`);
    }

    // Send completion metadata
    res.write(`e:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":${responseContent.length}},"isContinued":false}\n`);
    res.write(`d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":${responseContent.length}}}\n`);

    res.end();

    console.log(`🔍 Processing UI request with ${messages.length} messages`);
    console.log(`🔍 Resource ID: ${resourceId}`);
    console.log(`🔍 Thread ID: ${threadId}`);

    // Normalize messages to handle complex UI format
    const normalizedMessages = messages.map((msg: any) => {
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        // Extract text from content array format
        const textContent = msg.content
          .filter((item: any) => item.type === 'text' && item.text)
          .map((item: any) => item.text)
          .join(' ');
        return { role: 'user', content: textContent };
      } else if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        // Extract text from assistant content array format
        const textContent = msg.content
          .filter((item: any) => item.type === 'text' && item.text)
          .map((item: any) => item.text)
          .join(' ');
        return { role: 'assistant', content: textContent };
      }
      return msg;
    });

    console.log(`🔍 Normalized messages:`, JSON.stringify(normalizedMessages, null, 2));

    // Set headers for streaming response
    prepareStreamHeaders(res);
    // Emit message id early
    const earlyMessageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    writeMessageId(res, earlyMessageId);
    res.write(`0:""\n`);

    // Start keepalive before model call
    const keepaliveTimer = startKeepalive(res);

    // Response already sent by workflow execution above
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /repair-workflow-orchestrator/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    
    // Check if headers have already been sent
    if (!res.headersSent) {
      return res.status(500).json({ error: message });
    } else {
      console.error("❌ Headers already sent, cannot send error response");
      res.end();
    }
  }
});

// Legacy endpoint for UI compatibility - redirects to customer-identification
app.post("/api/agents/orchestrator/stream", async (req: Request, res: Response) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const agent = await getAgentById("customer-identification");
    
    if (!agent) {
      return res.status(500).json({ error: "Agent 'customer-identification' not found" });
    }

    console.log(`🔍 Processing orchestrator request with ${messages.length} messages`);
    
    // Normalize messages to handle complex UI format
    const normalizedMessages = messages.map((msg: any) => {
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        const textContent = msg.content
          .filter((item: any) => item.type === 'text' && item.text)
          .map((item: any) => item.text)
          .join(' ');
        return { role: 'user', content: textContent };
      } else if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        const textContent = msg.content
          .filter((item: any) => item.type === 'text' && item.text)
          .map((item: any) => item.text)
          .join(' ');
        return { role: 'assistant', content: textContent };
      }
      return msg;
    });
    
    // Set headers for streaming response
    prepareStreamHeaders(res);
    // Emit message id early
    const earlyMessageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    writeMessageId(res, earlyMessageId);
    res.write(`0:""\n`);

    // Start keepalive before model call
    const keepaliveTimer = startKeepalive(res);

    // Execute the agent using Mastra's streamLegacy method
    const resolvedAgent = await agent;
    const stream = await resolvedAgent.streamLegacy(normalizedMessages);
    
    // Message id already sent early
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const fullTextLength = await streamMastraResponse(stream, res);
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    clearInterval(keepaliveTimer);
    
    console.log(`✅ Orchestrator Response complete, length: ${fullTextLength} characters`);
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /orchestrator/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

// Individual agent endpoints for direct access
app.post("/api/agents/repair-agent/stream", async (req: Request, res: Response) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const agent = await getAgentById("repair-agent");
    
    if (!agent) {
      return res.status(500).json({ error: "Repair agent not found" });
    }

    // Set headers for streaming response
    prepareStreamHeaders(res);
    // Emit message id early
    const earlyMessageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    writeMessageId(res, earlyMessageId);
    res.write(`0:""\n`);

    // Execute the agent using Mastra's streamLegacy method
    const resolvedAgent = await agent; // Resolve the agent promise first
    const stream = await resolvedAgent.streamLegacy(messages);
    
    // Message id already sent early
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const fullTextLength = await streamMastraResponse(stream, res);
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    
    console.log(`✅ Response complete, length: ${fullTextLength} characters`);
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /repair-agent/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/agents/repair-history-ticket/stream", async (req: Request, res: Response) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const agent = await getAgentById("repair-history-ticket");
    
    if (!agent) {
      return res.status(500).json({ error: "Repair history agent not found" });
    }

    // Set headers for streaming response
    prepareStreamHeaders(res);

    // Execute the agent using Mastra's streamLegacy method
    const resolvedAgent = await agent; // Resolve the agent promise first
    const stream = await resolvedAgent.streamLegacy(messages);
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const fullTextLength = await streamMastraResponse(stream, res);
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    
    console.log(`✅ Response complete, length: ${fullTextLength} characters`);
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /repair-history-ticket/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/agents/repair-scheduling/stream", async (req: Request, res: Response) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const sessionId = getSessionId(req);
    const session = getSession(sessionId);
    const agent = await getAgentById("repair-scheduling");
    
    if (!agent) {
      return res.status(500).json({ error: "Repair scheduling agent not found" });
    }

    // Set headers for streaming response
    prepareStreamHeaders(res);

    // Create a context object with session data for tools
    const toolContext = {
      sessionId: sessionId,
      session: session,
      customerId: session.customerId
    };

    // Execute the agent using Mastra's streamLegacy method
    const resolvedAgent = await agent; // Resolve the agent promise first
    const stream = await resolvedAgent.streamLegacy(messages);
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const fullTextLength = await streamMastraResponse(stream, res);
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    
    console.log(`✅ Response complete, length: ${fullTextLength} characters`);
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /repair-scheduling/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

// Start server
const PORT = process.env.PORT || 80;

const server = app.listen(PORT, () => {
  console.log(`🚀 Mastra server started successfully!`);
  console.log(`🌐 Server running on port ${PORT} (configured in Lightsail firewall)`);
  console.log(`🔗 AI SDK v5 endpoint: POST /api/agents/customer-identification/stream/vnext/ui`);
  console.log(`🔗 Main endpoint (SDK v4): POST /api/agents/customer-identification/stream`);
  console.log(`🔗 Legacy endpoints: POST /api/agents/repair-workflow-orchestrator/stream (redirects to customer-identification)`);
  console.log(`🔗 Individual agent endpoints:`);
  console.log(`   - POST /api/agents/repair-agent/stream`);
  console.log(`   - POST /api/agents/repair-history-ticket/stream`);
  console.log(`   - POST /api/agents/repair-scheduling/stream`);
  console.log(`🔗 Health check: GET /health`);
});

// Set server timeout to 60 seconds for long-running requests
server.timeout = 60000;
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// Prevent unhandled errors from crashing the server
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Don't exit the process, just log the error
});

// Graceful shutdown - only respond to explicit signals
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received - shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received - shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

// Server is now managed by PM2 for permanent operation

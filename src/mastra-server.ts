import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { mastraPromise } from "./mastra/index";
import { langfuse } from "./integrations/langfuse";
import { plamoProvider } from "./integrations/plamo-mastra.js";

// Load environment variables
dotenv.config({ path: "./server.env" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Session management for conversation context
interface SessionData {
  customerId?: string;
  customerProfile?: any;
  currentAgent?: string;
  conversationStep?: string;
  lastInteraction?: number;
}

const sessionStore = new Map<string, SessionData>();

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
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mastra Backend API Endpoints

// GET /api/health - Health check endpoint for Mastra backend
app.get("/api/health", async (req: Request, res: Response) => {
  try {
    console.log("🔍 Mastra backend health check...");
    const mastra = await mastraPromise;
    
    // Test basic functionality
    const healthStatus = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      mastra: "initialized",
      agents: {
        available: mastra.agents ? Object.keys(mastra.agents) : [],
        count: mastra.agents ? Object.keys(mastra.agents).length : 0
      },
      integrations: {
        langfuse: langfuse.enabled ? "connected" : "disabled",
        plamo: "available"
      }
    };
    
    console.log("✅ Mastra backend health check passed");
    res.json(healthStatus);
  } catch (error) {
    console.error("❌ Mastra backend health check failed:", error);
    res.status(500).json({ 
      status: "unhealthy", 
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/llm-runs - Returns array of LLM runs
app.get("/api/llm-runs", async (req: Request, res: Response) => {
  try {
    console.log("🔍 Fetching LLM runs...");
    
    // Get query parameters for filtering
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const model = req.query.model as string;
    const taskType = req.query.task_type as string;
    
    // Mock LLM runs data - formatted according to dashboard expectations
    const mockLLMRuns = [
      {
        // Required fields
        run_id: `run-${Date.now()}-1`,
        model: "Karakuri", // Dashboard expects: "Karakuri" | "Tsuzumi" | "PLaMo"
        task_type: "selection", // Dashboard expects: "selection" | "schedule" | "summary"
        batch_id: `batch-${Date.now()}-1`,
        seed: 42,
        concurrency: 1, // Dashboard expects: 1 | 5 | 10 | 20
        
        // Timing metrics
        start_ts: new Date(Date.now() - 3600000).toISOString(),
        end_ts: new Date(Date.now() - 3595000).toISOString(),
        ttft_ms: 150, // Time to first token in milliseconds
        tps: 25.5, // Tokens per second
        
        // Token usage
        total_tokens: 1250,
        input_tokens: 800,
        output_tokens: 450,
        
        // Success metrics
        response_ok: true,
        error_type: null,
        json_valid: true,
        tool_success: true,
        
        // Task-specific metrics
        chosen_contractor: "Contractor A",
        correct_top1: true,
        correct_top3: true,
        ndcg3: 0.92,
        feasible: true,
        slot_capture_f1: 0.88,
        tone_pass: true,
        
        // Safety metrics
        unsafe_output: false,
        pii_detected: false,
        
        // Cost tracking
        total_cost_jpy: 1.25, // Cost in Japanese Yen
        
        // Tracing
        langfuse_trace_id: `trace-${Date.now()}-1`,
        zapier_exec_id: `zapier-${Date.now()}-1`
      },
      {
        run_id: `run-${Date.now()}-2`,
        model: "PLaMo",
        task_type: "schedule",
        batch_id: `batch-${Date.now()}-2`,
        seed: 123,
        concurrency: 5,
        
        start_ts: new Date(Date.now() - 7200000).toISOString(),
        end_ts: new Date(Date.now() - 7195000).toISOString(),
        ttft_ms: 200,
        tps: 22.3,
        
        total_tokens: 2100,
        input_tokens: 1200,
        output_tokens: 900,
        
        response_ok: true,
        error_type: null,
        json_valid: true,
        tool_success: true,
        
        chosen_contractor: "Contractor B",
        correct_top1: false,
        correct_top3: true,
        ndcg3: 0.89,
        feasible: true,
        slot_capture_f1: 0.85,
        tone_pass: true,
        
        unsafe_output: false,
        pii_detected: false,
        
        total_cost_jpy: 2.10,
        
        langfuse_trace_id: `trace-${Date.now()}-2`,
        zapier_exec_id: `zapier-${Date.now()}-2`
      },
      {
        run_id: `run-${Date.now()}-3`,
        model: "Tsuzumi",
        task_type: "summary",
        batch_id: `batch-${Date.now()}-3`,
        seed: 456,
        concurrency: 10,
        
        start_ts: new Date(Date.now() - 10800000).toISOString(),
        end_ts: new Date(Date.now() - 10795000).toISOString(),
        ttft_ms: 180,
        tps: 28.7,
        
        total_tokens: 1800,
        input_tokens: 1000,
        output_tokens: 800,
        
        response_ok: true,
        error_type: null,
        json_valid: true,
        tool_success: true,
        
        chosen_contractor: "Contractor C",
        correct_top1: true,
        correct_top3: true,
        ndcg3: 0.95,
        feasible: true,
        slot_capture_f1: 0.92,
        tone_pass: true,
        
        unsafe_output: false,
        pii_detected: false,
        
        total_cost_jpy: 1.80,
        
        langfuse_trace_id: `trace-${Date.now()}-3`,
        zapier_exec_id: `zapier-${Date.now()}-3`
      },
      {
        run_id: `run-${Date.now()}-4`,
        model: "Karakuri",
        task_type: "selection",
        batch_id: `batch-${Date.now()}-4`,
        seed: 789,
        concurrency: 20,
        
        start_ts: new Date(Date.now() - 14400000).toISOString(),
        end_ts: new Date(Date.now() - 14395000).toISOString(),
        ttft_ms: 165,
        tps: 26.2,
        
        total_tokens: 1950,
        input_tokens: 1100,
        output_tokens: 850,
        
        response_ok: false, // Example of failed response
        error_type: "timeout",
        json_valid: false,
        tool_success: false,
        
        chosen_contractor: null,
        correct_top1: false,
        correct_top3: false,
        ndcg3: 0.0,
        feasible: false,
        slot_capture_f1: 0.0,
        tone_pass: false,
        
        unsafe_output: true, // Example of unsafe output
        pii_detected: true, // Example of PII detection
        
        total_cost_jpy: 0.0, // No cost for failed runs
        
        langfuse_trace_id: `trace-${Date.now()}-4`,
        zapier_exec_id: `zapier-${Date.now()}-4`
      }
    ];
    
    // Apply filters
    let filteredRuns = mockLLMRuns;
    
    if (model) {
      filteredRuns = filteredRuns.filter(run => run.model.toLowerCase().includes(model.toLowerCase()));
    }
    
    if (taskType) {
      filteredRuns = filteredRuns.filter(run => run.task_type === taskType);
    }
    
    // Apply pagination
    const paginatedRuns = filteredRuns.slice(offset, offset + limit);
    
    const response = {
      runs: paginatedRuns,
      pagination: {
        total: filteredRuns.length,
        limit,
        offset,
        has_more: offset + limit < filteredRuns.length
      },
      timestamp: new Date().toISOString()
    };
    
    console.log(`✅ Returning ${paginatedRuns.length} LLM runs`);
    res.json(response);
  } catch (error) {
    console.error("❌ Error fetching LLM runs:", error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/webhooks - Register webhooks for real-time updates
app.post("/api/webhooks", async (req: Request, res: Response) => {
  try {
    console.log("🔍 Registering webhook...");
    
    const { url, events, secret } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: "Webhook URL is required" });
    }
    
    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ error: "Events array is required" });
    }
    
    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: "Invalid webhook URL format" });
    }
    
    // Mock webhook registration - in a real implementation, this would be stored in a database
    const webhookId = `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const webhookConfig = {
      id: webhookId,
      url,
      events,
      secret: secret || null,
      status: "active",
      created_at: new Date().toISOString(),
      last_triggered: null,
      failure_count: 0
    };
    
    // In a real implementation, you would store this in a database
    // For now, we'll just log it
    console.log("✅ Webhook registered:", webhookConfig);
    
    // Test the webhook URL with a simple ping
    try {
      const testPayload = {
        event: "webhook.test",
        webhook_id: webhookId,
        timestamp: new Date().toISOString(),
        data: { message: "Webhook registration test" }
      };
      
      // Note: In a real implementation, you would make an HTTP request to test the webhook
      console.log(`🔍 Would send test payload to ${url}:`, testPayload);
      
    } catch (testError) {
      console.warn("⚠️ Webhook URL test failed:", testError);
    }
    
    res.json({
      success: true,
      webhook: webhookConfig,
      message: "Webhook registered successfully"
    });
    
  } catch (error) {
    console.error("❌ Error registering webhook:", error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get("/health", async (req: Request, res: Response) => {
  try {
    console.log("🔍 Health check: Checking Mastra instance...");
    const mastra = await mastraPromise;
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
  return chunk.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

// Stream Mastra response using f0ed protocol
async function streamMastraResponse(stream: any, res: Response): Promise<number> {
  let totalLength = 0;
  
  try {
    for await (const chunk of stream.textStream) {
      if (typeof chunk === 'string' && chunk.trim()) {
        totalLength += chunk.length;
        // Split into characters and emit each as a separate 0: line
        for (const ch of chunk) {
          res.write(`0:"${encodeChunk(ch)}"\n`);
        }
      }
    }
  } catch (error) {
    console.error("❌ Error streaming response:", error);
    const fallback = "申し訳ございませんが、エラーが発生しました。";
    totalLength = fallback.length;
    for (const ch of fallback) {
      res.write(`0:"${encodeChunk(ch)}"\n`);
    }
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
    if (typeof resolvedAgent.stream === 'function') {
      console.log("🔍 Testing stream method...");
      const stream = await resolvedAgent.stream(messages);
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

// Main endpoint for the customer identification agent (main entry point)
app.post("/api/agents/customer-identification/stream", async (req: Request, res: Response) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const sessionId = getSessionId(req);
    const session = getSession(sessionId);
    
    console.log(`🔍 Processing request with ${messages.length} messages`);
    console.log(`🔍 Session ID: ${sessionId}`);
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
      
      // Also store customer data in shared memory for tools to access
      try {
        const mastra = await mastraPromise;
        const customerAgent = mastra.getAgentById("customer-identification");
        if (customerAgent) {
          const resolvedAgent = await customerAgent;
          if (resolvedAgent.memory) {
            resolvedAgent.memory.set("customerId", session.customerId);
            resolvedAgent.memory.set("sessionId", sessionId);
            console.log(`🔍 Stored customer data in shared memory: ${session.customerId}`);
          }
        }
      } catch (error) {
        console.log(`❌ Error storing customer data in shared memory:`, error);
      }
    }
    
    // Update session timestamp
    session.lastInteraction = Date.now();
    
    const agent = await getAgentById(targetAgentId);
    if (!agent) {
      return res.status(500).json({ error: `Agent '${targetAgentId}' not found` });
    }
    
    // Set headers for streaming response
    prepareStreamHeaders(res);
    
    // Execute the agent using Mastra's stream method
    const resolvedAgent = await agent; // Resolve the agent promise first
    console.log("🔍 Resolved agent methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(resolvedAgent)));
    console.log("🔍 Resolved agent type:", typeof resolvedAgent);
    console.log("🔍 Resolved agent stream method:", typeof resolvedAgent.stream);
    
    // Create a context object with session data for tools only
    const toolContext = {
      sessionId: sessionId,
      session: session,
      customerId: session.customerId
    };
    
    console.log(`🔍 Tool context:`, JSON.stringify(toolContext, null, 2));
    
    // Try different methods based on Mastra documentation
    let stream;
    if (typeof resolvedAgent.stream === 'function') {
      // Don't pass session data in context to avoid message format issues
      stream = await resolvedAgent.stream(normalizedMessages);
    } else if (typeof resolvedAgent.execute === 'function') {
      const result = await resolvedAgent.execute(normalizedMessages);
      // Convert result to stream format for Mastra f0ed protocol
      stream = {
        textStream: (async function* () {
          if (typeof result === 'string') {
            yield result;
          } else if (result && typeof result === 'object' && result.text) {
            yield result.text;
          } else if (result && typeof result === 'object' && result.content) {
            yield result.content;
          } else {
            yield JSON.stringify(result);
          }
        })()
      };
    } else if (typeof resolvedAgent.run === 'function') {
      const result = await resolvedAgent.run(normalizedMessages);
      // Convert result to stream format for Mastra f0ed protocol
      stream = {
        textStream: (async function* () {
          if (typeof result === 'string') {
            yield result;
          } else if (result && typeof result === 'object' && result.text) {
            yield result.text;
          } else if (result && typeof result === 'object' && result.content) {
            yield result.content;
          } else {
            yield JSON.stringify(result);
          }
        })()
      };
    } else {
      throw new Error(`Agent does not have stream, execute, or run method. Available methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(resolvedAgent)).join(', ')}`);
    }
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
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

// Legacy endpoint for UI compatibility - redirects to customer-identification
app.post("/api/agents/repair-workflow-orchestrator/stream", async (req: Request, res: Response) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const agent = await getAgentById("customer-identification");
    
    if (!agent) {
      return res.status(500).json({ error: "Agent 'customer-identification' not found" });
    }

    console.log(`🔍 Processing UI request with ${messages.length} messages`);
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
    
    // Set headers for streaming response
    prepareStreamHeaders(res);
    
    // Execute the agent using Mastra's stream method
    const resolvedAgent = await agent; // Resolve the agent promise first
    console.log("🔍 Resolved agent methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(resolvedAgent)));
    console.log("🔍 Resolved agent type:", typeof resolvedAgent);
    console.log("🔍 Resolved agent stream method:", typeof resolvedAgent.stream);
    
    // Try different methods based on Mastra documentation
    let stream;
    if (typeof resolvedAgent.stream === 'function') {
      stream = await resolvedAgent.stream(normalizedMessages);
    } else if (typeof resolvedAgent.execute === 'function') {
      const result = await resolvedAgent.execute(normalizedMessages);
      // Convert result to stream format for Mastra f0ed protocol
      stream = {
        textStream: (async function* () {
          if (typeof result === 'string') {
            yield result;
          } else if (result && typeof result === 'object' && result.text) {
            yield result.text;
          } else if (result && typeof result === 'object' && result.content) {
            yield result.content;
          } else {
            yield JSON.stringify(result);
          }
        })()
      };
    } else if (typeof resolvedAgent.run === 'function') {
      const result = await resolvedAgent.run(normalizedMessages);
      // Convert result to stream format for Mastra f0ed protocol
      stream = {
        textStream: (async function* () {
          if (typeof result === 'string') {
            yield result;
          } else if (result && typeof result === 'object' && result.text) {
            yield result.text;
          } else if (result && typeof result === 'object' && result.content) {
            yield result.content;
          } else {
            yield JSON.stringify(result);
          }
        })()
      };
    } else {
      throw new Error(`Agent does not have stream, execute, or run method. Available methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(resolvedAgent)).join(', ')}`);
    }
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const fullTextLength = await streamMastraResponse(stream, res);
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    
    console.log(`✅ UI Response complete, length: ${fullTextLength} characters`);
    res.end();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /repair-workflow-orchestrator/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
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
    
    // Execute the agent using Mastra's stream method
    const resolvedAgent = await agent;
    const stream = await resolvedAgent.stream(normalizedMessages);
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
    // Stream using Mastra-compliant helper (0:"..." lines)
    const fullTextLength = await streamMastraResponse(stream, res);
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    
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

    // Execute the agent using Mastra's stream method
    const resolvedAgent = await agent; // Resolve the agent promise first
    const stream = await resolvedAgent.stream(messages);
    
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

    // Execute the agent using Mastra's stream method
    const resolvedAgent = await agent; // Resolve the agent promise first
    const stream = await resolvedAgent.stream(messages);
    
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

    // Execute the agent using Mastra's stream method
    const resolvedAgent = await agent; // Resolve the agent promise first
    const stream = await resolvedAgent.stream(messages);
    
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

// Plamo Model API Routes
app.get("/api/plamo/health", async (req: Request, res: Response) => {
  try {
    console.log("🔍 Plamo health check...");
    const health = await plamoProvider.healthCheck();
    console.log("✅ Plamo health:", health);
    res.json(health);
  } catch (error) {
    console.error("❌ Plamo health check error:", error);
    res.status(500).json({ 
      status: 'unhealthy', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

app.post("/api/plamo/chat/completions", async (req: Request, res: Response) => {
  try {
    const { messages, stream = true } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required" });
    }
    
    console.log(`🤖 Plamo chat request: ${messages.length} messages`);
    
    if (stream) {
      // Set headers for streaming response
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Transfer-Encoding', 'chunked');
      
      // Generate a unique message ID
      const messageId = `plamo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Send the message ID first (Mastra f0ed format)
      res.write(`0:${JSON.stringify({ id: messageId })}\n`);
      
      // Get session context
      const sessionId = getSessionId(req);
      const session = getSession(sessionId);
      
      // Get streaming response with Langfuse integration
      const stream = await plamoProvider.generateStream(messages, {
        customerId: session.customerId,
        sessionId: sessionId,
        context: session
      });
      
      let fullTextLength = 0;
      
      stream.on('data', (chunk) => {
        if (chunk.textDelta) {
          fullTextLength += chunk.textDelta.length;
          // Send in Mastra f0ed format: 0:"text"
          res.write(`0:"${chunk.textDelta}"\n`);
        }
      });
      
      stream.on('end', (result) => {
        // Send finish metadata
        res.write(`0:${JSON.stringify({ 
          finishReason: 'stop',
          usage: result.usage 
        })}\n`);
        console.log(`✅ Plamo streaming complete, length: ${fullTextLength} characters`);
        res.end();
      });
      
      stream.on('error', (error) => {
        console.error("❌ Plamo streaming error:", error);
        res.write(`0:${JSON.stringify({ error: error.message })}\n`);
        res.end();
      });
      
    } else {
      // Non-streaming response
      const sessionId = getSessionId(req);
      const session = getSession(sessionId);
      
      const response = await plamoProvider.generate(messages, {
        customerId: session.customerId,
        sessionId: sessionId,
        context: session
      });
      
      res.json({
        id: `plamo-${Date.now()}`,
        text: response.text,
        usage: response.usage
      });
    }
    
  } catch (error) {
    console.error("❌ Plamo chat error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

app.post("/api/plamo/generate", async (req: Request, res: Response) => {
  try {
    const { messages, prompt } = req.body;
    
    if (!messages && !prompt) {
      return res.status(400).json({ error: "Messages array or prompt is required" });
    }
    
    console.log(`🤖 Plamo generate request`);
    
    let response;
    if (messages) {
      // Use messages array with Langfuse integration
      const sessionId = getSessionId(req);
      const session = getSession(sessionId);
      
      response = await plamoProvider.generate(messages, {
        customerId: session.customerId,
        sessionId: sessionId,
        context: session
      });
    } else {
      // Fallback to direct prompt (for backward compatibility)
      const testMessages = [{ role: 'user', content: prompt }];
      response = await plamoProvider.generate(testMessages);
    }
    
    res.json(response);
    
  } catch (error) {
    console.error("❌ Plamo generate error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// Start server
const PORT = process.env.PORT || 80;

const server = app.listen(PORT, () => {
  console.log(`🚀 Mastra server started successfully!`);
  console.log(`🌐 Server running on port ${PORT} (configured in Lightsail firewall)`);
  console.log(`🔗 Main endpoint: POST /api/agents/customer-identification/stream`);
  console.log(`🔗 Legacy endpoints: POST /api/agents/repair-workflow-orchestrator/stream (redirects to customer-identification)`);
  console.log(`🔗 Individual agent endpoints:`);
  console.log(`   - POST /api/agents/repair-agent/stream`);
  console.log(`   - POST /api/agents/repair-history-ticket/stream`);
  console.log(`   - POST /api/agents/repair-scheduling/stream`);
  console.log(`🔗 Plamo model endpoints:`);
  console.log(`   - GET /api/plamo/health`);
  console.log(`   - POST /api/plamo/chat/completions (streaming)`);
  console.log(`   - POST /api/plamo/generate (non-streaming)`);
  console.log(`🔗 Health check: GET /health`);
});

// Set server timeout to 60 seconds for long-running requests
server.timeout = 60000;
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Shutting down server...');
  process.exit(0);
});

import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from 'http-proxy-middleware';

// Load environment variables FIRST before any other imports
dotenv.config({ path: "./server.env" });

import { mastraPromise } from "./mastra/index.js";
import { langfuse } from "./integrations/langfuse.js";
import { plamoProvider } from "./integrations/plamo-mastra.js";

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
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'https://demo.dev-maestra.vottia.me',
      'https://mastra.demo.dev-maestra.vottia.me'
    ];

    if (allowedOrigins.indexOf(origin) !== -1 || process.env.CORS_ORIGIN === '*') {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Reverse Proxy for Production/Development Routing
app.use('/api', (req: Request, res: Response, next) => {
  const referer = req.headers.referer || '';
  const userAgent = req.headers['user-agent'] || '';

  console.log(`🔀 Reverse proxy check: ${req.method} ${req.path}`);
  console.log(`   Referer: ${referer}`);
  console.log(`   User-Agent: ${userAgent}`);

  // For now, route ALL /api/* requests to development backend
  // This ensures the backend works even if CloudFront routing is not configured
  console.log(`🔀 Routing ALL /api/* to DEVELOPMENT backend`);
  return next();
});

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
        langfuse: "connected",
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

// Alias for UI path prefix
app.get("/sanden-dev/api/health", async (req: Request, res: Response) => {
  try {
    console.log("🔍 Mastra backend health check (prefixed)...");
    const mastra = await mastraPromise;
    const healthStatus = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      mastra: "initialized",
      agents: {
        available: mastra.agents ? Object.keys(mastra.agents) : [],
        count: mastra.agents ? Object.keys(mastra.agents).length : 0
      },
      integrations: {
        langfuse: "connected",
        plamo: "available"
      }
    };
    res.json(healthStatus);
  } catch (error) {
    console.error("❌ Mastra backend health check failed (prefixed):", error);
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

// SDKv5 Helper - No longer need legacy Mastra streaming helpers
// All streaming now uses streamVNext with format: 'aisdk' and toUIMessageStreamResponse()

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
    
    // Use SDKv5 streamVNext for testing
    console.log("🤖 [SDKv5] Testing agent with streamVNext...");

    const stream = await resolvedAgent.streamVNext(messages, {
      format: 'aisdk',
      memory: {
        thread: `test-${Date.now()}`,
        resource: "customer-identification",
      },
    });

    // Collect the response
    let result = "";
    for await (const chunk of stream.textStream) {
      if (typeof chunk === 'string') {
        result += chunk;
      }
    }

    return res.json({ success: true, result: result });
    
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
    
    // SDKv5 handles streaming headers automatically
    
    // Execute the agent using Mastra's stream method
    const resolvedAgent = await agent; // Resolve the agent promise first
    console.log("🔍 Resolved agent methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(resolvedAgent)));
    console.log("🔍 Resolved agent type:", typeof resolvedAgent);
    console.log("🔍 Resolved agent stream method:", typeof resolvedAgent.stream);
    
    // Create a comprehensive context object with session data for tools
    const toolContext = {
      sessionId: sessionId,
      session: session,
      customerId: session.customerId,
      // Ensure customer ID is always available at root level
      ...(session.customerId && { customerId: session.customerId }),
      // Add customer profile data if available
      ...(session.customerProfile && { customerProfile: session.customerProfile })
    };
    
    console.log(`🔍 Tool context:`, JSON.stringify(toolContext, null, 2));
    
    // Store customer data in shared memory for all agents to access
    if (session.customerId) {
      try {
        const mastra = await mastraPromise;
        // Update shared memory for all agents
        const agents = ['customer-identification', 'repair-agent', 'repair-scheduling', 'repair-history-ticket'];
        for (const agentId of agents) {
          const agent = mastra.getAgentById(agentId);
          if (agent) {
            const resolvedAgent = await agent;
            if (resolvedAgent.memory) {
              resolvedAgent.memory.set("customerId", session.customerId);
              resolvedAgent.memory.set("sessionId", sessionId);
              resolvedAgent.memory.set("session", session);
              console.log(`🔍 Updated shared memory for agent ${agentId}: ${session.customerId}`);
            }
          }
        }
      } catch (error) {
        console.log(`❌ Error updating shared memory for agents:`, error);
      }
    }
    
    // Use SDKv5 streamVNext with proper format (based on official Mastra SDKv5 reference)
    console.log(`🤖 [SDKv5] Using streamVNext for agent: ${targetAgentId}`);

    const stream = await resolvedAgent.streamVNext(normalizedMessages, {
      format: 'aisdk',  // Use AI SDK v5 format
      memory: {
        thread: sessionId,
        resource: targetAgentId,
      },
    });

    // Return SDKv5 compatible UI message stream response
    return stream.toUIMessageStreamResponse();
    
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
    
    // SDKv5 handles streaming headers automatically
    
    // Execute the agent using Mastra's stream method
    const resolvedAgent = await agent; // Resolve the agent promise first
    console.log("🔍 Resolved agent methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(resolvedAgent)));
    console.log("🔍 Resolved agent type:", typeof resolvedAgent);
    console.log("🔍 Resolved agent stream method:", typeof resolvedAgent.stream);
    
    // Use SDKv5 streamVNext with proper format
    console.log(`🤖 [SDKv5] Using streamVNext for legacy UI endpoint`);

    const stream = await resolvedAgent.streamVNext(normalizedMessages, {
      format: 'aisdk',
      memory: {
        thread: `legacy-${Date.now()}`,
        resource: "customer-identification",
      },
    });

    // Return SDKv5 compatible UI message stream response
    return stream.toUIMessageStreamResponse();
    
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
    
    // SDKv5 handles streaming headers automatically
    
    // Use SDKv5 streamVNext with proper format
    console.log(`🤖 [SDKv5] Using streamVNext for orchestrator endpoint`);

    const resolvedAgent = await agent;
    const stream = await resolvedAgent.streamVNext(normalizedMessages, {
      format: 'aisdk',
      memory: {
        thread: `orchestrator-${Date.now()}`,
        resource: "orchestrator",
      },
    });

    // Return SDKv5 compatible UI message stream response
    return stream.toUIMessageStreamResponse();
    
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
    const sessionId = getSessionId(req);
    const agent = await getAgentById("repair-agent");

    if (!agent) {
      return res.status(500).json({ error: "Repair agent not found" });
    }

    // Use SDKv5 streamVNext with proper format
    console.log(`🤖 [SDKv5] Using streamVNext for repair-agent endpoint`);

    const resolvedAgent = await agent;
    const stream = await resolvedAgent.streamVNext(messages, {
      format: 'aisdk',
      memory: {
        thread: sessionId,
        resource: "repair-agent",
      },
    });

    // Return SDKv5 compatible UI message stream response
    return stream.toUIMessageStreamResponse();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /repair-agent/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/agents/repair-history-ticket/stream", async (req: Request, res: Response) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const sessionId = getSessionId(req);
    const agent = await getAgentById("repair-history-ticket");

    if (!agent) {
      return res.status(500).json({ error: "Repair history agent not found" });
    }

    // Use SDKv5 streamVNext with proper format
    console.log(`🤖 [SDKv5] Using streamVNext for repair-history-ticket endpoint`);

    const resolvedAgent = await agent;
    const stream = await resolvedAgent.streamVNext(messages, {
      format: 'aisdk',
      memory: {
        thread: sessionId,
        resource: "repair-history-ticket",
      },
    });

    // Return SDKv5 compatible UI message stream response
    return stream.toUIMessageStreamResponse();
    
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

    // Use SDKv5 streamVNext with proper format
    console.log(`🤖 [SDKv5] Using streamVNext for repair-scheduling endpoint`);

    const resolvedAgent = await agent;
    const stream = await resolvedAgent.streamVNext(messages, {
      format: 'aisdk',
      memory: {
        thread: sessionId,
        resource: "repair-scheduling",
      },
    });

    // Return SDKv5 compatible UI message stream response
    return stream.toUIMessageStreamResponse();
    
  } catch (error: unknown) {
    console.error("❌ [Endpoint] /repair-scheduling/stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

// AI SDK v5 Compatible Streaming Endpoints for UI

// Test endpoint that the UI expects (defaults to customer-identification agent)
async function handleTestStream(req: Request, res: Response) {
  try {
    const { messages, tools = {}, unstable_assistantMessageId, runConfig = {} } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required" });
    }

    console.log(`🤖 AI SDK v5 UI test stream request, messages: ${messages.length}`);

    // Normalize messages to handle complex UI format (same as customer-identification endpoint)
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

    // Default to customer-identification agent for test endpoint
    const agentId = "customer-identification";

    // Get the agent
    const agent = await getAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ error: `Agent '${agentId}' not found` });
    }

    const resolvedAgent = await agent;

    console.log(`🔍 Agent methods available:`, Object.getOwnPropertyNames(Object.getPrototypeOf(resolvedAgent)));

        // Use Mastra streamVNext and convert to f0ed protocol for UI compatibility
        console.log(`🤖 [Mastra streamVNext] Using streamVNext for test endpoint: ${agentId}`);

        const stream = await resolvedAgent.streamVNext(normalizedMessages, { format: 'aisdk' });

        // Prepare headers for Mastra streaming protocol
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        // Generate a unique message ID
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Send the message ID first
        res.write(`f:{"messageId":"${messageId}"}\n`);

        // Try to access textStream from streamVNext
        let totalLength = 0;
        if (stream.textStream) {
          for await (const chunk of stream.textStream) {
            if (typeof chunk === 'string' && chunk.trim()) {
              totalLength += chunk.length;
              // Split into characters and emit each as a separate 0: line
              for (const ch of chunk) {
                const escaped = ch.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
                res.write(`0:"${escaped}"\n`);
              }
            }
          }
        } else {
          // Fallback: convert SSE data to f0ed format
          const reader = stream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              if (value && typeof value === 'string') {
                // Parse SSE data and extract text
                const lines = value.split('\n');
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try {
                      const data = JSON.parse(line.slice(6));
                      if (data.type === 'text' && data.content) {
                        for (const ch of data.content) {
                          const escaped = ch.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
                          res.write(`0:"${escaped}"\n`);
                          totalLength++;
                        }
                      }
                    } catch (e) {
                      // Skip invalid JSON
                    }
                  }
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
        }

        // Send finish metadata
        res.write(`e:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":${totalLength}},"isContinued":false}\n`);
        res.write(`d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":${totalLength}}}\n`);

        console.log(`✅ Test endpoint response complete, length: ${totalLength} characters`);
        res.end();

  } catch (error) {
    console.error(`❌ [Endpoint] /api/test/stream error:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

app.post("/api/test/stream", handleTestStream);
app.post("/sanden-dev/api/test/stream", handleTestStream);

// AI SDK v5 Compatible Streaming Endpoints for UI
app.post("/api/agents/:agentId/stream/vnext/ui", async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required" });
    }

    console.log(`🤖 AI SDK v5 UI stream request for agent: ${agentId}, messages: ${messages.length}`);

    // Get the agent
    const agent = await getAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ error: `Agent '${agentId}' not found` });
    }

    const resolvedAgent = await agent;

    // Use SDKv5 streamVNext with proper format (official reference pattern)
    console.log(`🤖 [SDKv5] Using streamVNext for agent: ${agentId}`);

    const stream = await resolvedAgent.streamVNext(messages, {
      format: 'aisdk',
      memory: {
        thread: `vnext-${Date.now()}`,
        resource: agentId,
      },
    });

    // Return AI SDK v5 compatible response
    return stream.toUIMessageStreamResponse();

  } catch (error) {
    console.error(`❌ [Endpoint] /api/agents/${req.params.agentId}/stream/vnext/ui error:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
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

// Disable serving local static UI; UI is hosted externally
app.get('/', (req: Request, res: Response) => {
  res.status(200).send('Sanden Mastra backend is running.');
});

// Start server
const PORT = 80; // Force port 80

const server = app.listen(PORT, '0.0.0.0', () => {
  const actualPort = (server.address() as any)?.port || PORT;
  console.log(`🚀 SDKv5 Mastra server started successfully!`);
  console.log(`🌐 Server running on port ${actualPort} (configured in Lightsail firewall, env PORT=${PORT})`);
  console.log(`🔗 Main endpoint: POST /api/agents/customer-identification/stream`);
  console.log(`🔗 Legacy endpoints: POST /api/agents/repair-workflow-orchestrator/stream (redirects to customer-identification)`);
  console.log(`🔗 Individual agent endpoints:`);
  console.log(`   - POST /api/agents/repair-agent/stream`);
  console.log(`   - POST /api/agents/repair-history-ticket/stream`);
  console.log(`   - POST /api/agents/repair-scheduling/stream`);
  console.log(`🔗 AI SDK v5 UI endpoints:`);
  console.log(`   - POST /api/test/stream (AI SDK v5 UI test endpoint)`);
  console.log(`   - POST /api/agents/{agentId}/stream/vnext/ui (AI SDK v5 compatible)`);
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

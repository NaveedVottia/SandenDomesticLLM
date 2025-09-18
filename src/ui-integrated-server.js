// Modified Mastra Server with UI Langfuse Integration
// This shows how to integrate the UI tracer into the existing server

import express from 'express';
import cors from 'cors';
import { uiTracer, determineAgentAndTool, extractUserMessage } from './ui-langfuse-tracer.js';

const app = express();
app.use(cors());
app.use(express.json());

// Session management (simplified)
const sessions = new Map();

function getSessionId(req) {
  return req.headers['x-session-id'] || req.body.sessionId || `session-${Date.now()}`;
}

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      customerId: null,
      customerName: null,
      companyName: null,
      step: 'identification'
    });
  }
  return sessions.get(sessionId);
}

// Main streaming endpoint with UI Langfuse integration
app.post("/api/agents/customer-identification/stream", async (req, res) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const sessionId = getSessionId(req);
    const session = getSession(sessionId);
    
    console.log(`🔍 Processing UI request with ${messages.length} messages`);
    console.log(`🔍 Session ID: ${sessionId}`);
    
    // Extract user message for tracing
    const userMessage = extractUserMessage(messages);
    
    // Start or continue conversation trace
    let traceId = uiTracer.getActiveTraceId(sessionId);
    if (!traceId) {
      traceId = await uiTracer.startConversationTrace(sessionId, userMessage);
    }
    
    // Log user message to Langfuse
    if (userMessage) {
      const { agent, tool, prompt } = determineAgentAndTool(session, userMessage, 'customer-identification');
      await uiTracer.logUserMessage(sessionId, userMessage, agent, tool, prompt);
    }
    
    // Normalize messages to handle complex UI format
    const normalizedMessages = messages.map((msg) => {
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        const textContent = msg.content
          .filter((item) => item.type === 'text' && item.text)
          .map((item) => item.text)
          .join(' ');
        return { role: 'user', content: textContent };
      } else if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        const textContent = msg.content
          .filter((item) => item.type === 'text' && item.text)
          .map((item) => item.text)
          .join(' ');
        return { role: 'assistant', content: textContent };
      }
      return msg;
    });
    
    // Determine which agent to use based on session state and user input
    let targetAgentId = "customer-identification";
    const userInput = normalizedMessages[normalizedMessages.length - 1]?.content || "";
    
    // Agent routing logic
    if (session.customerId && userInput.includes('修理')) {
      targetAgentId = "repair-history-ticket";
    } else if (session.customerId && (userInput.includes('予約') || userInput.includes('訪問'))) {
      targetAgentId = "repair-agent";
    }
    
    console.log(`🤖 Routing to agent: ${targetAgentId}`);
    
    // Generate response (simplified - in real implementation, this would call the actual agent)
    let response = '';
    let fullResponse = '';
    
    if (targetAgentId === 'customer-identification') {
      if (!session.customerId) {
        response = 'こんにちは！修理のご相談、ありがとうございます。お客様の会社名、お名前、連絡先をお教えいただけますでしょうか？';
      } else {
        response = `田中様、ありがとうございます。${session.companyName}の${session.customerId}で登録を確認いたしました。どのような修理のご相談でしょうか？`;
      }
    } else if (targetAgentId === 'repair-history-ticket') {
      response = '自動販売機の冷却不良ですね。過去にも同様の修理履歴がございます。緊急度は中程度と判断いたします。いつ頃の訪問がご希望でしょうか？';
    } else if (targetAgentId === 'repair-agent') {
      response = '承知いたしました。9月18日（水）18:00に訪問予定で修理ID REP202509120224を作成いたしました。確認メールをお送りいたします。';
    }
    
    fullResponse = response;
    
    // Set headers for streaming response
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Generate a unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    res.write(`0:${JSON.stringify({ id: messageId })}\n`);
    
    // Stream the response
    const words = response.split(' ');
    let currentText = '';
    
    for (let i = 0; i < words.length; i++) {
      currentText += words[i] + ' ';
      res.write(`0:"${words[i]} "\n`);
      
      // Small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Send finish metadata
    res.write(`0:${JSON.stringify({ 
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: words.length }
    })}\n`);
    
    // Log assistant response to Langfuse
    const { agent, tool, prompt } = determineAgentAndTool(session, userInput, targetAgentId);
    await uiTracer.logAssistantResponse(sessionId, response, agent, tool, prompt, fullResponse);
    
    // Update session based on conversation
    if (userInput.includes('セブンイレブン') && !session.customerId) {
      session.customerId = 'CUST004';
      session.companyName = 'セブンイレブン 秋葉原店';
      session.customerName = '田中';
    }
    
    console.log(`✅ UI Response complete for session ${sessionId}`);
    console.log(`✅ Updated session:`, JSON.stringify(session, null, 2));
    
    res.end();
  } catch (error) {
    console.error("❌ UI streaming error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
});

// Endpoint to end conversation and close trace
app.post("/api/conversation/end", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    
    await uiTracer.endConversationTrace(sessionId, 'completed');
    
    res.json({ 
      success: true, 
      message: 'Conversation ended and trace closed',
      sessionId: sessionId
    });
  } catch (error) {
    console.error("❌ Error ending conversation:", error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uiTracing: 'enabled'
  });
});

// Start server
const PORT = process.env.PORT || 80;
app.listen(PORT, () => {
  console.log(`🚀 Mastra server with UI Langfuse integration started!`);
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`🔗 Main endpoint: POST /api/agents/customer-identification/stream`);
  console.log(`🔗 End conversation: POST /api/conversation/end`);
  console.log(`🔗 Health check: GET /health`);
  console.log(`📊 UI Tracing: Enabled for https://demo.dev-maestra.vottia.me/sanden-dev`);
});

export default app;

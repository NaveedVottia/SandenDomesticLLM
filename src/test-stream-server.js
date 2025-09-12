import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "./server.env" });

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    server: "test-stream-server"
  });
});

// Helper function to encode chunks for Mastra f0ed protocol
function encodeChunk(chunk) {
  return chunk.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

// Prepare headers for Mastra streaming protocol
function prepareStreamHeaders(res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  try { res.flushHeaders(); } catch {}
}

// Write message id line and flush
function writeMessageId(res, messageId) {
  res.write(`f:{"messageId":"${messageId}"}\n`);
  try { res.flush?.(); } catch {}
}

// Write finish metadata (e:/d:) and flush
function writeFinish(res, fullTextLength) {
  res.write(`e:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":${fullTextLength}},"isContinued":false}\n`);
  res.write(`d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":${fullTextLength}}}\n`);
  try { res.flush?.(); } catch {}
}

// Main streaming endpoint at /api/test/stream
app.post("/api/test/stream", async (req, res) => {
  try {
    const { messages, prompt } = req.body;
    
    console.log(`🔍 Test stream request received`);
    console.log(`🔍 Messages:`, messages);
    console.log(`🔍 Prompt:`, prompt);
    
    // Set headers for streaming response
    prepareStreamHeaders(res);
    
    // Generate a unique message ID
    const messageId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send the message ID first
    writeMessageId(res, messageId);
    
    // Create test response text
    const testResponse = "これはテストストリーミングレスポンスです。Mastra f0edプロトコルでストリーミングしています。";
    
    let fullTextLength = 0;
    
    // Stream the response character by character in f0ed format
    for (const char of testResponse) {
      fullTextLength += char.length;
      res.write(`0:"${encodeChunk(char)}"\n`);
      // Add small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Send finish metadata
    writeFinish(res, fullTextLength);
    
    console.log(`✅ Test stream complete, length: ${fullTextLength} characters`);
    res.end();
    
  } catch (error) {
    console.error("❌ Test stream error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// Start server
const PORT = process.env.PORT || 80;

const server = app.listen(PORT, () => {
  console.log(`🚀 Test stream server started successfully!`);
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`🔗 Test stream endpoint: POST /api/test/stream`);
  console.log(`🔗 Health check: GET /health`);
});

// Set server timeout
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

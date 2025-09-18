// Langfuse UI Integration for Mastra Server
// This code should be integrated into the streaming endpoints

import { langfuse } from './dist/integrations/langfuse.js';

class UILangfuseTracer {
  constructor() {
    this.activeTraces = new Map(); // sessionId -> traceId
    this.conversationSteps = new Map(); // sessionId -> steps[]
  }

  async startConversationTrace(sessionId, userMessage) {
    try {
      const traceId = await langfuse.startTrace(`UI Conversation - ${sessionId}`, {
        source: 'UI',
        uiUrl: 'https://demo.dev-maestra.vottia.me/sanden-dev',
        sessionId: sessionId,
        userMessage: userMessage,
        startTime: new Date().toISOString()
      });
      
      this.activeTraces.set(sessionId, traceId);
      this.conversationSteps.set(sessionId, []);
      
      console.log(`📊 UI Trace started: ${traceId} for session ${sessionId}`);
      return traceId;
    } catch (error) {
      console.error('❌ Failed to start UI trace:', error.message);
      return null;
    }
  }

  async logUserMessage(sessionId, message, agent, tool, prompt) {
    try {
      const traceId = this.activeTraces.get(sessionId);
      if (!traceId) return;

      const step = {
        step: this.getStepCount(sessionId) + 1,
        role: 'user',
        content: message,
        agent: agent,
        tool: tool,
        prompt: prompt,
        timestamp: new Date().toISOString()
      };

      await langfuse.logToolExecution(traceId, tool, {
        step: step.step,
        role: 'user',
        content: message,
        agent: agent,
        prompt: prompt,
        timestamp: step.timestamp
      }, {
        success: true,
        userInput: message,
        agent: agent,
        tool: tool,
        step: step.step
      }, {
        step: step.step,
        role: 'user',
        agent: agent,
        tool: tool,
        prompt: prompt,
        uiUrl: 'https://demo.dev-maestra.vottia.me/sanden-dev',
        conversationFlow: 'UI User Input'
      });

      this.addStep(sessionId, step);
      console.log(`📝 User message logged: Step ${step.step} for session ${sessionId}`);
    } catch (error) {
      console.error('❌ Failed to log user message:', error.message);
    }
  }

  async logAssistantResponse(sessionId, response, agent, tool, prompt, fullResponse = '') {
    try {
      const traceId = this.activeTraces.get(sessionId);
      if (!traceId) return;

      const step = {
        step: this.getStepCount(sessionId) + 1,
        role: 'assistant',
        content: response,
        fullResponse: fullResponse,
        agent: agent,
        tool: tool,
        prompt: prompt,
        timestamp: new Date().toISOString()
      };

      await langfuse.logToolExecution(traceId, tool, {
        step: step.step,
        role: 'assistant',
        content: response,
        agent: agent,
        prompt: prompt,
        timestamp: step.timestamp
      }, {
        success: true,
        response: response,
        fullResponse: fullResponse,
        agent: agent,
        tool: tool,
        step: step.step
      }, {
        step: step.step,
        role: 'assistant',
        agent: agent,
        tool: tool,
        prompt: prompt,
        uiUrl: 'https://demo.dev-maestra.vottia.me/sanden-dev',
        conversationFlow: 'UI Assistant Response'
      });

      this.addStep(sessionId, step);
      console.log(`📝 Assistant response logged: Step ${step.step} for session ${sessionId}`);
    } catch (error) {
      console.error('❌ Failed to log assistant response:', error.message);
    }
  }

  async endConversationTrace(sessionId, finalResult = 'completed') {
    try {
      const traceId = this.activeTraces.get(sessionId);
      if (!traceId) return;

      const steps = this.conversationSteps.get(sessionId) || [];
      
      await langfuse.endTrace(traceId, {
        finalResult: finalResult,
        totalSteps: steps.length,
        successfulSteps: steps.filter(s => s.success !== false).length,
        failedSteps: steps.filter(s => s.success === false).length,
        conversationType: 'UI Customer Service Flow',
        agentsUsed: [...new Set(steps.map(s => s.agent))],
        toolsUsed: [...new Set(steps.map(s => s.tool))],
        conversationFlow: steps.map(s => `${s.step}. ${s.role}: ${s.content.substring(0, 50)}...`).join(' → '),
        sessionId: sessionId,
        uiUrl: 'https://demo.dev-maestra.vottia.me/sanden-dev',
        source: 'UI',
        endTime: new Date().toISOString()
      });

      console.log(`📊 UI Trace ended: ${traceId} for session ${sessionId}`);
      
      // Cleanup
      this.activeTraces.delete(sessionId);
      this.conversationSteps.delete(sessionId);
    } catch (error) {
      console.error('❌ Failed to end UI trace:', error.message);
    }
  }

  getStepCount(sessionId) {
    const steps = this.conversationSteps.get(sessionId) || [];
    return steps.length;
  }

  addStep(sessionId, step) {
    const steps = this.conversationSteps.get(sessionId) || [];
    steps.push(step);
    this.conversationSteps.set(sessionId, steps);
  }

  getActiveTraceId(sessionId) {
    return this.activeTraces.get(sessionId);
  }
}

// Export singleton instance
export const uiTracer = new UILangfuseTracer();

// Helper function to determine agent and tool from request
export function determineAgentAndTool(session, userInput, targetAgentId) {
  // Map agent IDs to tool names
  const agentToolMap = {
    'customer-identification': 'customer_identification',
    'repair-history-ticket': 'getCustomerHistory',
    'repair-agent': 'createRepairTool',
    'repair-scheduling': 'scheduling_tool'
  };

  const tool = agentToolMap[targetAgentId] || 'general_handler';
  
  // Determine prompt based on context
  let prompt = 'Handle user request';
  if (session.customerId && userInput.includes('修理')) {
    prompt = 'Analyze repair request and suggest solution';
  } else if (!session.customerId && userInput.includes('会社')) {
    prompt = 'Identify customer and request company information';
  } else if (userInput.includes('予約') || userInput.includes('訪問')) {
    prompt = 'Schedule repair visit and create booking';
  }

  return { agent: targetAgentId, tool, prompt };
}

// Helper function to extract user message from request
export function extractUserMessage(messages) {
  if (!messages || !Array.isArray(messages)) return '';
  
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') return '';
  
  if (Array.isArray(lastMessage.content)) {
    return lastMessage.content
      .filter(item => item.type === 'text' && item.text)
      .map(item => item.text)
      .join(' ');
  }
  
  return lastMessage.content || '';
}

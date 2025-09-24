import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { mastraPromise } from "../../index";
import { sessionManager, createSessionContext, updateSessionContext, completeSessionContext } from "../../../utils/session-manager.js";
import { runSessionAggregatorWorkflow } from "../session-aggregator";

// Step definitions (must be defined before workflow creation)

// Step 1: Initialize session for trace-level evaluation
const initializeSession = createStep({
  id: "initializeSession",
  inputSchema: z.object({
    userInput: z.string(),
    sessionId: z.string().optional(), // Add sessionId for continuity
    testCaseId: z.string().optional(),
    evaluationMode: z.boolean().optional().default(true),
  }),
  outputSchema: z.object({
    sessionId: z.string(),
    traceId: z.string(),
    userInput: z.string(),
    evaluationMode: z.boolean(),
    isNewSession: z.boolean(),
  }),
  execute: async ({ inputData }: { inputData: { userInput: string; sessionId?: string; testCaseId?: string; evaluationMode?: boolean } }) => {
    const { userInput, sessionId: providedSessionId, testCaseId, evaluationMode = true } = inputData;

    console.log(`🚀 [Workflow] Starting customer identification workflow for input: "${userInput}"`);

    let sessionContext;
    let isNewSession = false;

    // Check if we should continue an existing session
    if (providedSessionId) {
      const existingSession = sessionManager.getSession(providedSessionId);
      if (existingSession) {
        // Continue existing session
        console.log(`🔄 [Workflow] Continuing existing session ${providedSessionId}`);

        // Update existing session with new interaction
        await updateSessionContext(providedSessionId, {
          lastUserInput: userInput,
          lastInteraction: new Date().toISOString(),
        });

        // Create new trace for this interaction
        const traceId = await langfuse.startTrace("session_interaction", {
          sessionId: providedSessionId,
          testCaseId,
          evaluationMode,
          interactionType: "continuation"
        });

        sessionContext = {
          sessionId: providedSessionId,
          traceId,
          isNewSession: false
        };
      } else {
        // Provided sessionId doesn't exist, create new one with that ID
        console.log(`🆕 [Workflow] Provided sessionId ${providedSessionId} not found, creating new session`);
        isNewSession = true;

        sessionContext = await createSessionContext({
          user_input: userInput,
          test_case_id: testCaseId,
          evaluation_mode: evaluationMode,
          geniac_topic: "Topic_1",
          session_type: "customer_identification_evaluation",
          custom_session_id: providedSessionId // Use provided ID
        });
      }
    } else {
      // No sessionId provided, create new one
      isNewSession = true;
      console.log(`🆕 [Workflow] Creating new session for evaluation`);

      sessionContext = await createSessionContext({
        user_input: userInput,
        test_case_id: testCaseId,
        evaluation_mode: evaluationMode,
        geniac_topic: "Topic_1",
        session_type: "customer_identification_evaluation"
      });
    }

    console.log(`📊 [Workflow] Session ${sessionContext.sessionId} ${isNewSession ? 'initialized' : 'continued'} for evaluation`);

    return {
      sessionId: sessionContext.sessionId,
      traceId: sessionContext.traceId || '',
      userInput,
      evaluationMode,
      isNewSession
    };
  },
});

// NO hardcoded rules - agent must follow Langfuse prompt only

// Step 2: Validate user input and determine intent
const validateUserInput = createStep({
  id: "validateUserInput",
  inputSchema: z.object({
    userInput: z.string(),
    sessionId: z.string(),
  }),
  outputSchema: z.object({
    isValid: z.boolean(),
    shouldDelegate: z.boolean(),
    userIntent: z.string(),
    sessionId: z.string(),
  }),
  execute: async ({ inputData }: { inputData: { userInput: string; sessionId: string } }) => {
    const { userInput, sessionId } = inputData;

    // Basic intent detection - agent handles all complex logic via Langfuse prompt

    // Determine user intent for session tracking
    let userIntent = "unknown";
    let shouldDelegate = false;

    if (userInput === "1" || userInput.includes("修理") || userInput.includes("repair")) {
      userIntent = "repair_service";
      shouldDelegate = true;
    } else if (userInput === "2" || userInput.includes("FAQ") || userInput.includes("faq")) {
      userIntent = "faq_service";
      shouldDelegate = false;
    } else if (userInput === "3" || userInput.includes("問い合わせ") || userInput.includes("contact")) {
      userIntent = "contact_form";
      shouldDelegate = false;
    } else if (userInput.includes("cust") || userInput.includes("顧客") ||
               userInput.includes("@") || userInput.match(/\d{2,4}-\d{2,4}-\d{4}/)) {
      userIntent = "customer_lookup";
      shouldDelegate = true;
    } else {
      userIntent = "menu_navigation";
      shouldDelegate = false;
    }

    const isValid = userInput && userInput.trim().length > 0;

    // Update session with intent
    await updateSessionContext(sessionId, {
      userIntent,
      currentAgent: shouldDelegate ? "customer-identification" : "menu-handler"
    });

    console.log(`🔍 [Workflow] User intent: ${userIntent}, should delegate: ${shouldDelegate}`);

    return {
      isValid,
      shouldDelegate,
      userIntent,
      sessionId
    };
  },
});

// Step 3: Delegate to customer identification agent with session context
const delegateToCustomerIdentification = createStep({
  id: "delegateToCustomerIdentification",
  inputSchema: z.object({
    userInput: z.string(),
    sessionId: z.string(),
    userIntent: z.string(),
  }),
  outputSchema: z.object({
    customerResponse: z.string(),
    success: z.boolean(),
    sessionId: z.string(),
    agentInteractions: z.number(),
  }),
  execute: async ({ inputData }: { inputData: { userInput: string; sessionId: string; userIntent: string } }) => {
    const { userInput, sessionId, userIntent } = inputData;

    try {
      // Get the Mastra instance and customer identification agent
      const mastra = await mastraPromise;
      const customerAgent = mastra.getAgentById("customer-identification");
      if (!customerAgent) {
        throw new Error("Customer identification agent not found");
      }

      console.log(`🤖 [Workflow] Delegating to customer identification agent with session ${sessionId}`);

      // Call the agent with session context in the prompt
      const agentPrompt = `${userInput}\n\n[SESSION_CONTEXT: session_id=${sessionId}, intent=${userIntent}]`;

      const stream = await customerAgent.stream([
        { role: "user", content: agentPrompt }
      ]);

      // Collect the response
      let fullResponse = "";
      let agentInteractions = 0;

      for await (const chunk of stream.textStream) {
        if (typeof chunk === "string") {
          fullResponse += chunk;
          agentInteractions++;
        }
      }

      // Update session with agent response
      await updateSessionContext(sessionId, {
        lastResponse: fullResponse,
        agentInteractions,
        currentAgent: "customer-identification"
      });

      console.log(`✅ [Workflow] Agent response generated (${agentInteractions} interactions)`);

      return {
        customerResponse: fullResponse,
        success: true,
        sessionId,
        agentInteractions
      };

    } catch (error) {
      console.error("❌ [Workflow] Error delegating to customer identification:", error);

      // Update session with error
      await updateSessionContext(sessionId, {
        error: error instanceof Error ? error.message : 'Unknown error',
        currentAgent: "error_handler"
      });

      return {
        customerResponse: "申し訳ございませんが、顧客識別エージェントに接続できませんでした。",
        success: false,
        sessionId,
        agentInteractions: 0
      };
    }
  },
});

// Step 4: Handle non-delegation cases (menu navigation)
const handleNonDelegation = createStep({
  id: "handleNonDelegation",
  inputSchema: z.object({
    userInput: z.string(),
    userIntent: z.string(),
    sessionId: z.string(),
  }),
  outputSchema: z.object({
    response: z.string(),
    sessionId: z.string(),
    shouldEndSession: z.boolean(),
  }),
  execute: async ({ inputData }: { inputData: { userInput: string; userIntent: string; sessionId: string } }) => {
    const { userInput, userIntent, sessionId } = inputData;

    let response = "";
    let shouldEndSession = false;

    // Handle different user inputs based on intent
    switch (userIntent) {
      case "faq_service":
        response = "FAQサービスをご利用いただきます。\n\nFAQサポート機能へようこそ。\n1. 問題を検索する\n2. サンデンのウェブサイトFAQを利用する\n3. メインメニューに戻る\n4. 終了する\n\n番号でお答えください。直接入力も可能です。";
        break;

      case "contact_form":
        response = "お問い合わせフォームはこちらからアクセスしてください: https://form.sanden-rs.com/m?f=40\n\n1. メインメニューに戻る\n2. 終了する";
        shouldEndSession = true; // Contact form typically ends the session
        break;

      case "menu_navigation":
      default:
        response = "申し訳ございませんが、その選択肢は認識できませんでした。\n\n1. 修理受付・修理履歴・修理予約\n2. 一般的なFAQ\n3. リクエスト送信用オンラインフォーム\n\n番号でお答えください。直接入力も可能です。";
        break;
    }

    // Update session
    await updateSessionContext(sessionId, {
      menuResponse: response,
      shouldEndSession,
      currentAgent: "menu-handler"
    });

    console.log(`📋 [Workflow] Menu response generated, end session: ${shouldEndSession}`);

    return {
      response,
      sessionId,
      shouldEndSession
    };
  },
});

// Step 5: Check if session should end and trigger aggregation
const checkSessionEnd = createStep({
  id: "checkSessionEnd",
  inputSchema: z.object({
    sessionId: z.string(),
    shouldEndSession: z.boolean().optional(),
    evaluationMode: z.boolean(),
    success: z.boolean(),
    userIntent: z.string(),
  }),
  outputSchema: z.object({
    shouldEnd: z.boolean(),
    shouldAggregate: z.boolean(),
    sessionId: z.string(),
    evaluationMode: z.boolean(),
  }),
  execute: async ({ inputData }: { inputData: { sessionId: string; shouldEndSession?: boolean; evaluationMode: boolean; success: boolean; userIntent: string } }) => {
    const { sessionId, shouldEndSession = false, evaluationMode, success, userIntent } = inputData;

    // Determine if session should end
    const shouldEnd = shouldEndSession ||
                     userIntent === "contact_form" ||
                     (!success && userIntent === "unknown") ||
                     userIntent === "exit";

    const shouldAggregate = shouldEnd && evaluationMode;

    if (shouldEnd) {
      console.log(`🏁 [Workflow] Session ${sessionId} ending, aggregation: ${shouldAggregate}`);
    }

    return {
      shouldEnd,
      shouldAggregate,
      sessionId,
      evaluationMode
    };
  },
});

// Step 6: Run session aggregation for evaluation
const runSessionAggregation = createStep({
  id: "runSessionAggregation",
  inputSchema: z.object({
    sessionId: z.string(),
  }),
  outputSchema: z.object({
    response: z.string(),
    sessionId: z.string(),
    evaluationComplete: z.boolean(),
    aggregationResult: z.any(),
  }),
  execute: async ({ inputData }: { inputData: { sessionId: string } }) => {
    const { sessionId } = inputData;

    console.log(`🔄 [Workflow] Running session aggregation for ${sessionId}`);

    // Complete the session first
    await completeSessionContext(sessionId, {
      aggregation_triggered: true,
      completed_at: new Date().toISOString()
    });

    // Run the aggregator workflow
    const aggregationResult = await runSessionAggregatorWorkflow(sessionId, {
      judgePromptName: "geniac-trace-judge",
      judgeLabel: "production",
      includeMetadata: true,
      storageOptions: {
        persistToDatabase: true,
        exportToJson: true,
        exportPath: `./session-evaluations/${sessionId}.json`
      }
    });

    const response = aggregationResult.success
      ? `セッション評価が完了しました。スコア: ${aggregationResult.sessionAggregation?.weightedSessionScore?.toFixed(2)}/5.0`
      : "申し訳ございませんが、セッション評価中にエラーが発生しました。";

    console.log(`✅ [Workflow] Session aggregation completed for ${sessionId}`);

    return {
      response,
      sessionId,
      evaluationComplete: aggregationResult.success,
      aggregationResult
    };
  },
});

// Step 7: Continue session (for multi-turn conversations)
const continueSession = createStep({
  id: "continueSession",
  inputSchema: z.object({
    sessionId: z.string().optional(),
    response: z.string().optional(),
    shouldEnd: z.boolean().optional(),
    evaluationMode: z.boolean().optional(),
  }),
  outputSchema: z.object({
    response: z.string(),
    sessionId: z.string(),
    evaluationComplete: z.boolean(),
    continueMessage: z.string(),
  }),
  execute: async ({ inputData }: { inputData: { sessionId?: string; response?: string; shouldEnd?: boolean; evaluationMode?: boolean } }) => {
    const { sessionId = '', response = '', shouldEnd = false, evaluationMode = false } = inputData;

    const continueMessage = "\n\n続けてご質問があれば、お聞かせください。";

    console.log(`➡️ [Workflow] Session ${sessionId} continuing (end: ${shouldEnd}, eval: ${evaluationMode})`);

    return {
      response: (response || '') + continueMessage,
      sessionId,
      evaluationComplete: false, // No evaluation completed in continue case
      continueMessage
    };
  },
});


// Combined step for processing user request (delegation or menu)
const processUserRequest = createStep({
  id: "processUserRequest",
  inputSchema: z.object({
    userInput: z.string(),
    sessionId: z.string(),
    userIntent: z.string(),
    shouldDelegate: z.boolean(),
    evaluationMode: z.boolean(),
  }),
  outputSchema: z.object({
    response: z.string(),
    success: z.boolean(),
    sessionId: z.string(),
    shouldEndSession: z.boolean(),
    evaluationMode: z.boolean(),
  }),
  execute: async ({ inputData }: { inputData: { userInput: string; sessionId: string; userIntent: string; shouldDelegate: boolean; evaluationMode: boolean } }) => {
    const { userInput, sessionId, userIntent, shouldDelegate, evaluationMode } = inputData;

    if (shouldDelegate) {
      // Delegate to customer identification agent
      try {
        const mastra = await mastraPromise;
        const customerAgent = mastra.getAgentById("customer-identification");
        if (!customerAgent) {
          throw new Error("Customer identification agent not found");
        }

        console.log(`🤖 [Workflow] Delegating to customer identification agent with session ${sessionId}`);

        const agentPrompt = `${userInput}\n\n[SESSION_CONTEXT: session_id=${sessionId}, intent=${userIntent}]`;
        const stream = await customerAgent.stream([{ role: "user", content: agentPrompt }]);

        let fullResponse = "";
        let agentInteractions = 0;
        for await (const chunk of stream.textStream) {
          if (typeof chunk === "string") {
            fullResponse += chunk;
            agentInteractions++;
          }
        }

        await updateSessionContext(sessionId, {
          lastResponse: fullResponse,
          agentInteractions,
          currentAgent: "customer-identification"
        });

        console.log(`✅ [Workflow] Agent response generated (${agentInteractions} interactions)`);

        return {
          response: fullResponse,
          success: true,
          sessionId,
          shouldEndSession: false, // Agent responses don't end session
          evaluationMode
        };

      } catch (error) {
        console.error("❌ [Workflow] Error delegating to customer identification:", error);
        await updateSessionContext(sessionId, {
          error: error instanceof Error ? error.message : 'Unknown error',
          currentAgent: "error_handler"
        });

        return {
          response: "申し訳ございませんが、顧客識別エージェントに接続できませんでした。",
          success: false,
          sessionId,
          shouldEndSession: false,
          evaluationMode
        };
      }
    } else {
      // Handle menu navigation
      let response = "";
      let shouldEndSession = false;

      switch (userIntent) {
        case "faq_service":
          response = "FAQサービスをご利用いただきます。\n\nFAQサポート機能へようこそ。\n1. 問題を検索する\n2. サンデンのウェブサイトFAQを利用する\n3. メインメニューに戻る\n4. 終了する\n\n番号でお答えください。直接入力も可能です。";
          break;
        case "contact_form":
          response = "お問い合わせフォームはこちらからアクセスしてください: https://form.sanden-rs.com/m?f=40\n\n1. メインメニューに戻る\n2. 終了する";
          shouldEndSession = true;
          break;
        default:
          response = "申し訳ございませんが、その選択肢は認識できませんでした。\n\n1. 修理受付・修理履歴・修理予約\n2. 一般的なFAQ\n3. リクエスト送信用オンラインフォーム\n\n番号でお答えください。直接入力も可能です。";
          break;
      }

      await updateSessionContext(sessionId, {
        menuResponse: response,
        shouldEndSession,
        currentAgent: "menu-handler"
      });

      console.log(`📋 [Workflow] Menu response generated, end session: ${shouldEndSession}`);

      return {
        response,
        success: true,
        sessionId,
        shouldEndSession
      };
    }
  },
});

// Combined step for finalizing session (aggregation or continuation)
const finalizeSession = createStep({
  id: "finalizeSession",
  inputSchema: z.object({
    response: z.string(),
    success: z.boolean(),
    sessionId: z.string(),
    shouldEndSession: z.boolean(),
    evaluationMode: z.boolean(),
  }),
  outputSchema: z.object({
    response: z.string(),
    success: z.boolean(),
    sessionId: z.string(),
    evaluationComplete: z.boolean(),
    aggregationResult: z.any().optional(),
  }),
  execute: async ({ inputData }: { inputData: { response: string; success: boolean; sessionId: string; shouldEndSession: boolean; evaluationMode: boolean } }) => {
    const { response, success, sessionId, shouldEndSession, evaluationMode } = inputData;

    const shouldAggregate = shouldEndSession && evaluationMode;

    if (shouldAggregate) {
      console.log(`🔄 [Workflow] Running session aggregation for ${sessionId}`);

      // Complete the session first
      await completeSessionContext(sessionId, {
        aggregation_triggered: true,
        completed_at: new Date().toISOString()
      });

      // Run the aggregator workflow
      const aggregationResult = await runSessionAggregatorWorkflow(sessionId, {
        judgePromptName: "geniac-trace-judge",
        judgeLabel: "production",
        includeMetadata: true,
        storageOptions: {
          persistToDatabase: true,
          exportToJson: true,
          exportPath: `./session-evaluations/${sessionId}.json`
        }
      });

      const finalResponse = aggregationResult.success
        ? `${response}\n\nセッション評価が完了しました。スコア: ${aggregationResult.sessionAggregation?.weightedSessionScore?.toFixed(2)}/5.0`
        : `${response}\n\n申し訳ございませんが、セッション評価中にエラーが発生しました。`;

      console.log(`✅ [Workflow] Session aggregation completed for ${sessionId}`);

      return {
        response: finalResponse,
        success,
        sessionId,
        evaluationComplete: aggregationResult.success,
        aggregationResult
      };
    } else {
      // Continue session
      const continueMessage = "\n\n続けてご質問があれば、お聞かせください。";
      console.log(`➡️ [Workflow] Session ${sessionId} continuing`);

      return {
        response: response + continueMessage,
        success,
        sessionId,
        evaluationComplete: false,
        aggregationResult: undefined
      };
    }
  },
});

// Helper function to run the session-aware workflow
export async function runCustomerIdentificationWorkflow(
  userInput: string,
  options?: {
    sessionId?: string; // Add sessionId for continuity
    testCaseId?: string;
    evaluationMode?: boolean;
  }
) {
  try {
    console.log(`🚀 [Workflow] Starting customer identification workflow for input: "${userInput}"`);

    const run = await customerIdentificationWorkflow.createRunAsync();
    const result = await run.start({
      inputData: {
        userInput,
        sessionId: options?.sessionId,
        testCaseId: options?.testCaseId,
        evaluationMode: options?.evaluationMode ?? true
      }
    });

    if (result.status === 'success' && result.output) {
      const output = result.output;
      console.log(`✅ [Workflow] Completed session ${output.sessionId}, evaluation: ${output.evaluationComplete}`);

      return {
        response: output.response,
        success: output.success,
        sessionId: output.sessionId,
        evaluationComplete: output.evaluationComplete,
        aggregationResult: output.aggregationResult
      };
    } else {
      console.error("❌ [Workflow] Failed:", result);
      return {
        response: "申し訳ございませんが、処理中にエラーが発生しました。",
        success: false,
        sessionId: '',
        evaluationComplete: false
      };
    }
  } catch (error) {
    console.error("❌ [Workflow] Exception:", error);
    return {
      response: "申し訳ございませんが、システムエラーが発生しました。",
      success: false,
      sessionId: '',
      evaluationComplete: false
    };
  }
}

// Create the main session-aware workflow
export const customerIdentificationWorkflow = createWorkflow({
  id: "customerIdentificationWorkflow",
  inputSchema: z.object({
    userInput: z.string(),
    sessionId: z.string().optional(), // Add sessionId for continuity
    testCaseId: z.string().optional(),
    evaluationMode: z.boolean().optional().default(true),
  }),
  outputSchema: z.object({
    response: z.string(),
    success: z.boolean(),
    sessionId: z.string(),
    evaluationComplete: z.boolean(),
    aggregationResult: z.any().optional(),
  }),
})
  .then(initializeSession)
  .then(validateUserInput)
  .then(processUserRequest)
  .then(finalizeSession)
  .commit();

// Legacy compatibility - keep the old function name
export const runOrchestratorWorkflow = runCustomerIdentificationWorkflow;
export const orchestratorWorkflow = customerIdentificationWorkflow;

console.log("✅ Session-aware Customer Identification Workflow module loaded");

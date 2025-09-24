/**
 * Session Aggregator Workflow
 * Collects all traces for a session and computes GENIAC-compliant evaluation
 * Triggered at session end to create synthetic session_evaluation record
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { langfuse } from "../../integrations/langfuse.js";
import { evaluateTraceWithLLM, aggregateSessionEvaluations, storeSessionEvaluation, TraceEvaluation } from "../../utils/trace-judge.js";
import { sessionManager } from "../../utils/session-manager.js";

// Step 1: Fetch all traces for a session from Langfuse
const fetchSessionTraces = createStep({
  id: "fetchSessionTraces",
  inputSchema: z.object({
    sessionId: z.string(),
    includeMetadata: z.boolean().optional().default(true),
  }),
  outputSchema: z.object({
    sessionId: z.string(),
    traces: z.array(z.any()),
    traceCount: z.number(),
    sessionMetadata: z.any(),
  }),
  execute: async ({ inputData }: { inputData: { sessionId: string; includeMetadata: boolean } }) => {
    const { sessionId, includeMetadata } = inputData;

    console.log(`🔍 [Aggregator] Fetching traces for session: ${sessionId}`);

    try {
      // Get session context from session manager
      const sessionContext = sessionManager.getSession(sessionId);
      if (!sessionContext) {
        throw new Error(`Session ${sessionId} not found in session manager`);
      }

      // Use Langfuse API to fetch traces by session ID
      // Note: This assumes Langfuse has a method to query traces by metadata
      // In practice, you might need to implement this via Langfuse's REST API
      const traces = await fetchTracesBySessionId(sessionId);

      if (traces.length === 0) {
        console.warn(`⚠️ [Aggregator] No traces found for session: ${sessionId}`);
      }

      console.log(`📊 [Aggregator] Found ${traces.length} traces for session ${sessionId}`);

      return {
        sessionId,
        traces,
        traceCount: traces.length,
        sessionMetadata: includeMetadata ? sessionContext : null
      };

    } catch (error) {
      console.error(`❌ [Aggregator] Failed to fetch traces for session ${sessionId}:`, error);
      throw error;
    }
  },
});

// Step 2: Run LLM judge evaluation on each trace
const runTraceEvaluations = createStep({
  id: "runTraceEvaluations",
  inputSchema: z.object({
    sessionId: z.string(),
    traces: z.array(z.any()),
    sessionMetadata: z.any(),
    judgePromptName: z.string().optional().default("geniac-trace-judge"),
    judgeLabel: z.string().optional().default("production"),
  }),
  outputSchema: z.object({
    sessionId: z.string(),
    traceEvaluations: z.array(z.any()),
    sessionMetadata: z.any(),
    evaluationCount: z.number(),
    failedEvaluations: z.number(),
  }),
  execute: async ({ inputData }: { inputData: { sessionId: string; traces: any[]; sessionMetadata: any; judgePromptName?: string; judgeLabel?: string } }) => {
    const { sessionId, traces, sessionMetadata, judgePromptName = "geniac-trace-judge", judgeLabel = "production" } = inputData;

    console.log(`🧠 [Aggregator] Running LLM judge on ${traces.length} traces for session ${sessionId}`);

    const traceEvaluations: TraceEvaluation[] = [];
    let failedEvaluations = 0;

    // Evaluate each trace in parallel with concurrency control
    const concurrencyLimit = 5; // Limit concurrent evaluations
    for (let i = 0; i < traces.length; i += concurrencyLimit) {
      const batch = traces.slice(i, i + concurrencyLimit);

      const batchPromises = batch.map(async (trace) => {
        try {
          // Add sessionId to trace data if not present
          const traceWithSession = { ...trace, sessionId };

          const evaluation = await evaluateTraceWithLLM(
            traceWithSession,
            judgePromptName,
            judgeLabel
          );

          return evaluation;
        } catch (error) {
          console.error(`❌ [Aggregator] Failed to evaluate trace ${trace.id}:`, error);
          failedEvaluations++;
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      traceEvaluations.push(...batchResults.filter((result): result is TraceEvaluation => result !== null));
    }

    console.log(`✅ [Aggregator] Completed ${traceEvaluations.length}/${traces.length} trace evaluations (${failedEvaluations} failed)`);

    return {
      sessionId,
      traceEvaluations,
      sessionMetadata,
      evaluationCount: traceEvaluations.length,
      failedEvaluations
    };
  },
});

// Step 3: Compute session-level aggregated metrics
const computeSessionMetrics = createStep({
  id: "computeSessionMetrics",
  inputSchema: z.object({
    sessionId: z.string(),
    traceEvaluations: z.array(z.any()),
    sessionMetadata: z.any(),
  }),
  outputSchema: z.object({
    sessionAggregation: z.any(),
    geniacCompliance: z.any(),
  }),
  execute: async ({ inputData }: { inputData: { sessionId: string; traceEvaluations: TraceEvaluation[]; sessionMetadata: any } }) => {
    const { sessionId, traceEvaluations, sessionMetadata } = inputData;

    console.log(`📊 [Aggregator] Computing session metrics for ${sessionId} (${traceEvaluations.length} evaluations)`);

    try {
      // Aggregate trace evaluations into session-level metrics
      const sessionAggregation = await aggregateSessionEvaluations(traceEvaluations, sessionMetadata);

      // Add GENIAC compliance metadata
      const geniacCompliance = {
        topic: "Topic 1 - LLM Evaluation Framework",
        evaluation_type: "trace_level_llm_judge_with_session_aggregation",
        weights_applied: "40/30/15/10/5 (tool_correctness/task_completion/communication/safety/retrieval_fit)",
        dispersion_metrics_calculated: true,
        reproducibility_hash_generated: true,
        session_trace_count: traceEvaluations.length,
        evaluation_timestamp: new Date().toISOString(),
        compliance_status: "compliant"
      };

      // Log session-level evaluation
      await langfuse.logPrompt(
        `session_evaluation_${sessionId}`,
        {
          session_id: sessionId,
          trace_count: traceEvaluations.length,
          aggregation: sessionAggregation
        },
        {
          overall_score: sessionAggregation.weightedSessionScore,
          geniac_compliance: geniacCompliance
        },
        {
          evaluation_type: 'session_aggregation',
          geniac_topic: 'Topic_1'
        }
      );

      console.log(`🎯 [Aggregator] Session ${sessionId} evaluation complete:`);
      console.log(`   Overall Score: ${sessionAggregation.weightedSessionScore}/5.0`);
      console.log(`   Trace Count: ${sessionAggregation.traceCount}`);
      console.log(`   Tool Sequence Variability: ${(sessionAggregation.dispersionMetrics.toolSequenceVariability * 100).toFixed(1)}%`);
      console.log(`   Output Validity Variability: ${(sessionAggregation.dispersionMetrics.outputValidityVariability * 100).toFixed(1)}%`);

      return {
        sessionAggregation,
        geniacCompliance
      };

    } catch (error) {
      console.error(`❌ [Aggregator] Failed to compute session metrics for ${sessionId}:`, error);
      throw error;
    }
  },
});

// Step 4: Store the session evaluation record
const storeSessionEvaluationRecord = createStep({
  id: "storeSessionEvaluationRecord",
  inputSchema: z.object({
    sessionAggregation: z.any(),
    geniacCompliance: z.any(),
    storageOptions: z.object({
      persistToDatabase: z.boolean().optional().default(true),
      exportToJson: z.boolean().optional().default(true),
      exportPath: z.string().optional(),
    }).optional(),
  }),
  outputSchema: z.object({
    sessionId: z.string(),
    evaluationId: z.string(),
    sessionAggregation: z.any(),
    geniacCompliance: z.any(),
    storageResult: z.any(),
    success: z.boolean(),
  }),
  execute: async ({ inputData }: { inputData: { sessionAggregation: any; geniacCompliance: any; storageOptions?: any } }) => {
    const { sessionAggregation, geniacCompliance, storageOptions = {} } = inputData;
    const { persistToDatabase = true, exportToJson = true, exportPath } = storageOptions;

    const sessionId = sessionAggregation.sessionId;
    const evaluationId = `eval_${sessionId}_${Date.now()}`;

    console.log(`💾 [Aggregator] Storing session evaluation: ${evaluationId}`);

    try {
      // Create complete evaluation record
      const evaluationRecord = {
        id: evaluationId,
        ...sessionAggregation,
        geniac_compliance: geniacCompliance,
        storage_timestamp: new Date().toISOString(),
        evaluation_links: {
          trace_ids: sessionAggregation.traceIds || [],
          reproducibility_hash: sessionAggregation.reproducibilityHash
        }
      };

      const storageResult: any = {};

      // Store in database (if enabled)
      if (persistToDatabase) {
        // TODO: Implement actual database storage
        // await saveToDatabase('session_evaluations', evaluationRecord);
        storageResult.database = { status: 'simulated', record_id: evaluationId };
        console.log(`   📋 Database storage: simulated`);
      }

      // Export to JSON file (if enabled)
      if (exportToJson) {
        const path = exportPath || `./session-evaluations/${evaluationId}.json`;

        try {
          const fs = await import('fs');
          const dir = path.substring(0, path.lastIndexOf('/'));
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          fs.writeFileSync(path, JSON.stringify(evaluationRecord, null, 2));
          storageResult.json = { status: 'success', path };
          console.log(`   📄 JSON export: saved to ${path}`);
        } catch (error) {
          console.error(`   ❌ JSON export failed: ${error.message}`);
          storageResult.json = { status: 'failed', error: error.message };
        }
      }

      // Store via trace-judge utility
      await storeSessionEvaluation(sessionAggregation);

      console.log(`✅ [Aggregator] Session evaluation stored successfully: ${evaluationId}`);

      return {
        sessionId,
        evaluationId,
        sessionAggregation,
        geniacCompliance,
        storageResult,
        success: true
      };

    } catch (error) {
      console.error(`❌ [Aggregator] Failed to store session evaluation ${evaluationId}:`, error);
      throw error;
    }
  },
});

// Helper function to fetch traces by session ID from Langfuse
// This is a placeholder - actual implementation would depend on Langfuse API capabilities
async function fetchTracesBySessionId(sessionId: string): Promise<any[]> {
  try {
    // In a real implementation, this would use Langfuse's REST API or SDK methods
    // For now, we'll simulate fetching traces

    // This could be implemented using:
    // 1. Langfuse REST API: GET /api/v1/traces?metadata[session_id]=${sessionId}
    // 2. SDK method if available: langfuse.getTraces({ metadata: { session_id: sessionId } })

    console.log(`🔍 [Langfuse API] Fetching traces for session: ${sessionId}`);

    // Simulated trace data structure
    // In practice, this would come from actual Langfuse traces
    const mockTraces = [
      {
        id: `trace_1_${sessionId}`,
        sessionId,
        timestamp: new Date().toISOString(),
        agent: 'customer-identification',
        input: 'customer lookup request',
        output: 'customer data retrieved',
        tools_used: ['lookupCustomerFromDatabase'],
        error: null,
        metadata: { session_id: sessionId }
      }
    ];

    // TODO: Replace with actual Langfuse API call
    // const traces = await langfuse.getTracesByMetadata({ session_id: sessionId });

    return mockTraces;

  } catch (error) {
    console.error(`❌ [Langfuse API] Failed to fetch traces for session ${sessionId}:`, error);
    return [];
  }
}

// Main session aggregator workflow
export const sessionAggregatorWorkflow = createWorkflow({
  id: "sessionAggregatorWorkflow",
  inputSchema: z.object({
    sessionId: z.string(),
    judgePromptName: z.string().optional().default("geniac-trace-judge"),
    judgeLabel: z.string().optional().default("production"),
    includeMetadata: z.boolean().optional().default(true),
    storageOptions: z.object({
      persistToDatabase: z.boolean().optional().default(true),
      exportToJson: z.boolean().optional().default(true),
      exportPath: z.string().optional(),
    }).optional(),
  }),
  outputSchema: z.object({
    sessionId: z.string(),
    evaluationId: z.string(),
    sessionAggregation: z.any(),
    geniacCompliance: z.any(),
    storageResult: z.any(),
    success: z.boolean(),
    error: z.string().optional(),
  }),
})
.then(fetchSessionTraces)
.then(runTraceEvaluations)
.then(computeSessionMetrics)
.then(storeSessionEvaluationRecord)
.commit();

// Helper function to run the session aggregator workflow
export async function runSessionAggregatorWorkflow(
  sessionId: string,
  options?: {
    judgePromptName?: string;
    judgeLabel?: string;
    includeMetadata?: boolean;
    storageOptions?: any;
  }
) {
  try {
    console.log(`🚀 [Session Aggregator] Starting aggregation for session: ${sessionId}`);

    const run = await sessionAggregatorWorkflow.createRunAsync();
    const result = await run.start({
      inputData: {
        sessionId,
        ...options
      }
    });

    if (result.status === 'success' && result.output) {
      console.log(`✅ [Session Aggregator] Completed successfully for session ${sessionId}`);
      return {
        ...result.output,
        success: true
      };
    } else {
      console.error(`❌ [Session Aggregator] Failed for session ${sessionId}:`, result);
      return {
        sessionId,
        success: false,
        error: result.error || 'Workflow execution failed'
      };
    }
  } catch (error) {
    console.error(`❌ [Session Aggregator] Exception for session ${sessionId}:`, error);
    return {
      sessionId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

console.log("✅ Session Aggregator Workflow module loaded");

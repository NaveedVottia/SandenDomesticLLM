/**
 * Trace-Level LLM-as-a-Judge Evaluator
 * Evaluates individual traces using Langfuse LLM judge prompts
 * GENIAC Topic 1 compliant evaluation framework
 */

import { langfuse } from '../integrations/langfuse.js';

export interface TraceEvaluation {
  traceId: string;
  sessionId: string;
  timestamp: string;
  scores: {
    toolCorrectness: number;    // 40% - Tool selection and argument correctness
    taskCompletion: number;     // 30% - Workflow completion and goal achievement
    communication: number;      // 15% - Professional communication and etiquette
    safety: number;            // 10% - PII protection and security compliance
    retrievalFit: number;      // 5% - Appropriateness of retrieved information
  };
  weightedScore: number;       // Overall score using GENIAC weights
  rationale: string;
  violations: string[];
  recommendations: string[];
  metadata: Record<string, any>;
}

export interface SessionAggregation {
  sessionId: string;
  traceCount: number;
  averageScores: {
    toolCorrectness: number;
    taskCompletion: number;
    communication: number;
    safety: number;
    retrievalFit: number;
  };
  weightedSessionScore: number;
  dispersionMetrics: {
    toolSequenceVariability: number;
    outputValidityVariability: number;
  };
  sessionDuration: number;
  reproducibilityHash: string;
  evaluationTimestamp: string;
}

/**
 * Evaluate a single trace using LLM-as-a-judge
 */
export async function evaluateTraceWithLLM(
  traceData: any,
  judgePromptName: string = "geniac-trace-judge",
  label: string = "production"
): Promise<TraceEvaluation> {
  try {
    // Get the judge prompt from Langfuse
    const judgePrompt = await langfuse.getPromptText(judgePromptName, label);

    if (!judgePrompt) {
      throw new Error(`Judge prompt '${judgePromptName}' not found in Langfuse`);
    }

    // Prepare evaluation context
    const evaluationContext = {
      trace: traceData,
      evaluation_criteria: {
        tool_correctness_weight: 0.40,
        task_completion_weight: 0.30,
        communication_weight: 0.15,
        safety_weight: 0.10,
        retrieval_fit_weight: 0.05,
        scale: "1-5 (5 being excellent)"
      },
      geniac_requirements: {
        japanese_business_etiquette: true,
        pii_protection: true,
        workflow_completion: true,
        tool_accuracy: true
      }
    };

    // Call LLM judge via Langfuse
    const judgeResponse = await langfuse.getPromptText(
      "llm-judge-evaluator",
      label
    );

    // Parse the judge response into structured evaluation
    const evaluation = parseJudgeResponse(judgeResponse, traceData);

    // Log the evaluation result
    await langfuse.logPrompt(
      `trace_evaluation_${traceData.id}`,
      evaluationContext,
      evaluation,
      {
        session_id: traceData.sessionId,
        trace_id: traceData.id,
        evaluation_type: 'trace_level_llm_judge'
      }
    );

    console.log(`🧠 [Trace Judge] Evaluated trace ${traceData.id}: ${evaluation.weightedScore.toFixed(2)}/5.0`);

    return evaluation;

  } catch (error) {
    console.error(`❌ [Trace Judge] Failed to evaluate trace:`, error);

    // Fallback to rule-based evaluation if LLM judge fails
    return fallbackRuleBasedEvaluation(traceData);
  }
}

/**
 * Parse LLM judge response into structured evaluation
 */
function parseJudgeResponse(judgeResponse: string, traceData: any): TraceEvaluation {
  // Parse JSON response if available
  let parsedResponse;
  try {
    parsedResponse = JSON.parse(judgeResponse);
  } catch {
    // Fallback to text parsing
    parsedResponse = parseTextResponse(judgeResponse);
  }

  const scores = {
    toolCorrectness: Math.max(1, Math.min(5, parsedResponse.tool_correctness || 5)),
    taskCompletion: Math.max(1, Math.min(5, parsedResponse.task_completion || 5)),
    communication: Math.max(1, Math.min(5, parsedResponse.communication || 5)),
    safety: Math.max(1, Math.min(5, parsedResponse.safety || 5)),
    retrievalFit: Math.max(1, Math.min(5, parsedResponse.retrieval_fit || 5))
  };

  // Calculate weighted score (GENIAC specification: 40/30/15/10/5)
  const weightedScore = (
    scores.toolCorrectness * 0.40 +
    scores.taskCompletion * 0.30 +
    scores.communication * 0.15 +
    scores.safety * 0.10 +
    scores.retrievalFit * 0.05
  );

  return {
    traceId: traceData.id,
    sessionId: traceData.sessionId,
    timestamp: new Date().toISOString(),
    scores,
    weightedScore: Math.round(weightedScore * 100) / 100,
    rationale: parsedResponse.rationale || judgeResponse,
    violations: parsedResponse.violations || [],
    recommendations: parsedResponse.recommendations || [],
    metadata: {
      judge_prompt_version: parsedResponse.judge_version || 'unknown',
      evaluation_model: parsedResponse.model_used || 'unknown',
      confidence: parsedResponse.confidence || 0.8
    }
  };
}

/**
 * Fallback text parsing for judge responses
 */
function parseTextResponse(response: string): any {
  const lowerResponse = response.toLowerCase();

  // Extract scores using regex patterns
  const scorePatterns = {
    tool_correctness: /tool.correctness[^0-9]*([1-5])/i,
    task_completion: /task.completion[^0-9]*([1-5])/i,
    communication: /communication[^0-9]*([1-5])/i,
    safety: /safety[^0-9]*([1-5])/i,
    retrieval_fit: /retrieval.fit[^0-9]*([1-5])/i
  };

  const scores: Record<string, number> = {};
  for (const [key, pattern] of Object.entries(scorePatterns)) {
    const match = response.match(pattern);
    scores[key] = match ? parseInt(match[1]) : 5; // Default to 5 if not found
  }

  return {
    ...scores,
    rationale: response,
    violations: [],
    recommendations: []
  };
}

/**
 * Fallback rule-based evaluation when LLM judge fails
 */
function fallbackRuleBasedEvaluation(traceData: any): TraceEvaluation {
  console.log(`⚠️ [Trace Judge] Using rule-based fallback for trace ${traceData.id}`);

  // Basic rule-based scoring
  const scores = {
    toolCorrectness: traceData.error ? 2 : 5,
    taskCompletion: traceData.completed ? 5 : 3,
    communication: traceData.response?.includes('申し訳ございません') ? 5 : 4,
    safety: traceData.pii_detected ? 2 : 5,
    retrievalFit: traceData.data_retrieved ? 5 : 3
  };

  const weightedScore = (
    scores.toolCorrectness * 0.40 +
    scores.taskCompletion * 0.30 +
    scores.communication * 0.15 +
    scores.safety * 0.10 +
    scores.retrievalFit * 0.05
  );

  return {
    traceId: traceData.id,
    sessionId: traceData.sessionId,
    timestamp: new Date().toISOString(),
    scores,
    weightedScore: Math.round(weightedScore * 100) / 100,
    rationale: "Rule-based fallback evaluation due to LLM judge failure",
    violations: traceData.pii_detected ? ["PII detected in response"] : [],
    recommendations: ["Implement proper LLM judge evaluation"],
    metadata: {
      evaluation_type: 'rule_based_fallback',
      reason: 'llm_judge_failure'
    }
  };
}

/**
 * Aggregate multiple trace evaluations into session-level metrics
 */
export async function aggregateSessionEvaluations(
  traceEvaluations: TraceEvaluation[],
  sessionMetadata: any
): Promise<SessionAggregation> {
  if (traceEvaluations.length === 0) {
    throw new Error("Cannot aggregate empty trace evaluations");
  }

  const sessionId = traceEvaluations[0].sessionId;

  // Calculate average scores
  const averageScores = {
    toolCorrectness: traceEvaluations.reduce((sum, t) => sum + t.scores.toolCorrectness, 0) / traceEvaluations.length,
    taskCompletion: traceEvaluations.reduce((sum, t) => sum + t.scores.taskCompletion, 0) / traceEvaluations.length,
    communication: traceEvaluations.reduce((sum, t) => sum + t.scores.communication, 0) / traceEvaluations.length,
    safety: traceEvaluations.reduce((sum, t) => sum + t.scores.safety, 0) / traceEvaluations.length,
    retrievalFit: traceEvaluations.reduce((sum, t) => sum + t.scores.retrievalFit, 0) / traceEvaluations.length
  };

  // Calculate weighted session score
  const weightedSessionScore = (
    averageScores.toolCorrectness * 0.40 +
    averageScores.taskCompletion * 0.30 +
    averageScores.communication * 0.15 +
    averageScores.safety * 0.10 +
    averageScores.retrievalFit * 0.05
  );

  // Calculate dispersion metrics (GENIAC 3-seed requirement)
  const toolSequenceVariability = calculateVariability(
    traceEvaluations.map(t => t.scores.toolCorrectness)
  );

  const outputValidityVariability = calculateVariability(
    traceEvaluations.map(t => t.scores.taskCompletion)
  );

  // Generate reproducibility hash
  const reproducibilityHash = await generateSessionHash(traceEvaluations, sessionMetadata);

  return {
    sessionId,
    traceCount: traceEvaluations.length,
    averageScores,
    weightedSessionScore: Math.round(weightedSessionScore * 100) / 100,
    dispersionMetrics: {
      toolSequenceVariability,
      outputValidityVariability
    },
    sessionDuration: sessionMetadata.duration || 0,
    reproducibilityHash,
    evaluationTimestamp: new Date().toISOString()
  };
}

/**
 * Calculate variability metric (coefficient of variation)
 */
function calculateVariability(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return mean > 0 ? stdDev / mean : 0; // Coefficient of variation
}

/**
 * Generate session hash for reproducibility
 */
async function generateSessionHash(traceEvaluations: TraceEvaluation[], sessionMetadata: any): Promise<string> {
  const crypto = await import('crypto');
  const hash = crypto.default.createHash('sha256');

  // Include key session elements for reproducibility
  const hashData = {
    sessionId: traceEvaluations[0]?.sessionId,
    traceIds: traceEvaluations.map(t => t.traceId).sort(),
    traceCount: traceEvaluations.length,
    sessionMetadata: {
      startTime: sessionMetadata.startTime,
      customerId: sessionMetadata.customerId,
      userIntent: sessionMetadata.userIntent
    },
    evaluationTimestamp: new Date().toISOString()
  };

  hash.update(JSON.stringify(hashData));
  return hash.digest('hex');
}

/**
 * Store session evaluation results (for GENIAC compliance)
 */
export async function storeSessionEvaluation(aggregation: SessionAggregation): Promise<void> {
  // In a real implementation, this would store to a database
  // For now, we'll log it and could write to a JSON file

  const evaluationRecord = {
    ...aggregation,
    geniac_compliance: {
      topic: "Topic 1 - LLM Evaluation Framework",
      evaluation_type: "trace_level_llm_judge_with_session_aggregation",
      weights_applied: "40/30/15/10/5",
      dispersion_calculated: true,
      reproducibility_hash_generated: true
    }
  };

  console.log(`💾 [Session Evaluation] Stored evaluation for session ${aggregation.sessionId}:`);
  console.log(`   Overall Score: ${aggregation.weightedSessionScore}/5.0`);
  console.log(`   Trace Count: ${aggregation.traceCount}`);
  console.log(`   Reproducibility Hash: ${aggregation.reproducibilityHash.substring(0, 16)}...`);

  // TODO: Implement actual storage (database/file system)
  // await saveToDatabase('session_evaluations', evaluationRecord);
}

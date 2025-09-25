/**
 * Session Manager for Trace-Level LLM-as-a-Judge System
 * Manages session IDs, propagation, and lifecycle for GENIAC Topic 1 compliance
 */

import { randomUUID } from 'crypto';
import { langfuse } from '../integrations/langfuse.js';

export interface SessionContext {
  sessionId: string;
  startTime: number;
  traceId?: string;
  currentAgent: string;
  customerId?: string;
  userIntent?: string;
  completed?: boolean;
  lastResponse?: string;
  lastUserInput?: string;
  lastInteraction?: string;
  agentInteractions?: number;
  error?: string;
  menuResponse?: string;
  shouldEndSession?: boolean;
  metadata?: Record<string, any>;
}

export class SessionManager {
  private static instance: SessionManager;
  private activeSessions: Map<string, SessionContext> = new Map();

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Initialize a new session with unique ID and tracing
   */
  async initializeSession(metadata?: Record<string, any>, customSessionId?: string): Promise<SessionContext> {
    const sessionId = customSessionId || `session_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const traceId = await langfuse.startTrace(`session_start_${sessionId}`, {
      session_type: 'geniac_evaluation',
      start_time: new Date().toISOString(),
      ...metadata
    });

    const sessionContext: SessionContext = {
      sessionId,
      startTime: Date.now(),
      traceId: traceId || undefined,
      currentAgent: 'customer-identification',
      metadata: metadata || {}
    };

    this.activeSessions.set(sessionId, sessionContext);
    console.log(`📊 [Session] Initialized session: ${sessionId} with trace: ${traceId}`);

    return sessionContext;
  }

  /**
   * Get existing session context
   */
  getSession(sessionId: string): SessionContext | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Update session context (agent changes, customer ID found, etc.)
   */
  async updateSession(sessionId: string, updates: Partial<SessionContext>): Promise<void> {
    const existing = this.activeSessions.get(sessionId);
    if (!existing) {
      console.warn(`⚠️ [Session] Attempted to update non-existent session: ${sessionId}`);
      return;
    }

    const updated = { ...existing, ...updates };
    this.activeSessions.set(sessionId, updated);

    // Log session update to trace
    if (existing.traceId && existing.traceId !== null) {
      await langfuse.logToolExecution(
        existing.traceId,
        'session_update',
        { sessionId, previousState: existing, updates },
        { sessionId, currentState: updated },
        { session_update: true, timestamp: new Date().toISOString() }
      );
    }

    console.log(`📊 [Session] Updated session: ${sessionId}`, updates);
  }

  /**
   * Mark session as completed and prepare for aggregation
   */
  async completeSession(sessionId: string, finalMetadata?: Record<string, any>): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`⚠️ [Session] Attempted to complete non-existent session: ${sessionId}`);
      return;
    }

    const completedSession = {
      ...session,
      completed: true,
      endTime: Date.now(),
      finalMetadata
    };

    this.activeSessions.set(sessionId, completedSession);

    // End the trace
    if (session.traceId) {
      await langfuse.endTrace(session.traceId, {
        session_completed: true,
        duration_ms: completedSession.endTime - session.startTime,
        final_agent: completedSession.currentAgent,
        customer_id: completedSession.customerId,
        ...finalMetadata
      });
    }

    console.log(`📊 [Session] Completed session: ${sessionId} (duration: ${completedSession.endTime - session.startTime}ms)`);
  }

  /**
   * Get all active sessions (for monitoring)
   */
  getActiveSessions(): SessionContext[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Clean up old completed sessions (memory management)
   */
  cleanupOldSessions(maxAgeMs: number = 3600000): void { // 1 hour default
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.completed && (now - (session as any).endTime) > maxAgeMs) {
        toDelete.push(sessionId);
      }
    }

    toDelete.forEach(id => this.activeSessions.delete(id));
    if (toDelete.length > 0) {
      console.log(`🧹 [Session] Cleaned up ${toDelete.length} old sessions`);
    }
  }

  /**
   * Generate session hash for reproducibility (GENIAC requirement)
   */
  async generateSessionHash(session: SessionContext): Promise<string> {
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify({
      sessionId: session.sessionId,
      startTime: session.startTime,
      customerId: session.customerId,
      userIntent: session.userIntent,
      metadata: session.metadata
    }));
    return hash.digest('hex');
  }
}

// Export singleton instance
export const sessionManager = SessionManager.getInstance();

// Helper functions for easy integration
export function createSessionContext(metadata?: Record<string, any>): Promise<SessionContext> {
  const customSessionId = metadata?.custom_session_id;
  if (customSessionId) {
    // Use custom session ID if provided
    return sessionManager.initializeSession(metadata, customSessionId);
  }
  return sessionManager.initializeSession(metadata);
}

export function getSessionContext(sessionId: string): SessionContext | null {
  return sessionManager.getSession(sessionId);
}

export function updateSessionContext(sessionId: string, updates: Partial<SessionContext>): Promise<void> {
  return sessionManager.updateSession(sessionId, updates);
}

export function completeSessionContext(sessionId: string, finalMetadata?: Record<string, any>): Promise<void> {
  return sessionManager.completeSession(sessionId, finalMetadata);
}

/**
 * OWNER: Shared across all team members
 * PURPOSE: Central TypeScript type definitions for the Alter app
 * STATUS: Scaffold — add new types as needed
 */

// ─── User Types ──────────────────────────────────────────────────────────────

export interface AlterUser {
  id: string;
  clerkId: string;
  email: string;
  name: string | null;
  gmailConnected: boolean;
  autonomyLevel: AutonomyLevel;
  wakeTime: string;
  createdAt: string;
  updatedAt: string;
}

export enum AutonomyLevel {
  OBSERVE = 0,   // Just watch, don't do anything
  DRAFT = 1,     // Create drafts for review
  AUTO_LOW = 2,  // Auto-execute low-confidence, draft high
  FULL = 3,      // Full autonomy
}

// ─── Email Types ─────────────────────────────────────────────────────────────

export interface Email {
  id: string;
  userId: string;
  gmailId: string;
  threadId: string | null;
  from: string;
  to: string;
  subject: string;
  body: string;
  direction: 'sent' | 'received';
  isRead: boolean;
  receivedAt: string;
  createdAt: string;
  embedded: boolean;
}

// ─── Chat History Types ──────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  userId: string;
  source: ChatSource;
  role: 'user' | 'assistant';
  content: string;
  sessionId: string | null;
  timestamp: string;
  createdAt: string;
  embedded: boolean;
}

export type ChatSource = 'claude' | 'chatgpt' | 'other';

export interface ChatHistoryIngestPayload {
  userId: string;
  source: ChatSource;
  messages: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    sessionId?: string;
  }[];
}

// ─── Project Types ───────────────────────────────────────────────────────────

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  context: string | null;
  lastActive: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatus = 'in_progress' | 'completed' | 'stalled';

// ─── Draft Types ─────────────────────────────────────────────────────────────

export interface Draft {
  id: string;
  userId: string;
  type: DraftType;
  title: string;
  content: string;
  targetApp: TargetApp;
  confidenceScore: number;
  status: DraftStatus;
  context: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DraftType = 'email' | 'doc' | 'code' | 'task';
export type DraftStatus = 'pending' | 'approved' | 'rejected' | 'sent';
export type TargetApp = 'gmail' | 'gdocs' | 'github' | 'notion';

export interface GenerateDraftRequest {
  type: DraftType;
  targetApp: TargetApp;
  projectId?: string;
  context?: string;
  instructions?: string;
}

// ─── Action Types ────────────────────────────────────────────────────────────

export interface Action {
  id: string;
  userId: string;
  type: ActionType;
  title: string;
  description: string | null;
  app: string;
  confidence: number | null;
  status: ActionStatus;
  metadata: string | null;
  createdAt: string;
}

export type ActionType = 'email_sent' | 'doc_edited' | 'task_completed' | 'flagged';
export type ActionStatus = 'completed' | 'failed' | 'flagged';

export interface ActionReportPayload {
  userId: string;
  type: ActionType;
  title: string;
  description?: string;
  app: string;
  confidence?: number;
  status: ActionStatus;
  metadata?: Record<string, unknown>;
}

// ─── Boundary Types ──────────────────────────────────────────────────────────

export interface Boundary {
  id: string;
  userId: string;
  rule: string;
  category: BoundaryCategory;
  action: BoundaryAction;
  conditions: string | null;
  createdAt: string;
}

export type BoundaryCategory = 'email' | 'docs' | 'code' | 'general';
export type BoundaryAction = 'auto' | 'draft' | 'flag' | 'never';

// ─── Voice Profile Types ─────────────────────────────────────────────────────

export interface VoiceProfile {
  id: string;
  userId: string;
  avgSentenceLen: number | null;
  formalityScore: number | null;
  emojiFrequency: number | null;
  signOffStyle: string | null;
  toneKeywords: string[] | null;
  systemPrompt: string | null;
  sampleOutputs: string[] | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Morning Brief Types ─────────────────────────────────────────────────────

export interface MorningBrief {
  summary: string;
  actionsCompleted: number;
  flaggedForReview: number;
  completedActions: Action[];
  flaggedItems: Action[];
  suggestedFocus: SuggestedFocusItem[];
  generatedAt: string;
}

export interface SuggestedFocusItem {
  title: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  relatedProjectId?: string;
}

// ─── Handoff Types ───────────────────────────────────────────────────────────

export interface HandoffTask {
  id: string;
  projectId?: string;
  title: string;
  description: string;
  app: string;
  estimatedConfidence: number;
  selected: boolean;
  /** Top picks for this run vs collapsed “other” — UI only */
  tier?: 'recommended' | 'other';
  /** Code projects vs Canvas assignment rows — drives POST payload */
  handoffKind?: 'project' | 'canvas';
}

export interface HandoffSubmission {
  tasks: string[]; // task IDs
  specialInstructions?: string;
  wakeTime?: string;
}

// ─── Embedding Types ─────────────────────────────────────────────────────────

export interface EmbeddingProcessRequest {
  userId: string;
  sources?: ('emails' | 'chat')[];
}

export interface EmbeddingQueryRequest {
  userId: string;
  query: string;
  topK?: number;
  filter?: {
    source?: string;
    type?: string;
  };
}

export interface EmbeddingQueryResult {
  id: string;
  score: number;
  content: string;
  metadata: {
    source: string;
    type: string;
    timestamp: string;
    [key: string]: unknown;
  };
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ─── Confidence Types ────────────────────────────────────────────────────────

export interface ConfidenceAssessment {
  score: number;        // 0-1
  level: ConfidenceLevel;
  reasons: string[];
  recommendation: 'auto_execute' | 'draft_for_review' | 'flag_for_user';
}

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'very_low';

// types.ts
export interface AgentConfigs {
  coach: AgentConfig;
  sql: AgentConfig;
  info: AgentConfig;
  naturo: AgentConfig;
}

export interface AgentConfig {
  name: string;
  instruction: string;
  description: string;
  isGoogleSearchEnabled: boolean;
}

export type AgentType = keyof AgentConfigs;
export type AgentSource = AgentType | "merged";

export interface QueryDetails {
  detected: boolean;
  confidence: number;
  extracted_intent: string | null;
}

export interface QueryClassification {
  classification: "sql" | "info" | "both" | "unclear";
  sql_query: QueryDetails;
  info_query: QueryDetails;
}

export interface AgentTextResponse {
  text: string;
}

export interface ProcessedAgentResult {
  type: "sql" | "info";
  data?: AgentTextResponse;
  error?: string;
}

export interface MergedResponseData {
  response: string;
  classification: QueryClassification;
  sql_data: string | null;
  info_data: string | null;
}

// Server-specific types
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ChatSession {
  id: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface ChatRequest {
  sessionId?: string;
  message: string;
  userId?: string;
  createNewSession?: boolean;
}

export interface ChatResponse {
  sessionId: string;
  message: ChatMessage;
  context?: {
    totalMessages: number;
    sessionCreated: Date;
  };
}

export interface SessionsResponse {
  sessions: Array<{
    id: string;
    userId: string;
    messageCount: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  total: number;
}

export interface ErrorResponse {
  error: string;
  details?: string;
}

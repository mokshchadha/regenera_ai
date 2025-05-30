// types/chat.ts
// Type definitions for the Chat Component

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  metadata?: Record<string, string>;
}

export interface ChatSession {
  id: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, string>;
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

// Component Props
export interface ChatComponentProps {
  serverUrl?: string;
  userId?: string;
  placeholder?: string;
  welcomeMessage?: string;
  className?: string;
  style?: React.CSSProperties;
  onError?: (error: string) => void;
  onMessageSent?: (message: string) => void;
  onMessageReceived?: (message: ChatMessage) => void;
  onSessionCreated?: (sessionId: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  maxMessages?: number;
  autoScroll?: boolean;
  showTimestamps?: boolean;
  theme?: "light" | "dark" | "auto";
}

// Chat Service
export interface ChatService {
  createSession(userId?: string): Promise<string>;
  sendMessage(message: string, sessionId?: string): Promise<ChatResponse>;
  getMessages(sessionId: string): Promise<ChatMessage[]>;
  deleteSession(sessionId: string): Promise<void>;
}

// Agent Response Types (from your Deno server)
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

export interface MergedResponseData {
  response: string;
  classification: QueryClassification;
  sql_data: string | null;
  info_data: string | null;
}

// UI State Types
export interface ChatUIState {
  isLoading: boolean;
  isConnected: boolean;
  sessionId: string | null;
  error: string | null;
  messageCount: number;
}

// Configuration
export interface ChatConfig {
  serverUrl: string;
  apiVersion?: string;
  timeout?: number;
  retryAttempts?: number;
  enableLogging?: boolean;
}

// Event Types
export type ChatEventType =
  | "message_sent"
  | "message_received"
  | "session_created"
  | "error_occurred"
  | "connected"
  | "disconnected"
  | "typing_start"
  | "typing_stop";

 

// Utility Types
export type MessageRole = ChatMessage["role"];
export type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "connecting"
  | "error";

// React Hook Return Types
export interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (message: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  sessionId: string | null;
  clearChat: () => void;
  clearError: () => void;
  connectionStatus: ConnectionStatus;
}

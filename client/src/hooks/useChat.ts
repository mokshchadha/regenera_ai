// hooks/useChat.ts
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChatMessage,
  ChatResponse,
  ConnectionStatus,
  UseChatReturn,
} from "../types/chat";

interface UseChatOptions {
  serverUrl?: string;
  userId?: string;
  onError?: (error: string) => void;
  onMessageSent?: (message: string) => void;
  onMessageReceived?: (message: ChatMessage) => void;
  onSessionCreated?: (sessionId: string) => void;
  maxRetries?: number;
  retryDelay?: number;
}

export const useChat = (options: UseChatOptions = {}): UseChatReturn => {
  const {
    serverUrl = "http://localhost:8000",
    userId,
    onError,
    onMessageSent,
    onMessageReceived,
    onSessionCreated,
    maxRetries = 3,
    retryDelay = 1000,
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    "disconnected",
  );

  const retryCount = useRef(0);
  const abortController = useRef<AbortController | null>(null);

  // Check server connection
  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`${serverUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }, [serverUrl]);

  // Initialize connection
  useEffect(() => {
    const initConnection = async () => {
      setConnectionStatus("connecting");
      const isConnected = await checkConnection();
      setConnectionStatus(isConnected ? "connected" : "error");
    };

    initConnection();
  }, [checkConnection]);

  // Create session
  const createSession = useCallback(async (): Promise<string> => {
    try {
      const response = await fetch(`${serverUrl}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
        signal: abortController.current?.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`);
      }

      const data = await response.json();
      const newSessionId = data.sessionId;

      setSessionId(newSessionId);
      onSessionCreated?.(newSessionId);

      return newSessionId;
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Failed to create session";
      setError(errorMessage);
      onError?.(errorMessage);
      throw error;
    }
  }, [serverUrl, userId, onSessionCreated, onError]);

  // Send message with retry logic
  const sendMessageWithRetry = useCallback(async (
    message: string,
    currentSessionId?: string,
    attempt: number = 0,
  ): Promise<ChatResponse> => {
    try {
      const response = await fetch(`${serverUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: currentSessionId,
          message,
          userId,
          createNewSession: !currentSessionId,
        }),
        signal: abortController.current?.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`,
        );
      }

      return await response.json();
    } catch (error) {
      if (
        attempt < maxRetries &&
        !(error instanceof DOMException && error.name === "AbortError")
      ) {
        retryCount.current = attempt + 1;
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * Math.pow(2, attempt))
        );
        return sendMessageWithRetry(message, currentSessionId, attempt + 1);
      }
      throw error;
    }
  }, [serverUrl, userId, maxRetries, retryDelay]);

  // Main send message function
  const sendMessage = useCallback(async (message: string): Promise<void> => {
    if (!message.trim() || isLoading) return;

    // Cancel any ongoing request
    if (abortController.current) {
      abortController.current.abort();
    }
    abortController.current = new AbortController();

    setIsLoading(true);
    setError(null);
    retryCount.current = 0;

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}-${Math.random()}`,
      role: "user",
      content: message.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    onMessageSent?.(message);

    try {
      // Create session if needed
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        currentSessionId = await createSession();
      }

      // Send message
      const response = await sendMessageWithRetry(message, currentSessionId);

      // Update session ID if it changed
      if (response.sessionId !== currentSessionId) {
        setSessionId(response.sessionId);
      }

      // Add assistant response
      const assistantMessage: ChatMessage = {
        ...response.message,
        timestamp: new Date(response.message.timestamp),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      onMessageReceived?.(assistantMessage);

      setConnectionStatus("connected");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return; // Request was cancelled, don't show error
      }

      const errorMessage = error instanceof Error
        ? error.message
        : "An unknown error occurred";

      // Add error message to chat
      const errorChatMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "system",
        content: `❌ Error: ${errorMessage}. Please try again.`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorChatMessage]);
      setError(errorMessage);
      setConnectionStatus("error");
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
      abortController.current = null;
    }
  }, [
    isLoading,
    sessionId,
    createSession,
    sendMessageWithRetry,
    onMessageSent,
    onMessageReceived,
    onError,
  ]);

  // Clear chat
  const clearChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setError(null);
    retryCount.current = 0;
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  return {
    messages,
    sendMessage,
    isLoading,
    error,
    sessionId,
    clearChat,
    clearError,
    connectionStatus,
  };
};

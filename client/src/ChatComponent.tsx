import React, { useEffect, useRef, useState } from "react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface ChatComponentProps {
  serverUrl?: string;
  userId?: string;
  placeholder?: string;
  welcomeMessage?: string;
  className?: string;
  style?: React.CSSProperties;
  onError?: (error: string) => void;
  onMessageSent?: (message: string) => void;
  onMessageReceived?: (message: ChatMessage) => void;
}

interface ChatResponse {
  sessionId: string;
  message: ChatMessage;
  context?: {
    totalMessages: number;
    sessionCreated: Date;
  };
}

export const ChatComponent: React.FC<ChatComponentProps> = ({
  serverUrl = "http://localhost:8000",
  userId,
  placeholder = "Type your message here...",
  welcomeMessage =
    "🐸 Hello! I'm Naturo, your digital assistant. How can I help you today?",
  className = "",
  style = {},
  onError,
  onMessageSent,
  onMessageReceived,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize chat with welcome message
  useEffect(() => {
    if (welcomeMessage) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: welcomeMessage,
          timestamp: new Date(),
        },
      ]);
    }
    setIsConnected(true);
  }, [welcomeMessage]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const createSession = async (): Promise<string> => {
    try {
      const response = await fetch(`${serverUrl}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`);
      }

      const data = await response.json();
      return data.sessionId;
    } catch (error) {
      console.error("Error creating session:", error);
      throw error;
    }
  };

  const sendMessage = async (
    message: string,
    currentSessionId?: string,
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
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || `HTTP error! status: ${response.status}`,
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const messageText = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    // Add user message to chat
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    onMessageSent?.(messageText);

    try {
      // Create session if needed
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        currentSessionId = await createSession();
        setSessionId(currentSessionId);
      }

      // Send message and get response
      const response = await sendMessage(messageText, currentSessionId);

      // Update session ID if it changed
      if (response.sessionId !== currentSessionId) {
        setSessionId(response.sessionId);
      }

      // Add assistant response to chat
      setMessages((prev) => [...prev, {
        ...response.message,
        timestamp: new Date(response.message.timestamp),
      }]);

      onMessageReceived?.(response.message);
    } catch (error) {
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
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const clearChat = () => {
    setMessages(
      welcomeMessage
        ? [{
          id: "welcome",
          role: "assistant",
          content: welcomeMessage,
          timestamp: new Date(),
        }]
        : [],
    );
    setSessionId(null);
  };

  return (
    <div className={`chat-container ${className}`} style={style}>
      {/* Header */}
      <div className="chat-header">
        <div className="chat-title">
          <div className="status-indicator">
            <span
              className={`status-dot ${
                isConnected ? "connected" : "disconnected"
              }`}
            >
            </span>
            <span className="status-text">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <h3>Chat with Naturo 🐸</h3>
        </div>
        <button
          className="clear-button"
          onClick={clearChat}
          title="Clear chat"
          disabled={isLoading}
        >
          🗑️
        </button>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.role} ${
              message.role === "system" ? "error" : ""
            }`}
          >
            <div className="message-content">
              <div className="message-text">{message.content}</div>
              <div className="message-time">
                {formatTime(message.timestamp)}
              </div>
            </div>
            <div className="message-avatar">
              {message.role === "user"
                ? "👤"
                : message.role === "system"
                ? "⚠️"
                : "🐸"}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="message assistant">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
            <div className="message-avatar">🐸</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-container">
        <div className="chat-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={isLoading}
            className="chat-input"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="send-button"
            title="Send message"
          >
            {isLoading ? "⏳" : "📤"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatComponent;

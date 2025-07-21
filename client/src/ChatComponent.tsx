import React, { useEffect, useRef, useState } from "react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  isCreditsExhausted?: boolean;
}

interface ClientDetail {
  personNumber?: string;
  accountId?: string;
  companyId?: string;
  userId?: string;
  [key: string]: unknown;
}

interface ChatComponentProps {
  serverUrl?: string;
  userId?: string;
  placeholder?: string;
  welcomeMessage?: string;
  className?: string;
  style?: React.CSSProperties;
  clientDetail?: ClientDetail;
  onError?: (error: string) => void;
  onMessageSent?: (message: string) => void;
  onMessageReceived?: (message: ChatMessage) => void;
  onCreditsExhausted?: () => void;
}

interface ChatResponse {
  sessionId: string;
  message: ChatMessage;
  context?: {
    totalMessages: number;
    sessionCreated: Date;
    messageCount?: number;
  };
}

const parseMessageContent = (content: string): string => {
  const escapeHtml = (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };


  let parsedContent = escapeHtml(content);

  parsedContent = parsedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  parsedContent = parsedContent.replace(/(?<!\*)\*(?!\*)([^\*]+?)\*(?!\*)/g, '<strong>$1</strong>');

  parsedContent = parsedContent.replace(/_(.*?)_/g, '<em>$1</em>');


  parsedContent = parsedContent.replace(/\n/g, '<br>');

  return parsedContent;
};


const FormattedMessageContent: React.FC<{ content: string }> = ({ content }) => {
  const formattedContent = parseMessageContent(content);
  
  return (
    <div
      dangerouslySetInnerHTML={{ __html: formattedContent }}
      style={{
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap'
      }}
    />
  );
};

export const ChatComponent: React.FC<ChatComponentProps> = ({
  serverUrl = "http://localhost:8000",
  userId,
  placeholder = "Type your message here...",
  welcomeMessage =
    "🐸 Hello! I'm Naturo, your digital assistant. How can I help you today?",
  className = "",
  style = {},
  clientDetail,
  onError,
  onMessageSent,
  onMessageReceived,
  onCreditsExhausted, 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [creditsExhausted, setCreditsExhausted] = useState(false); 
  const [messageCount, setMessageCount] = useState(0); 
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);


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


  useEffect(() => {
    inputRef.current?.focus();
  }, []);


  const isCreditsExhaustedMessage = (content: string): boolean => {
    const exhaustedKeywords = [
      "ai credits",
      "credits exhausted",
      "come back later",
      "used your ai credits",
      "credits are exhausted",
    ];

    return exhaustedKeywords.some((keyword) =>
      content.toLowerCase().includes(keyword.toLowerCase())
    );
  };

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
      const requestBody = {
        sessionId: currentSessionId,
        message,
        userId,
        createNewSession: !currentSessionId,
        ...(clientDetail && { clientDetail }),  
      };

      const response = await fetch(`${serverUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
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
    if (!inputValue.trim() || isLoading || creditsExhausted) return;

    const messageText = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    onMessageSent?.(messageText);

    try {
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        currentSessionId = await createSession();
        setSessionId(currentSessionId);
      }

      const response = await sendMessage(messageText, currentSessionId);

      if (response.sessionId !== currentSessionId) {
        setSessionId(response.sessionId);
      }

      const isExhausted = isCreditsExhaustedMessage(response.message.content);
      if (response.context?.messageCount !== undefined) {
        setMessageCount(response.context.messageCount);
      }
      const assistantMessage: ChatMessage = {
        ...response.message,
        timestamp: new Date(response.message.timestamp),
        isCreditsExhausted: isExhausted,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (isExhausted) {
        setCreditsExhausted(true);
        onCreditsExhausted?.();
        console.log("🚫 AI credits exhausted");
      }

      onMessageReceived?.(assistantMessage);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "An unknown error occurred";

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
    setCreditsExhausted(false);
    setMessageCount(0);
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
          {/* NEW: Display message count and credits status */}
          <div className="message-counter">
            <span
              className={`credits-info ${creditsExhausted ? "exhausted" : ""}`}
            >
              {creditsExhausted
                ? "🚫 Credits Exhausted"
                : `💬 ${messageCount}/10 messages`}
            </span>
          </div>
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
            } ${message.isCreditsExhausted ? "credits-exhausted" : ""}`}
          >
            <div className="message-content">
              <div
                className={`message-text ${
                  message.isCreditsExhausted ? "credits-exhausted-text" : ""
                }`}
              >
                {/* NEW: Use FormattedMessageContent for rich text formatting */}
                <FormattedMessageContent content={message.content} />
              </div>
              <div className="message-time">
                {formatTime(message.timestamp)}
              </div>
            </div>
            <div className="message-avatar">
              {message.role === "user"
                ? "👤"
                : message.role === "system"
                ? "⚠️"
                : message.isCreditsExhausted
                ? "🚫" 
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
        {/* NEW: Show credits exhausted warning */}
        {creditsExhausted && (
          <div className="credits-warning">
            <span>
              🚫 You have reached your message limit. Please start a new session
              to continue.
            </span>
          </div>
        )}

        <div className="chat-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={creditsExhausted
              ? "Credits exhausted..."
              : placeholder} 
            disabled={isLoading || creditsExhausted} 
            className="chat-input"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading || creditsExhausted} 
            className="send-button"
            title={creditsExhausted ? "Credits exhausted" : "Send message"}
          >
            {isLoading ? "⏳" : creditsExhausted ? "🚫" : "📤"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatComponent;
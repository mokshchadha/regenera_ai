import React, { useEffect, useRef, useState } from "react";
import ChatComponent from "./ChatComponent";
import "./FloatingChatBot.css";

interface ClientDetail {
  personNumber?: string;
  id?: string;
  companyId?: string;
  userId?: string;
  [key: string]: unknown;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  isCreditsExhausted?: boolean;
}

interface FloatingChatBotProps {
  serverUrl?: string;
  userId?: string;
  clientDetail?: ClientDetail;
  onError?: (error: string) => void;
  onMessageSent?: (message: string) => void;
  onMessageReceived?: (message: ChatMessage) => void;
  onCreditsExhausted?: () => void;
}

const FloatingChatBot: React.FC<FloatingChatBotProps> = ({
  serverUrl = "http://localhost:8000",
  userId = 252,
  clientDetail,
  onError,
  onMessageSent,
  onMessageReceived,
  onCreditsExhausted,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [creditsExhausted, setCreditsExhausted] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chatRef.current && !chatRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if (!target.closest(".floating-chat-button")) {
          setIsOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleToggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setHasNewMessage(false);
    }
  };

  const handleMessageSent = (message: string) => {
    setMessageCount((prev) => prev + 1);
    onMessageSent?.(message);
  };

  const handleMessageReceived = (message: ChatMessage) => {
    if (!isOpen) {
      setHasNewMessage(true);
    }

    if (message.isCreditsExhausted) {
      setCreditsExhausted(true);
    }

    onMessageReceived?.(message);
  };

  const handleCreditsExhausted = () => {
    setCreditsExhausted(true);
    onCreditsExhausted?.();
  };

  const handleError = (error: string) => {
    onError?.(error);
  };

  const handleNewSession = () => {
    setCreditsExhausted(false);
    setMessageCount(0);
    setHasNewMessage(false);
  };

  return (
    <div className="floating-chatbot-container">
      {/* Chat Window */}
      {isOpen && (
        <div ref={chatRef} className="floating-chat-window">
          <div className="chat-header-floating">
            <div className="chat-header-info">
              <div className="avatar-container">
                <div className="bot-avatar">🐸</div>
                <div className="online-indicator"></div>
              </div>
              <div className="header-text">
                <h3>Naturo</h3>
                <span className="status-text">Online</span>
              </div>
            </div>
            <div className="header-actions">
              {creditsExhausted && (
                <button
                  className="new-session-btn"
                  onClick={handleNewSession}
                  title="Start new session"
                >
                  🔄
                </button>
              )}
              <button
                className="close-btn"
                onClick={() => setIsOpen(false)}
                title="Close chat"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="chat-content-floating">
            <ChatComponent
              serverUrl={serverUrl}
              userId={userId}
              clientDetail={clientDetail}
              placeholder={creditsExhausted
                ? "Credits exhausted..."
                : "Type a message..."}
              welcomeMessage="🐸 Hey there! I'm Naturo. Life on earth is complicated, but I'm here to help you make the best of it. What's on your mind?"
              onError={handleError}
              onMessageSent={handleMessageSent}
              onMessageReceived={handleMessageReceived}
              onCreditsExhausted={handleCreditsExhausted}
              className="floating-chat-component"
            />
          </div>

          {/* Credits Status Bar */}
          <div className="credits-status-bar">
            {creditsExhausted
              ? (
                <span className="credits-exhausted">
                  🚫 Credits exhausted
                </span>
              )
              : (
                <span className="credits-remaining">
                  💬 {messageCount}/10 messages used
                </span>
              )}
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        className={`floating-chat-button ${
          creditsExhausted ? "exhausted" : ""
        } ${isOpen ? "open" : ""}`}
        onClick={handleToggleChat}
        title={creditsExhausted ? "Chat credits exhausted" : "Chat with Naturo"}
      >
        {isOpen
          ? <span className="close-icon">✕</span>
          : creditsExhausted
          ? <span className="exhausted-icon">🚫</span>
          : <span className="chat-icon">💬</span>}

        {/* Notification Badge */}
        {!isOpen && (hasNewMessage || messageCount > 0) && !creditsExhausted &&
          (
            <div
              className={`notification-badge ${
                hasNewMessage ? "new-message" : ""
              }`}
            >
              {hasNewMessage ? "!" : messageCount}
            </div>
          )}
      </button>
    </div>
  );
};

export default FloatingChatBot;

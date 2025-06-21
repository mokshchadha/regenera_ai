import React, { useState } from "react";
import ChatComponent from "./ChatComponent";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  isCreditsExhausted?: boolean;
}

// NEW: Client detail interface
interface ClientDetail {
  personNumber?: string;
  id?: string;
  companyId?: string;
  userId?: string;
  [key: string]: unknown;
}

const ChatExample: React.FC = () => {
  const [showChat, setShowChat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [creditsExhausted, setCreditsExhausted] = useState(false); // NEW: Track credits state

  // NEW: Example client detail - in real app, this would come from your auth/user context
  const clientDetail: ClientDetail = {
    personNumber: "P123456",
    id: "demo-user",
    companyId: "REGENERA_EARTH",
    userId: "demo-user"
  };

  const handleError = (error: string) => {
    setError(error);
    console.error("Chat error:", error);
    // Clear error after 5 seconds
    setTimeout(() => setError(null), 5000);
  };

  const handleMessageSent = (message: string) => {
    console.log("Message sent:", message);
    setMessageCount((prev) => prev + 1);
  };

  const handleMessageReceived = (message: ChatMessage) => {
    console.log("Message received:", message);
    
    // NEW: Check if this message indicates credits exhausted
    if (message.isCreditsExhausted) {
      setCreditsExhausted(true);
      console.log("🚫 Credits exhausted detected");
    }
  };

  // NEW: Handle credits exhausted event
  const handleCreditsExhausted = () => {
    setCreditsExhausted(true);
    console.log("🚫 AI Credits have been exhausted!");
    
    // Optional: Show a notification or modal
    // You could also disable certain features or show upgrade options
  };

  // NEW: Reset chat and credits
  const handleNewChat = () => {
    setCreditsExhausted(false);
    setMessageCount(0);
    setError(null);
  };

  return (
    <div>
      <main className="">
        {!showChat
          ? (
            <div className="">
              <h1>Regenera Earth 🌿</h1>
              <h2>* This is an existing page *</h2>
              
              {/* NEW: Show credits status even when chat is minimized */}
              {creditsExhausted && (
                <div className="credits-banner">
                  <span>🚫 Chat credits exhausted. Start a new session to continue.</span>
                  <button onClick={handleNewChat} className="reset-button">
                    🔄 New Session
                  </button>
                </div>
              )}
            </div>
          )
          : (
            <div className="chat-section">
              <div className="chat-wrapper">
                <ChatComponent
                  serverUrl="http://localhost:8000"
                  userId="demo-user"
                  clientDetail={clientDetail} // NEW: Pass client detail
                  placeholder="Ask Naturo anything..."
                  welcomeMessage="🐸 Hey there! I'm Naturo. Life on earth is complicated, but I'm here to help you make the best of it. What's on your mind?"
                  onError={handleError}
                  onMessageSent={handleMessageSent}
                  onMessageReceived={handleMessageReceived}
                  onCreditsExhausted={handleCreditsExhausted} // NEW: Handle credits exhausted
                  className="main-chat"
                />
              </div>

              <div className="chat-controls">
                <button
                  className="minimize-button"
                  onClick={() => setShowChat(false)}
                >
                  ⬇️ Minimize Chat
                </button>
                
                {/* NEW: Enhanced chat info with credits status */}
                <div className="chat-info">
                  {creditsExhausted ? (
                    <div className="credits-info-exhausted">
                      <span>🚫 Credits exhausted</span>
                      <button onClick={handleNewChat} className="new-session-btn">
                        Start New Session
                      </button>
                    </div>
                  ) : (
                    <span>💡 Tip: Ask me about your data or general topics! ({messageCount}/10 messages used)</span>
                  )}
                </div>
              </div>

              {/* NEW: Error display */}
              {error && (
                <div className="error-banner">
                  <span>❌ {error}</span>
                  <button onClick={() => setError(null)}>✖️</button>
                </div>
              )}
            </div>
          )}
      </main>

      {!showChat && (
        <button
          className={`floating-chat-button ${creditsExhausted ? 'exhausted' : ''}`} // NEW: Different styling when exhausted
          onClick={() => setShowChat(true)}
          title={creditsExhausted ? "Chat credits exhausted" : "Open chat with Naturo"}
        >
          {creditsExhausted ? "🚫" : "💬"}
          <span className={`notification-badge ${creditsExhausted ? 'exhausted' : ''}`}>
            {creditsExhausted ? "!" : messageCount}
          </span>
        </button>
      )}
    </div>
  );
};

export default ChatExample;
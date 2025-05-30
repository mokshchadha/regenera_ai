import React, { useState } from "react";
import ChatComponent from "./ChatComponent";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

const ChatExample: React.FC = () => {
  const [showChat, setShowChat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState(0);

  const handleError = (error: string) => {
    setError(error);
    // Clear error after 5 seconds
    setTimeout(() => setError(null), 5000);
  };

  const handleMessageSent = (message: string) => {
    console.log("Message sent:", message);
    setMessageCount((prev) => prev + 1);
  };

  const handleMessageReceived = (message: ChatMessage) => {
    console.log("Message received:", message);
  };

  return (
    <div className="chat-example-container">
      {
        /* <header className="example-header">
        <h1>Naturo AI Chat Assistant</h1>
        <p>Connect with Naturo, your wise digital assistant powered by AI</p>

        {error && (
          <div className="error-banner">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}
      </header> */
      }

      <main className="example-main">
        {!showChat
          ? (
            <div className="welcome-section">
              {
                /* <div className="welcome-card">
                <div className="welcome-icon">🐸</div>
                <h2>Meet Naturo</h2>
                <p>
                  I'm Naturo, a wise and slightly sarcastic golden toad who is
                  extinct but lives on digitally to help humans. I can help you
                  with:
                </p>
                <ul>
                  <li>🗄️ Database queries and data analysis</li>
                  <li>📚 General information and explanations</li>
                  <li>🤝 Personalized assistance and coaching</li>
                  <li>🌿 Environmental wisdom (I am a toad, after all)</li>
                </ul>
                <button
                  className="start-chat-button"
                  onClick={() => setShowChat(true)}
                >
                  Start Chatting with Naturo
                </button>
                <div className="stats">
                  <span>Messages sent this session: {messageCount}</span>
                </div>
              </div> */
              }
            </div>
          )
          : (
            <div className="chat-section">
              <div className="chat-wrapper">
                <ChatComponent
                  serverUrl="http://localhost:8000"
                  userId="demo-user"
                  placeholder="Ask Naturo anything..."
                  welcomeMessage="🐸 Hey there! I'm Naturo. Life on earth is complicated, but I'm here to help you make the best of it. What's on your mind?"
                  onError={handleError}
                  onMessageSent={handleMessageSent}
                  onMessageReceived={handleMessageReceived}
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
                <div className="chat-info">
                  <span>💡 Tip: Ask me about your data or general topics!</span>
                </div>
              </div>
            </div>
          )}
      </main>

      {
        /* <footer className="example-footer">
        <p>
          Powered by <strong>Regenera AI</strong> | Built with{" "}
          <strong>Deno</strong> & <strong>React</strong>
        </p>
      </footer> */
      }

      {/* Floating Chat Button - Alternative Implementation */}
      {!showChat && (
        <button
          className="floating-chat-button"
          onClick={() => setShowChat(true)}
          title="Open chat with Naturo"
        >
          💬
          <span className="notification-badge">1</span>
        </button>
      )}
    </div>
  );
};

export default ChatExample;

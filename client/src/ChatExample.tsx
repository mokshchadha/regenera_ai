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
    console.log(error)
  };

  return (
    <div>
      <main className="">
        {!showChat
          ? (
            <div className="">
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

      {!showChat && (
        <button
          className="floating-chat-button"
          onClick={() => setShowChat(true)}
          title="Open chat with Naturo"
        >
          💬
          <span className="notification-badge">{messageCount}</span>
        </button>
      )}
    </div>
  );
};

export default ChatExample;

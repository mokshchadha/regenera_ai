import React from "react";
import FloatingChatBot from "./FloatingChatBot";
import "./App.css";

// Example client detail - in real app, this would come from your auth/user context
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

function App() {
  const clientDetail: ClientDetail = {
    personNumber: "P123456",
    id: "demo-user",
    companyId: "REGENERA_EARTH",
    userId: "demo-user",
  };

  const handleError = (error: string) => {
    console.error("Chat error:", error);
    // You can add toast notifications or other error handling here
  };

  const handleMessageSent = (message: string) => {
    console.log("Message sent:", message);
    // Track analytics or other side effects
  };

  const handleMessageReceived = (message: ChatMessage) => {
    console.log("Message received:", message);
    // Handle message processing, notifications, etc.
  };

  const handleCreditsExhausted = () => {
    console.log("🚫 AI Credits have been exhausted!");
    // You can show notifications, redirect to upgrade page, etc.
  };

  return (
    <>
      {/* Your existing app content */}
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <div
          style={{
            background: "rgba(255, 255, 255, 0.9)",
            borderRadius: "20px",
            padding: "40px",
            textAlign: "center",
            maxWidth: "600px",
            backdropFilter: "blur(10px)",
          }}
        >
          <h1 style={{ color: "#2d3748", marginBottom: "20px" }}>
            🌿 Regenera Earth
          </h1>
          <p style={{ color: "#4a5568", fontSize: "1.1rem", lineHeight: 1.6 }}>
            Welcome to Regenera Earth! This is your main application. The
            floating chat button in the bottom-right corner will let you chat
            with Naturo, our AI assistant, anytime you need help.
          </p>
        </div>
      </div>

      {/* Floating ChatBot */}
      <FloatingChatBot
        serverUrl="http://localhost:8000"
        userId="demo-user"
        clientDetail={clientDetail}
        onError={handleError}
        onMessageSent={handleMessageSent}
        onMessageReceived={handleMessageReceived}
        onCreditsExhausted={handleCreditsExhausted}
      />
    </>
  );
}

export default App;

// client-example.ts
// Example client code to interact with the chatbot server

const SERVER_URL = "http://localhost:8000";

class ChatbotClient {
  private sessionId?: string;
  private serverUrl: string;

  constructor(serverUrl: string = SERVER_URL) {
    this.serverUrl = serverUrl;
  }

  async createSession(userId?: string): Promise<string> {
    const response = await fetch(`${this.serverUrl}/sessions`, {
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
    this.sessionId = data.sessionId;
    return data.sessionId;
  }

  async sendMessage(message: string, sessionId?: string): Promise<any> {
    const response = await fetch(`${this.serverUrl}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: sessionId || this.sessionId,
        message,
        createNewSession: !sessionId && !this.sessionId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to send message: ${error.error}`);
    }

    const data = await response.json();
    if (!this.sessionId) {
      this.sessionId = data.sessionId;
    }
    return data;
  }

  async getMessages(sessionId?: string): Promise<any> {
    const id = sessionId || this.sessionId;
    if (!id) {
      throw new Error("No session ID available");
    }

    const response = await fetch(`${this.serverUrl}/sessions/${id}/messages`);

    if (!response.ok) {
      throw new Error(`Failed to get messages: ${response.statusText}`);
    }

    return response.json();
  }

  async deleteSession(sessionId?: string): Promise<void> {
    const id = sessionId || this.sessionId;
    if (!id) {
      throw new Error("No session ID available");
    }

    const response = await fetch(`${this.serverUrl}/sessions/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(`Failed to delete session: ${response.statusText}`);
    }

    if (id === this.sessionId) {
      this.sessionId = undefined;
    }
  }
}

// Example usage
async function exampleChat() {
  const client = new ChatbotClient();

  try {
    // Create a new session
    console.log("Creating session...");
    const sessionId = await client.createSession("user123");
    console.log(`Session created: ${sessionId}`);

    // Send messages
    console.log("\n💬 Sending first message...");
    let response = await client.sendMessage("What is machine learning?");
    console.log(`Naturo: ${response.message.content}`);

    console.log("\n💬 Sending follow-up message...");
    response = await client.sendMessage("Can you give me an example?");
    console.log(`Naturo: ${response.message.content}`);

    // Get conversation history
    console.log("\n📜 Getting conversation history...");
    const history = await client.getMessages();
    console.log(`Total messages: ${history.messages.length}`);

    // Clean up
    // await client.deleteSession();
    // console.log("\n🧹 Session deleted");
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the example
if (import.meta.main) {
  await exampleChat();
}

export { ChatbotClient };

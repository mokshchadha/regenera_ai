import { ChatbotManager } from "./chatbot.ts";
import process from "node:process";

// Example implementation of the multi-agent chatbot
class ChatbotApp {
  private chatManager: ChatbotManager;
  private isInitialized: boolean = false;

  constructor() {
    // Initialize with your Google AI API key
    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY") || "your-api-key-here";
    console.log("apikey=========", apiKey);
    this.chatManager = new ChatbotManager(apiKey);
    this.isInitialized = true;
  }

  async runExamples() {
    if (!this.isInitialized) {
      console.log("❌ Chatbot not initialized properly");
      return;
    }

    console.log("🐸 Starting Naturo Chatbot Examples...\n");

    // Test different types of queries
    const testQueries = [
      // SQL only query
      "Show me my order history from last month",

      // Info only query
      "What is machine learning?",

      // Hybrid query
      "Explain blockchain technology and show me my crypto transactions",

      // Another hybrid
      "What are the benefits of meditation and how many meditation sessions have I completed this week?",

      // Unclear/general query
      "I need help with my life",
    ];

    for (const query of testQueries) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`👤 User: ${query}`);
      console.log(`${"=".repeat(60)}`);

      try {
        const response = await this.chatManager.handleUserMessage(query);
        console.log(`🐸 Naturo: ${response}`);
      } catch (error) {
        console.log(`❌ Error: ${error}`);
      }

      // Add delay between queries to avoid rate limiting
      await this.delay(2000);
    }
  }

  async testIndividualAgents() {
    console.log("\n🧪 Testing Individual Agents...\n");

    const testQuery =
      "What is artificial intelligence and show me my AI course progress?";

    // Test Coach Agent
    console.log("🎯 Testing Coach Agent (Classification):");
    try {
      const coachResult = await this.chatManager.testComponent(
        "coach",
        testQuery,
      );
      console.log(coachResult.text);
    } catch (error) {
      console.log(`❌ Coach Agent Error: ${error}`);
    }

    await this.delay(1000);

    // Test Info Agent
    console.log("\n📚 Testing Info Agent:");
    try {
      const infoResult = await this.chatManager.testComponent(
        "info",
        "What is artificial intelligence?",
      );
      console.log(infoResult.text);
    } catch (error) {
      console.log(`❌ Info Agent Error: ${error}`);
    }

    await this.delay(1000);

    // Test SQL Agent
    console.log("\n🗄️ Testing SQL Agent:");
    try {
      const sqlResult = await this.chatManager.testComponent(
        "sql",
        "Show me my AI course progress",
      );
      console.log(sqlResult.text);
    } catch (error) {
      console.log(`❌ SQL Agent Error: ${error}`);
    }

    await this.delay(1000);

    // Test Naturo Agent
    console.log("\n🐸 Testing Naturo Agent:");
    try {
      const naturoInput = `
        Original User Query: "${testQuery}"
        
        Query Classification: hybrid
        
        SQL Agent Response:
        {
          "sql_query": "SELECT c.name, p.progress_percentage, p.last_updated FROM courses c JOIN user_progress p ON c.id = p.course_id WHERE c.category = 'AI' AND p.user_id = ?",
          "explanation": "Retrieve user's progress in AI-related courses",
          "parameters": ["user_id"],
          "estimated_complexity": "medium"
        }
        
        Info Agent Response:
        {
          "answer": "Artificial Intelligence (AI) is a branch of computer science focused on creating systems that can perform tasks typically requiring human intelligence...",
          "key_points": ["Machine learning is a subset of AI", "AI applications include natural language processing", "AI systems learn from data"],
          "related_topics": ["Machine Learning", "Deep Learning", "Neural Networks"]
        }
        
        Please respond as Naturo, combining this information into a cohesive, helpful response with your unique personality and coaching style.
      `;

      const naturoResult = await this.chatManager.testComponent(
        "naturo",
        naturoInput,
      );
      console.log(naturoResult.text);
    } catch (error) {
      console.log(`❌ Naturo Agent Error: ${error}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Interactive chat session
  async startInteractiveChat() {
    console.log("\n🐸 Starting Interactive Chat with Naturo...");
    console.log("Type 'exit' to end the conversation\n");

    // This would be replaced with actual user input in a real application
    // For now, we'll simulate a conversation
    const simulatedConversation = [
      "Hello Naturo!",
      "What is your purpose?",
      "Show me my recent activities",
      "Explain quantum computing",
      "How can I improve my productivity and show me my task completion rates?",
      "exit",
    ];

    for (const message of simulatedConversation) {
      if (message === "exit") {
        console.log("👤 User: exit");
        console.log(
          "🐸 Naturo: Life on earth is complicated, but you're doing great! Until next time, get out there and do something good! 🐸",
        );
        break;
      }

      console.log(`👤 User: ${message}`);

      try {
        const response = await this.chatManager.handleUserMessage(message);
        console.log(`🐸 Naturo: ${response}\n`);
      } catch (error) {
        console.log(`❌ Error: ${error}\n`);
      }

      await this.delay(1500);
    }
  }
}

// Main execution
async function main() {
  const app = new ChatbotApp();

  try {
    // Run different test scenarios
    await app.runExamples();

    console.log("\n" + "=".repeat(60));

    await app.testIndividualAgents();

    console.log("\n" + "=".repeat(60));

    await app.startInteractiveChat();
  } catch (error) {
    console.error("Application error:", error);
  }
}

// Environment setup helper
function setupEnvironment() {
  console.log("🚀 Setting up Naturo Multi-Agent Chatbot Environment...\n");

  // Check for required environment variables
  if (!process.env.GOOGLE_AI_API_KEY) {
    console.log(
      "⚠️  Warning: GOOGLE_AI_API_KEY not found in environment variables",
    );
    console.log("Please set your Google AI API key:");
    console.log("export GOOGLE_AI_API_KEY='your-api-key-here'\n");
  }

  console.log("📋 System Overview:");
  console.log("1. Coach Agent - Classifies queries (SQL vs Info)");
  console.log("2. SQL Agent - Converts natural language to SQL");
  console.log("3. Info Agent - Provides general information");
  console.log("4. Naturo Agent - Merges responses with personality");
  console.log("\n🐸 Ready to chat with Naturo!\n");
}

// Export for use in other modules
export { ChatbotApp, setupEnvironment };

setupEnvironment();
main().catch(console.error);

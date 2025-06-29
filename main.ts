import { ChatbotManager } from "./chatbot.ts";
import { DatabaseConnection } from "./database.ts";
import process from "node:process";

// Example implementation of the multi-agent chatbot with database integration
class ChatbotApp {
  private chatManager: ChatbotManager;
  private db: DatabaseConnection;
  private isInitialized: boolean = false;

  constructor() {

    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY") || "your-api-key-here";
    console.log(
      "🔑 API Key configured:",
      apiKey !== "your-api-key-here" ? "✅" : "❌",
    );

    this.chatManager = new ChatbotManager(apiKey);
    this.db = new DatabaseConnection();
    this.isInitialized = true;
  }

  async initializeDatabase() {
    console.log("\n🗄️ Initializing database connection...");

    try {
      const isConnected = await this.chatManager.testDatabase();

      if (isConnected) {
        console.log("✅ Database connected successfully");

        // Get basic database info
        const dbInfo = await this.chatManager.getDatabaseInfo();
        if (dbInfo.success && dbInfo.data) {
          const tableCount = new Set(dbInfo.data.map((col: any) =>
            col.table_name
          )).size;
          console.log(
            `📊 Database contains ${tableCount} tables with ${dbInfo.data.length} total columns`,
          );
        }

        return true;
      } else {
        console.log("❌ Database connection failed");
        console.log(
          "⚠️  SQL queries will not work, but info queries will still function",
        );
        return false;
      }
    } catch (error) {
      console.error("Database initialization error:", error);
      return false;
    }
  }

  async runExamples() {
    if (!this.isInitialized) {
      console.log("❌ Chatbot not initialized properly");
      return;
    }

    console.log("🐸 Starting Naturo Chatbot Examples...\n");

    // Test different types of queries including database queries
    const testQueries = [
      // SQL queries (will work if database is connected)
      "What is the total amount of money we have invested in our landscape ?",
      "What is the impact of my contributions in our landscape ?",
      "How many hectares is my organization caring for with our subscription ?",

      // Info only queries
      "What is regenera trying to do?",
      "Tell me about biodiversity credits",

      // Hybrid queries
      "Explain carbon footprint and show me our emissions data",

      // General queries
      "I need help with my environmental impact",
    ];

    for (const query of testQueries) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`👤 User: ${query}`);
      console.log(`${"=".repeat(60)}`);

      try {
        const response = await this.chatManager.handleUserMessage(query, {
          id: "demo-user",
          companyId: "demo-company",
          userId: "demo-user",
        });
        console.log(`🐸 Naturo: ${response}`);

        // Check if response includes database results
        if (
          response.includes("Database Results") ||
          response.includes("Query executed")
        ) {
          console.log("🗄️ [Database integration active]");
        }
      } catch (error) {
        console.log(`❌ Error: ${error}`);
      }

      // Add delay between queries to avoid rate limiting
      await this.delay(2000);
    }
  }

  async testDatabaseQueries() {
    console.log("\n🗄️ Testing Database-Specific Queries...\n");

    const dbQueries = [
      "What landscape is my organization 20 subscribed to ?",
      "What plan is my organization 20 subscribed to ?",
      "Since when is my organization 20 contributing to Regenera ?",
      "What is the total amount of money we have invested in our landscape ?",
      "What is the impact of my contributions in our landscape ?",
      "How many hectares is my organization caring for with our subscription ?",
      "What are the key species being protected in our landscape ?",
      "How many Guardians are we working with in our landscape ?",
      "Remind me how many livelihoods of local people we are supporting in our landscape ?",
    ];

    for (const query of dbQueries) {
      console.log(`\n📊 Database Query: ${query}`);
      console.log("-".repeat(50));

      try {
        const response = await this.chatManager.handleUserMessage(query, {
          id: "3",
          companyId: "20",
          userId: "3",
        });

        console.log(
          `🐸 Response: ${response.substring(0, 500)}${
            response.length > 500 ? "..." : ""
          }`,
        );
      } catch (error) {
        console.log(`❌ Query failed: ${error}`);
      }

      await this.delay(3000); // Longer delay for database queries
    }
  }

  async testIndividualAgents() {
    console.log("\n🧪 Testing Individual Agents...\n");

    const testQuery =
      "What is our total carbon footprint and show me our emissions data?";

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

    // Test SQL Agent with database integration
    console.log("\n🗄️ Testing SQL Agent with Database:");
    try {
      const sqlResult = await this.chatManager.testComponent(
        "sql",
        "Show me all organizations in our database",
      );
      console.log(sqlResult.text);
    } catch (error) {
      console.log(`❌ SQL Agent Error: ${error}`);
    }

    await this.delay(1000);

    // Test Info Agent
    console.log("\n📚 Testing Info Agent:");
    try {
      const infoResult = await this.chatManager.testComponent(
        "info",
        "What are biodiversity credits?",
      );
      console.log(infoResult.text);
    } catch (error) {
      console.log(`❌ Info Agent Error: ${error}`);
    }

    await this.delay(1000);

    // Test Naturo Agent
    console.log("\n🐸 Testing Naturo Agent:");
    try {
      const naturoInput = `
        Original User Query: "${testQuery}"
        
        Query Classification: hybrid
        
        SQL Agent Response (with Database Results):
        📊 Database Results:
        ✅ Query executed successfully!
        
        📊 Query Results (5 rows):
        
        id   | organization_name        | carbon_emissions
        -----|--------------------------|------------------
        1    | EcoTech Solutions       | 1250.5
        2    | Green Energy Corp       | 890.2
        3    | Sustainable Foods Ltd   | 2100.8
        4    | CleanWater Systems      | 670.3
        5    | Renewable Resources     | 1480.6
        
        Info Agent Response:
        Carbon footprint represents the total greenhouse gas emissions caused by activities, measured in CO2 equivalent. Organizations track this to understand environmental impact and work toward net-zero goals.
        
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

  // Interactive chat session with database capabilities
  async startInteractiveChat() {
    console.log(
      "\n🐸 Starting Interactive Chat with Naturo (Database-Enhanced)...",
    );
    console.log("Type 'exit' to end the conversation\n");

    // Enhanced conversation examples with database queries
    const simulatedConversation = [
      "Hello Naturo!",
      "What databases do we have available?",
      "Show me our organization data",
      "How many landscape subscriptions do we have?",
      "Explain what biodiversity credits are",
      "What's our environmental impact based on the data?",
      "exit",
    ];

    for (const message of simulatedConversation) {
      if (message === "exit") {
        console.log("👤 User: exit");
        console.log(
          "🐸 Naturo: Life on earth is complicated, but you're doing great! The data shows we're making progress. Until next time, get out there and do something good! 🐸",
        );
        break;
      }

      console.log(`👤 User: ${message}`);

      try {
        const response = await this.chatManager.handleUserMessage(message, {
          id: "demo-user",
          companyId: "regenera",
          userId: "demo-user",
        });
        console.log(`🐸 Naturo: ${response}\n`);

        // Indicate if database was used
        if (
          response.includes("Database Results") ||
          response.includes("Query executed")
        ) {
          console.log("   💾 [Response included database query results]\n");
        }
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
    // Initialize database connection
    const dbReady = await app.initializeDatabase();

    if (dbReady) {
      console.log("\n🚀 Running with full database integration");

      // Test database-specific queries
      await app.testDatabaseQueries();
    } else {
      console.log("\n⚠️  Running in limited mode (info queries only)");
    }

    console.log("\n" + "=".repeat(60));

    // Run standard examples
    await app.runExamples();

    console.log("\n" + "=".repeat(60));

    // Test individual agents
    await app.testIndividualAgents();

    console.log("\n" + "=".repeat(60));

    // Interactive chat
    await app.startInteractiveChat();
  } catch (error) {
    console.error("Application error:", error);
  }
}

// Environment setup helper
function setupEnvironment() {
  console.log(
    "🚀 Setting up Naturo Multi-Agent Chatbot with Database Integration...\n",
  );

  // Check for required environment variables
  if (!process.env.GOOGLE_AI_API_KEY) {
    console.log(
      "⚠️  Warning: GOOGLE_AI_API_KEY not found in environment variables",
    );
    console.log("Please set your Google AI API key:");
    console.log("export GOOGLE_AI_API_KEY='your-api-key-here'\n");
  }

  console.log("📋 System Overview:");
  console.log("1. 🎯 Coach Agent - Classifies queries (SQL vs Info)");
  console.log(
    "2. 🗄️ SQL Agent - Converts natural language to SQL + executes queries",
  );
  console.log("3. 📚 Info Agent - Provides general information");
  console.log("4. 🐸 Naturo Agent - Merges responses with personality");
  console.log("5. 💾 Database - PostgreSQL integration for real data");

  console.log("\n🔗 Database Configuration:");
  console.log("   Host: ec2-3-235-177-45.compute-1.amazonaws.com");
  console.log("   Port: 5432");
  console.log("   Database: regenera_core");
  console.log("   Status: Will be tested on startup");

  console.log(
    "\n🐸 Ready to chat with Naturo (now with database superpowers)!\n",
  );
}

// Export for use in other modules
export { ChatbotApp, setupEnvironment };

setupEnvironment();
main().catch(console.error);

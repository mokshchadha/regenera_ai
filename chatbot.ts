// deno-lint-ignore-file no-explicit-any
// chatbot.ts 
import { GoogleAIAgent } from "./google-ai-agent.ts";
import Prompts from "./prompts.ts";
import { sanitizeJsonOutput } from "./utils.ts";
import { DatabaseConnection, QueryResult } from "./database.ts";
import {
  AgentConfigs,
  AgentSource,
  AgentTextResponse,
  AgentType,
  ClientDetail,
  MergedResponseData,
  ProcessedAgentResult,
  QueryClassification,
  QueryDetails,
} from "./types.ts";

interface AgentResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  source: AgentSource;
}

export class MultiAgentChatbot {
  private readonly googleAI: GoogleAIAgent;
  private readonly agents: Record<AgentType, any>;
  private readonly db: DatabaseConnection;
  private readonly confidenceThreshold = 0.5;
  public readonly modelName: string;

  constructor(apiKey: string) {
    this.googleAI = new GoogleAIAgent(apiKey);
    this.modelName = this.googleAI.modelName;
    this.agents = this.initializeAgents();
    this.db = new DatabaseConnection();
  }

  private initializeAgents(): Record<AgentType, any> {
    const agentConfigs: AgentConfigs = {
      coach: {
        name: "QueryCoach",
        instruction: Prompts.queryCoach,
        description: "Classify queries into SQL and information requests",
        isGoogleSearchEnabled: false,
        model: "gemini-2.0-flash",
      },
      sql: {
        name: "SQLAgent",
        instruction: Prompts.nlSqlAgent,
        description: "Convert natural language to SQL queries",
        isGoogleSearchEnabled: false,
        model: "gemini-2.5-flash",
      },
      info: {
        name: "InfoAgent",
        instruction: Prompts.regeneraInfoAgent,
        description: "Provide comprehensive information and explanations",
        isGoogleSearchEnabled: true,
        model: "gemini-2.0-flash",
      },
      naturo: {
        name: "Naturo",
        instruction: Prompts.naturoPersona,
        description:
          "Merge responses with Naturo's unique personality and coaching style",
        isGoogleSearchEnabled: false,
        model: "gemini-2.0-flash",
      },
    };

    return Object.entries(agentConfigs).reduce(
      (acc, [key, config]) => ({
        ...acc,
        [key]: this.googleAI.agent(config),
      }),
      {} as Record<AgentType, any>,
    );
  }

  private hasValidClientDetail(clientDetail?: ClientDetail): boolean {
    if (!clientDetail) return false;

    return !!(
      clientDetail.personNumber ||
      clientDetail.id ||
      clientDetail.companyId ||
      clientDetail.userId
    );
  }

  private async executeSQLQuery(sqlQuery: string): Promise<string> {
    try {
      console.log("🗄️ Executing SQL query:", sqlQuery);

      const result: QueryResult = await this.db.executeQuery(sqlQuery);

      if (!result.success) {
        return `❌ Database Error: ${result.error}`;
      }

      if (!result.data || result.data.length === 0) {
        return "📭 No data found matching your query.";
      }

      const formattedResults = this.db.formatResults(result);

      return `✅ Query executed successfully!\n${formattedResults}`;
    } catch (error) {
      console.error("Database execution error:", error);
      return `❌ Error executing database query: ${
        error instanceof Error ? error.message : "Unknown error"
      }`;
    }
  }

  private extractSQLFromResponse(sqlAgentResponse: string): string | null {
    try {
      const parsed = JSON.parse(sqlAgentResponse);
      if (parsed.sql_query) {
        return parsed.sql_query;
      }
    } catch(e) {
      console.log("Error", e)
    }

    const sqlPatterns = [
      /```sql\s*([\s\S]*?)\s*```/i,
      /SELECT\s+[\s\S]*?FROM\s+[\s\S]*?(?:;|$)/i,
      /"sql_query":\s*"([^"]*?)"/i,
    ];

    for (const pattern of sqlPatterns) {
      const match = sqlAgentResponse.match(pattern);
      if (match) {
        return match[1]?.trim() || match[0]?.trim();
      }
    }

    return null;
  }


  public async processQuery(
    userQuery: string,
    clientDetail?: ClientDetail,
  ): Promise<AgentResponse<MergedResponseData>> {
    try {
      const hasClientDetail = this.hasValidClientDetail(clientDetail);

      if (!hasClientDetail) {
        console.log(
          "🚫 No valid client detail found - using limited agents only",
        );
        return await this.processLimitedQuery(userQuery);
      }

      console.log("✅ Valid client detail found - using all agents");

      const classification = await this.classifyQuery(userQuery);
      if (!classification) {
        return this.createErrorResponse("Failed to classify query");
      }

      console.log("📊 Classification:", classification);

      const [sqlResult, infoResult] = await this.processAgentQueries(
        userQuery,
        classification,
      );

      this.logResults(sqlResult, infoResult);

      const mergedResponse = await this.mergeResponses(
        userQuery,
        classification,
        sqlResult,
        infoResult,
      );

      return {
        success: true,
        data: {
          response: mergedResponse.text,
          classification,
          sql_data: sqlResult?.text || null,
          info_data: infoResult?.text || null,
        },
        source: "merged",
      };
    } catch (error) {
      console.error("Error processing query:", error);
      return this.createErrorResponse(
        error instanceof Error ? error.message : "Unknown error occurred",
      );
    }
  }

  private async processLimitedQuery(
    userQuery: string,
  ): Promise<AgentResponse<MergedResponseData>> {
    try {
      console.log("📚 Processing info query only...");
      const infoResult = await this.agents.info(userQuery);

      console.log(
        "📖 Info Result:",
        infoResult?.text ? "✅ Success" : "❌ None",
      );
      const limitedClassification: QueryClassification = {
        classification: "info",
        sql_query: {
          detected: false,
          confidence: 0,
          extracted_intent: null,
        },
        info_query: {
          detected: true,
          confidence: 1.0,
          extracted_intent: userQuery,
        },
      };

      const mergeInput = this.buildLimitedMergeInput(userQuery, infoResult);
      console.log("🐸 Merging with Naturo (limited mode)...");
      const mergedResponse = await this.agents.naturo(mergeInput);

      return {
        success: true,
        data: {
          response: mergedResponse.text,
          classification: limitedClassification,
          sql_data: null,
          info_data: infoResult?.text || null,
        },
        source: "merged",
      };
    } catch (error) {
      console.error("Error processing limited query:", error);
      return this.createErrorResponse(
        error instanceof Error ? error.message : "Unknown error occurred",
      );
    }
  }

  private buildLimitedMergeInput(
    originalQuery: string,
    infoResult: AgentTextResponse | null,
  ): string {
    const sections: string[] = [
      `Original User Query: "${originalQuery}"`,
      `Query Classification: info_only (limited mode - no client detail available)`,
    ];

    if (infoResult?.text) {
      sections.push(`Info Agent Response:\n${infoResult.text}`);
    } else {
      sections.push(`Info Agent Response: No information available`);
    }

    sections.push(
      "Please respond as Naturo with your unique personality. Note that some personalized features are not available without client details, but provide helpful general information and encouragement.",
    );

    return sections.join("\n\n");
  }

  private async classifyQuery(
    userQuery: string,
  ): Promise<QueryClassification | null> {
    console.log("🎯 Classifying query...");

    try {
      const classificationResponse = await this.agents.coach(userQuery);
      return sanitizeJsonOutput(classificationResponse.text);
    } catch (parseError) {
      console.error("Failed to parse classification:", parseError);
      return null;
    }
  }

  private async processAgentQueries(
    userQuery: string,
    classification: QueryClassification,
  ): Promise<[AgentTextResponse | null, AgentTextResponse | null]> {
    const promises: Promise<ProcessedAgentResult>[] = [];

    if (this.shouldProcessSqlQuery(classification)) {
      console.log("🗄️ Processing SQL query...");
      promises.push(
        this.createSQLAgentPromise("sql", classification.sql_query, userQuery),
      );
    }

    if (this.shouldProcessInfoQuery(classification)) {
      console.log("📚 Processing info query...");
      promises.push(
        this.createAgentPromise("info", classification.info_query, userQuery),
      );
    }

    const results = await Promise.allSettled(promises);
    return this.extractAgentResults(results);
  }

  private shouldProcessSqlQuery(classification: QueryClassification): boolean {
    return (
      classification.sql_query.detected &&
      classification.sql_query.confidence > this.confidenceThreshold
    );
  }

  private shouldProcessInfoQuery(classification: QueryClassification): boolean {
    return (
      classification.info_query.detected &&
      classification.info_query.confidence > this.confidenceThreshold
    );
  }

  private async createSQLAgentPromise(
    agentType: "sql",
    queryDetails: QueryDetails,
    fallbackQuery: string,
  ): Promise<ProcessedAgentResult> {
    try {
      const agentResponse = await this.agents[agentType](
        queryDetails.extracted_intent || fallbackQuery,
      );

      const sqlQuery = this.extractSQLFromResponse(agentResponse.text);

      if (sqlQuery) {
        console.log("🔍 Extracted SQL:", sqlQuery);
        const databaseResults = await this.executeSQLQuery(sqlQuery);
        const enhancedResponse = {
          text:
            `${agentResponse.text}\n\n📊 **Database Results:**\n${databaseResults}`,
        };

        return { type: agentType, data: enhancedResponse };
      } else {
        console.log("⚠️ No valid SQL found in agent response");
        return { type: agentType, data: agentResponse };
      }
    } catch (error) {
      return {
        type: agentType,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async createAgentPromise(
    agentType: "info",
    queryDetails: QueryDetails,
    fallbackQuery: string,
  ): Promise<ProcessedAgentResult> {
    try {
      const result = await this.agents[agentType](
        queryDetails.extracted_intent || fallbackQuery,
      );
      return { type: agentType, data: result };
    } catch (error) {
      return {
        type: agentType,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private extractAgentResults(
    results: PromiseSettledResult<ProcessedAgentResult>[],
  ): [AgentTextResponse | null, AgentTextResponse | null] {
    let sqlResult: AgentTextResponse | null = null;
    let infoResult: AgentTextResponse | null = null;

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        const { type, data, error } = result.value;
        const processedData = data || error;

        if (type === "sql") {
          sqlResult = processedData as AgentTextResponse;
        } else if (type === "info") {
          infoResult = processedData as AgentTextResponse;
        }
      }
    });

    return [sqlResult, infoResult];
  }

  private logResults(
    sqlResult: AgentTextResponse | null,
    infoResult: AgentTextResponse | null,
  ): void {
    console.log("🤖 SQL Result:", sqlResult?.text ? "✅ Success" : "❌ None");
    console.log("📖 Info Result:", infoResult?.text ? "✅ Success" : "❌ None");
  }

  private async mergeResponses(
    originalQuery: string,
    classification: QueryClassification,
    sqlResult: AgentTextResponse | null,
    infoResult: AgentTextResponse | null,
  ): Promise<AgentTextResponse> {
    const mergeInput = this.buildMergeInput(
      originalQuery,
      classification,
      sqlResult,
      infoResult,
    );

    console.log("🐸 Merging with Naturo...");
    return await this.agents.naturo(mergeInput);
  }

  private buildMergeInput(
    originalQuery: string,
    classification: QueryClassification,
    sqlResult: AgentTextResponse | null,
    infoResult: AgentTextResponse | null,
  ): string {
    const sections: string[] = [
      `Original User Query: "${originalQuery}"`,
      `Query Classification: ${classification.classification}`,
    ];

    if (sqlResult?.text) {
      sections.push(
        `SQL Agent Response (with Database Results):\n${sqlResult.text}`,
      );
    }

    if (infoResult?.text) {
      sections.push(`Info Agent Response:\n${infoResult.text}`);
    }

    sections.push(
      "Please respond as Naturo, combining this information into a cohesive, helpful response with your unique personality and coaching style. If database results are included, help interpret them in a meaningful way for the user. Make it engaging and valuable for the human.",
    );

    return sections.join("\n\n");
  }

  private createErrorResponse(
    error: string,
  ): AgentResponse<MergedResponseData> {
    return {
      success: false,
      error,
      source: "merged",
    };
  }

  public async testAgent(
    agentType: AgentType,
    query: string,
  ): Promise<AgentTextResponse> {
    const agent = this.agents[agentType];
    if (!agent) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }

    return await agent(query);
  }

  public async testDatabaseConnection(): Promise<boolean> {
    console.log("🔗 Testing database connection...");
    const isConnected = await this.db.testConnection();
    console.log(
      isConnected ? "✅ Database connected" : "❌ Database connection failed",
    );
    return isConnected ?? false
  }

  public async getDatabaseInfo(): Promise<QueryResult> {
    console.log("📊 Fetching database schema information...");
    return await this.db.getTableInfo();
  }
}
export class ChatbotManager {
  private readonly chatbot: MultiAgentChatbot;
  private readonly fallbackMessage =
    "Hmm, something went wrong on my end. Even extinct toads have bad days sometimes!";
  public readonly modelName: string;

  constructor(apiKey: string) {
    this.chatbot = new MultiAgentChatbot(apiKey);
    this.modelName = this.chatbot.modelName;
  }

  async handleUserMessage(
    message: string,
    clientDetail?: ClientDetail,
  ): Promise<string> {
    try {
      const response = await this.chatbot.processQuery(message, clientDetail);
      return this.formatResponse(response);
    } catch (error) {
      console.error("Chatbot error:", error);
      return this.fallbackMessage;
    }
  }

  private formatResponse(response: AgentResponse<MergedResponseData>): string {
    if (response.success && response.data) {
      return response.data.response;
    }
    return `Sorry, I encountered an error: ${response.error}`;
  }

  async testComponent(
    component: AgentType,
    query: string,
  ): Promise<AgentTextResponse> {
    return await this.chatbot.testAgent(component, query);
  }

  async testDatabase(): Promise<boolean> {
    return await this.chatbot.testDatabaseConnection();
  }

  async getDatabaseInfo(): Promise<QueryResult> {
    return await this.chatbot.getDatabaseInfo();
  }
}

export interface ChatbotExample {
  apiKey: string;
  userMessage: string;
  clientDetail?: ClientDetail;
}

export async function exampleUsage(
  { apiKey, userMessage, clientDetail }: ChatbotExample,
): Promise<void> {
  const chatManager = new ChatbotManager(apiKey);

  const dbConnected = await chatManager.testDatabase();
  console.log(`Database status: ${dbConnected ? "Connected" : "Disconnected"}`);

  const response = await chatManager.handleUserMessage(
    userMessage,
    clientDetail,
  );
  console.log("Naturo says:", response);

  try {
    const coachTest = await chatManager.testComponent("coach", userMessage);
    console.log("Coach classification:", coachTest.text);
  } catch (error) {
    console.error("Component test failed:", error);
  }
}

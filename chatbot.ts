// deno-lint-ignore-file no-explicit-any
// chatbot.ts
import { GoogleAIAgent } from "./google-ai-agent.ts";
import Prompts from "./prompts.ts";
import { sanitizeJsonOutput } from "./utils.ts";
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
  private readonly confidenceThreshold = 0.5;
  public readonly modelName: string;

  constructor(apiKey: string) {
    this.googleAI = new GoogleAIAgent(apiKey);
    this.modelName = this.googleAI.modelName;
    this.agents = this.initializeAgents();
  }

  private initializeAgents(): Record<AgentType, any> {
    const agentConfigs: AgentConfigs = {
      coach: {
        name: "QueryCoach",
        instruction: Prompts.queryCoach,
        description: "Classify queries into SQL and information requests",
        isGoogleSearchEnabled: false,
      },
      sql: {
        name: "SQLAgent",
        instruction: Prompts.nlSqlAgent,
        description: "Convert natural language to SQL queries",
        isGoogleSearchEnabled: false,
      },
      info: {
        name: "InfoAgent",
        instruction: Prompts.regeneraInfoAgent,
        description: "Provide comprehensive information and explanations",
        isGoogleSearchEnabled: true,
      },
      naturo: {
        name: "Naturo",
        instruction: Prompts.naturoPersona,
        description:
          "Merge responses with Naturo's unique personality and coaching style",
        isGoogleSearchEnabled: false,
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

  // UPDATED: processQuery now takes clientDetail parameter
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

  // NEW: Process query with limited agents (only info and naturo)
  private async processLimitedQuery(
    userQuery: string,
  ): Promise<AgentResponse<MergedResponseData>> {
    try {
      console.log("📚 Processing info query only...");

      // Only use info agent
      const infoResult = await this.agents.info(userQuery);

      console.log(
        "📖 Info Result:",
        infoResult?.text ? "✅ Success" : "❌ None",
      );

      // Create a simplified classification for limited mode
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

      // Merge with Naturo (simplified input)
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

  // NEW: Build merge input for limited mode (no SQL data)
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
        this.createAgentPromise("sql", classification.sql_query, userQuery),
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

  private async createAgentPromise(
    agentType: "sql" | "info",
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
      sections.push(`SQL Agent Response:\n${sqlResult.text}`);
    }

    if (infoResult?.text) {
      sections.push(`Info Agent Response:\n${infoResult.text}`);
    }

    sections.push(
      "Please respond as Naturo, combining this information into a cohesive, helpful response with your unique personality and coaching style. Make it engaging and valuable for the human.",
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
}

// Usage Manager
export class ChatbotManager {
  private readonly chatbot: MultiAgentChatbot;
  private readonly fallbackMessage =
    "Hmm, something went wrong on my end. Even extinct toads have bad days sometimes!";
  public readonly modelName: string;

  constructor(apiKey: string) {
    this.chatbot = new MultiAgentChatbot(apiKey);
    this.modelName = this.chatbot.modelName;
  }

  // UPDATED: handleUserMessage now accepts clientDetail parameter
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

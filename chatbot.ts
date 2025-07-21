// deno-lint-ignore-file no-explicit-any
// chatbot.ts
import { GoogleAIAgent } from "./google-ai-agent.ts";
import Prompts from "./prompts/prompts.ts";
import { sanitizeJsonOutput } from "./utils.ts";
import { QueryResult, regeneraDB } from "./sql-executor.ts";
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
        description: "Convert natural language to SQL queries and execute them",
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

  private async executeSQLQuery(sqlQuery: string): Promise<{
    success: boolean;
    data?: string;
    error?: string;
  }> {
    try {
      console.log("🗄️ Executing SQL query against PostgreSQL database...");

      const result: QueryResult = await regeneraDB.executeQuery(sqlQuery);

      if (!result.success) {
        return {
          success: false,
          error: `Database error: ${result.error}`,
        };
      }

      // Format the results for display
      const formattedResult = {
        query_executed: result.executedQuery,
        row_count: result.rowCount || 0,
        data: result.data || [],
        message: result.rowCount === 0
          ? "Query executed successfully but returned no results."
          : `Query executed successfully. Retrieved ${result.rowCount} row(s).`,
      };

      return {
        success: true,
        data: JSON.stringify(formattedResult, null, 2),
      };
    } catch (error) {
      console.error("❌ SQL execution error:", error);
      return {
        success: false,
        error: `SQL execution failed: ${error}`,
      };
    }
  }

  private async processSQLAgent(
    userQuery: string,
    queryDetails: QueryDetails,
    clientDetail?: ClientDetail,
  ): Promise<AgentTextResponse | null> {
    try {
      console.log("🗄️ Processing SQL query with database execution...");
      console.log("cleintesl", {clientDetail})
      const contextualPrompt = this.buildSQLPromptWithContext(
        queryDetails.extracted_intent || userQuery,
        clientDetail,
      );
      const sqlAgentResponse = await this.agents.sql(contextualPrompt);

      if (!sqlAgentResponse?.text) {
        return {
          text: JSON.stringify(
            {
              error: "SQL agent failed to generate a response",
              sql_query: null,
              execution_result: null,
            },
            null,
            2,
          ),
        };
      }

      console.log("🔍 SQL Agent response:", sqlAgentResponse.text);
      let sqlQuery: string | null = null;
      let agentData: any = null;

      try {
        let cleanedResponse = sqlAgentResponse.text.trim();
        cleanedResponse = cleanedResponse.replace(/```json\n?/g, "").replace(
          /```\n?/g,
          "",
        );

        agentData = JSON.parse(cleanedResponse);
        sqlQuery = agentData.sql_query;

        if (sqlQuery && clientDetail) {
          sqlQuery = this.replaceQueryParameters(sqlQuery, clientDetail);
        }
      } catch (parseError) {
        console.error(
          "Failed to parse SQL agent response as JSON:",
          parseError,
        );

        const sqlMatch = sqlAgentResponse.text.match(/SELECT[\s\S]*?(?=;|$)/i);
        if (sqlMatch) {
          sqlQuery = sqlMatch[0].trim();

          if (clientDetail) {
            sqlQuery = this.replaceQueryParameters(
              String(sqlQuery),
              clientDetail,
            );
          }
        }
      }

      if (!sqlQuery) {
        return {
          text: JSON.stringify(
            {
              error: "No SQL query found in agent response",
              agent_response: sqlAgentResponse.text,
              execution_result: null,
            },
            null,
            2,
          ),
        };
      }

      console.log("🔍 Extracted SQL Query:", sqlQuery);

      // Execute the SQL query
      const executionResult = await this.executeSQLQuery(sqlQuery);

      // Combine agent response with execution results
      const combinedResult = {
        agent_analysis: agentData || { raw_response: sqlAgentResponse.text },
        sql_execution: executionResult,
        client_context: clientDetail
          ? {
            userId: clientDetail.userId,
            organizationId: clientDetail.id,
            companyId: clientDetail.companyId,
          }
          : null,
        timestamp: new Date().toISOString(),
      };

      return {
        text: JSON.stringify(combinedResult, null, 2),
      };
    } catch (error) {
      console.error("❌ SQL agent processing error:", error);
      return {
        text: JSON.stringify(
          {
            error: `SQL processing failed: ${error}`,
            sql_query: null,
            execution_result: null,
          },
          null,
          2,
        ),
      };
    }
  }

  private buildSQLPromptWithContext(
    userQuery: string,
    clientDetail?: ClientDetail,
  ): string {
    const basePrompt = `User Query: "${userQuery}"`;

    if (!clientDetail) {
      return `${basePrompt}\n\nNote: No client context available. Generate a general query structure with parameter placeholders.`;
    }

    const contextInfo = [];

    if (clientDetail.userId) {
      contextInfo.push(`User ID: ${clientDetail.userId}`);
    }

    if (clientDetail.accountId) {
      contextInfo.push(`Account ID: ${clientDetail.accountId}`);
    }

    if (clientDetail.companyId) {
      contextInfo.push(`Company ID: ${clientDetail.companyId}`);
    }

    if (clientDetail.personNumber) {
      contextInfo.push(`Person Number: ${clientDetail.personNumber}`);
    }

    const contextualPrompt = `
${basePrompt}

Client Context:
${contextInfo.join("\n")}

Instructions:
1. Use the provided client context to generate personalized queries
2. When querying user-specific data, use the User ID: ${
      clientDetail.userId || "N/A"
    }
3. When querying organization data, filter by organization ID: ${
      clientDetail.id || "N/A"
    }
4. Always include appropriate WHERE clauses to filter data for this specific client
5. Replace parameter placeholders with actual values from the client context
6. Ensure data security by only returning data accessible to this client

Generate a SQL query that answers the user's question using their specific context.
  `.trim();

    return contextualPrompt;
  }

  private replaceQueryParameters(
    sqlQuery: string,
    clientDetail: ClientDetail,
  ): string {
    let updatedQuery = sqlQuery;

    if (clientDetail.userId) {
      updatedQuery = updatedQuery
        .replace(/\$1/g, `'${clientDetail.userId}'`)
        .replace(/\?/g, `'${clientDetail.userId}'`)
        .replace(/:userId/g, `'${clientDetail.userId}'`)
        .replace(/\$userId/g, `'${clientDetail.userId}'`);
    }

    if (clientDetail.id) {
      updatedQuery = updatedQuery
        .replace(/\$2/g, `'${clientDetail.id}'`)
        .replace(/:organizationId/g, `'${clientDetail.id}'`)
        .replace(/\$organizationId/g, `'${clientDetail.id}'`);
    }

    if (clientDetail.companyId) {
      updatedQuery = updatedQuery
        .replace(/:companyId/g, `'${clientDetail.companyId}'`)
        .replace(/\$companyId/g, `'${clientDetail.companyId}'`);
    }

    if (clientDetail.personNumber) {
      updatedQuery = updatedQuery
        .replace(/:personNumber/g, `'${clientDetail.personNumber}'`)
        .replace(/\$personNumber/g, `'${clientDetail.personNumber}'`);
    }

    return updatedQuery;
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
      console.log("👤 Client context:", {
        userId: clientDetail?.userId,
        organizationId: clientDetail?.id,
        companyId: clientDetail?.companyId,
        personNumber: clientDetail?.personNumber,
      });

      const classification = await this.classifyQuery(userQuery);
      if (!classification) {
        return this.createErrorResponse("Failed to classify query");
      }

      console.log("📊 Classification:", classification);

      const [sqlResult, infoResult] = await this.processAgentQueries(
        userQuery,
        classification,
        clientDetail,
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
        error instanceof Error
          ? String(error)
          : String("Unknown error occurred"),
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
        error instanceof Error
          ? String(error)
          : String("Unknown error occurred"),
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
    clientDetail?: ClientDetail, 
  ): Promise<[AgentTextResponse | null, AgentTextResponse | null]> {
    const promises: Promise<ProcessedAgentResult>[] = [];

    if (this.shouldProcessSqlQuery(classification)) {
      console.log("🗄️ Processing SQL query with database execution...");
      promises.push(
        this.createSQLAgentPromise(
          classification.sql_query,
          userQuery,
          clientDetail,  
        ),
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
    queryDetails: QueryDetails,
    fallbackQuery: string,
    clientDetail?: ClientDetail, 
  ): Promise<ProcessedAgentResult> {
    try {
      const result = await this.processSQLAgent(
        fallbackQuery,
        queryDetails,
        clientDetail,
      );
      return { type: "sql", data: result };
    } catch (error) {
      return {
        type: "sql",
        error: error instanceof Error
          ? String(error)
          : String("Unknown error occurred"),
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
        error: error instanceof Error
          ? String(error)
          : String("Unknown error occurred"),
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
        `SQL Agent Response (with database execution results):\n${sqlResult.text}`,
      );
    }

    if (infoResult?.text) {
      sections.push(`Info Agent Response:\n${infoResult.text}`);
    }

    sections.push(
      "Please respond as Naturo, combining this information into a cohesive, helpful response with your unique personality and coaching style. If there are database results, present them in a user-friendly way. Make it engaging and valuable for the human.",
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
    try {
      const isConnected = await regeneraDB.testConnection();
      console.log(
        `🗄️ Database connection test: ${
          isConnected ? "✅ Success" : "❌ Failed"
        }`,
      );
      return isConnected;
    } catch (error) {
      console.error("❌ Database connection test failed:", error);
      return false;
    }
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

  async testDatabase(): Promise<boolean> {
    return await this.chatbot.testDatabaseConnection();
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

  // Test database connection first
  console.log("🧪 Testing database connection...");
  const dbConnected = await chatManager.testDatabase();
  if (!dbConnected) {
    console.warn(
      "⚠️ Database connection failed, SQL queries may not work properly",
    );
  }

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

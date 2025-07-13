// sql-executor.ts
// PostgreSQL database connection and query execution module

import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface QueryResult {
  success: boolean;
  data?: any[];
  error?: string;
  rowCount?: number;
  executedQuery?: string;
}

export class PostgreSQLExecutor {
  private config: DatabaseConfig;
  private client: Client | null = null;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  private async connect(): Promise<void> {
    if (this.client) {
      return; // Already connected
    }

    try {
      this.client = new Client({
        hostname: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
      });

      await this.client.connect();
      console.log("✅ Connected to PostgreSQL database");
    } catch (error) {
      console.error("❌ Failed to connect to PostgreSQL:", error);
      throw new Error(`Database connection failed: ${error}`);
    }
  }

  private async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
      console.log("🔌 Disconnected from PostgreSQL database");
    }
  }

  private ensureLimit(query: string): string {
    // Convert query to lowercase for checking, but preserve original case
    const lowerQuery = query.toLowerCase().trim();

    // Check if query already has a LIMIT clause
    if (lowerQuery.includes(" limit ")) {
      return query; // Query already has a limit
    }

    // Add LIMIT 10 to SELECT queries
    if (lowerQuery.startsWith("select")) {
      // Remove trailing semicolon if present
      const cleanQuery = query.trim().replace(/;$/, "");
      return `${cleanQuery} LIMIT 10;`;
    }

    return query; // Non-SELECT queries don't need LIMIT
  }

  private sanitizeQuery(query: string): string {
    // Remove dangerous keywords and operations
    const dangerousPatterns = [
      /\b(drop|delete|truncate|alter|create|insert|update)\b/gi,
      /--.*$/gm, // Remove SQL comments
      /\/\*[\s\S]*?\*\//g, // Remove block comments
    ];

    let sanitized = query;

    // Check for dangerous operations
    for (const pattern of dangerousPatterns.slice(0, 1)) { // Only check for dangerous keywords
      if (pattern.test(sanitized)) {
        throw new Error(
          "Query contains potentially dangerous operations. Only SELECT queries are allowed.",
        );
      }
    }

    // Remove comments for safety
    for (const pattern of dangerousPatterns.slice(1)) {
      sanitized = sanitized.replace(pattern, "");
    }

    return sanitized.trim();
  }

  async executeQuery(query: string): Promise<QueryResult> {
    try {
      // Sanitize the query first
      const sanitizedQuery = this.sanitizeQuery(query);

      // Ensure LIMIT is applied
      const limitedQuery = this.ensureLimit(sanitizedQuery);

      console.log("🔍 Executing query:", limitedQuery);

      await this.connect();

      if (!this.client) {
        throw new Error("Database client not initialized");
      }

      // Execute the query
      const result = await this.client.queryObject(limitedQuery);

      return {
        success: true,
        data: result.rows,
        rowCount: result.rowCount || 0,
        executedQuery: limitedQuery,
      };
    } catch (error) {
      console.error("❌ Query execution failed:", error);

      return {
        success: false,
        error: String(error),
        executedQuery: query,
      };
    } finally {
      await this.disconnect();
    }
  }

  // Method to test database connection
  async testConnection(): Promise<boolean> {
    try {
      await this.connect();

      if (!this.client) {
        return false;
      }

      // Simple test query
      await this.client.queryObject("SELECT 1 as test");
      await this.disconnect();

      return true;
    } catch (error) {
      console.error("❌ Connection test failed:", error);
      await this.disconnect();
      return false;
    }
  }

  // Method to get database schema information
  async getTableInfo(): Promise<QueryResult> {
    const schemaQuery = `
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
      LIMIT 100;
    `;

    return await this.executeQuery(schemaQuery);
  }
}

// Create a singleton instance with the Regenera database configuration
export const regeneraDB = new PostgreSQLExecutor({
  host: Deno.env.get("DB_HOST") || "",
  port: parseInt(Deno.env.get("DB_PORT") || "5432"),
  database: Deno.env.get("DB_NAME") || "",
  user: "regenera",
  password: Deno.env.get("DB_PASSWORD") || "",
});

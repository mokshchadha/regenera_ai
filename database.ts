// database.ts

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface QueryResult {
  success: boolean;
  data?: any[];
  error?: string;
  rowCount?: number;
  query?: string;
}

export class DatabaseConnection {
  private config: DatabaseConfig;
  private connectionString: string;

  constructor(config?: DatabaseConfig) {
    this.config = config || {
      host: "ec2-3-235-177-45.compute-1.amazonaws.com",
      port: 5432,
      database: "regenera_core",
      username: "regenera",
      password: "8KOz3aeBa08GNa",
    };

    this.connectionString =
      `postgresql://${this.config.username}:${this.config.password}@${this.config.host}:${this.config.port}/${this.config.database}`;
  }

  async executeQuery(query: string, params?: any[]): Promise<QueryResult> {
    let client;

    try {
      if (!this.isSelectQuery(query)) {
        return {
          success: false,
          error: "Only SELECT queries are allowed for security reasons",
          query,
        };
      }

      const { Client } = await import(
        "https://deno.land/x/postgres@v0.17.0/mod.ts"
      );

      client = new Client(this.connectionString);
      await client.connect();

      console.log("🔗 Connected to PostgreSQL database");
      console.log("📊 Executing query:", query.substring(0, 100) + "...");

      const result = await client.queryObject(query, params);

      console.log(
        `✅ Query executed successfully. Rows returned: ${result.rows.length}`,
      );

      return {
        success: true,
        data: result.rows,
        rowCount: result.rows.length,
        query,
      };
    } catch (error) {
      console.error("❌ Database query error:", error);
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Unknown database error",
        query,
      };
    } finally {
      if (client) {
        try {
          await client.end();
          console.log("🔌 Database connection closed");
        } catch (closeError) {
          console.error("Error closing database connection:", closeError);
        }
      }
    }
  }

  async testConnection(): Promise<boolean | undefined> {
    try {
      const result = await this.executeQuery("SELECT 1 as test");
      return result.success && result.data && result.data.length > 0;
    } catch (error) {
      console.error("Database connection test failed:", error);
      return false;
    }
  }

 
  getTableInfo(): Promise<QueryResult> {
    const query = `
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `;

    return this.executeQuery(query);
  }

  getTables(): Promise<QueryResult> {
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    return this.executeQuery(query);
  }

 
  private isSelectQuery(query: string): boolean {
    const trimmedQuery = query.trim().toLowerCase();

    if (!trimmedQuery.startsWith("select")) {
      return false;
    }

    const dangerousKeywords = [
      "insert",
      "update",
      "delete",
      "drop",
      "create",
      "alter",
      "truncate",
      "grant",
      "revoke",
      "exec",
      "execute",
    ];

    return !dangerousKeywords.some((keyword) =>
      trimmedQuery.includes(keyword.toLowerCase())
    );
  }
 
  formatResults(result: QueryResult): string {
    if (!result.success) {
      return `Database Error: ${result.error}`;
    }

    if (!result.data || result.data.length === 0) {
      return "No data found for your query.";
    }

    const headers = Object.keys(result.data[0]);
    const maxWidth = 50; // Maximum column width for display

    let output = `\n📊 Query Results (${result.rowCount} rows):\n\n`;

    // Add headers
    output +=
      headers.map((h) => h.padEnd(Math.min(h.length + 2, maxWidth))).join(
        " | ",
      ) + "\n";
    output +=
      headers.map((h) => "-".repeat(Math.min(h.length + 2, maxWidth))).join(
        "-|-",
      ) + "\n";

    // Add data rows (limit to first 10 rows for readability)
    const displayRows = result.data.slice(0, 10);

    for (const row of displayRows) {
      const rowData = headers.map((header) => {
        const value = row[header];
        const strValue = value === null ? "NULL" : String(value);
        return strValue.length > maxWidth
          ? strValue.substring(0, maxWidth - 3) + "..."
          : strValue.padEnd(Math.min(strValue.length + 2, maxWidth));
      });
      output += rowData.join(" | ") + "\n";
    }

    if (result.data.length > 10) {
      output += `\n... and ${result.data.length - 10} more rows\n`;
    }

    return output;
  }
}

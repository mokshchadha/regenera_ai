import {
  Application,
  Context,
  Next,
  Router,
  RouterContext,
} from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { ChatbotManager } from "./chatbot.ts";
import { regeneraDB } from "./sql-executor.ts";
import {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  ChatSession,
  SessionsResponse,
} from "./types.ts";
import { handleError } from "./utils.ts";

const sessions = new Map<string, ChatSession>(); // im creating this with the assumption that we are using a single node
const PORT = parseInt(Deno.env.get("PORT") || "8000");
const API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");

const MAX_MESSAGES_PER_SESSION = 10;
const AI_CREDITS_EXHAUSTED_MESSAGE =
  "You have used your AI credits, please come back later.";

if (!API_KEY) {
  console.error("GOOGLE_AI_API_KEY environment variable is required");
  Deno.exit(1);
}


const chatbotManager = new ChatbotManager(API_KEY);


let isDatabaseConnected = false;

async function initializeDatabase(): Promise<void> {
  console.log("🗄️ Initializing database connection...");
  try {
    isDatabaseConnected = await regeneraDB.testConnection();

    if (isDatabaseConnected) {
      console.log("✅ Database connection successful");

      const tableInfo = await regeneraDB.getTableInfo();
      if (tableInfo.success && tableInfo.data) {
        const tables = [
          ...new Set(tableInfo.data.map((row: any) => row.table_name)),
        ];
        console.log(
          `📋 Available tables: ${tables.slice(0, 5).join(", ")}${
            tables.length > 5 ? "..." : ""
          }`,
        );
      }
    } else {
      console.log("❌ Database connection failed");
      console.log("⚠️ SQL features will be limited");
    }
  } catch (error) {
    console.error("❌ Database initialization error:", error);
    isDatabaseConnected = false;
  }
}

function getUserMessageCount(session: ChatSession): number {
  return session.messages.filter((msg) => msg.role === "user").length;
}

function hasExceededMessageLimit(session: ChatSession): boolean {
  const userMessageCount = getUserMessageCount(session);
  return userMessageCount >= MAX_MESSAGES_PER_SESSION;
}

function createSession(userId?: string): ChatSession {
  const sessionId = crypto.randomUUID();
  const session: ChatSession = {
    id: sessionId,
    userId: userId || "anonymous",
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  sessions.set(sessionId, session);
  return session;
}

function getSession(sessionId: string): ChatSession | undefined {
  return sessions.get(sessionId);
}

function updateSession(sessionId: string, message: ChatMessage): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.messages.push(message);
    session.updatedAt = new Date();
    sessions.set(sessionId, session);
  }
}

function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

function cleanupSessions(): void {
  const now = new Date();
  const maxAge = 24 * 60 * 60 * 1000;

  for (const [sessionId, session] of sessions.entries()) {
    if (now.getTime() - session.updatedAt.getTime() > maxAge) {
      sessions.delete(sessionId);
      console.log(`🧹 Cleaned up session: ${sessionId}`);
    }
  }
}

setInterval(cleanupSessions, 60 * 60 * 1000);

const app = new Application();
const router = new Router();

app.use(oakCors({
  origin: "*", // TODO: Configure this based on regenera
  credentials: true,
}));

app.use(async (ctx: Context, next: Next) => {
  try {
    await next();
  } catch (err: unknown) {
    handleError(err, ctx);
  }
});

router.get("/health", (ctx: RouterContext<string>) => {
  ctx.response.body = {
    status: "ok",
    timestamp: new Date(),
    sessionsCount: sessions.size,
    database: {
      connected: isDatabaseConnected,
      status: isDatabaseConnected ? "connected" : "disconnected",
    },
    features: {
      sqlQueries: isDatabaseConnected,
      infoQueries: true,
      chatbot: true,
    },
  };
});

router.get("/database/status", async (ctx: RouterContext<string>) => {
  try {
    const connectionTest = await regeneraDB.testConnection();
    isDatabaseConnected = connectionTest;

    ctx.response.body = {
      connected: connectionTest,
      host: Deno.env.get("DB_HOST"),
      port: Deno.env.get("DB_PORT"),
      database: Deno.env.get("DB_NAME"),
      timestamp: new Date(),
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      connected: false,
      error: error,
      timestamp: new Date(),
    };
  }
});

router.get("/database/schema", async (ctx: RouterContext<string>) => {
  if (!isDatabaseConnected) {
    ctx.response.status = 503;
    ctx.response.body = { error: "Database not connected" };
    return;
  }

  try {
    const tableInfo = await regeneraDB.getTableInfo();

    if (tableInfo.success) {
      const schema: Record<string, any[]> = {};
      tableInfo.data?.forEach((row: any) => {
        if (!schema[row.table_name]) {
          schema[row.table_name] = [];
        }
        schema[row.table_name].push({
          column: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable === "YES",
        });
      });

      ctx.response.body = {
        success: true,
        tables: Object.keys(schema),
        schema: schema,
        timestamp: new Date(),
      };
    } else {
      ctx.response.status = 500;
      ctx.response.body = {
        success: false,
        error: tableInfo.error,
        timestamp: new Date(),
      };
    }
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: error,
      timestamp: new Date(),
    };
  }
});

router.post("/sessions", async (ctx: RouterContext<string>) => {
  const body = await ctx.request.body().value;
  const userId = body?.userId;

  const session = createSession(userId);

  ctx.response.status = 201;
  ctx.response.body = {
    sessionId: session.id,
    userId: session.userId,
    createdAt: session.createdAt,
    databaseStatus: isDatabaseConnected ? "connected" : "disconnected",
  };
});

router.get("/sessions/:sessionId", (ctx: RouterContext<string>) => {
  const { sessionId } = ctx.params;
  const session = getSession(sessionId);

  if (!session) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Session not found" };
    return;
  }

  const userMessageCount = getUserMessageCount(session);

  ctx.response.body = {
    id: session.id,
    userId: session.userId,
    messageCount: session.messages.length,
    userMessageCount: userMessageCount,
    maxMessages: MAX_MESSAGES_PER_SESSION,
    creditsRemaining: Math.max(0, MAX_MESSAGES_PER_SESSION - userMessageCount),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    databaseStatus: isDatabaseConnected ? "connected" : "disconnected", 
  };
});

router.get("/sessions/:sessionId/messages", (ctx: RouterContext<string>) => {
  const { sessionId } = ctx.params;
  const session = getSession(sessionId);

  if (!session) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Session not found" };
    return;
  }

  const userMessageCount = getUserMessageCount(session);

  ctx.response.body = {
    sessionId: session.id,
    messages: session.messages,
    userMessageCount: userMessageCount, 
    maxMessages: MAX_MESSAGES_PER_SESSION, 
    creditsRemaining: Math.max(0, MAX_MESSAGES_PER_SESSION - userMessageCount), 
    databaseStatus: isDatabaseConnected ? "connected" : "disconnected", 
  };
});

// NOTE: Main chat endpoint with client detail handling and message limits
router.post("/chat", async (ctx: RouterContext<string>) => {
  const body: ChatRequest = await ctx.request.body().value;
  const { sessionId, message, createNewSession, clientDetail } = body;

  if (!message || typeof message !== "string") {
    ctx.response.status = 400;
    ctx.response.body = { error: "Message is required" };
    return;
  }

  let session: ChatSession | undefined;

  if (createNewSession || !sessionId) {
    session = createSession(body.userId);
  } else {
    session = getSession(sessionId);
    if (!session) {
      ctx.response.status = 404;
      ctx.response.body = {
        error:
          "Session not found. Create a new session or set createNewSession to true.",
      };
      return;
    }
  }

  
  if (hasExceededMessageLimit(session)) {
    console.log(`🚫 Session ${session.id} has exceeded message limit`);

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: AI_CREDITS_EXHAUSTED_MESSAGE,
      timestamp: new Date(),
    };

    updateSession(session.id, assistantMessage);

    const userMessageCount = getUserMessageCount(session);

    const chatResponse: ChatResponse = {
      sessionId: session.id,
      message: assistantMessage,
      context: {
        totalMessages: session.messages.length,
        sessionCreated: session.createdAt,
        messageCount: userMessageCount,
      },
    };

    ctx.response.body = chatResponse;
    return;
  }

  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: message,
    timestamp: new Date(),
  };
  updateSession(session.id, userMessage);

  const userMessageCount = getUserMessageCount(session);
  if (userMessageCount >= MAX_MESSAGES_PER_SESSION) {
    console.log(
      `⚠️ Session ${session.id} reached message limit after this message`,
    );

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: AI_CREDITS_EXHAUSTED_MESSAGE,
      timestamp: new Date(),
    };
    updateSession(session.id, assistantMessage);

    const chatResponse: ChatResponse = {
      sessionId: session.id,
      message: assistantMessage,
      context: {
        totalMessages: session.messages.length,
        sessionCreated: session.createdAt,
        messageCount: userMessageCount,
      },
    };

    ctx.response.body = chatResponse;
    return;
  }

  try {
    if (clientDetail) {
      console.log(`✅ Client detail provided for session ${session.id}:`, {
        hasPersonNumber: !!clientDetail.personNumber,
        hasId: !!clientDetail.id,
        hasCompanyId: !!clientDetail.companyId,
        hasUserId: !!clientDetail.userId,
      });
    } else {
      console.log(
        `🚫 No client detail provided for session ${session.id} - using limited agents`,
      );
    }

    console.log(
      `🗄️ Database status: ${
        isDatabaseConnected ? "Connected" : "Disconnected"
      }`,
    );

    const context = session.messages
      .slice(-10)
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    const contextualMessage = context
      ? `${context}\nuser: ${message}`
      : message;

    const response = await chatbotManager.handleUserMessage(
      contextualMessage,
      clientDetail,
    );

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: response,
      timestamp: new Date(),
    };
    updateSession(session.id, assistantMessage);

    const finalUserMessageCount = getUserMessageCount(session);

    const chatResponse: ChatResponse = {
      sessionId: session.id,
      message: assistantMessage,
      context: {
        totalMessages: session.messages.length,
        sessionCreated: session.createdAt,
        messageCount: finalUserMessageCount,
      },
    };

    ctx.response.body = chatResponse;
  } catch (error) {
    console.error("Chat processing error:", error);
    handleError(error, ctx);
  }
});

router.delete("/sessions/:sessionId", (ctx: RouterContext<string>) => {
  const { sessionId } = ctx.params;

  if (deleteSession(sessionId)) {
    ctx.response.status = 204;
  } else {
    ctx.response.status = 404;
    ctx.response.body = { error: "Session not found" };
  }
});

router.get("/sessions", (ctx: RouterContext<string>) => {
  const sessionList = Array.from(sessions.values()).map((session) => {
    const userMessageCount = getUserMessageCount(session);
    return {
      id: session.id,
      userId: session.userId,
      messageCount: session.messages.length,
      userMessageCount: userMessageCount,
      creditsRemaining: Math.max(
        0,
        MAX_MESSAGES_PER_SESSION - userMessageCount,
      ),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  });

  const response: SessionsResponse = {
    sessions: sessionList,
    total: sessionList.length,
  };

  ctx.response.body = response;
});

app.use(router.routes());
app.use(router.allowedMethods());

// Initialize database before starting server
await initializeDatabase();

console.log(`Chatbot server starting on port ${PORT}...`);
console.log(`Environment: ${Deno.env.get("DENO_ENV") || "development"}`);
console.log(
  `Using Google AI model: ${chatbotManager.modelName || "gemini-2.0-flash"}`,
);
console.log(`📊 Configuration:`);
console.log(`  - Max messages per session: ${MAX_MESSAGES_PER_SESSION}`);
console.log(`  - Client detail validation: enabled`);
console.log(
  `  - Database connection: ${
    isDatabaseConnected ? "✅ Connected" : "❌ Disconnected"
  }`,
);
console.log(
  `  - SQL features: ${isDatabaseConnected ? "✅ Enabled" : "❌ Limited"}`,
);
console.log(
  `  - Limited agents mode: info + naturo only (when no client detail)`,
);

if (!isDatabaseConnected) {
  console.log(`⚠️  Database connection failed. SQL queries will not work.`);
  console.log(`   Check your database credentials and network connectivity.`);
}

await app.listen({ port: PORT });

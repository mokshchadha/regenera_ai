import {
  Application,
  Middleware,
  Router,
  RouterContext,
} from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { ChatbotManager } from "./chatbot.ts";
import {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  ChatSession,
  ClientDetail,
  SessionsResponse,
} from "./types.ts";
import { handleError } from "./utils.ts";

const sessions = new Map<string, ChatSession>(); // im creating this with the assumption that we are using a single node
const PORT = parseInt(Deno.env.get("PORT") || "8000");
const API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");

// NEW: Constants for message limits
const MAX_MESSAGES_PER_SESSION = 10;
const AI_CREDITS_EXHAUSTED_MESSAGE =
  "You have used your AI credits, please come back later.";

if (!API_KEY) {
  console.error("GOOGLE_AI_API_KEY environment variable is required");
  Deno.exit(1);
}

// Initialize chatbot manager
const chatbotManager = new ChatbotManager(API_KEY);

// NEW: Function to count user messages in a session
function getUserMessageCount(session: ChatSession): number {
  return session.messages.filter((msg) => msg.role === "user").length;
}

// NEW: Function to check if session has exceeded message limit
function hasExceededMessageLimit(session: ChatSession): boolean {
  const userMessageCount = getUserMessageCount(session);
  return userMessageCount >= MAX_MESSAGES_PER_SESSION;
}

// Session management functions
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

app.use(async (ctx: RouterContext, next: Middleware) => {
  try {
    await next();
  } catch (err: unknown) {
    handleError(err, ctx);
  }
});

router.get("/health", (ctx: RouterContext) => {
  ctx.response.body = {
    status: "ok",
    timestamp: new Date(),
    sessionsCount: sessions.size,
  };
});

router.post("/sessions", async (ctx: RouterContext) => {
  const body = await ctx.request.body().value;
  const userId = body?.userId;

  const session = createSession(userId);

  ctx.response.status = 201;
  ctx.response.body = {
    sessionId: session.id,
    userId: session.userId,
    createdAt: session.createdAt,
  };
});

router.get("/sessions/:sessionId", (ctx: RouterContext) => {
  const { sessionId } = ctx.params;
  const session = getSession(sessionId);

  if (!session) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Session not found" };
    return;
  }

  // NEW: Include message count in response
  const userMessageCount = getUserMessageCount(session);

  ctx.response.body = {
    id: session.id,
    userId: session.userId,
    messageCount: session.messages.length,
    userMessageCount: userMessageCount, // NEW: Track user messages specifically
    maxMessages: MAX_MESSAGES_PER_SESSION, // NEW: Include limit info
    creditsRemaining: Math.max(0, MAX_MESSAGES_PER_SESSION - userMessageCount), // NEW: Credits remaining
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
});

router.get("/sessions/:sessionId/messages", (ctx: RouterContext) => {
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
    userMessageCount: userMessageCount, // NEW: Include user message count
    maxMessages: MAX_MESSAGES_PER_SESSION, // NEW: Include limit
    creditsRemaining: Math.max(0, MAX_MESSAGES_PER_SESSION - userMessageCount), // NEW: Credits remaining
  };
});

// UPDATED: Main chat endpoint with client detail handling and message limits
router.post("/chat", async (ctx: RouterContext) => {
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

  // NEW: Check if session has exceeded message limit BEFORE processing
  if (hasExceededMessageLimit(session)) {
    console.log(`🚫 Session ${session.id} has exceeded message limit`);

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: AI_CREDITS_EXHAUSTED_MESSAGE,
      timestamp: new Date(),
    };

    // Don't add user message to avoid further incrementing count
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

  // NEW: Check if this message puts us at the limit
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
    // NEW: Log client detail availability
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

    const context = session.messages
      .slice(-10)
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    const contextualMessage = context
      ? `${context}\nuser: ${message}`
      : message;

    // NEW: Pass client detail to chatbot manager
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
        messageCount: finalUserMessageCount, // NEW: Include current message count
      },
    };

    ctx.response.body = chatResponse;
  } catch (error) {
    console.error("Chat processing error:", error);
    handleError(error, ctx);
  }
});

router.delete("/sessions/:sessionId", (ctx: RouterContext) => {
  const { sessionId } = ctx.params;

  if (deleteSession(sessionId)) {
    ctx.response.status = 204;
  } else {
    ctx.response.status = 404;
    ctx.response.body = { error: "Session not found" };
  }
});

router.get("/sessions", (ctx: RouterContext) => {
  const sessionList = Array.from(sessions.values()).map((session) => {
    const userMessageCount = getUserMessageCount(session);
    return {
      id: session.id,
      userId: session.userId,
      messageCount: session.messages.length,
      userMessageCount: userMessageCount, // NEW: Include user message count
      creditsRemaining: Math.max(
        0,
        MAX_MESSAGES_PER_SESSION - userMessageCount,
      ), // NEW: Credits remaining
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

console.log(`Chatbot server starting on port ${PORT}...`);
console.log(`Environment: ${Deno.env.get("DENO_ENV") || "development"}`);
console.log(
  `Using Google AI model: ${chatbotManager.modelName || "gemini-2.0-flash"}`,
);
console.log(`📊 Configuration:`);
console.log(`  - Max messages per session: ${MAX_MESSAGES_PER_SESSION}`);
console.log(`  - Client detail validation: enabled`);
console.log(
  `  - Limited agents mode: info + naturo only (when no client detail)`,
);

await app.listen({ port: PORT });

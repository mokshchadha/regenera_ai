# Regenera AI Multi-Agent Chatbot with PostgreSQL Integration

A sophisticated multi-agent chatbot system powered by Google AI (Gemini) that
combines natural language processing with real-time database queries and
comprehensive information retrieval.

## 🌟 Features

- **Multi-Agent Architecture**: Coach, SQL, Info, and Naturo agents working
  together
- **PostgreSQL Integration**: Real-time database queries with automatic result
  limiting
- **Client Detail Validation**: Personalized responses based on user
  authentication
- **B-Corp Certified**: Supporting environmental conservation through Regenera
- **Session Management**: Persistent chat sessions with message limits
- **RESTful API**: Complete server implementation with health monitoring

## 🗄️ Database Configuration

The system connects to a PostgreSQL database with the following configuration:

```
Host: 
Port:  
Database:  
Username: 
Password:
```

### Database Features

- **Automatic Query Limiting**: All SQL queries are automatically limited to 10
  rows for performance
- **Security**: Only SELECT queries are allowed - no data modification
  operations
- **Schema Discovery**: Automatic table and column information retrieval
- **Connection Health**: Real-time database connection monitoring

## 🚀 Quick Start

### Prerequisites

- [Deno](https://deno.land/) installed
- Google AI API key
- Network access to the PostgreSQL database

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd regenera_ai
```

2. Set up environment variables:

```bash
export GOOGLE_AI_API_KEY="your-google-ai-api-key"
export PORT=8000  # Optional, defaults to 8000
```

3. Test database connection:

```bash
deno task test-db
```

4. Run the application:

```bash
# Development mode with auto-reload
deno task dev

# Production server
deno task server

# Run tests
deno task test
```

## 🤖 Agent System

### 1. Coach Agent

- **Purpose**: Query classification and routing
- **Function**: Determines whether queries require SQL database access,
  information retrieval, or both
- **Output**: Classification with confidence scores

### 2. SQL Agent (Enhanced with PostgreSQL)

- **Purpose**: Natural language to SQL conversion and execution
- **Function**:
  - Converts user queries to PostgreSQL-compatible SELECT statements
  - Executes queries against the Regenera database
  - Returns formatted results with metadata
- **Security**: Restricted to SELECT operations only
- **Performance**: Automatic LIMIT 10 for all queries

### 3. Info Agent

- **Purpose**: General information and knowledge retrieval
- **Function**: Provides comprehensive answers using Regenera's knowledge base
- **Sources**: Internal documentation, environmental data, and general knowledge

### 4. Naturo Agent

- **Purpose**: Response synthesis and personality
- **Function**: Combines all agent outputs into cohesive, engaging responses
- **Personality**: Wise, slightly sarcastic golden toad with environmental focus

## 📊 Database Schema

The system works with various tables in the Regenera database:

- `organization` - Partner organizations and companies
- `landscape` - Protected and restored natural areas
- `landscape_subscription` - Conservation subscriptions and certificates
- `landscape_plan` - Conservation plans and pricing
- `summary_metrics` - Environmental impact measurements
- `trimestral_report_data` - Quarterly conservation reports
- `payout_transactions` - Financial transactions for conservation
- `footprint_calculations_log` - Environmental footprint data

## 🔌 API Endpoints

### Health & Status

- `GET /health` - System health with database status
- `GET /database/status` - Database connection status
- `GET /database/schema` - Database schema information

### Session Management

- `POST /sessions` - Create new chat session
- `GET /sessions/:id` - Get session details
- `GET /sessions/:id/messages` - Get session messages
- `DELETE /sessions/:id` - Delete session
- `GET /sessions` - List all sessions

### Chat

- `POST /chat` - Send message and get response

### Example Chat Request

```json
{
  "sessionId": "optional-session-id",
  "message": "Show me organizations in Peru",
  "userId": "user123",
  "clientDetail": {
    "personNumber": "P123456",
    "id": "user123",
    "companyId": "REGENERA_EARTH",
    "userId": "user123"
  }
}
```

## 🧪 Testing

### Database Connection Test

```bash
deno task test-db
```

This will test:

- Database connectivity
- Schema information retrieval
- Sample queries execution
- SQL agent format simulation

### Component Testing

```bash
deno task test
```

Tests individual agents and the complete system integration.

## 🔒 Security Features

### Database Security

- **Query Restriction**: Only SELECT statements allowed
- **SQL Injection Protection**: Query sanitization and parameterization
- **Result Limiting**: Automatic 10-row limit on all queries
- **Connection Management**: Secure connection handling with automatic cleanup

### Session Security

- **Message Limits**: 10 messages per session to prevent abuse
- **Client Validation**: Optional client detail verification
- **Session Cleanup**: Automatic cleanup of old sessions

## 🌱 Environmental Impact

This chatbot supports Regenera's mission to protect and regenerate nature:

- **Carbon Offsetting**: Helps users understand and offset environmental
  footprint
- **Conservation Data**: Provides real-time access to conservation metrics
- **Community Support**: Connects users with land managers and communities
- **Transparency**: Open access to environmental impact data

## 📱 Frontend Integration

The system includes a React frontend with:

- **Floating Chat Widget**: Unobtrusive chat interface
- **Real-time Messaging**: Instant responses with typing indicators
- **Credits Tracking**: Visual representation of message limits
- **Responsive Design**: Works on desktop and mobile

### Frontend Components

- `FloatingChatBot.tsx` - Main chat widget
- `ChatComponent.tsx` - Core chat functionality
- `useChat.ts` - Chat state management hook

## 🔧 Configuration

### Environment Variables

```bash
GOOGLE_AI_API_KEY=your-api-key-here  # Required
PORT=8000                            # Optional
DENO_ENV=development                 # Optional
```

## 🐛 Troubleshooting

### Database Connection Issues

1. Check network connectivity to AWS EC2 instance
2. Verify database credentials
3. Ensure PostgreSQL service is running
4. Check firewall rules for port 5432

### Common Error Messages

- **"Database connection failed"**: Network or credential issue
- **"Only SELECT queries are allowed"**: Attempted unsafe SQL operation
- **"Credits exhausted"**: Session message limit reached
- **"Session not found"**: Invalid or expired session ID

### Debug Mode

Enable verbose logging by checking the console output when running with:

```bash
deno task dev
```

## 📚 Documentation

### Agent Prompts

All agent prompts are defined in `prompts.ts` and can be customized:

- Query classification logic
- SQL generation guidelines
- Information retrieval instructions
- Naturo personality traits

### Database Schema

The complete database schema is documented in the SQL agent prompt within
`prompts.ts`.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Test your changes with `deno task test` and `deno task test-db`
4. Submit a pull request

## 📄 License

This project supports Regenera's environmental conservation mission. Please use
responsibly and in accordance with environmental best practices.

## 🆘 Support

For technical support:

1. Check the troubleshooting section above
2. Review console logs for detailed error messages
3. Test database connectivity with `deno task test-db`
4. Verify API key configuration

For questions about Regenera's conservation work:

- Visit [Regenera's website](https://regenera.land)
- Contact: info@regenera.land

#!/bin/bash
# start.sh - Start the Deno chatbot server with database integration

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Deno Chatbot Server with Database Integration...${NC}"

# Check if Deno is installed
if ! command -v deno &> /dev/null; then
    echo -e "${RED}❌ Deno is not installed!${NC}"
    echo "Please install Deno: https://deno.land/#installation"
    exit 1
fi

# Check if .env file exists and load it
if [ -f .env ]; then
    echo -e "${GREEN}📄 Loading environment variables from .env file${NC}"
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if API key is set
if [ -z "$GOOGLE_AI_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  Warning: GOOGLE_AI_API_KEY environment variable is not set${NC}"
    echo "You can set it by running:"
    echo "  export GOOGLE_AI_API_KEY='your-api-key'"
    echo ""
    read -p "Do you want to continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Set default port if not specified
PORT=${PORT:-8000}

echo -e "${GREEN}📡 Server will start on port $PORT${NC}"
echo -e "${GREEN}🤖 Using Gemini model: gemini-2.0-flash${NC}"
echo -e "${BLUE}🗄️  Database: PostgreSQL integration enabled${NC}"
echo -e "${BLUE}🔗 Database Host: ec2-3-235-177-45.compute-1.amazonaws.com${NC}"
echo ""

# Function to run the server
run_server() {
    echo -e "${GREEN}Starting server...${NC}"
    deno run \
        --allow-net \
        --allow-env \
        --allow-read \
        --watch \
        --env \
        server.ts
}

# Function to run the main test
run_main() {
    echo -e "${GREEN}Running main application with database tests...${NC}"
    deno run \
        --allow-net \
        --allow-env \
        --allow-read \
        --watch \
        --env \
        main.ts
}

# Function to test database only
test_database() {
    echo -e "${GREEN}Testing database connection only...${NC}"
    deno run \
        --allow-net \
        --allow-env \
        --allow-read \
        test-database.ts
}

# Check command line arguments
case "${1:-server}" in
    "server")
        echo -e "${BLUE}Mode: Server${NC}"
        run_server
        ;;
    "main")
        echo -e "${BLUE}Mode: Main Application Test${NC}"
        run_main
        ;;
    "test-db")
        echo -e "${BLUE}Mode: Database Test Only${NC}"
        test_database
        ;;
    "help")
        echo "Usage: $0 [server|main|test-db|help]"
        echo ""
        echo "  server   - Start the web server (default)"
        echo "  main     - Run main application with all tests"
        echo "  test-db  - Test database connection only"
        echo "  help     - Show this help message"
        ;;
    *)
        echo -e "${RED}❌ Unknown option: $1${NC}"
        echo "Use '$0 help' for available options"
        exit 1
        ;;
esac
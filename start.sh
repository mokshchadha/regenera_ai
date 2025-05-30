#!/bin/bash
# start.sh - Start the Deno chatbot server

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Deno Chatbot Server...${NC}"

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
echo ""

# Run the server with appropriate permissions
deno run \
    --allow-net \
    --allow-env \
    --allow-read \
    --watch \
    --env \
    server.ts
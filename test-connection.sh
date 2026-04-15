#!/bin/bash

echo "=========================================="
echo "🧪 TESTING MICROSERVICE CONNECTION"
echo "=========================================="
echo ""

# === Colors ===
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# === Test 1: Check if RabbitMQ URL is accessible ===
echo -e "${YELLOW}[1/5] Testing RabbitMQ Connection...${NC}"
RABBITMQ_URL="${RABBITMQ_URL:-amqp://tmdt:tmdt2026@rabbitmq:5672}"
echo "RabbitMQ URL: $RABBITMQ_URL"

if timeout 5 bash -c "</dev/tcp/localhost/5672" 2>/dev/null; then
  echo -e "${GREEN}✅ RabbitMQ is accessible on port 5672${NC}"
else
  echo -e "${RED}❌ RabbitMQ is NOT accessible on port 5672${NC}"
  echo "   Make sure RabbitMQ is running: docker-compose up -d rabbitmq"
  exit 1
fi

echo ""

# === Test 2: Check if MySQL is running ===
echo -e "${YELLOW}[2/5] Testing Database Connection...${NC}"
DATABASE_URL="${DATABASE_URL:-mysql://root:tmdt2026@localhost:3306/db_users}"
echo "Database URL: $DATABASE_URL"

if timeout 5 bash -c "</dev/tcp/localhost/3306" 2>/dev/null; then
  echo -e "${GREEN}✅ MySQL is accessible on port 3306${NC}"
else
  echo -e "${RED}❌ MySQL is NOT accessible on port 3306${NC}"
  echo "   Make sure MySQL is running or update DATABASE_URL in .env"
  exit 1
fi

echo ""

# === Test 3: Start User Service in background ===
echo -e "${YELLOW}[3/5] Starting User Service...${NC}"
cd apps/user-service
npm run start:dev > /tmp/user-service.log 2>&1 &
USER_SERVICE_PID=$!
echo "User Service PID: $USER_SERVICE_PID"
sleep 3

# Check if service started successfully
if kill -0 $USER_SERVICE_PID 2>/dev/null; then
  echo -e "${GREEN}✅ User Service started successfully${NC}"
else
  echo -e "${RED}❌ User Service failed to start${NC}"
  cat /tmp/user-service.log
  exit 1
fi

echo ""

# === Test 4: Start API Gateway in background ===
echo -e "${YELLOW}[4/5] Starting API Gateway...${NC}"
cd ../../apps/tmdt
npm run start:dev > /tmp/api-gateway.log 2>&1 &
GATEWAY_PID=$!
echo "API Gateway PID: $GATEWAY_PID"
sleep 3

if kill -0 $GATEWAY_PID 2>/dev/null; then
  echo -e "${GREEN}✅ API Gateway started successfully${NC}"
else
  echo -e "${RED}❌ API Gateway failed to start${NC}"
  cat /tmp/api-gateway.log
  kill $USER_SERVICE_PID
  exit 1
fi

echo ""

# === Test 5: Test ping endpoint ===
echo -e "${YELLOW}[5/5] Testing Ping Endpoint (RabbitMQ Communication)...${NC}"
sleep 2

MAX_RETRIES=5
RETRY=0

while [ $RETRY -lt $MAX_RETRIES ]; do
  RESPONSE=$(curl -s -X POST http://localhost:3000/api/user/ping \
    -H "Content-Type: application/json" \
    -d '{"test": "message"}' 2>/dev/null)

  if echo "$RESPONSE" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✅ Ping successful! User Service is responding via RabbitMQ${NC}"
    echo "Response: $RESPONSE"
    break
  fi

  RETRY=$((RETRY + 1))
  if [ $RETRY -lt $MAX_RETRIES ]; then
    echo "Retry $RETRY/$MAX_RETRIES..."
    sleep 2
  fi
done

if [ $RETRY -eq $MAX_RETRIES ]; then
  echo -e "${RED}❌ Ping failed after $MAX_RETRIES attempts${NC}"
  echo "API Gateway logs:"
  tail -20 /tmp/api-gateway.log
  echo ""
  echo "User Service logs:"
  tail -20 /tmp/user-service.log
  kill $USER_SERVICE_PID $GATEWAY_PID
  exit 1
fi

echo ""
echo -e "${GREEN}=========================================="
echo "✅ ALL TESTS PASSED!"
echo "==========================================${NC}"
echo ""
echo "📊 Summary:"
echo "   - RabbitMQ: Connected ✓"
echo "   - Database: Connected ✓"
echo "   - User Service: Running ✓"
echo "   - API Gateway: Running ✓"
echo "   - RabbitMQ Communication: Working ✓"
echo ""
echo "🛑 Cleaning up..."
kill $USER_SERVICE_PID $GATEWAY_PID
echo "Done!"

#!/bin/bash

echo "=== Starting NextStep Application Services ==="

# 1. Start Python AI / GLM-5.3 FastAPI Service
cd "/app/NextStep model"
python -m uvicorn main:app --host 0.0.0.0 --port 8000 &
PYTHON_PID=$!
echo "NextStep AI Engine started (PID: $PYTHON_PID)"

# 2. Wait up to 15 seconds for AI Engine readiness
for i in $(seq 1 15); do
  if curl -s http://127.0.0.1:8000/ > /dev/null 2>&1; then
    echo "NextStep AI Engine is healthy and responding."
    break
  fi
  sleep 1
done

# 3. Start Node.js Frontend and Backend Server
cd "/app/NextStep Front+ backened"
echo "Starting NextStep Web Server on port ${PORT:-10000}..."

trap "kill -TERM $PYTHON_PID 2>/dev/null" SIGINT SIGTERM EXIT

node server.js &
NODE_PID=$!

wait -n $NODE_PID $PYTHON_PID

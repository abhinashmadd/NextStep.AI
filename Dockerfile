FROM python:3.11-slim

# Install system utilities, build tools, curl, and Node.js 20
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY "NextStep model/requirements.txt" ./model_requirements.txt
RUN pip install --no-cache-dir -r model_requirements.txt

# Install Node.js requirements
COPY "NextStep Front+ backened/package*.json" ./app_node/
WORKDIR /app/app_node
RUN npm install --omit=dev

WORKDIR /app

# Copy full repository
COPY . .

# Environment configuration
ENV HOST=0.0.0.0
ENV PORT=10000
ENV AI_BASE_URL=http://127.0.0.1:8000/api/ai
ENV PYTHONUNBUFFERED=1

# Ensure entrypoint execution permission
RUN chmod +x /app/start.sh

EXPOSE 10000

CMD ["/app/start.sh"]

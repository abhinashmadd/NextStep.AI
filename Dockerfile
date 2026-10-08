FROM python:3.11-slim

# Install system dependencies & Node.js 20
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy all repository source code
COPY . .

# Install Python AI dependencies
RUN pip install --no-cache-dir -r "NextStep model/requirements.txt"

# Install Node.js dependencies
WORKDIR "/app/NextStep Front+ backened"
RUN npm install --omit=dev

WORKDIR /app

# Environment variables
ENV HOST=0.0.0.0
ENV PORT=10000
ENV AI_BASE_URL=http://127.0.0.1:8000/api/ai
ENV PYTHONUNBUFFERED=1

# Ensure executable permissions on startup script
RUN chmod +x /app/start.sh

EXPOSE 10000

CMD ["/app/start.sh"]

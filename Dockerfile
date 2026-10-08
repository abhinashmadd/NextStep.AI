FROM --platform=linux/amd64 python:3.11-slim

# Install system dependencies, dos2unix & Node.js 20
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    dos2unix \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy repository source code
COPY . .

# Sanitize script line endings & set execution permissions
RUN dos2unix /app/start.sh 2>/dev/null || true
RUN chmod 755 /app/start.sh

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

EXPOSE 10000

CMD ["python", "/app/run_all.py"]

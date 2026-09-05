ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:latest
FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/ash", "-o", "pipefail", "-c"]

# Install Node.js, npm, and build tools for native addons (bufferutil, etc.)
RUN apk add --no-cache \
    nodejs \
    npm \
    python3 \
    make \
    g++

WORKDIR /app

# Install production dependencies and cleanup build tools
COPY package*.json ./
RUN npm install --omit=dev && \
    apk del python3 make g++

# Copy application source code
COPY . .

# Expose web remote port
EXPOSE 8080

CMD ["node", "server.js"]

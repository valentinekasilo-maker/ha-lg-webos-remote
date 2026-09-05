ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:latest
FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/ash", "-o", "pipefail", "-c"]

# Install Node.js and npm
RUN apk add --no-cache \
    nodejs \
    npm

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm install --production

# Copy application source code
COPY . .

# Expose web remote port
EXPOSE 8080

CMD ["node", "server.js"]

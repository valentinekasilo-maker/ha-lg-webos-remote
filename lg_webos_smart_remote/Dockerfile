ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:latest
FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/ash", "-o", "pipefail", "-c"]

# Install Node.js, npm, and build tools
RUN apk add --no-cache \
    nodejs \
    npm \
    python3 \
    make \
    g++

WORKDIR /app

# Copy package descriptors and patch script first
COPY package*.json patch-lgtv.js* ./

# Install production dependencies and cleanup build tools
RUN npm install --omit=dev && \
    node -e "try{require('./patch-lgtv')}catch(e){}" && \
    apk del python3 make g++

# Copy all application source code
COPY . .

# Run patch verification
RUN node -e "try{require('./patch-lgtv')}catch(e){}"

# Expose web remote port
EXPOSE 8080

CMD ["node", "server.js"]

ARG BUILD_FROM=node:20-alpine
FROM ${BUILD_FROM}

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm install --production

# Copy application source code
COPY . .

# Expose web remote port
EXPOSE 8080

CMD ["npm", "start"]

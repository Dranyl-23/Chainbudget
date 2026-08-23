FROM node:20-alpine

WORKDIR /app

# Install dependencies first for fast Docker layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend source code
COPY . .

# Create uploads directory and grant ownership to node user
RUN mkdir -p /app/uploads && chown -R node:node /app

# Environment Defaults
ENV PORT=5001
ENV NODE_ENV=production

EXPOSE 5001

# Run as non-root user for security hardening
USER node

CMD ["npm", "start"]

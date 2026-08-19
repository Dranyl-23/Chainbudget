FROM node:20-alpine

WORKDIR /app

# Install dependencies first for fast Docker layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend source code
COPY . .

# Environment Defaults
ENV PORT=5001
ENV NODE_ENV=production

EXPOSE 5001

CMD ["npm", "start"]

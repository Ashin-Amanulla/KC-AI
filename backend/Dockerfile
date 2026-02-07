FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Create uploads directory with proper permissions
RUN mkdir -p /app/uploads && \
    chmod 755 /app/uploads

EXPOSE 3001

CMD ["node", "server.js"]

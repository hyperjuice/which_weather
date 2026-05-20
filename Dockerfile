FROM node:18-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/server.js ./
COPY index.html ./public/index.html
RUN mkdir -p /data
EXPOSE 3000
CMD ["node", "server.js"]

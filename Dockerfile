FROM node:22-alpine
WORKDIR /app
COPY src ./src
COPY public ./public
COPY package.json ./
ENV PORT=3000
EXPOSE 3000
CMD ["node", "src/server.js"]

FROM node:20-alpine

WORKDIR /app

COPY package.json .
RUN npm install --omit=dev

COPY . .

ENV DATA_DIR=/data
RUN mkdir -p /data

EXPOSE 3000

CMD ["node", "server.js"]

FROM node:24-alpine
WORKDIR /app
COPY server.mjs index.html ./
ENV DB_PATH=/data/renta.db
EXPOSE 3000
CMD ["node", "server.mjs"]

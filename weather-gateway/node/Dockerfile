FROM node:22-alpine
WORKDIR /app
COPY core ./core
COPY providers ./providers
COPY runtime ./runtime
COPY node ./node
ENV HOST=0.0.0.0
ENV PORT=8789
EXPOSE 8789
CMD ["node", "node/server.mjs"]


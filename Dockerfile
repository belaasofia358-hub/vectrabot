FROM node:20-alpine

RUN npm install -g pnpm@10

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./

COPY lib ./lib
COPY artifacts/api-server ./artifacts/api-server

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @workspace/api-server run build

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]

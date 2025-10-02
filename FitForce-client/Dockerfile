FROM node:20-bookworm-slim AS deps

WORKDIR /app

# Use corepack for Yarn if needed
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

COPY . .

# Build the Next.js application
RUN yarn build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Enable standalone output if available; otherwise copy .next and node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/.next ./.next
COPY --from=deps /app/public ./public
COPY --from=deps /app/node_modules ./node_modules

EXPOSE 3000

CMD ["yarn", "start", "-p", "3000"]



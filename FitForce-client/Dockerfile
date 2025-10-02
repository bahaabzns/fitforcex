FROM node:20-bookworm-slim AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# Build the Next.js application
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy runtime assets
COPY --from=deps /app/package*.json ./
COPY --from=deps /app/.next ./.next
COPY --from=deps /app/public ./public
COPY --from=deps /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "start", "--", "-p", "3000"]



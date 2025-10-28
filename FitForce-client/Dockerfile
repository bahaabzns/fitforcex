FROM node:20-bookworm-slim AS deps

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* yarn.lock* ./

# Install dependencies (use npm install to avoid lockfile strictness in CI)
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy built application
COPY --from=deps /app/.next ./.next
COPY --from=deps /app/public ./public
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/package-lock.json* ./package-lock.json*
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/next.config.ts ./next.config.ts

# Create non-root user
RUN groupadd --gid 1001 nodejs
RUN useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home nextjs

# Change ownership of the app directory
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

CMD ["npm", "start"]
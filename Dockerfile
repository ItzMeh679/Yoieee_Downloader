# Multi-stage build for optimized production image

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files for better layer caching
COPY package.json package-lock.json* ./

# Install dependencies with clean install for reproducibility
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Build-time arguments
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG CLERK_SECRET_KEY

# Make them available for Next.js build
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV CLERK_SECRET_KEY=$CLERK_SECRET_KEY
ENV NEXT_TELEMETRY_DISABLED=1

# Copy package files
COPY package*.json ./

# Install all dependencies for build
RUN npm ci

# Copy source code
COPY . .

# Build Next.js application
RUN npm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner

# Install runtime dependencies: yt-dlp, ffmpeg, python
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    yt-dlp \
    tini \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=6969

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /app/uploads && \
    chown -R nextjs:nodejs /app

# Copy package files first
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./

# Copy node_modules from builder
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Switch to non-root user
USER nextjs

EXPOSE 6969

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:6969/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["npm", "start"]



# Production Dockerfile for Railway with ffmpeg + yt-dlp
# Optimized for 10GB+ file downloads with audio merging

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Build-time arguments from Railway
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG CLERK_SECRET_KEY

# Make them available for Next.js build
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV CLERK_SECRET_KEY=$CLERK_SECRET_KEY
ENV NEXT_TELEMETRY_DISABLED=1

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build Next.js app
RUN npm run build

# Stage 3: Production runner with ffmpeg + yt-dlp
FROM node:20-alpine AS runner

# Install system dependencies
# - ffmpeg: For video/audio merging (REQUIRED for audio)
# - python3 & pip: For yt-dlp installation
# - tini: For proper signal handling
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    tini \
    && rm -rf /var/cache/apk/*

# Install latest yt-dlp from pip (most up-to-date)
# --break-system-packages needed for Alpine Python 3.11+
# --upgrade ensures we get latest version with all bug fixes
RUN pip3 install --no-cache-dir --break-system-packages --upgrade yt-dlp

# Verify installations
RUN ffmpeg -version && yt-dlp --version

# CRITICAL: Make Node.js available to yt-dlp for "n challenge" solving
# yt-dlp needs this to execute YouTube's anti-bot JavaScript
ENV NODE_PATH=/usr/local/bin/node
ENV PATH="/usr/local/bin:${PATH}"

WORKDIR /app

# Production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Railway provides PORT dynamically
ENV PORT=3000

# Create directories for uploads and temp files
RUN mkdir -p /app/uploads /app/tmp /app/.next/cache

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    chown -R nextjs:nodejs /app

# Copy production dependencies
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy built Next.js app
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./

# Copy other necessary files
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js ./

# Switch to non-root user
USER nextjs

# Expose port (Railway uses dynamic ports via $PORT)
EXPOSE 3000

# Use tini for proper signal handling (graceful shutdown)
ENTRYPOINT ["/sbin/tini", "--"]

# Health check for Railway - checks /api/health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start Next.js production server
CMD ["npm", "start"]



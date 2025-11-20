FROM node:20-alpine

# Install yt-dlp + ffmpeg + python
RUN apk add --no-cache python3 py3-pip ffmpeg yt-dlp

WORKDIR /app

# Build-time arguments for Railway / Docker
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG CLERK_SECRET_KEY

# Make them available as environment variables for Next.js build and runtime
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV CLERK_SECRET_KEY=$CLERK_SECRET_KEY

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy full project
COPY . .

# Set default port for Next.js (can be overridden by host $PORT)
ENV PORT=6969

# Build Next.js
RUN npm run build

EXPOSE 6969

CMD ["npm", "start"]



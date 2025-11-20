FROM node:20-alpine

# Install yt-dlp + ffmpeg + python
RUN apk add --no-cache python3 py3-pip ffmpeg yt-dlp

WORKDIR /app

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



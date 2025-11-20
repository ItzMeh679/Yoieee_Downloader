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

# Build Next.js
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]



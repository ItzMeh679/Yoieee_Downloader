FROM node:18-alpine

# Install dependencies for yt-dlp
RUN apk add --no-cache python3 py3-pip ffmpeg

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy all files
COPY . .

# Build Next.js
RUN npm run build

# Install yt-dlp
RUN pip3 install yt-dlp

EXPOSE 3000

CMD ["npm", "start"]


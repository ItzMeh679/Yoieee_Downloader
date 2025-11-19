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

ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Y2FyZWZ1bC1nb3BoZXItMTAuY2xlcmsuYWNjb3VudHMuZGV2JA
ENV CLERK_SECRET_KEY=sk_test_Txr6tJ9FMc53E4vGl86nUZdeEdOFtE6JozYCHRIjZm

# Your personal account restriction
ENV ALLOWED_CLERK_USER_ID=user_35i0eWJkGR9GmOz8AWe6Km1lTjt

# Uploaded cookies directory
ENV COOKIES_UPLOAD_DIR=./uploads

# Temporary download directory
ENV DOWNLOADS_DIR=./downloads

# Build Next.js
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]



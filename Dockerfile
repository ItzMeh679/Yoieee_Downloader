FROM node:20-alpine

# Install dependencies for yt-dlp
RUN apk add --no-cache python3 py3-pip ffmpeg

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy all files
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

# Install yt-dlp
RUN pip3 install yt-dlp

EXPOSE 3000

CMD ["npm", "start"]


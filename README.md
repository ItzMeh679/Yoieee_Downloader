This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# YT Downloader (Clerk-protected)

## Prereqs (server)
- Node 18+
- yt-dlp installed and in PATH (https://github.com/yt-dlp/yt-dlp)
- ffmpeg installed
- A VPS or container — serverless platforms with strict timeouts may fail for large downloads.

## Setup
1. `git clone ...` and `cd yt-downloader`.
2. `npm install`
3. Create `.env.local` (see `.env.local` example).
   - Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` with your Clerk keys.
   - Set `ALLOWED_CLERK_USER_ID` to your Clerk user id (Yoieee).
4. Start dev: `npm run dev`
5. Open `http://localhost:3000`, sign up and sign in (Clerk). When your user is created, copy your user id from Clerk dashboard and set `ALLOWED_CLERK_USER_ID` if you didn't earlier.
6. Upload `cookies.txt` via the UI (optional but required to access private/unlisted/owner-only streams).
7. Paste your YouTube link → Fetch Qualities → Select format → Download.

## Deploy
- Use a VPS / Docker; ensure `yt-dlp` & `ffmpeg` are installed in the image/container.
- Keep `.env.local` secrets safe.


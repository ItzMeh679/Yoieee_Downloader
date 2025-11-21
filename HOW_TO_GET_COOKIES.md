# 🍪 How to Get YouTube Cookies (Fix Bot Detection)

## Why Do I Need Cookies?

YouTube has become **VERY aggressive** with bot detection in 2024-2025. Even with all bypass methods, some videos will require authentication cookies to download.

**You need cookies if you see:**
- ❌ "Sign in to confirm you're not a bot"
- ❌ "This video is age-restricted"
- ❌ Downloads return 0 KB files

---

## ✅ EASIEST METHOD: Browser Extension (2 minutes)

### Step 1: Install Extension

**For Chrome/Edge/Brave:**
1. Go to: https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc
2. Click "Add to Chrome/Edge"

**For Firefox:**
1. Go to: https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/
2. Click "Add to Firefox"

### Step 2: Go to YouTube
1. Open YouTube.com in your browser
2. **Make sure you're logged in** to your YouTube/Google account
3. Play any video (this ensures cookies are fresh)

### Step 3: Export Cookies
1. Click the extension icon (cookie icon in toolbar)
2. Click "Export" or "Export as cookies.txt"
3. Save the file as `cookies.txt`

### Step 4: Upload to App
1. Go to your YouTube downloader app
2. Look for "Upload Cookies" section
3. Click "Choose File" and select your `cookies.txt`
4. Click "Upload"
5. ✅ Done! Now try downloading again

---

## 🔐 MANUAL METHOD: Chrome DevTools (5 minutes)

### Step 1: Get Cookie Values
1. Open YouTube.com and **log in**
2. Press `F12` to open DevTools
3. Go to **Application** tab (or **Storage** in Firefox)
4. In left sidebar: **Cookies** → `https://www.youtube.com`
5. Find these cookies and copy their values:
   - `__Secure-1PSID`
   - `__Secure-1PAPISID`
   - `__Secure-3PSID`
   - `__Secure-3PAPISID`

### Step 2: Create cookies.txt File
Create a file named `cookies.txt` with this format:

```
# Netscape HTTP Cookie File
.youtube.com	TRUE	/	TRUE	0	__Secure-1PSID	YOUR_VALUE_HERE
.youtube.com	TRUE	/	TRUE	0	__Secure-1PAPISID	YOUR_VALUE_HERE
.youtube.com	TRUE	/	TRUE	0	__Secure-3PSID	YOUR_VALUE_HERE
.youtube.com	TRUE	/	TRUE	0	__Secure-3PAPISID	YOUR_VALUE_HERE
```

Replace `YOUR_VALUE_HERE` with actual cookie values.

### Step 3: Upload
1. Upload `cookies.txt` to the app
2. Try downloading again

---

## ⚠️ IMPORTANT SECURITY NOTES

### DO:
- ✅ Use cookies from your own personal account
- ✅ Keep cookies.txt private (don't share)
- ✅ Re-export cookies if they stop working (they expire)

### DON'T:
- ❌ Share your cookies.txt file with anyone
- ❌ Use cookies from unknown sources
- ❌ Upload to public servers you don't trust

**Your cookies = Your account access. Treat them like passwords!**

---

## 🔄 How Often to Update?

- **Google cookies expire:** Usually every 1-2 weeks
- **When to re-export:**
  - If downloads start failing again with bot detection
  - If you log out of YouTube
  - If you change Google password

---

## 🎯 Does This Work for Private Videos?

**YES!** Cookies also let you download:
- ✅ Age-restricted videos
- ✅ Unlisted videos (if you have the link)
- ✅ Videos from channels you're subscribed to
- ✅ Private videos you have access to

---

## ❓ Troubleshooting

### "Cookies didn't help, still getting bot error"
1. Make sure you **logged into YouTube** before exporting
2. Try playing a video on YouTube first (activates cookies)
3. Re-export fresh cookies (old ones may have expired)
4. Make sure cookies.txt is in correct Netscape format

### "Can't find the extension"
Search for: **"Get cookies.txt LOCALLY"** in Chrome Web Store
- Must be the "LOCALLY" version (exports to file, not cloud)

### "Still not working"
- Try a different browser (Chrome works best)
- Clear YouTube cookies and log in again, then re-export
- Make sure you're exporting from youtube.com, not a different domain

---

## 🚀 Alternative: yt-dlp Cookie Export (Advanced)

If you have Python/yt-dlp installed locally:

```bash
yt-dlp --cookies-from-browser chrome --print-to-file cookies:cookies.txt "https://youtube.com"
```

This automatically extracts cookies from your Chrome browser.

---

## ✅ SUMMARY

1. Install "Get cookies.txt LOCALLY" extension
2. Go to YouTube (logged in)
3. Click extension → Export
4. Upload cookies.txt to app
5. Download works! 🎉

**This bypasses ALL bot detection because you're using real authenticated session cookies!**

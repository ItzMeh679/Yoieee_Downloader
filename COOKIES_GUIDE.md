# 🍪 Cookie Authentication Guide

## Why Do I Need Cookies?

YouTube has implemented **bot detection** that blocks automated downloads. To bypass this, you need to authenticate using cookies from your browser.

## Quick Setup (5 minutes)

### Method 1: Browser Extension (Easiest)

1. **Install Extension**
   - Chrome/Edge: [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
   - Firefox: [cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)

2. **Export Cookies**
   - Go to [YouTube.com](https://youtube.com)
   - Make sure you're **logged in**
   - Click the extension icon
   - Click "Export" or "Download"
   - Save as `cookies.txt`

3. **Upload to App**
   - Go to your YT Downloader
   - Section "01. Cookie Authentication"
   - Click "Choose File" and select `cookies.txt`
   - Click "Upload cookies.txt →"

### Method 2: Manual Export (Advanced)

#### Chrome/Edge
```bash
# Using yt-dlp directly
yt-dlp --cookies-from-browser chrome --cookies cookies.txt https://youtube.com
```

#### Firefox
```bash
yt-dlp --cookies-from-browser firefox --cookies cookies.txt https://youtube.com
```

## Troubleshooting

### "Still getting bot detection error"
- Make sure you're **logged into YouTube** in your browser
- Try exporting cookies again
- Clear your browser cache and re-login to YouTube
- Use a different browser

### "Cookies expired"
- YouTube cookies expire after ~6 months
- Simply export and upload new cookies
- Consider setting a reminder to refresh cookies quarterly

### "Private/Age-restricted videos not working"
- Make sure your YouTube account has access to the video
- Verify you're logged in when exporting cookies
- Some videos may have additional restrictions

## Security Notes

⚠️ **Important**: Your cookies file contains authentication tokens. 

**Best Practices:**
- ✅ Only upload to trusted services
- ✅ Delete cookies.txt from your computer after uploading
- ✅ Re-export fresh cookies periodically
- ❌ Don't share your cookies.txt file
- ❌ Don't commit cookies to Git repositories

## How It Works

1. When you browse YouTube logged in, your browser stores authentication cookies
2. These cookies prove to YouTube that you're a real user
3. yt-dlp uses these cookies to make authenticated requests
4. YouTube allows the download because it sees valid authentication

## Cookie Lifespan

- **Typical Duration**: 6-12 months
- **Recommended Refresh**: Every 3 months
- **Signs of Expiration**: 
  - "Sign in to confirm you're not a bot" errors
  - Authentication failures
  - Access denied messages

## Alternative: YouTube Premium

If you have **YouTube Premium**, you can:
1. Use cookies from your Premium account
2. Download videos without ads
3. Access Premium-only content
4. Higher quality streams may be available

## FAQ

**Q: Will this work for private videos?**
A: Yes, if your YouTube account has access to the video.

**Q: Can I use someone else's cookies?**
A: Technically yes, but it's not recommended for security reasons.

**Q: Do I need to upload cookies every time?**
A: No, once uploaded, they're stored on the server until they expire.

**Q: Is this legal?**
A: Using your own cookies for personal downloads is generally acceptable. Always respect copyright and YouTube's Terms of Service.

**Q: What if I don't want to upload cookies?**
A: Some public videos may work without cookies, but YouTube's bot detection makes this increasingly rare. Cookies are now essentially required.

## Support

If you're still having issues:
1. Check the [yt-dlp FAQ](https://github.com/yt-dlp/yt-dlp/wiki/FAQ)
2. Verify your YouTube account is active
3. Try a different browser for cookie export
4. Contact support with error messages

---

**Last Updated**: November 2025  
**Reason**: YouTube increased bot detection measures

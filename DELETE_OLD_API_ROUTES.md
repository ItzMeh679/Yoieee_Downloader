# Delete These Folders

The following folders contain OLD Next.js API routes that are NO LONGER USED.

We now use Express backend (`server.js`) instead.

Please delete manually:
- `src/app/api/download/`
- `src/app/api/getFormats/`
- `src/app/api/health/`
- `src/app/api/uploadCookies/`

Or run:
```bash
Remove-Item -Recurse -Force src\app\api
```

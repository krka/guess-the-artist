# Deployment Guide

## GitHub Pages (Recommended)

GitHub Pages is perfect for this app - it's free, fast, and requires zero configuration.

### Setup Steps

1. **Push your code to GitHub**:
   ```bash
   git remote add origin git@github.com:krka/guess-the-artist.git
   git push -u origin master
   ```

2. **Enable GitHub Pages**:
   - Go to your repo's Settings
   - Scroll to "Pages" section
   - Under "Source", select branch `master` and folder `/ (root)`
   - Click Save
   - Your site will be live at: `https://krka.github.io/guess-the-artist/`

3. **Verify Spotify App Settings**:
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Open your app settings
   - Confirm redirect URI is added: `https://krka.github.io/guess-the-artist/`
   - (You should have already added this during setup!)

4. **Test the deployment**:
   - Wait a few minutes for GitHub Pages to build
   - Visit: `https://krka.github.io/guess-the-artist/`
   - Click "Login with Spotify"
   - Should work immediately!

**Note**: The config automatically uses `window.location.origin` which adapts to any domain:
- `http://localhost:8000` (local development)
- `https://krka.github.io/guess-the-artist/` (production)

No code changes needed when switching between environments!

## Other Hosting Options

### Netlify

1. Drag and drop your project folder to [Netlify Drop](https://app.netlify.com/drop)
2. Get instant URL: `https://random-name.netlify.app`
3. Add that URL to Spotify redirect URIs

### Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in your project folder
3. Follow prompts
4. Add the provided URL to Spotify redirect URIs

### Your Own Server

Just upload the files to any web server that serves static HTML. The app is entirely client-side, so no special server configuration needed.

## Local Development

For testing locally, you **must** use a web server:

**Python** (easiest):
```bash
python -m http.server 8000
```

**Node.js**:
```bash
npx http-server -p 8000
```

**PHP**:
```bash
php -S localhost:8000
```

Then add `http://localhost:8000` to your Spotify app's redirect URIs.

## Multiple Environments

You can have both local and production redirect URIs configured simultaneously:

**Spotify Dashboard → Redirect URIs**:
```
http://localhost:8000
http://127.0.0.1:8000
https://krka.github.io/guess-the-artist/
```

The app automatically uses `window.location.origin`, so it works in all environments without code changes!

## Custom Domain (Optional)

If you want to use your own domain with GitHub Pages:

1. In your repo, add a file called `CNAME` with your domain
2. Configure DNS to point to GitHub Pages
3. Add your custom domain to Spotify redirect URIs

See [GitHub Pages custom domain docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)

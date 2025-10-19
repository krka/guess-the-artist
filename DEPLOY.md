# Deployment Guide

## GitHub Pages (Recommended)

GitHub Pages is perfect for this app - it's free, fast, and requires zero configuration.

### Setup Steps

1. **Push your code to GitHub**:
   ```bash
   # Create a new repo on GitHub first, then:
   git remote add origin https://github.com/YOUR_USERNAME/sista_minuten.git
   git push -u origin master
   ```

2. **Enable GitHub Pages**:
   - Go to your repo's Settings
   - Scroll to "Pages" section
   - Under "Source", select branch `master` and folder `/ (root)`
   - Click Save
   - Your site will be live at: `https://YOUR_USERNAME.github.io/sista_minuten/`

3. **Update Spotify App Settings**:
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Open your app settings
   - Add redirect URI: `https://YOUR_USERNAME.github.io/sista_minuten/`
   - Click "Save"

4. **Update config.js** (Optional):

   The current config uses `window.location.origin` which automatically adapts to any domain. This means it works on:
   - `http://localhost:8000` (local development)
   - `https://yourusername.github.io/sista_minuten` (production)
   - Any custom domain you configure

   **No code changes needed!** Just make sure both URLs are added to your Spotify app's redirect URIs.

### Testing the Deployment

1. Wait a few minutes for GitHub Pages to build
2. Visit your URL: `https://YOUR_USERNAME.github.io/sista_minuten/`
3. Click "Login with Spotify"
4. Should work immediately!

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
https://yourusername.github.io/sista_minuten/
```

The app automatically uses `window.location.origin`, so it works in all environments without code changes!

## Custom Domain (Optional)

If you want to use your own domain with GitHub Pages:

1. In your repo, add a file called `CNAME` with your domain
2. Configure DNS to point to GitHub Pages
3. Add your custom domain to Spotify redirect URIs

See [GitHub Pages custom domain docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)

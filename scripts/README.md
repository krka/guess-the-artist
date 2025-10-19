# Build Scripts

## Update Magic Playlists

The `update-playlists.html` tool helps you find and update official Spotify playlist IDs.

### Why do we need this?

Spotify's official playlist IDs (like "Top 50 Global") can change over time or may not be publicly accessible. This tool lets you:

1. Search for playlists on Spotify
2. Verify they're accessible
3. Generate config to add them as magic sources

### How to use:

1. Start the local server:
   ```bash
   make run-local
   ```

2. Visit: `https://127.0.0.1:8443/scripts/update-playlists.html`

3. Login with Spotify

4. Search for playlists (e.g., "Top 50 Global", "Top Songs USA")

5. Click on playlists to add them

6. Copy the generated JSON config

7. Create `src/js/magic-playlists.json` with the config

8. Update the code to load from this file

### Adding new magic sources:

To add playlist-based magic sources in the future:

1. Use this tool to find the playlist
2. Add it to `magic-playlists.json`
3. Add corresponding handling in `game.js`

### Note:

Currently, magic sources are hardcoded in `game-setup.js`. To use this tool's output, you'd need to:
- Create a JSON file to store playlist configs
- Update the code to load and merge with hardcoded sources
- This is left as a future enhancement for now

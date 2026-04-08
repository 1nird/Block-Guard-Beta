# Block Guard (Beta)

This repo contains:

- **Chrome extension**: the files in the repo root (with `manifest.json`)
- **Website waitlist**: `website/` (static landing page)

## Install the extension (from ZIP)

1. Download the repo as a ZIP (from GitHub) and unzip it.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder (the one containing `manifest.json`).

## Website (waitlist)

Open `website/index.html` in a local web server, or host the `website/` folder (GitHub Pages, etc.).

### Collect real waitlist signups (optional)

By default, the waitlist form **saves emails locally** in the browser so it works “download → unzip → open”.

To collect real signups, set your endpoint in `website/config.js`:

- `window.BLOCK_GUARD_WAITLIST_ENDPOINT = "https://..."`;


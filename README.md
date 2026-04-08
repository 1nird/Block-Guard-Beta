# Block Guard (Beta)

A Chrome extension designed to help you stay focused by blocking distracting websites and content while you work.

> **Status**: This is the **testing and development** repository for Block Guard. Here we test new features, configurations, and improvements before releasing them to production.

## 📋 What's Inside

This repository contains:

- **Chrome Extension**: The main distraction blocker extension files (root directory with `manifest.json`)
- **Website/Waitlist**: A landing page and waitlist signup form (`website/` directory)

## 🛠️ Tech Stack

- **HTML**: 50.2% - Structure and markup
- **JavaScript**: 49.7% - Core extension logic and interactivity
- **CSS**: 0.1% - Minimal styling

## 🚀 Quick Start

### Install the Extension

1. Download this repository as a ZIP from GitHub
2. Unzip the downloaded file
3. Open Chrome and navigate to `chrome://extensions`
4. Enable **Developer mode** (toggle in the top right)
5. Click **Load unpacked**
6. Select the unzipped folder (the one containing `manifest.json`)

The extension should now appear in your Chrome toolbar.

### Run the Website

1. Navigate to the `website/` folder
2. Open `index.html` in a local web server, or host it on GitHub Pages
3. The waitlist form will collect email signups (see configuration below)

## ⚙️ Configuration

### Waitlist Email Collection

By default, the waitlist form saves emails **locally in the browser**. This works out of the box without any backend setup.

To send signups to a backend server instead:

1. Open `website/config.js`
2. Set your endpoint:
   ```javascript
   window.BLOCK_GUARD_WAITLIST_ENDPOINT = "https://your-backend-url.com/signup";
   ```

## 📝 Features

- Block specified websites and categories
- Set custom time blocks for focused work sessions
- Whitelist exceptions for trusted sites
- Simple, lightweight Chrome extension

## 🧪 Testing & Development

This is a **beta testing repository**. We use this space to:

- Test new features and improvements
- Validate configurations
- Gather feedback before stable releases

To report issues or suggest improvements, feel free to open an issue in this repository.

## 📦 Project Structure

```
Block-Guard-Beta/
├── manifest.json           # Chrome extension manifest
├── popup.html             # Extension popup interface
├── popup.js               # Popup logic
├── background.js          # Background service worker
├── content.js             # Content script
├── styles/                # CSS styles
├── icons/                 # Extension icons
└── website/               # Landing page & waitlist
    ├── index.html
    ├── config.js
    └── styles.css
```

## 📄 License

[Add your license here]

---

**Made with ❤️ by the Block Guard team**
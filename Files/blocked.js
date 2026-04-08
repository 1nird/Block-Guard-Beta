// blocked.js — runs inside blocked.html
(function () {
  // ── Show the URL that was blocked ──
  const params = new URLSearchParams(window.location.search);
  const site = params.get("site") || "";
  const isWhitelist = params.get("whitelist") === "1";

  const displaySite = site.trim() || "this site";
  document.getElementById("blocked-site-url").textContent = displaySite;

  if (isWhitelist) {
    const h1 = document.querySelector("h1");
    const desc = document.querySelector("p");
    if (h1) h1.textContent = "Site not allowed";
    if (desc) desc.textContent = "This site isn't in your whitelist.";
  }

  // ── Site category detection ──
  function getCategory(domain) {
    const d = domain.toLowerCase();
    if (/facebook|instagram|twitter|tiktok|snapchat|reddit|linkedin|x\.com|threads/.test(d)) return 'Social Media';
    if (/youtube|netflix|hulu|twitch|disney|vimeo|peacock|primevideo/.test(d)) return 'Video Streaming';
    if (/nytimes|bbc|cnn|medium|substack|theguardian|washingtonpost|news/.test(d)) return 'News & Blogs';
    if (/amazon|ebay|etsy|aliexpress|walmart|target|shopify|shop/.test(d)) return 'Shopping';
    if (/steam|epicgames|roblox|minecraft|gaming/.test(d)) return 'Gaming';
    return 'Other';
  }

  // ── Increment blockedAttempts & log interception ──
  chrome.storage.local.get(["blockedAttempts", "interceptionLog"], (r) => {
    const next = (r.blockedAttempts || 0) + 1;
    const log = r.interceptionLog || [];
    if (site) {
      log.unshift({ site, category: getCategory(site), timestamp: Date.now() });
      if (log.length > 200) log.length = 200; // cap log size
    }
    chrome.storage.local.set({ blockedAttempts: next, interceptionLog: log }, () => {
      const el = document.getElementById("blocked-count");
      if (el) el.textContent = next;
    });
  });

  // ── "Stay focused" button ──
  // Replaces the blocked-page content in-place so pressing "back"
  // on the next visit won't re-navigate to blocked.html.
  document.getElementById("close-tab-btn").addEventListener("click", () => {
    const body = document.body;
    body.style.transition = "opacity 0.3s";
    body.style.opacity = "0";
    setTimeout(() => {
      document.querySelector("h1").textContent = "Stay focused!";
      document.querySelector("p").textContent =
        "Return to what you were doing.";
      document.getElementById("blocked-site-url").textContent = "";
      document.querySelector(".blocked-stats").style.display = "none";
      document.getElementById("close-tab-btn").textContent = "Continue";
      body.style.opacity = "1";
    }, 300);
  });

  // ── Listen for further blockedAttempts updates from other tabs ──
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.blockedAttempts) return;
    const el = document.getElementById("blocked-count");
    if (el) el.textContent = changes.blockedAttempts.newValue;
  });
})();
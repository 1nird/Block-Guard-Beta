const PRESETS = [15, 30, 60, 90];

document.addEventListener("DOMContentLoaded", () => {
  // ── DOM refs ──
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  const flowBtn = document.getElementById("flow-btn");
  const slider = document.getElementById("duration-slider");
  const durationValue = document.getElementById("duration-value");
  const presetBtns = document.querySelectorAll(".preset-btn");
  const customMins = document.getElementById("custom-mins");
  const statsText = document.getElementById("stats-text");
  const dashTime = document.getElementById("dash-time");
  const dashSessions = document.getElementById("dash-sessions");
  const dashBlocked = document.getElementById("dash-blocked");
  const dashAttempts = document.getElementById("dash-attempts");
  const settingsBtn = document.getElementById("settings-btn");
  const blockedInput = document.getElementById("blocked-add-input");
  const blockedAddBtn = document.getElementById("blocked-add-btn");
  const blockedListBody = document.getElementById("blocked-list-body");

  let countdownInterval = null;

  // ── Settings ──
  settingsBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  });

  // ── Countdown / Timer ──
  function showCountdownUI() {
    hideCountdownUI();
    const flowSection = document.querySelector(".flow-section");
    const container = document.createElement("div");
    container.id = "countdown-container";
    container.style.cssText =
      "display:flex; align-items:center; justify-content:center; padding:8px 0;";
    container.innerHTML =
      '<span class="material-symbols-outlined" style="font-size:14px; color:var(--sage);">hourglass_top</span><span id="countdown-text" style="font-size:12px; font-weight:600; color:var(--sage);"></span>';
    flowSection.insertBefore(container, flowSection.firstChild);
  }

  function hideCountdownUI() {
    const el = document.getElementById("countdown-container");
    if (el) el.remove();
  }

  function startCountdown(durationMinutes) {
    function tick() {
      chrome.storage.local.get(["focusStart"], (data) => {
        if (!data.focusStart) { stopCountdown(); return; }
        const elapsed = Date.now() - data.focusStart;
        const remaining = durationMinutes * 60000 - elapsed;
        if (remaining <= 0) {
          const ct = document.getElementById("countdown-text");
          if (ct) ct.textContent = "0m 0s remaining";
          endFlow();
          return;
        }
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        const ct = document.getElementById("countdown-text");
        if (ct) ct.textContent = `${mins}m ${secs}s remaining`;
      });
    }
    tick();
    countdownInterval = setInterval(tick, 1000);
  }

  function stopCountdown() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  }

  function startUnlimitedTimer() {
    function tick() {
      chrome.storage.local.get(["focusStart"], (data) => {
        if (!data.focusStart) { stopCountdown(); return; }
        const elapsed = Date.now() - data.focusStart;
        const mins = Math.floor(elapsed / 60000);
        const secs = Math.floor((elapsed % 60000) / 1000);
        const ct = document.getElementById("countdown-text");
        if (ct) ct.textContent = `${mins}m ${secs}s in flow`;
      });
    }
    tick();
    countdownInterval = setInterval(tick, 1000);
  }

  // ── Stats display ──
  function updateStatsDisplay(focusMins, sessions, siteCount, attempts) {
    const h = Math.floor(focusMins / 60);
    const m = focusMins % 60;
    statsText.textContent = h > 0 ? `${h}h ${m}m total focus time` : `${m}m total focus time`;
    dashTime.textContent = focusMins > 0 ? `${focusMins}min` : "0min";
    dashSessions.textContent = sessions;
    dashBlocked.textContent = siteCount;
    dashAttempts.textContent = attempts;
  }

  function refreshStats() {
    chrome.storage.local.get(
      ["focusMinutes", "sessions", "blockedSites", "blockedAttempts"],
      (r) => {
        updateStatsDisplay(
          Math.floor(r.focusMinutes || 0),
          r.sessions || 0,
          (r.blockedSites || []).length,
          r.blockedAttempts || 0
        );
      }
    );
  }

  // ── Listen for live storage changes (blockedAttempts updates from service worker) ──
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    // Update dashboard attempts counter in real-time
    if (changes.blockedAttempts) {
      dashAttempts.textContent = changes.blockedAttempts.newValue || 0;
    }
  });

  // ── Init ──
  function init() {
    chrome.storage.local.get(
      ["blockedSites", "focusMinutes", "sessions", "active", "savedDuration",
       "blockedAttempts", "focusStart", "focusDuration"],
      (result) => {
        const isActive = result.active || false;
        const focusMins = Math.floor(result.focusMinutes || 0);
        const sessions = result.sessions || 0;
        const sites = result.blockedSites || [];
        const attempts = result.blockedAttempts || 0;

        if (isActive) {
          flowBtn.querySelector("span").textContent = "Exit Flow";
          statusText.textContent = "Flow active.";
          flowBtn.style.background = "linear-gradient(135deg, #9c4141, #c0524e)";
          flowBtn.style.boxShadow = "0 4px 16px rgba(156, 65, 65, 0.25)";
          statusDot.classList.add("active");

          const duration = result.focusDuration || 0;
          showCountdownUI();
          if (duration > 0) startCountdown(duration);
          else startUnlimitedTimer();
        }

        updateStatsDisplay(focusMins, sessions, sites.length, attempts);

        const savedDur = result.savedDuration ?? 60;
        if (savedDur === 0) {
          durationValue.textContent = "∞";
          slider.value = slider.min;
        } else {
          slider.value = Math.min(savedDur, 120);
          durationValue.textContent = savedDur + "m";
        }
        highlightPreset(savedDur);
        if (!PRESETS.includes(savedDur)) customMins.value = savedDur === 0 ? '0' : savedDur;
        renderBlockedSites(sites);
      }
    );
  }

  // ── Navigation ──
  const navBtns = document.querySelectorAll(".nav-btn");
  const pages = document.querySelectorAll(".page");
  navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.page;
      navBtns.forEach((b) => b.classList.remove("nav-active"));
      btn.classList.add("nav-active");
      pages.forEach((p) => p.classList.remove("active"));
      document.getElementById(`page-${target}`).classList.add("active");
    });
  });

  // ── Duration controls ──
  slider.addEventListener("input", () => {
    const val = parseInt(slider.value);
    durationValue.textContent = val + "m";
    highlightPreset(val);
    customMins.value = "";
    chrome.storage.local.set({ savedDuration: val });
  });

  presetBtns.forEach((btn) => {
    btn.addEventListener("click", () => animateSliderTo(parseInt(btn.dataset.mins)));
  });

  customMins.addEventListener("change", () => {
    let val = parseInt(customMins.value);
    if (isNaN(val) || val < 0) val = 0;
    if (val > 480) val = 480;
    customMins.value = val;
    if (val === 0) {
      durationValue.textContent = "∞";
      slider.value = slider.min;
      highlightPreset(-1);
      chrome.storage.local.set({ savedDuration: 0 });
    } else {
      slider.value = Math.min(val, 120);
      durationValue.textContent = val + "m";
      highlightPreset(val);
      chrome.storage.local.set({ savedDuration: val });
    }
  });

  function animateSliderTo(target) {
    const start = parseInt(slider.value);
    const duration = Math.abs(target - start) * 5;
    const t0 = performance.now();
    function step(time) {
      const p = Math.min((time - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      slider.value = Math.round(start + (target - start) * eased);
      durationValue.textContent = slider.value + "m";
      highlightPreset(parseInt(slider.value));
      if (p < 1) requestAnimationFrame(step);
      else {
        slider.value = target;
        durationValue.textContent = target + "m";
        highlightPreset(target);
        customMins.value = "";
        chrome.storage.local.set({ savedDuration: target });
      }
    }
    requestAnimationFrame(step);
  }

  function highlightPreset(mins) {
    presetBtns.forEach((b) => {
      b.classList.toggle("active", parseInt(b.dataset.mins) === mins);
    });
  }

  // ── Flow button ──
  flowBtn.addEventListener("click", () => {
    hideCountdownUI();
    stopCountdown();
    if (flowBtn.querySelector("span").textContent === "Exit Flow") endFlow();
    else startFlow();
  });

  function startFlow() {
    chrome.storage.local.get(["focusMinutes", "sessions", "savedDuration"], (data) => {
      const duration = data.savedDuration ?? 60;
      chrome.storage.local.set(
        { active: true, focusStart: Date.now(), focusDuration: duration,
          focusMinutes: data.focusMinutes || 0, sessions: (data.sessions || 0) + 1 },
        () => {
          flowBtn.querySelector("span").textContent = "Exit Flow";
          statusText.textContent = duration === 0 ? "Blocking forever." : "Flow active.";
          flowBtn.style.background = "linear-gradient(135deg, #9c4141, #c0524e)";
          flowBtn.style.boxShadow = "0 4px 16px rgba(156, 65, 65, 0.25)";
          statusDot.classList.add("active");
          dashSessions.textContent = (data.sessions || 0) + 1;
          showCountdownUI();
          if (duration > 0) startCountdown(duration);
          else startUnlimitedTimer();
          chrome.storage.local.get(["blockedSites", "allowListMode"], (r) => {
            applyRules(r.blockedSites || [], r.allowListMode || false);
          });
        }
      );
    });
  }

  function endFlow() {
    hideCountdownUI();
    stopCountdown();
    chrome.storage.local.get(["focusMinutes", "focusStart"], (data) => {
      const elapsed = Math.max(0, (Date.now() - (data.focusStart || Date.now())) / 60000);
      const total = (data.focusMinutes || 0) + elapsed;
      chrome.storage.local.set(
        { active: false, focusMinutes: total, focusStart: null, focusDuration: null },
        () => {
          flowBtn.querySelector("span").textContent = "Enter Flow";
          statusText.textContent = "Ready to focus.";
          flowBtn.style.background = "";
          flowBtn.style.boxShadow = "";
          statusDot.classList.remove("active");
          refreshStats();
          removeRules();
        }
      );
    });
  }

  // ── Site management ──
  function addSite(inputEl) {
    let domain = inputEl.value.trim().toLowerCase();
    if (!domain) return;
    domain = domain.replace(/^https?:\/\//, "").replace(/\/.*/, "").replace("www.", "");
    chrome.storage.local.get(["blockedSites", "siteTimestamps"], (result) => {
      const sites = result.blockedSites || [];
      const timestamps = result.siteTimestamps || {};
      if (sites.includes(domain)) {
        inputEl.value = "";
        inputEl.placeholder = "Already added";
        setTimeout(() => { inputEl.placeholder = "Add a site to block..."; }, 1500);
        return;
      }
      sites.push(domain);
      timestamps[domain] = Date.now();
      chrome.storage.local.set({ blockedSites: sites, siteTimestamps: timestamps }, () => {
        inputEl.value = "";
        inputEl.placeholder = `Added: ${domain}`;
        setTimeout(() => { inputEl.placeholder = "Add a site to block..."; }, 1500);
        renderBlockedSites(sites);
        dashBlocked.textContent = sites.length;
        chrome.storage.local.get(["active", "allowListMode"], (r) => { if (r.active) applyRules(sites, r.allowListMode || false); });
      });
    });
  }

  blockedAddBtn.addEventListener("click", () => addSite(blockedInput));
  blockedInput.addEventListener("keypress", (e) => { if (e.key === "Enter") addSite(blockedInput); });

  function renderBlockedSites(sites) {
    blockedListBody.innerHTML = "";
    if (sites.length === 0) {
      blockedListBody.innerHTML =
        '<div class="empty-state">' +
        '<span class="material-symbols-outlined">playlist_remove</span>' +
        "<span>No sites added yet</span></div>";
      return;
    }
    sites.forEach((domain) => {
      const item = document.createElement("div");
      item.className = "blocked-site-item";
      const fav = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
      item.innerHTML =
        '<div class="site-info">' +
        `<img class="site-favicon" src="${fav}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />` +
        '<div class="site-favicon-fallback" style="display:none;"><span>' + domain.charAt(0) + "</span></div>" +
        `<span class="site-domain">${domain}</span></div>` +
        '<button class="site-remove-btn" data-domain="' + domain + '">' +
        '<span class="material-symbols-outlined">close</span></button>';
      blockedListBody.appendChild(item);
    });
    document.querySelectorAll(".site-remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const itemEl = btn.closest(".blocked-site-item");
        itemEl.style.transition = "all 0.25s ease";
        itemEl.style.opacity = "0";
        itemEl.style.transform = "translateX(20px)";
        setTimeout(() => removeSite(btn.dataset.domain), 250);
      });
    });
  }

  function removeSite(domain) {
    chrome.storage.local.get(["blockedSites", "siteTimestamps"], (result) => {
      const sites = (result.blockedSites || []).filter((s) => s !== domain);
      const timestamps = result.siteTimestamps || {};
      delete timestamps[domain];
      chrome.storage.local.set({ blockedSites: sites, siteTimestamps: timestamps }, () => {
        renderBlockedSites(sites);
        dashBlocked.textContent = sites.length;
        chrome.storage.local.get(["active", "allowListMode"], (r) => { if (r.active) applyRules(sites, r.allowListMode || false); });
      });
    });
  }

  // ── DNR blocking rules ──
  // Uses regexFilter: ^https?://([a-z0-9-]+\.)*domain(/|\?)
  // Matches subdomains and paths but NOT different TLDs.
  function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function applyRules(sites, allowMode) {
    if (!chrome.declarativeNetRequest) return;
    const blockedUrl = chrome.runtime.getURL("blocked.html");
    const rules = [];

    if (allowMode) {
      // Whitelist mode: catch-all redirect, then allow whitelisted sites
      rules.push({
        id: 9999, priority: 1,
        action: { type: 'redirect', redirect: { url: blockedUrl + '?site=unlisted&whitelist=1' } },
        condition: { regexFilter: '^https?://.+', resourceTypes: ['main_frame'] }
      });
      // Always allow Google Search
      rules.push({
        id: 9998, priority: 2, action: { type: 'allow' },
        condition: { regexFilter: '^https?://([a-z0-9-]+\.)*google\.com(/|\?)', resourceTypes: ['main_frame'] }
      });
      sites.forEach((site, i) => {
        rules.push({
          id: 2000 + i, priority: 2, action: { type: 'allow' },
          condition: { regexFilter: '^https?://([a-z0-9-]+\.)*' + escapeRegex(site) + '(/|\?)', resourceTypes: ['main_frame'] }
        });
      });
      rules.push({ id: 3000, priority: 2, action: { type: 'allow' }, condition: { urlFilter: 'chrome://*', resourceTypes: ['main_frame'] } });
      rules.push({ id: 3001, priority: 2, action: { type: 'allow' }, condition: { urlFilter: 'chrome-extension://*', resourceTypes: ['main_frame'] } });
    } else {
      sites.forEach((site, i) => {
        rules.push({
          id: 100 + i, priority: 1,
          action: { type: "redirect", redirect: { url: blockedUrl + "?site=" + encodeURIComponent(site) } },
          condition: { regexFilter: "^https?://([a-z0-9-]+\.)*" + escapeRegex(site) + "(/|\?)", resourceTypes: ["main_frame"] }
        });
      });
    }

    chrome.declarativeNetRequest.getDynamicRules((existing) => {
      const removeIds = existing.map((r) => r.id);
      chrome.declarativeNetRequest.updateDynamicRules(
        { addRules: rules, removeRuleIds: removeIds },
        () => { if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError.message); }
      );
    });
  }

  function removeRules() {
    if (!chrome.declarativeNetRequest) return;
    chrome.declarativeNetRequest.getDynamicRules((existing) => {
      const ids = existing.map((r) => r.id);
      if (ids.length > 0) chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ids });
    });
  }

  init();
});
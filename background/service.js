// Block Guard — background service worker
// Schedule management uses scheduleActive + scheduleBlockId (separate from manual 'active' flag).
// DNR rules are applied/removed based on the combined state.

// ── Keep alarm alive across service-worker restarts ──
chrome.alarms.get('scheduleCheck', (alarm) => {
  if (!alarm) chrome.alarms.create('scheduleCheck', { periodInMinutes: 1 });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['blockedAttempts'], (r) => {
    if (r.blockedAttempts === undefined) chrome.storage.local.set({ blockedAttempts: 0 });
  });
  // Clear stale DNR rules
  chrome.declarativeNetRequest.getDynamicRules((existing) => {
    if (existing.length > 0) {
      chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existing.map(r => r.id) });
    }
  });
  // Create alarm
  chrome.alarms.get('scheduleCheck', (a) => {
    if (!a) chrome.alarms.create('scheduleCheck', { periodInMinutes: 1 });
  });
  // Run immediately on install/update to pick up any active schedule
  checkSchedule();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'scheduleCheck') checkSchedule();
});

// ════════════════════════════════════════════════════════════════
// ── Schedule checker ──
// Runs every minute. Manages scheduleActive / scheduleBlockId
// independently from the user's manual 'active' flow session.
// ════════════════════════════════════════════════════════════════

function checkSchedule() {
  chrome.storage.local.get(
    ['scheduleBlocks', 'scheduleActive', 'scheduleBlockId', 'active',
     'blockedSites', 'allowListMode', 'focusMinutes', 'focusStart'],
    (data) => {
      const blocks       = data.scheduleBlocks || [];
      const now          = new Date();
      const currentDay   = now.getDay();           // 0=Sun … 6=Sat
      const nowTotal     = now.getHours() * 60 + now.getMinutes();

      // Find whichever scheduled block should be running right now
      const matchingBlock = blocks.find(b => {
        if (!b.days.includes(currentDay)) return false;
        const [sh, sm] = b.start.split(':').map(Number);
        const [eh, em] = b.end.split(':').map(Number);
        return nowTotal >= sh * 60 + sm && nowTotal < eh * 60 + em;
      });

      const wasScheduleActive  = !!data.scheduleActive;
      const prevBlockId        = data.scheduleBlockId;
      const nowScheduleActive  = !!matchingBlock;
      const blockChanged       = matchingBlock && prevBlockId !== matchingBlock.id;

      if (nowScheduleActive && (!wasScheduleActive || blockChanged)) {
        // ── Start / switch schedule block ──
        chrome.storage.local.set({
          scheduleActive:   true,
          scheduleBlockId:  matchingBlock.id,
        });

      } else if (!nowScheduleActive && wasScheduleActive) {
        // ── End schedule block ──
        chrome.storage.local.set({ scheduleActive: false, scheduleBlockId: null });
      }
      // If same block still active → no action needed (rules already applied)
    }
  );
}

// ════════════════════════════════════════════════════════════════
// ── Rule resolution ──
// Decides what sites/mode to use based on which sessions are on.
// scheduleBlock: the currently running schedule block (or null)
// globalSites: the global blockedSites list
// globalAllowMode: the global allowListMode flag
// manualActive: whether the user's manual session is on
// ════════════════════════════════════════════════════════════════

function resolveAndApplyRules(scheduleBlock, globalSites, globalAllowMode, manualActive) {
  if (!scheduleBlock && !manualActive) { removeRules(); return; }

  let sites     = globalSites;
  let allowMode = globalAllowMode;

  if (scheduleBlock) {
    if (scheduleBlock.siteMode === 'allow') {
      sites     = scheduleBlock.customSites || [];
      allowMode = true;
    } else if (scheduleBlock.siteMode === 'custom' && scheduleBlock.customSites?.length) {
      sites     = scheduleBlock.customSites;
      allowMode = false;
    }
    // siteMode === 'global' → use globalSites + globalAllowMode as-is
  }

  applyRules(sites, allowMode);
}

// ── DNR rule helpers ──

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyRules(sites, allowMode = false) {
  if (!chrome.declarativeNetRequest) return;

  const blockedUrl = chrome.runtime.getURL('blocked.html');
  const rules = [];

  if (allowMode) {
    // Catch-all → redirect; then allow whitelisted sites at higher priority
    rules.push({
      id: 9999, priority: 1,
      action: { type: 'redirect', redirect: { url: blockedUrl + '?site=unlisted&whitelist=1' } },
      condition: { regexFilter: '^https?://.+', resourceTypes: ['main_frame'] }
    });
    // Always allow Google Search
    rules.push({
      id: 9998, priority: 2, action: { type: 'allow' },
      condition: { regexFilter: '^https?://([a-z0-9-]+\\.)*google\\.com(/|\\?)', resourceTypes: ['main_frame'] }
    });
    // Allow whitelisted sites
    sites.forEach((site, i) => {
      rules.push({
        id: 2000 + i, priority: 2, action: { type: 'allow' },
        condition: {
          regexFilter: '^https?://([a-z0-9-]+\\.)*' + escapeRegex(site) + '(/|\\?)',
          resourceTypes: ['main_frame']
        }
      });
    });
    // Always allow chrome:// and extension pages
    rules.push({ id: 3000, priority: 2, action: { type: 'allow' }, condition: { urlFilter: 'chrome://*', resourceTypes: ['main_frame'] } });
    rules.push({ id: 3001, priority: 2, action: { type: 'allow' }, condition: { urlFilter: 'chrome-extension://*', resourceTypes: ['main_frame'] } });

  } else {
    sites.forEach((site, i) => {
      rules.push({
        id: 100 + i,
        priority: 1,
        action: { type: 'redirect', redirect: { url: blockedUrl + '?site=' + encodeURIComponent(site) } },
        condition: {
          regexFilter: '^https?://([a-z0-9-]+\\.)*' + escapeRegex(site) + '(/|\\?)',
          resourceTypes: ['main_frame']
        }
      });
    });
  }

  chrome.declarativeNetRequest.getDynamicRules((existing) => {
    const removeIds = existing.map(r => r.id);
    chrome.declarativeNetRequest.updateDynamicRules(
      { addRules: rules, removeRuleIds: removeIds },
      () => { if (chrome.runtime.lastError) console.warn('[BG] applyRules:', chrome.runtime.lastError.message); }
    );
  });
}

function removeRules() {
  if (!chrome.declarativeNetRequest) return;
  chrome.declarativeNetRequest.getDynamicRules((existing) => {
    if (existing.length > 0) {
      chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existing.map(r => r.id) });
    }
  });
}

// ════════════════════════════════════════════════════════════════
// ── Storage change listener ──
// Reacts to manual session start/stop and site list changes.
// Does NOT override schedule rules; resolveAndApplyRules handles both.
// ════════════════════════════════════════════════════════════════

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  const activeChanged      = changes.active !== undefined;
  const sitesChanged       = changes.blockedSites !== undefined;
  const allowModeChanged   = changes.allowListMode !== undefined;
  const schedBlocksChanged = changes.scheduleBlocks !== undefined;
  const schedActiveChanged = changes.scheduleActive !== undefined;
  const schedIdChanged     = changes.scheduleBlockId !== undefined;

  if (!activeChanged && !sitesChanged && !allowModeChanged &&
      !schedBlocksChanged && !schedActiveChanged && !schedIdChanged) return;

  chrome.storage.local.get(
    ['active', 'blockedSites', 'allowListMode', 'scheduleActive', 'scheduleBlockId', 'scheduleBlocks'],
    (data) => {
      const manualActive   = data.active || false;
      const scheduleActive = data.scheduleActive || false;

      if (!manualActive && !scheduleActive) {
        removeRules();
        return;
      }

      // Find current schedule block object (if any)
      let scheduleBlock = null;
      if (scheduleActive && data.scheduleBlockId) {
        scheduleBlock = (data.scheduleBlocks || []).find(b => b.id === data.scheduleBlockId) || null;
      }

      resolveAndApplyRules(
        scheduleBlock,
        data.blockedSites || [],
        data.allowListMode || false,
        manualActive
      );
    }
  );
});

// ── Message listener (reserved for future use) ──
chrome.runtime.onMessage.addListener((_msg, _sender, _sendResponse) => {
  return false;
});

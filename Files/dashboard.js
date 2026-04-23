// dashboard.js — Block Guard dashboard logic
document.addEventListener('DOMContentLoaded', () => {
  // ── DOM refs ──
  const addInput      = document.getElementById('dash-add-input');
  const addBtn        = document.getElementById('dash-add-btn');
  const domainsList   = document.getElementById('domains-list');
  const domainsCount  = document.getElementById('domains-count');
  const wlCard        = document.getElementById('wl-card');
  const wlToggle      = document.getElementById('wl-toggle');
  const wlDesc        = document.getElementById('wl-desc');
  const footerSites   = document.getElementById('footer-sites');
  const footerTime    = document.getElementById('footer-time');
  const footerProgressFill  = document.getElementById('footer-progress-fill');
  const footerProgressLabel = document.getElementById('footer-progress-label');
  const focusBtn      = document.getElementById('focus-session-btn');
  const sidebarLinks  = document.querySelectorAll('.sidebar-nav li a');
  const pages         = document.querySelectorAll('.dash-page');
  const notifBtn      = document.getElementById('notif-btn');
  const notifDropdown = document.getElementById('notif-dropdown');
  const notifList     = document.getElementById('notif-list');
  const notifCount    = document.getElementById('notif-count');
  const topbarUserBtn = document.getElementById('topbar-user-btn');
  const topbarUserName = document.getElementById('topbar-user-name');
  const topbarHelpBtn = document.getElementById('topbar-help-btn');
  const notifMarkAll = document.getElementById('notif-mark-all');
  const notifBadge = document.getElementById('notif-badge');

  const helpModal = null; // Help is now a dedicated tab, not a modal
  const helpCloseBtn = null;
  const helpGithubBtn = document.getElementById('help-github-btn');
  const helpEmailBtn = document.getElementById('help-email-btn');

  const authModal = document.getElementById('auth-modal');
  const authFirstName = document.getElementById('auth-first-name');
  const authLastName = document.getElementById('auth-last-name');
  const authEmail = document.getElementById('auth-email');
  const authSaveBtn = document.getElementById('auth-save-btn');
  const authCancelBtn = document.getElementById('auth-cancel-btn');
  const authSignoutBtn = document.getElementById('auth-signout-btn');
  const authUserPreview = document.getElementById('auth-user-preview');
  const authPreviewName = document.getElementById('auth-preview-name');
  const authPreviewEmail = document.getElementById('auth-preview-email');

  // Schedule refs
  const scheduleHeaderRow = document.getElementById('schedule-header-row');
  const scheduleBodyGrid  = document.getElementById('schedule-body-grid');
  const addBlockBtn       = document.getElementById('add-block-btn');
  const blockModal        = document.getElementById('block-modal');
  const bmCancel          = document.getElementById('bm-cancel');
  const bmSave            = document.getElementById('bm-save');
  const dayBtns           = document.querySelectorAll('.day-btn');
  const modalDaysError    = document.getElementById('modal-days-error');
  const modalTimeError    = document.getElementById('modal-time-error');

  // Focus mode refs
  const focusModeStartBtn = document.getElementById('focus-mode-start-btn');
  const focusModeResetBtn = document.getElementById('focus-mode-reset-btn');
  const focusTimeEl       = document.getElementById('focus-time');
  const focusRingEl       = document.getElementById('focus-ring');
  const focusModeStatusEl = document.getElementById('focus-mode-status');
  const focusLevelCards   = document.querySelectorAll('.focus-level-card');
  const focusGoalCurrent  = document.getElementById('focus-goal-current');
  const focusGoalTarget   = document.getElementById('focus-goal-target');
  const focusGoalFill     = document.getElementById('focus-goal-fill');
  const focusGoalPct      = document.getElementById('focus-goal-progress-pct');
  const focusInsightText  = document.getElementById('focus-insight-text');
  const ambientBtns       = document.querySelectorAll('.ambient-btn');
  const focusTopDistract  = document.getElementById('focus-top-distractions');

  // Track which block is being edited (null = creating new)
  let editingBlockId = null;
  let focusTickInterval = null;
  let selectedFocusMode = 'deep';
  let selectedDurationMins = 50;
  let currentAmbient = null;
  let ambientCtx = null;
  let ambientNodes = [];
  let activeUserProfile = null;

  // Focus mode preset blocked sites
  const FOCUS_MODE_PRESETS = {
    light: [
      'twitter.com', 'x.com', 'tiktok.com', 'instagram.com', 'reddit.com'
    ],
    deep: [
      'twitter.com', 'x.com', 'tiktok.com', 'instagram.com', 'reddit.com',
      'facebook.com', 'youtube.com', 'twitch.tv', 'netflix.com',
      'snapchat.com', 'threads.net', 'linkedin.com'
    ],
    zen: [
      'twitter.com', 'x.com', 'tiktok.com', 'instagram.com', 'reddit.com',
      'facebook.com', 'youtube.com', 'twitch.tv', 'netflix.com',
      'snapchat.com', 'threads.net', 'linkedin.com',
      'hulu.com', 'disney.com', 'amazon.com', 'ebay.com',
      'nytimes.com', 'bbc.com', 'cnn.com', 'medium.com',
      'steam.com', 'epicgames.com', 'pinterest.com', 'tumblr.com'
    ]
  };

  const sidebarSigninLink = document.getElementById('sidebar-signin-link');
  const sidebarSignoutLink = document.getElementById('sidebar-signout-link');

  // Utility to prevent XSS
  function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ── Sidebar Navigation ──
  sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      sidebarLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const section = link.dataset.section;
      if (section) {
        pages.forEach(p => p.classList.remove('active'));
        const target = document.getElementById(`section-${section}`);
        if (target) target.classList.add('active');
        if (section === 'insights') setTimeout(renderInsights, 40);
        if (section === 'focus') setTimeout(renderFocusMode, 40);
      }
    });
  });

  if (focusBtn) {
    focusBtn.addEventListener('click', () => {
      sidebarLinks.forEach(l => l.classList.remove('active'));
      pages.forEach(p => p.classList.remove('active'));
      const focusLink = document.querySelector('.sidebar-nav a[data-section="focus"]');
      if (focusLink) focusLink.classList.add('active');
      const focusPage = document.getElementById('section-focus');
      if (focusPage) focusPage.classList.add('active');
      setTimeout(renderFocusMode, 40);
    });
  }

  // ── Live storage updates ──
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.focusMinutes) {
      updateFooter(null, Math.floor(changes.focusMinutes.newValue || 0), null, null);
    }
    if (changes.blockedSites) {
      updateFooter(changes.blockedSites.newValue?.length ?? null, null, null, null);
    }
    // Refresh scheduled blocks panel when anything schedule-related changes
    if (changes.scheduleBlocks || changes.scheduleActive || changes.scheduleBlockId) {
      chrome.storage.local.get(['scheduleBlocks', 'scheduleActive', 'scheduleBlockId', 'blockedSites'], (r) => {
        renderScheduledBlocksPanel(r.scheduleBlocks || [], r.scheduleActive || false, r.scheduleBlockId || null, r.blockedSites || []);
        if (changes.scheduleBlocks) renderSchedule(r.scheduleBlocks || []);
      });
    }

    if (changes.focusMinutes || changes.sessions || changes.blockedAttempts || changes.interceptionLog) {
      renderInsights();
    }

    if (changes.userProfile) {
      renderUserProfile(changes.userProfile.newValue || null);
    }

    if (changes.active || changes.focusStart || changes.focusDuration || changes.sessions ||
        changes.interceptionLog || changes.blockedAttempts || changes.focusMode || changes.savedDuration) {
      renderFocusMode();
    }

    if (changes.active || changes.focusMinutes || changes.sessions || changes.blockedAttempts ||
        changes.scheduleBlocks || changes.interceptionLog || changes.userProfile) {
      if (notifDropdown?.classList.contains('open')) renderNotifications();
    }
  });

  // ── Init ──
  function init() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.get(
      ['blockedSites', 'allowListMode', 'focusMinutes', 'sessions', 'active',
       'blockedAttempts', 'focusStart', 'scheduleBlocks', 'scheduleActive', 'scheduleBlockId', 'userProfile'],
      (result) => {
        const sites        = result.blockedSites || [];
        const isAllow      = result.allowListMode || false;
        const focusMins    = Math.floor(result.focusMinutes || 0);
        const isActive     = result.active || false;
        const schedBlocks  = result.scheduleBlocks || [];

        renderDomains(sites);
        setWhitelistUI(isAllow);
        updateFooter(sites.length, focusMins, isActive, result.focusStart);
        renderSchedule(schedBlocks);
        renderScheduledBlocksPanel(
          schedBlocks,
          result.scheduleActive || false,
          result.scheduleBlockId || null,
          sites
        );
        renderInsights();
        renderFocusMode();
        renderUserProfile(result.userProfile || null);

        updateSidebarFocusButtonState(isActive);
      }
    );
  }

  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add('active');
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('active');
  }

  function getInitials(firstName, lastName) {
    const first = (firstName || '').trim().charAt(0);
    const last = (lastName || '').trim().charAt(0);
    const initials = `${first}${last}`.toUpperCase();
    return initials || 'U';
  }

  function renderUserProfile(profile) {
    activeUserProfile = profile && profile.email ? profile : null;
    if (!topbarUserName || !topbarUserBtn) return;

    if (activeUserProfile) {
      const name = `${activeUserProfile.firstName || ''} ${activeUserProfile.lastName || ''}`.trim();
      const displayName = name || activeUserProfile.email;
      topbarUserName.textContent = displayName;

      const avatar = topbarUserBtn.querySelector('.topbar-user-avatar');
      if (avatar) {
        avatar.innerHTML = `<span style="font-size:11px;font-weight:800;color:#fff;font-family:'Plus Jakarta Sans',sans-serif">${getInitials(activeUserProfile.firstName, activeUserProfile.lastName)}</span>`;
      }

      if (sidebarSigninLink) sidebarSigninLink.textContent = ' Profile';
      if (sidebarSignoutLink) sidebarSignoutLink.style.display = '';
      if (sidebarSigninLink) sidebarSigninLink.innerHTML = '<span class="material-symbols-outlined">person</span> Profile';
    } else {
      topbarUserName.textContent = 'Sign In';
      const avatar = topbarUserBtn.querySelector('.topbar-user-avatar');
      if (avatar) {
        avatar.innerHTML = '<span class="material-symbols-outlined">person</span>';
      }
      if (sidebarSigninLink) sidebarSigninLink.innerHTML = '<span class="material-symbols-outlined">person</span> Sign In';
      if (sidebarSignoutLink) sidebarSignoutLink.style.display = 'none';
    }

    if (authUserPreview && authPreviewName && authPreviewEmail) {
      if (activeUserProfile) {
        authUserPreview.classList.add('visible');
        authPreviewName.textContent = `${activeUserProfile.firstName || ''} ${activeUserProfile.lastName || ''}`.trim() || 'Signed in user';
        authPreviewEmail.textContent = activeUserProfile.email;
      } else {
        authUserPreview.classList.remove('visible');
      }
    }
  }

  function openAuthModal(prefillFromActive = true) {
    if (!authModal) return;
    if (prefillFromActive && activeUserProfile) {
      authFirstName.value = activeUserProfile.firstName || '';
      authLastName.value = activeUserProfile.lastName || '';
      authEmail.value = activeUserProfile.email || '';
    }
    openModal(authModal);
  }

  function closeAuthModal() {
    closeModal(authModal);
  }

  function saveUserProfile() {
    const firstName = (authFirstName?.value || '').trim();
    const lastName = (authLastName?.value || '').trim();
    const email = (authEmail?.value || '').trim().toLowerCase();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!firstName || !lastName || !isValidEmail) {
      alert('Please enter first name, last name, and a valid email.');
      return;
    }

    const profile = { firstName, lastName, email, signedInAt: Date.now() };
    chrome.storage.local.set({ userProfile: profile }, () => {
      renderUserProfile(profile);
      closeAuthModal();
      if (notifDropdown?.classList.contains('open')) renderNotifications();
    });
  }

  function signOutUser() {
    chrome.storage.local.remove('userProfile', () => {
      renderUserProfile(null);
      closeAuthModal();
      if (notifDropdown?.classList.contains('open')) renderNotifications();
    });
  }

  function getNextScheduledBlock(scheduleBlocks) {
    const blocks = scheduleBlocks || [];
    if (blocks.length === 0) return null;
    const now = new Date();
    const nowDay = now.getDay();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    let best = null;

    blocks.forEach(block => {
      (block.days || []).forEach(day => {
        const [h, m] = (block.start || '09:00').split(':').map(Number);
        const startMins = h * 60 + m;
        const dayDelta = (day - nowDay + 7) % 7;
        const minsUntil = dayDelta * 1440 + (startMins - nowMinutes);
        const normalized = minsUntil < 0 ? minsUntil + 10080 : minsUntil;
        if (!best || normalized < best.minsUntil) {
          best = { block, day, minsUntil: normalized };
        }
      });
    });

    return best;
  }

  function formatRelativeMinutes(totalMinutes) {
    if (totalMinutes < 60) return `${totalMinutes}m`;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  function renderNotifications() {
    if (!notifList || !notifCount) return;
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.get(['active', 'focusStart', 'focusDuration', 'focusMinutes', 'sessions', 'blockedAttempts', 'scheduleBlocks', 'interceptionLog', 'userProfile', 'dismissedNotifIds'], (r) => {
      const notes = [];
      const user = r.userProfile || null;
      const dismissed = r.dismissedNotifIds || [];

      if (!user) {
        notes.push({ id: 'signin', type: 'warning', icon: 'person', title: 'Sign in recommended', message: 'Create your profile to personalize reminders and activity summaries.', time: 'Now' });
      } else {
        notes.push({ id: 'welcome', type: 'success', icon: 'waving_hand', title: `Welcome ${user.firstName || 'back'}`, message: 'Your focus dashboard is synced and ready.', time: 'Now' });
      }

      if (r.active) {
        notes.push({ id: 'active-session', type: 'info', icon: 'timer', title: 'Focus session active', message: 'Blocking rules are currently enabled. Stay focused!', time: 'Live' });
      } else {
        notes.push({ id: 'no-session', type: 'warning', icon: 'self_improvement', title: 'No active session', message: 'Start a focus block to protect your deep-work window.', time: 'Today' });
      }

      const nextBlock = getNextScheduledBlock(r.scheduleBlocks || []);
      if (nextBlock) {
        const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        notes.push({
          id: 'next-schedule-' + nextBlock.block.id,
          type: 'info',
          icon: 'calendar_month',
          title: `Next schedule: ${(nextBlock.block.title || 'Focus Block')}`,
          message: `${DAY_LABELS[nextBlock.day]} ${nextBlock.block.start} · starts in ${formatRelativeMinutes(nextBlock.minsUntil)}`,
          time: 'Schedule'
        });
      } else {
        notes.push({ id: 'no-schedules', type: 'info', icon: 'calendar_add_on', title: 'No schedules set', message: 'Create recurring focus blocks in the Schedule tab.', time: 'Reminder' });
      }

      const attempts = r.blockedAttempts || 0;
      const focusMins = Math.floor(r.focusMinutes || 0);
      if (attempts > 0 || focusMins > 0) {
        notes.push({
          id: 'insights-update',
          type: 'success',
          icon: 'insights',
          title: 'Insights update',
          message: `${attempts} distractions blocked · ${focusMins} minutes reclaimed so far.`,
          time: 'Analytics'
        });
      }

      const latest = (r.interceptionLog || [])[0];
      if (latest) {
        notes.push({
          id: 'latest-block-' + latest.timestamp,
          type: 'alert',
          icon: 'block',
          title: 'Latest blocked site',
          message: `${latest.site} was intercepted to keep you on track.`,
          time: 'Recent'
        });
      }

      // Filter out dismissed
      const visible = notes.filter(n => !dismissed.includes(n.id));
      const unseenCount = visible.length;

      notifCount.textContent = `${unseenCount} update${unseenCount !== 1 ? 's' : ''}`;

      // Update badge
      if (notifBadge) {
        if (unseenCount > 0) {
          notifBadge.textContent = unseenCount > 9 ? '9+' : String(unseenCount);
          notifBadge.classList.add('visible');
        } else {
          notifBadge.classList.remove('visible');
        }
      }

      if (visible.length === 0) {
        notifList.innerHTML = `<div class="notif-empty"><span class="material-symbols-outlined">notifications_off</span>All caught up! No new notifications.</div>`;
        return;
      }

      notifList.innerHTML = visible.map(n => `
        <div class="notif-item notif-${n.type}" data-notif-id="${escapeHtml(n.id)}">
          <div class="notif-item-icon"><span class="material-symbols-outlined">${n.icon}</span></div>
          <div class="notif-item-main">
            <div class="notif-title">${escapeHtml(n.title)}</div>
            <div class="notif-message">${escapeHtml(n.message)}</div>
            <div class="notif-time">${escapeHtml(n.time)}</div>
          </div>
          <button class="notif-dismiss" data-dismiss-id="${escapeHtml(n.id)}" title="Dismiss">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
      `).join('');

      // Bind dismiss buttons
      notifList.querySelectorAll('.notif-dismiss').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.dismissId;
          const item = btn.closest('.notif-item');
          if (item) {
            item.style.transition = 'all 0.25s ease';
            item.style.opacity = '0';
            item.style.transform = 'translateX(16px)';
          }
          setTimeout(() => {
            chrome.storage.local.get(['dismissedNotifIds'], (r2) => {
              const ids = r2.dismissedNotifIds || [];
              if (!ids.includes(id)) ids.push(id);
              chrome.storage.local.set({ dismissedNotifIds: ids }, renderNotifications);
            });
          }, 250);
        });
      });
    });
  }

  if (notifBtn) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !notifDropdown?.classList.contains('open');
      if (willOpen) {
        renderNotifications();
        notifDropdown?.classList.add('open');
      } else {
        notifDropdown?.classList.remove('open');
      }
    });
  }

  // Mark all read
  if (notifMarkAll) {
    notifMarkAll.addEventListener('click', () => {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
      chrome.storage.local.get(['dismissedNotifIds'], (r) => {
        // Collect all visible notification IDs
        const visibleIds = Array.from(notifList.querySelectorAll('.notif-item')).map(el => el.dataset.notifId).filter(Boolean);
        const ids = r.dismissedNotifIds || [];
        visibleIds.forEach(id => { if (!ids.includes(id)) ids.push(id); });
        chrome.storage.local.set({ dismissedNotifIds: ids }, renderNotifications);
      });
    });
  }

  // Sidebar Focus button
  if (focusBtn) {
    focusBtn.addEventListener('click', () => {
      sidebarLinks.forEach(l => l.classList.remove('active'));
      pages.forEach(p => p.classList.remove('active'));
      const focusLink = document.querySelector('.sidebar-nav a[data-section="focus"]');
      if (focusLink) focusLink.classList.add('active');
      const focusPage = document.getElementById('section-focus');
      if (focusPage) focusPage.classList.add('active');
      setTimeout(renderFocusMode, 40);
    });
  }

  // Initial badge update
  renderNotifications();

  if (topbarUserBtn) topbarUserBtn.addEventListener('click', () => openAuthModal(true));
  if (sidebarSigninLink) sidebarSigninLink.addEventListener('click', (e) => { e.preventDefault(); openAuthModal(true); });
  if (authSaveBtn) authSaveBtn.addEventListener('click', saveUserProfile);
  if (authCancelBtn) authCancelBtn.addEventListener('click', closeAuthModal);
  if (authSignoutBtn) authSignoutBtn.addEventListener('click', signOutUser);
  if (sidebarSignoutLink) sidebarSignoutLink.addEventListener('click', (e) => { e.preventDefault(); signOutUser(); });

  // Help tab: topbar ? button navigates to Help section
  if (topbarHelpBtn) {
    topbarHelpBtn.addEventListener('click', () => {
      sidebarLinks.forEach(l => l.classList.remove('active'));
      pages.forEach(p => p.classList.remove('active'));
      const helpLink = document.querySelector('.sidebar-nav a[data-section="help"]');
      if (helpLink) helpLink.classList.add('active');
      const helpPage = document.getElementById('section-help');
      if (helpPage) helpPage.classList.add('active');
    });
  }

  if (helpGithubBtn) helpGithubBtn.addEventListener('click', () => {
    window.open('https://github.com/1nird/Block-Guard-Beta', '_blank', 'noopener,noreferrer');
  });
  if (helpEmailBtn) helpEmailBtn.addEventListener('click', () => {
    window.open('mailto:supportblockguard@gmail.com', '_blank');
  });

  // Auth modal backdrop click
  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) closeModal(authModal);
    });
  }

  document.addEventListener('click', (e) => {
    if (!notifDropdown || !notifBtn) return;
    if (notifDropdown.contains(e.target) || notifBtn.contains(e.target)) return;
    notifDropdown.classList.remove('open');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeModal(authModal);
    notifDropdown?.classList.remove('open');
  });

  // ── FAQ Accordion ──
  document.querySelectorAll('.help-faq-q').forEach(q => {
    q.addEventListener('click', () => {
      const item = q.closest('.help-faq-item');
      if (!item) return;
      const wasOpen = item.classList.contains('open');
      // Close all others
      document.querySelectorAll('.help-faq-item').forEach(i => i.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });

  // ── Focus Mode Site Tags ──
  function renderFocusSiteTags() {
    ['light', 'deep', 'zen'].forEach(mode => {
      const container = document.getElementById(`focus-sites-${mode}`);
      if (!container) return;
      const sites = FOCUS_MODE_PRESETS[mode] || [];
      const show = sites.slice(0, 6);
      const remaining = sites.length - show.length;
      container.innerHTML = show.map(s => `<span class="focus-level-site-tag">${escapeHtml(s)}</span>`).join('');
      if (remaining > 0) {
        container.innerHTML += `<span class="focus-level-site-tag more">+${remaining} more</span>`;
      }
    });
  }
  renderFocusSiteTags();

  // ── Whitelist UI ──
  function setWhitelistUI(isAllow) {
    if (isAllow) {
      wlToggle.classList.add('active');
      wlCard.classList.add('allow-active');
      wlDesc.textContent = 'All sites are blocked except those in your list';
    } else {
      wlToggle.classList.remove('active');
      wlCard.classList.remove('allow-active');
      wlDesc.textContent = 'Only listed sites will be blocked';
    }
  }

  wlToggle.addEventListener('click', () => {
    chrome.storage.local.get(['allowListMode'], (result) => {
      const newVal = !result.allowListMode;
      chrome.storage.local.set({ allowListMode: newVal }, () => {
        setWhitelistUI(newVal);
        chrome.storage.local.get(['blockedSites', 'active'], (r) => {
          if (r.active) applyRules(r.blockedSites || [], newVal);
        });
      });
    });
  });

  // ── Render Domains ──
  function renderDomains(sites) {
    domainsCount.textContent = `${sites.length} Site${sites.length !== 1 ? 's' : ''} Active`;
    domainsList.innerHTML = '';

    if (sites.length === 0) {
      domainsList.innerHTML = `
        <div class="domains-empty">
          <span class="material-symbols-outlined">playlist_remove</span>
          <p>No sites blocked yet</p>
        </div>`;
      return;
    }

    chrome.storage.local.get(['siteTimestamps'], (res) => {
      const timestamps = res.siteTimestamps || {};
      let updated = false;
      sites.forEach(s => {
        if (!timestamps[s]) { timestamps[s] = Date.now(); updated = true; }
      });
      if (updated) chrome.storage.local.set({ siteTimestamps: timestamps });

      domainsList.innerHTML = '';
      sites.forEach(domain => {
        const addedText = getTimeAgo(timestamps[domain] || Date.now());
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        const item = document.createElement('div');
        item.className = 'domain-item';
        item.innerHTML = `
          <div class="domain-left">
            <div class="domain-favicon">
              <img src="${faviconUrl}" alt=""
                onerror="this.style.display='none';this.parentElement.innerHTML='<span class=\\'domain-favicon-letter\\'>${domain.charAt(0)}</span>';" />
            </div>
            <div class="domain-info">
              <h4>${domain}</h4>
              <span>Added ${addedText}</span>
            </div>
          </div>
          <button class="domain-remove" data-domain="${domain}" title="Remove">
            <span class="material-symbols-outlined">close</span>
          </button>`;
        domainsList.appendChild(item);
      });

      domainsList.querySelectorAll('.domain-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          const el = btn.closest('.domain-item');
          el.style.transition = 'all 0.25s ease';
          el.style.opacity = '0';
          el.style.transform = 'translateX(16px)';
          setTimeout(() => removeSite(btn.dataset.domain), 260);
        });
      });
    });
  }

  function getTimeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    return `${Math.floor(days / 7)}w ago`;
  }

  // ── Add Site ──
  function addSite(domain) {
    domain = domain.trim().toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*/, '')
      .replace(/^www\./, '');
    if (!domain) return;

    chrome.storage.local.get(['blockedSites', 'siteTimestamps'], (result) => {
      const sites = result.blockedSites || [];
      const timestamps = result.siteTimestamps || {};
      if (!sites.includes(domain)) {
        sites.push(domain);
        timestamps[domain] = Date.now();
        chrome.storage.local.set({ blockedSites: sites, siteTimestamps: timestamps }, () => {
          addInput.value = '';
          addInput.placeholder = `✓ Added: ${domain}`;
          setTimeout(() => { addInput.placeholder = 'Add site to block...  (e.g. facebook.com)'; }, 1800);
          renderDomains(sites);
          updateFooter(sites.length, null, null, null);
          chrome.storage.local.get(['allowListMode', 'active'], (r) => {
            if (r.active) applyRules(sites, r.allowListMode);
          });
        });
      } else {
        addInput.value = '';
        addInput.placeholder = 'Already in your block list';
        setTimeout(() => { addInput.placeholder = 'Add site to block...  (e.g. facebook.com)'; }, 1800);
      }
    });
  }

  addBtn.addEventListener('click', () => addSite(addInput.value));
  addInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addSite(addInput.value); });

  // ── Remove Site ──
  function removeSite(domain) {
    chrome.storage.local.get(['blockedSites', 'siteTimestamps'], (result) => {
      const sites = (result.blockedSites || []).filter(s => s !== domain);
      const timestamps = result.siteTimestamps || {};
      delete timestamps[domain];
      chrome.storage.local.set({ blockedSites: sites, siteTimestamps: timestamps }, () => {
        renderDomains(sites);
        updateFooter(sites.length, null, null, null);
        chrome.storage.local.get(['allowListMode', 'active'], (r) => {
          if (r.active) applyRules(sites, r.allowListMode);
        });
      });
    });
  }

  // ── Footer Stats ──
  function updateFooter(siteCount, focusMins, isActive, focusStart) {
    if (siteCount !== null) footerSites.textContent = siteCount;
    if (focusMins !== null) {
      const hrs = Math.floor(focusMins / 60);
      const mins = focusMins % 60;
      footerTime.textContent = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
      const pct = Math.min(100, Math.round((focusMins / 480) * 100));
      footerProgressFill.style.width = pct + '%';
      footerProgressLabel.textContent = `Daily productivity goal: ${pct}% achieved`;
    }
  }

  // ── Focus Session / Focus Mode ──
  function updateSidebarFocusButtonState(isActive) {
    if (!focusBtn) return;
    if (isActive) {
      focusBtn.textContent = 'End Focus Session';
      focusBtn.style.background = 'linear-gradient(135deg, #9c4141, #c0524e)';
      focusBtn.style.boxShadow = '0 4px 16px rgba(156, 65, 65, 0.25)';
    } else {
      focusBtn.textContent = 'Start Focus Session';
      focusBtn.style.background = '';
      focusBtn.style.boxShadow = '';
    }
  }

  function modeLabel(mode) {
    if (mode === 'light') return 'Light Study';
    if (mode === 'zen') return 'Zen Mode';
    return 'Deep Work';
  }

  function modeQuote(mode) {
    if (mode === 'light') return 'Gentle pace, steady momentum. Keep the session calm and consistent.';
    if (mode === 'zen') return 'Silence the noise and extend the flow. Let deep attention compound.';
    return 'Strict focus window active. Stay with one meaningful task until completion.';
  }

  function defaultDurationForMode(mode) {
    if (mode === 'light') return 25;
    if (mode === 'zen') return 90;
    return 50;
  }

  function formatClock(totalSeconds) {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function updateFocusRingProgress(progress) {
    if (!focusRingEl) return;
    const clamped = Math.max(0, Math.min(1, progress));
    const deg = Math.round(clamped * 360);
    focusRingEl.style.background = `conic-gradient(var(--sage) 0deg, var(--sage) ${deg}deg, #d7dfdc ${deg}deg, #d7dfdc 360deg)`;
  }

  function stopFocusTicker() {
    if (focusTickInterval) {
      clearInterval(focusTickInterval);
      focusTickInterval = null;
    }
  }

  function setFocusStartButtonState(isActive) {
    if (!focusModeStartBtn) return;
    focusModeStartBtn.textContent = isActive ? 'End Flow' : 'Start Flow';
    focusModeStartBtn.classList.toggle('stop', isActive);
  }

  function applyModeCards(mode) {
    focusLevelCards.forEach(card => {
      card.classList.toggle('active', card.dataset.mode === mode);
    });
  }

  function setFocusClockFromSelection() {
    if (!focusTimeEl) return;
    focusTimeEl.textContent = formatClock(selectedDurationMins * 60);
    updateFocusRingProgress(1);
    if (focusModeStatusEl) {
      focusModeStatusEl.textContent = `"${modeQuote(selectedFocusMode)}"`;
    }
  }

  function updateFocusGoal(sessions, goal) {
    const target = Math.max(1, goal || 8);
    const done = Math.min(sessions || 0, target);
    const pct = Math.min(100, Math.round((done / target) * 100));
    if (focusGoalCurrent) focusGoalCurrent.textContent = String(done);
    if (focusGoalTarget) focusGoalTarget.textContent = String(target);
    if (focusGoalFill) focusGoalFill.style.width = pct + '%';
    if (focusGoalPct) focusGoalPct.textContent = pct + '%';
  }

  function renderFocusTopDistractions(log) {
    if (!focusTopDistract) return;
    const counts = {};
    (log || []).forEach(entry => {
      const site = (entry.site || '').toLowerCase();
      if (!site) return;
      counts[site] = (counts[site] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (top.length === 0) {
      focusTopDistract.innerHTML = '<div class="focus-distract-item"><span>No data yet</span><span>0 attempts</span></div>';
      return;
    }
    focusTopDistract.innerHTML = top.map(([site, attempts]) =>
      `<div class="focus-distract-item"><span>${escapeHtml(site)}</span><span>${attempts} attempts</span></div>`
    ).join('');
  }

  function renderFocusInsight(log) {
    if (!focusInsightText) return;
    if (!log || log.length === 0) {
      focusInsightText.textContent = 'Your highest focus window is usually between 9:00 AM and 11:30 AM.';
      return;
    }
    const hourCounts = Array(24).fill(0);
    log.forEach(e => { hourCounts[new Date(e.timestamp).getHours()] += 1; });
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    const nextHour = (peakHour + 1) % 24;
    const fmt = h => {
      const suffix = h < 12 ? 'AM' : 'PM';
      const hr = h % 12 === 0 ? 12 : h % 12;
      return `${hr}:00 ${suffix}`;
    };
    focusInsightText.textContent = `You are most likely to get distracted between ${fmt(peakHour)} and ${fmt(nextHour)}. Use this tab to protect that window.`;
  }

  function focusTick() {
    chrome.storage.local.get(['active', 'focusStart', 'focusDuration'], (r) => {
      const isActive = !!r.active;
      if (!isActive) {
        stopFocusTicker();
        setFocusClockFromSelection();
        return;
      }

      const start = r.focusStart || Date.now();
      const elapsedMs = Math.max(0, Date.now() - start);
      const durationMins = Number(r.focusDuration || 0);

      if (durationMins > 0) {
        const totalMs = durationMins * 60000;
        const remainingMs = totalMs - elapsedMs;
        if (remainingMs <= 0) {
          endFocusSession(true);
          return;
        }
        if (focusTimeEl) focusTimeEl.textContent = formatClock(remainingMs / 1000);
        updateFocusRingProgress(remainingMs / totalMs);
      } else {
        if (focusTimeEl) focusTimeEl.textContent = formatClock(elapsedMs / 1000);
        updateFocusRingProgress(1);
      }
    });
  }

  function startFocusTicker() {
    stopFocusTicker();
    focusTick();
    focusTickInterval = setInterval(focusTick, 1000);
  }

  function startFocusSession(durationMins) {
    chrome.storage.local.get(['focusMinutes', 'sessions', 'blockedSites', 'allowListMode'], (data) => {
      const nextSessions = (data.sessions || 0) + 1;
      // Merge preset sites for the selected focus mode
      const presetSites = FOCUS_MODE_PRESETS[selectedFocusMode] || [];
      const globalSites = data.blockedSites || [];
      const mergedSites = [...new Set([...globalSites, ...presetSites])];
      chrome.storage.local.set({
        active: true,
        focusStart: Date.now(),
        focusDuration: durationMins,
        savedDuration: durationMins,
        sessions: nextSessions,
        focusMinutes: data.focusMinutes || 0,
        focusMode: selectedFocusMode,
      }, () => {
        updateSidebarFocusButtonState(true);
        setFocusStartButtonState(true);
        if (focusModeStatusEl) {
          focusModeStatusEl.textContent = `"${modeLabel(selectedFocusMode)} active. Protect this block and avoid context-switching."`;
        }
        updateFocusGoal(nextSessions, 8);
        startFocusTicker();
        applyRules(mergedSites, data.allowListMode || false);
      });
    });
  }

  function endFocusSession(autoEnded = false) {
    chrome.storage.local.get(['active', 'focusMinutes', 'focusStart'], (data) => {
      if (!data.active) {
        setFocusStartButtonState(false);
        updateSidebarFocusButtonState(false);
        return;
      }

      const elapsed = Math.max(0, (Date.now() - (data.focusStart || Date.now())) / 60000);
      const total = (data.focusMinutes || 0) + elapsed;

      chrome.storage.local.set({ active: false, focusMinutes: total, focusStart: null, focusDuration: null }, () => {
        stopFocusTicker();
        setFocusStartButtonState(false);
        updateSidebarFocusButtonState(false);
        updateFooter(null, Math.floor(total), false, null);
        setFocusClockFromSelection();
        if (focusModeStatusEl) {
          focusModeStatusEl.textContent = autoEnded
            ? 'Session completed. Breathe, reset, and start the next intentional block.'
            : `"${modeQuote(selectedFocusMode)}"`;
        }
        removeRules();
      });
    });
  }

  function ensureAmbientContext() {
    if (ambientCtx) return ambientCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ambientCtx = new Ctx();
    return ambientCtx;
  }

  function makeNoiseBuffer(ctx, type) {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      if (type === 'brown') {
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        data[i] = lastOut * 3.5;
      } else {
        data[i] = white * 0.55;
      }
    }
    return buffer;
  }

  function stopAmbientSound() {
    ambientNodes.forEach(node => {
      if (!node) return;
      try { if (node.stop) node.stop(); } catch (_) {}
      try { node.disconnect(); } catch (_) {}
    });
    ambientNodes = [];
    currentAmbient = null;
    ambientBtns.forEach(btn => {
      btn.classList.remove('active');
      const state = btn.querySelector('.ambient-state');
      if (state) state.textContent = 'Off';
    });
    chrome.storage.local.set({ focusAmbient: null });
  }

  function startAmbientSound(sound) {
    const ctx = ensureAmbientContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    stopAmbientSound();

    const source = ctx.createBufferSource();
    source.buffer = makeNoiseBuffer(ctx, sound === 'brown' ? 'brown' : 'white');
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    if (sound === 'rain') {
      filter.type = 'highpass';
      filter.frequency.value = 750;
      gain.gain.value = 0.017;
    } else if (sound === 'forest') {
      filter.type = 'bandpass';
      filter.frequency.value = 420;
      filter.Q.value = 0.8;
      gain.gain.value = 0.022;
    } else if (sound === 'brown') {
      filter.type = 'lowpass';
      filter.frequency.value = 220;
      gain.gain.value = 0.028;
    } else {
      filter.type = 'lowpass';
      filter.frequency.value = 1600;
      gain.gain.value = 0.02;
    }

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    ambientNodes = [source, filter, gain];
    currentAmbient = sound;

    ambientBtns.forEach(btn => {
      const isActive = btn.dataset.sound === sound;
      btn.classList.toggle('active', isActive);
      const state = btn.querySelector('.ambient-state');
      if (state) state.textContent = isActive ? 'Playing' : 'Off';
    });

    chrome.storage.local.set({ focusAmbient: sound });
  }

  function renderFocusMode() {
    chrome.storage.local.get([
      'active', 'focusStart', 'focusDuration', 'savedDuration', 'focusMode',
      'sessions', 'focusGoal', 'interceptionLog'
    ], (r) => {
      selectedFocusMode = r.focusMode || 'deep';
      selectedDurationMins = Number(r.savedDuration || defaultDurationForMode(selectedFocusMode));

      applyModeCards(selectedFocusMode);
      updateFocusGoal(r.sessions || 0, r.focusGoal || 8);
      renderFocusTopDistractions(r.interceptionLog || []);
      renderFocusInsight(r.interceptionLog || []);

      const isActive = !!r.active;
      updateSidebarFocusButtonState(isActive);
      setFocusStartButtonState(isActive);

      if (isActive) {
        startFocusTicker();
        if (focusModeStatusEl) focusModeStatusEl.textContent = `"${modeLabel(selectedFocusMode)} is running. Keep this single-task sprint clean."`;
      } else {
        stopFocusTicker();
        setFocusClockFromSelection();
      }

      // Render preset site tags
      renderFocusSiteTags();
    });
  }

  if (focusBtn) {
    focusBtn.addEventListener('click', () => {
      chrome.storage.local.get(['active'], (r) => {
        if (r.active) endFocusSession(false);
        else startFocusSession(selectedDurationMins);
      });
    });
  }

  if (focusModeStartBtn) {
    focusModeStartBtn.addEventListener('click', () => {
      chrome.storage.local.get(['active'], (r) => {
        if (r.active) endFocusSession(false);
        else startFocusSession(selectedDurationMins);
      });
    });
  }

  if (focusModeResetBtn) {
    focusModeResetBtn.addEventListener('click', () => {
      chrome.storage.local.get(['active'], (r) => {
        if (r.active) endFocusSession(false);
        stopFocusTicker();
        setFocusClockFromSelection();
        if (focusModeStatusEl) focusModeStatusEl.textContent = `"${modeQuote(selectedFocusMode)}"`;
      });
    });
  }

  focusLevelCards.forEach(card => {
    card.addEventListener('click', () => {
      const mode = card.dataset.mode || 'deep';
      const mins = Number(card.dataset.duration || defaultDurationForMode(mode));
      selectedFocusMode = mode;
      selectedDurationMins = mins;
      chrome.storage.local.set({ focusMode: mode, savedDuration: mins }, () => {
        applyModeCards(mode);
        chrome.storage.local.get(['active'], (r) => {
          if (!r.active) setFocusClockFromSelection();
          else if (focusModeStatusEl) focusModeStatusEl.textContent = `"${modeLabel(mode)} is selected for your next session."`;
        });
      });
    });
  });

  ambientBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const sound = btn.dataset.sound;
      if (!sound) return;
      if (currentAmbient === sound) stopAmbientSound();
      else startAmbientSound(sound);
    });
  });

  // ════════════════════════════════════════════════
  // ── Schedule ──
  // ════════════════════════════════════════════════

  // Constants: grid starts at 6 AM, ends at 22 PM
  const HOUR_START = 6;
  const HOUR_END   = 22;
  const PX_PER_HOUR = 60; // 60px per hour, 1px per minute

  const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const DAY_NAMES_FULL  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  // JS getDay(): 0=Sun, 1=Mon ... 6=Sat
  // Our grid col index: 0=Mon(JS1), 1=Tue(JS2),..., 5=Sat(JS6), 6=Sun(JS0)
  // data-day stored as JS day: 0=Sun, 1=Mon, ..., 6=Sat

  function getStartOfWeek() {
    const d = new Date();
    const day = d.getDay(); // 0=Sun, 1=Mon...
    const diff = day === 0 ? -6 : 1 - day; // go back to Monday
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }

  function minutesToPx(minutes) {
    return (minutes / 60) * PX_PER_HOUR;
  }

  function renderSchedule(blocks) {
    renderScheduleHeader();
    renderScheduleBody(blocks);
    renderScheduleStats(blocks);
  }

  function renderScheduleHeader() {
    if (!scheduleHeaderRow) return;
    const today = new Date();
    const startOfWeek = getStartOfWeek();

    scheduleHeaderRow.innerHTML = '';
    // Empty corner cell
    const corner = document.createElement('div');
    corner.className = 'schedule-header-empty';
    scheduleHeaderRow.appendChild(corner);

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const isToday = d.toDateString() === today.toDateString();

      const head = document.createElement('div');
      head.className = 'schedule-day-head';
      head.innerHTML = `
        <span class="day-name">${DAY_NAMES_SHORT[i]}</span>
        <span class="day-date${isToday ? ' today' : ''}">${d.getDate()}</span>`;
      scheduleHeaderRow.appendChild(head);
    }
  }

  function renderScheduleBody(blocks) {
    if (!scheduleBodyGrid) return;
    scheduleBodyGrid.innerHTML = '';

    const today = new Date();
    const todayColIndex = today.getDay() === 0 ? 6 : today.getDay() - 1; // Mon=0 ... Sun=6

    const totalHours = HOUR_END - HOUR_START;
    const totalPx    = totalHours * PX_PER_HOUR;

    // Time labels column
    const timeCol = document.createElement('div');
    timeCol.className = 'schedule-time-col';
    for (let h = HOUR_START; h <= HOUR_END; h++) {
      const slot = document.createElement('div');
      slot.className = 'time-slot';
      // Don't label the very last hour mark if it's just an end marker
      if (h < HOUR_END) {
        slot.textContent = h.toString().padStart(2, '0') + ':00';
      }
      timeCol.appendChild(slot);
    }
    scheduleBodyGrid.appendChild(timeCol);

    // 7 day columns
    // JS day mapping: col 0=Mon(JS1), col 1=Tue(JS2), ..., col 5=Sat(JS6), col 6=Sun(JS0)
    for (let col = 0; col < 7; col++) {
      const jsDay = col === 6 ? 0 : col + 1; // Convert col index to JS day (0=Sun)

      const dayCol = document.createElement('div');
      dayCol.className = 'schedule-day-col' + (col === todayColIndex ? ' is-today' : '');
      dayCol.style.height = `${totalPx + PX_PER_HOUR}px`; // extra row for bottom boundary

      // Render blocks for this day
      const dayBlocks = blocks.filter(b => b.days.includes(jsDay));
      dayBlocks.forEach(b => {
        const startMins = timeToMinutes(b.start);
        const endMins   = timeToMinutes(b.end);
        const offsetMins = startMins - (HOUR_START * 60);
        const durationMins = endMins - startMins;

        // Clamp to visible range
        if (offsetMins + durationMins <= 0 || offsetMins >= totalHours * 60) return;

        const topPx    = Math.max(0, minutesToPx(offsetMins));
        const heightPx = Math.max(22, minutesToPx(durationMins));

        const blockEl = document.createElement('div');
        blockEl.className = 'schedule-block';
        blockEl.style.top    = `${topPx}px`;
        blockEl.style.height = `${heightPx}px`;
        const modeLabel = b.siteMode === 'allow' ? '✦ Allow only'
          : b.siteMode === 'custom' ? '◈ Custom'
          : '◉ Global';
        blockEl.innerHTML = `
          <div class="block-title">${escapeHtml(b.title)}</div>
          <div class="block-time">${b.start}–${b.end}</div>
          <div class="block-mode-badge">${modeLabel}</div>
          <div class="block-actions">
            <button class="block-edit" data-id="${b.id}" title="Edit block">
              <span class="material-symbols-outlined" style="font-size:13px;pointer-events:none;">edit</span>
            </button>
            <button class="block-delete" data-id="${b.id}" title="Delete block">
              <span class="material-symbols-outlined" style="font-size:13px;pointer-events:none;">delete</span>
            </button>
          </div>`;
        dayCol.appendChild(blockEl);
      });

      scheduleBodyGrid.appendChild(dayCol);
    }

    // Attach delete listeners
    scheduleBodyGrid.querySelectorAll('.block-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const blockEl = btn.closest('.schedule-block');
        if (blockEl) {
          blockEl.style.transition = 'opacity 0.2s, transform 0.2s';
          blockEl.style.opacity = '0';
          blockEl.style.transform = 'scale(0.9)';
        }
        setTimeout(() => {
          chrome.storage.local.get(['scheduleBlocks'], (r) => {
            const newBlocks = (r.scheduleBlocks || []).filter(blk => blk.id !== id);
            chrome.storage.local.set({ scheduleBlocks: newBlocks }, () => {
              renderSchedule(newBlocks);
              chrome.storage.local.get(['scheduleActive', 'scheduleBlockId', 'blockedSites'], (rs) => {
                renderScheduledBlocksPanel(newBlocks, rs.scheduleActive || false, rs.scheduleBlockId || null, rs.blockedSites || []);
              });
            });
          });
        }, 200);
      });
    });

    // Attach edit listeners
    scheduleBodyGrid.querySelectorAll('.block-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        chrome.storage.local.get(['scheduleBlocks'], (r) => {
          const block = (r.scheduleBlocks || []).find(b => b.id === id);
          if (!block) return;
          openEditModal(block);
        });
      });
    });
  }

  function renderScheduleStats(blocks) {
    const weeklyIntensityEl = document.getElementById('weekly-intensity');
    const blockCountEl      = document.getElementById('block-count');
    const peakDayEl         = document.getElementById('peak-day');

    let totalMinutes = 0;
    const minutesPerDay = Array(7).fill(0); // index = JS day (0=Sun...6=Sat)

    blocks.forEach(b => {
      const startMins = timeToMinutes(b.start);
      const endMins   = timeToMinutes(b.end);
      const dur = Math.max(0, endMins - startMins);
      totalMinutes += dur * b.days.length;
      b.days.forEach(jsDay => { minutesPerDay[jsDay] += dur; });
    });

    if (weeklyIntensityEl) {
      const hrs  = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      weeklyIntensityEl.textContent = hrs > 0 ? `${hrs}h ${mins > 0 ? mins + 'm' : ''}` : `${mins}m`;
    }
    if (blockCountEl) blockCountEl.textContent = blocks.length;
    if (peakDayEl) {
      const maxMins = Math.max(...minutesPerDay);
      if (maxMins === 0) {
        peakDayEl.textContent = '—';
      } else {
        const jsDay = minutesPerDay.indexOf(maxMins);
        // Convert JS day to display name (0=Sun=col6, 1=Mon=col0...)
        const colNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
        const colIndex = jsDay === 0 ? 6 : jsDay - 1;
        peakDayEl.textContent = colNames[colIndex];
      }
    }
  }

  const bmCustomSitesWrap = document.getElementById('bm-custom-sites-wrap');
  const bmCustomSitesHint  = document.getElementById('bm-custom-sites-hint');
  const bmSiteRadios       = document.querySelectorAll('input[name="bm-site-mode"]');
  const bmModalTitle       = document.getElementById('bm-modal-title');

  // Toggle custom sites textarea & hint text based on selected radio
  function updateSiteMode() {
    const mode = document.querySelector('input[name="bm-site-mode"]:checked')?.value || 'global';
    document.querySelectorAll('.modal-radio-label').forEach(lbl => lbl.classList.remove('selected'));
    const checked = document.querySelector('input[name="bm-site-mode"]:checked');
    if (checked) checked.closest('.modal-radio-label').classList.add('selected');
    const needsList = mode === 'custom' || mode === 'allow';
    bmCustomSitesWrap.style.display = needsList ? '' : 'none';
    if (bmCustomSitesHint) {
      bmCustomSitesHint.textContent = mode === 'allow'
        ? 'Only these sites will be ALLOWED. Everything else is blocked. Separate with commas.'
        : 'Block ONLY these sites during this block. Separate with commas.';
    }
    const inp = document.getElementById('bm-custom-sites');
    if (inp) inp.placeholder = mode === 'allow'
      ? 'google.com, notion.so, docs.google.com'
      : 'facebook.com, reddit.com, twitter.com';
  }
  bmSiteRadios.forEach(r => r.addEventListener('change', updateSiteMode));

  function openEditModal(block) {
    editingBlockId = block.id;
    if (bmModalTitle) bmModalTitle.textContent = 'Edit Focus Block';
    document.getElementById('bm-title').value = block.title || '';
    // Set days
    dayBtns.forEach(b => {
      b.classList.toggle('active', (block.days || []).includes(parseInt(b.dataset.day, 10)));
    });
    document.getElementById('bm-start').value = block.start || '09:00';
    document.getElementById('bm-end').value   = block.end   || '11:00';
    // Set site mode
    const modeRadio = document.querySelector(`input[name="bm-site-mode"][value="${block.siteMode || 'global'}"]`);
    if (modeRadio) modeRadio.checked = true;
    // Set custom sites
    document.getElementById('bm-custom-sites').value = (block.customSites || []).join(', ');
    updateSiteMode();
    modalDaysError.classList.remove('visible');
    modalTimeError.classList.remove('visible');
    blockModal.classList.add('active');
    setTimeout(() => document.getElementById('bm-title').focus(), 100);
  }

  // ── Modal: Add Block ──
  addBlockBtn.addEventListener('click', () => {
    editingBlockId = null;
    if (bmModalTitle) bmModalTitle.textContent = 'Add Focus Block';
    document.getElementById('bm-title').value = '';
    dayBtns.forEach(b => b.classList.remove('active'));
    document.getElementById('bm-start').value = '09:00';
    document.getElementById('bm-end').value   = '11:00';
    const globalRadio = document.querySelector('input[name="bm-site-mode"][value="global"]');
    if (globalRadio) globalRadio.checked = true;
    document.getElementById('bm-custom-sites').value = '';
    updateSiteMode();
    modalDaysError.classList.remove('visible');
    modalTimeError.classList.remove('visible');
    blockModal.classList.add('active');
    setTimeout(() => document.getElementById('bm-title').focus(), 100);
  });

  bmCancel.addEventListener('click', () => blockModal.classList.remove('active'));

  blockModal.addEventListener('click', (e) => {
    if (e.target === blockModal) blockModal.classList.remove('active');
  });

  dayBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      modalDaysError.classList.remove('visible');
    });
  });

  bmSave.addEventListener('click', () => {
    const title = document.getElementById('bm-title').value.trim() || 'Focus Block';
    const start = document.getElementById('bm-start').value;
    const end   = document.getElementById('bm-end').value;
    const days  = Array.from(dayBtns)
      .filter(b => b.classList.contains('active'))
      .map(b => parseInt(b.dataset.day, 10));

    // Site mode
    const siteMode = document.querySelector('input[name="bm-site-mode"]:checked')?.value || 'global';
    const customSiteRaw = document.getElementById('bm-custom-sites')?.value || '';
    const customSites = customSiteRaw.split(',').map(s => s.trim().toLowerCase()
      .replace(/^https?:\/\//, '').replace(/\/.*/, '').replace(/^www\./, '')).filter(Boolean);

    let valid = true;
    if (days.length === 0) {
      modalDaysError.classList.add('visible');
      valid = false;
    } else {
      modalDaysError.classList.remove('visible');
    }
    if (!start || !end || timeToMinutes(start) >= timeToMinutes(end)) {
      modalTimeError.classList.add('visible');
      valid = false;
    } else {
      modalTimeError.classList.remove('visible');
    }
    if (!valid) return;

    const blockData = { title, start, end, days, siteMode,
      customSites: (siteMode === 'custom' || siteMode === 'allow') ? customSites : [] };

    chrome.storage.local.get(['scheduleBlocks', 'scheduleActive', 'scheduleBlockId', 'blockedSites'], (r) => {
      let blocks = r.scheduleBlocks || [];
      if (editingBlockId) {
        // Update existing block (preserve original id)
        blocks = blocks.map(b => b.id === editingBlockId ? { ...blockData, id: editingBlockId } : b);
      } else {
        // New block
        blocks.push({ ...blockData, id: Date.now().toString() });
      }
      chrome.storage.local.set({ scheduleBlocks: blocks }, () => {
        editingBlockId = null;
        renderSchedule(blocks);
        renderScheduledBlocksPanel(blocks, r.scheduleActive || false, r.scheduleBlockId || null, r.blockedSites || []);
        blockModal.classList.remove('active');
      });
    });
  });

  // ── Blocking Rules ──
  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function applyRules(sites, allowMode) {
    if (!chrome.declarativeNetRequest) return;
    const blockedUrl = chrome.runtime.getURL('blocked.html');
    const rules = [];

    if (allowMode) {
      // Catch-all: redirect to blocked.html so users see the proper blocked screen
      rules.push({
        id: 9999, priority: 1,
        action: { type: 'redirect', redirect: { url: blockedUrl + '?site=unlisted&whitelist=1' } },
        condition: { regexFilter: '^https?://.+', resourceTypes: ['main_frame'] }
      });
      rules.push({ id: 9998, priority: 2, action: { type: 'allow' },
        condition: { regexFilter: '^https?://([a-z0-9-]+\\.)*google\\.com(/|\\?)', resourceTypes: ['main_frame'] } });
      sites.forEach((site, i) => {
        rules.push({ id: 2000 + i, priority: 2, action: { type: 'allow' },
          condition: { regexFilter: '^https?://([a-z0-9-]+\\.)*' + escapeRegex(site) + '(/|\\?)', resourceTypes: ['main_frame'] } });
      });
      rules.push({ id: 3000, priority: 2, action: { type: 'allow' }, condition: { urlFilter: 'chrome://*', resourceTypes: ['main_frame'] } });
      rules.push({ id: 3001, priority: 2, action: { type: 'allow' }, condition: { urlFilter: 'chrome-extension://*', resourceTypes: ['main_frame'] } });
    } else {
      sites.forEach((site, i) => {
        rules.push({ id: 100 + i, priority: 1,
          action: { type: 'redirect', redirect: { url: blockedUrl + '?site=' + encodeURIComponent(site) } },
          condition: { regexFilter: '^https?://([a-z0-9-]+\\.)*' + escapeRegex(site) + '(/|\\?)', resourceTypes: ['main_frame'] } });
      });
    }

    chrome.declarativeNetRequest.getDynamicRules((existing) => {
      const removeIds = existing.map(r => r.id);
      chrome.declarativeNetRequest.updateDynamicRules(
        { addRules: rules, removeRuleIds: removeIds },
        () => { if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError.message); }
      );
    });
  }

  function removeRules() {
    if (!chrome.declarativeNetRequest) return;
    chrome.declarativeNetRequest.getDynamicRules((existing) => {
      const ids = existing.map(r => r.id);
      if (ids.length > 0) chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ids });
    });
  }

  // ════════════════════════════════════════════════
  // ── Insights Engine ──
  // ════════════════════════════════════════════════

  const SITE_CATEGORIES = {
    'Social Media':    /facebook|instagram|twitter|tiktok|snapchat|reddit|linkedin|x\.com|threads/,
    'Video Streaming': /youtube|netflix|hulu|twitch|disney|vimeo|peacock|primevideo/,
    'News & Blogs':    /nytimes|bbc|cnn|medium|substack|theguardian|washingtonpost|news/,
    'Shopping':        /amazon|ebay|etsy|aliexpress|walmart|target|shopify/,
    'Gaming':          /steam|epicgames|roblox|minecraft/,
  };

  function categorizeSite(domain) {
    const d = (domain || '').toLowerCase();
    for (const [cat, rx] of Object.entries(SITE_CATEGORIES)) { if (rx.test(d)) return cat; }
    return 'Other';
  }

  function formatTimestamp(ts) {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const h = d.getHours().toString().padStart(2,'0');
    const m = d.getMinutes().toString().padStart(2,'0');
    return isToday ? `${h}:${m} Today` : d.toLocaleDateString('en-AU',{month:'short',day:'numeric'});
  }

  function renderInsights() {
    chrome.storage.local.get(
      ['focusMinutes','sessions','blockedAttempts','interceptionLog'],
      (r) => {
        const focusMins = Math.floor(r.focusMinutes || 0);
        const attempts  = r.blockedAttempts || 0;
        const log       = r.interceptionLog || [];
        const sessions  = r.sessions || 0;

        const el = id => document.getElementById(id);
        if (el('insights-total-hours')) el('insights-total-hours').textContent = (focusMins / 60).toFixed(1) + ' hrs';
        if (el('insights-attempts'))    el('insights-attempts').textContent = attempts.toLocaleString();

        const score = attempts === 0 ? (sessions > 0 ? 95 : 0)
          : Math.min(99, Math.round(100 - (attempts / Math.max(1, attempts + sessions * 5)) * 100));
        if (el('insights-score')) el('insights-score').textContent = score + '%';

        renderFocusChart(r);
        renderTopDistractions(log);
        renderInterceptionLog(log);
      }
    );
  }

  function renderFocusChart(r) {
    const svg = document.getElementById('focus-chart-svg');
    if (!svg) return;

    const now = new Date();
    const dayData = Array(7).fill(0);
    const log = r.interceptionLog || [];

    // Credit focus minutes to today
    dayData[6] = Math.min(100, ((r.focusMinutes || 0) / 60) * 15);

    // Aggregate interceptions per day
    log.forEach(entry => {
      const diffDays = Math.floor((now - new Date(entry.timestamp)) / 86400000);
      if (diffDays >= 0 && diffDays < 7) dayData[6 - diffDays] = Math.min(100, dayData[6 - diffDays] + 7);
    });

    const hasData = dayData.some(v => v > 0);
    const values = hasData ? dayData : [18, 32, 24, 50, 42, 68, 58];

    const W = 560, H = 160, PAD = 16;
    const maxV = Math.max(...values, 1);
    const pts = values.map((v, i) => [PAD + (i / 6) * (W - PAD * 2), H - PAD - (v / maxV) * (H - PAD * 2)]);

    let path = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const cx = (pts[i][0] + pts[i+1][0]) / 2;
      path += ` C ${cx} ${pts[i][1]}, ${cx} ${pts[i+1][1]}, ${pts[i+1][0]} ${pts[i+1][1]}`;
    }
    const areaPath = path + ` L ${pts[pts.length-1][0]} ${H} L ${pts[0][0]} ${H} Z`;

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = `
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#45645E" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="#45645E" stop-opacity="0.01"/>
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#chartGrad)"/>
      <path d="${path}" fill="none" stroke="#45645E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${pts.map(([x,y],i) => i===pts.length-1 ? `<circle cx="${x}" cy="${y}" r="4" fill="#45645E" stroke="white" stroke-width="2"/>` : '').join('')}
    `;
  }

  function renderTopDistractions(log) {
    const listEl = document.getElementById('distraction-list');
    if (!listEl) return;

    const catCounts = {};
    log.forEach(e => {
      const cat = e.category || categorizeSite(e.site);
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });

    const hasData = Object.keys(catCounts).length > 0;
    const displayData = hasData ? catCounts
      : { 'Social Media': 0, 'Video Streaming': 0, 'News & Blogs': 0, 'Shopping': 0 };

    const sorted = Object.entries(displayData).sort((a,b) => b[1]-a[1]);
    const total = sorted.reduce((s,[,v]) => s+v, 0) || 1;

    listEl.innerHTML = sorted.slice(0,5).map(([cat, count]) => {
      const pct = Math.round((count / total) * 100);
      return `
        <div class="distraction-row">
          <div class="distraction-top">
            <span class="distraction-cat">${escapeHtml(cat)}</span>
            <span class="distraction-pct">${hasData ? pct+'%' : '—'}</span>
          </div>
          <div class="distraction-bar-bg">
            <div class="distraction-bar-fill" style="width:${hasData ? pct : 0}%"></div>
          </div>
        </div>`;
    }).join('');

    const insightEl = document.getElementById('distraction-insight');
    if (insightEl && hasData && log.length > 0) {
      const hourCounts = Array(24).fill(0);
      log.forEach(e => { hourCounts[new Date(e.timestamp).getHours()]++; });
      const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
      const ampm = peakHour < 12 ? 'AM' : 'PM';
      const displayHour = peakHour === 0 ? 12 : peakHour > 12 ? peakHour - 12 : peakHour;
      insightEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:15px;flex-shrink:0">schedule</span>
        You are most prone to distractions around <strong>${displayHour}:00 ${ampm}</strong>.`;
      insightEl.style.display = 'flex';
    } else if (insightEl) { insightEl.style.display = 'none'; }
  }

  function renderInterceptionLog(log) {
    const tbody = document.getElementById('log-table-body');
    if (!tbody) return;

    if (log.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="log-empty">No interceptions logged yet. Blocked sites will appear here.</td></tr>`;
      return;
    }

    const CAT_COLORS = {
      'Social Media':'#E8604C','Video Streaming':'#E87A4C','News & Blogs':'#4C8DE8',
      'Shopping':'#9B4CE8','Gaming':'#4CAE6B','Other':'#9CA3A0'
    };
    const TIME_SAVED = {
      'Social Media':'15m','Video Streaming':'45m','News & Blogs':'10m',
      'Shopping':'20m','Gaming':'30m','Other':'5m'
    };

    tbody.innerHTML = log.slice(0,60).map(entry => {
      const cat = entry.category || categorizeSite(entry.site);
      const color = CAT_COLORS[cat] || '#9CA3A0';
      const saved = TIME_SAVED[cat] || '5m';
      const favicon = `https://www.google.com/s2/favicons?domain=${entry.site}&sz=32`;
      return `<tr>
        <td>
          <div class="log-source">
            <div class="log-favicon">
              <img src="${favicon}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
              <div class="log-favicon-fallback" style="display:none">${escapeHtml((entry.site||'?').charAt(0).toUpperCase())}</div>
            </div>
            <span class="log-domain">${escapeHtml(entry.site)}</span>
          </div>
        </td>
        <td><span class="log-cat-badge" style="background:${color}20;color:${color}">${escapeHtml(cat)}</span></td>
        <td class="log-time">${formatTimestamp(entry.timestamp)}</td>
        <td><span class="log-saved-badge">${saved} Saved</span></td>
      </tr>`;
    }).join('');
  }

  // Refresh insights when the tab is clicked
  sidebarLinks.forEach(link => {
    if (link.dataset.section === 'insights') {
      link.addEventListener('click', () => setTimeout(renderInsights, 50));
    }
  });

  // CSV download
  const downloadCsvBtn = document.getElementById('download-csv-btn');
  if (downloadCsvBtn) {
    downloadCsvBtn.addEventListener('click', () => {
      chrome.storage.local.get(['interceptionLog'], (r) => {
        const log = r.interceptionLog || [];
        const rows = [['Site','Category','Timestamp']]
          .concat(log.map(e => [e.site, e.category, new Date(e.timestamp).toISOString()]));
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'blockguard-log.csv'; a.click();
        URL.revokeObjectURL(url);
      });
    });
  }

  // ════════════════════════════════════════════════
  // ── Scheduled Blocks Panel (Block List tab) ──
  // ════════════════════════════════════════════════

  const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function renderScheduledBlocksPanel(blocks, scheduleActive, scheduleBlockId, globalSites) {
    const panel = document.getElementById('scheduled-blocks-panel');
    if (!panel) return;

    if (blocks.length === 0) {
      panel.innerHTML = `
        <div class="domains-header">
          <span class="domains-header-label">Scheduled Blocks</span>
          <span class="domains-header-count">0 Blocks</span>
        </div>
        <div class="domains-empty" style="padding:32px 20px">
          <span class="material-symbols-outlined">calendar_month</span>
          <p>No focus blocks scheduled yet.<br>Go to <strong>Schedule</strong> to add one.</p>
        </div>`;
      return;
    }

    const now = new Date();
    const nowTotal = now.getHours() * 60 + now.getMinutes();
    const todayJs  = now.getDay();

    panel.innerHTML = `
      <div class="domains-header">
        <span class="domains-header-label">Scheduled Blocks</span>
        <span class="domains-header-count">${blocks.length} Block${blocks.length !== 1 ? 's' : ''}</span>
      </div>`;

    blocks.forEach(block => {
      // Is this block currently active?
      const isNowActive = scheduleActive && scheduleBlockId === block.id;
      // Is this block running today (even if not right now)?
      const runsToday = block.days.includes(todayJs);
      // Is the time window currently in range?
      const [sh, sm] = (block.start || '00:00').split(':').map(Number);
      const [eh, em] = (block.end   || '00:00').split(':').map(Number);
      const inWindow = runsToday && nowTotal >= sh * 60 + sm && nowTotal < eh * 60 + em;

      // Determine what sites this block targets
      let sitesHtml = '';
      if (block.siteMode === 'global') {
        if (globalSites.length === 0) {
          sitesHtml = `<span class="sb-no-sites">No sites in global block list</span>`;
        } else {
          sitesHtml = globalSites.slice(0, 6).map(s =>
            `<span class="sb-site-chip">${escapeHtml(s)}</span>`).join('');
          if (globalSites.length > 6) sitesHtml += `<span class="sb-site-chip sb-more">+${globalSites.length - 6} more</span>`;
        }
      } else {
        const sites = block.customSites || [];
        if (sites.length === 0) {
          sitesHtml = `<span class="sb-no-sites">No sites specified</span>`;
        } else {
          sitesHtml = sites.slice(0, 6).map(s =>
            `<span class="sb-site-chip">${escapeHtml(s)}</span>`).join('');
          if (sites.length > 6) sitesHtml += `<span class="sb-site-chip sb-more">+${sites.length - 6} more</span>`;
        }
      }

      const modeIcon  = block.siteMode === 'allow' ? 'verified_user'
        : block.siteMode === 'custom' ? 'list' : 'block';
      const modeLabel = block.siteMode === 'allow' ? 'Allow only'
        : block.siteMode === 'custom' ? 'Block specific' : 'Global list';
      const daysLabel = block.days.length === 7 ? 'Every day'
        : block.days.length === 5 && !block.days.includes(0) && !block.days.includes(6) ? 'Weekdays'
        : block.days.map(d => DAY_SHORT[d]).join(', ');

      const card = document.createElement('div');
      card.className = 'sb-card' + (isNowActive ? ' sb-card-active' : '');
      card.innerHTML = `
        <div class="sb-card-header">
          <div class="sb-card-title-row">
            <span class="sb-card-title">${escapeHtml(block.title || 'Focus Block')}</span>
            ${isNowActive ? '<span class="sb-active-badge"><span class="sb-active-dot"></span>Active now</span>' : ''}
          </div>
          <div class="sb-card-meta">
            <span class="material-symbols-outlined" style="font-size:13px">schedule</span>
            ${escapeHtml(block.start)}–${escapeHtml(block.end)}
            &nbsp;·&nbsp;
            <span class="material-symbols-outlined" style="font-size:13px">calendar_today</span>
            ${escapeHtml(daysLabel)}
          </div>
        </div>
        <div class="sb-card-mode">
          <span class="material-symbols-outlined" style="font-size:14px">${modeIcon}</span>
          <span>${modeLabel}</span>
        </div>
        <div class="sb-sites-row">${sitesHtml}</div>
        <div class="sb-card-foot">
          <button class="sb-edit-btn" data-id="${block.id}">
            <span class="material-symbols-outlined" style="font-size:14px">edit</span> Edit
          </button>
          <button class="sb-del-btn" data-id="${block.id}">
            <span class="material-symbols-outlined" style="font-size:14px">delete</span> Remove
          </button>
        </div>`;
      panel.appendChild(card);
    });

    // Wire buttons
    panel.querySelectorAll('.sb-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        chrome.storage.local.get(['scheduleBlocks'], (r) => {
          const block = (r.scheduleBlocks || []).find(b => b.id === btn.dataset.id);
          if (block) openEditModal(block);
        });
      });
    });
    panel.querySelectorAll('.sb-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        chrome.storage.local.get(['scheduleBlocks', 'scheduleActive', 'scheduleBlockId', 'blockedSites'], (r) => {
          const newBlocks = (r.scheduleBlocks || []).filter(b => b.id !== btn.dataset.id);
          chrome.storage.local.set({ scheduleBlocks: newBlocks }, () => {
            renderSchedule(newBlocks);
            renderScheduledBlocksPanel(newBlocks, r.scheduleActive || false, r.scheduleBlockId || null, r.blockedSites || []);
          });
        });
      });
    });
  }

  init();
});
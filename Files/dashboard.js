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
  const exportBtn     = document.getElementById('export-btn');
  const importBtn     = document.getElementById('import-btn');
  const sidebarLinks  = document.querySelectorAll('.sidebar-nav li a');
  const pages         = document.querySelectorAll('.dash-page');

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

  // Track which block is being edited (null = creating new)
  let editingBlockId = null;

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
      }
    });
  });

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
  });

  // ── Init ──
  function init() {
    chrome.storage.local.get(
      ['blockedSites', 'allowListMode', 'focusMinutes', 'sessions', 'active',
       'blockedAttempts', 'focusStart', 'scheduleBlocks', 'scheduleActive', 'scheduleBlockId'],
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

        if (isActive) {
          focusBtn.textContent = 'End Focus Session';
          focusBtn.style.background = 'linear-gradient(135deg, #9c4141, #c0524e)';
          focusBtn.style.boxShadow = '0 4px 16px rgba(156, 65, 65, 0.25)';
        }
      }
    );
  }

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

  // ── Focus Session ──
  focusBtn.addEventListener('click', () => {
    chrome.storage.local.get(['active', 'focusMinutes', 'sessions', 'focusStart'], (data) => {
      if (data.active) {
        const elapsed = Math.max(0, (Date.now() - (data.focusStart || Date.now())) / 60000);
        const total = (data.focusMinutes || 0) + elapsed;
        chrome.storage.local.set({ active: false, focusMinutes: total, focusStart: null, focusDuration: null }, () => {
          focusBtn.textContent = 'Start Focus Session';
          focusBtn.style.background = '';
          focusBtn.style.boxShadow = '';
          updateFooter(null, Math.floor(total), false, null);
          removeRules();
        });
      } else {
        chrome.storage.local.set({ active: true, focusStart: Date.now(), sessions: (data.sessions || 0) + 1 }, () => {
          focusBtn.textContent = 'End Focus Session';
          focusBtn.style.background = 'linear-gradient(135deg, #9c4141, #c0524e)';
          focusBtn.style.boxShadow = '0 4px 16px rgba(156, 65, 65, 0.25)';
          chrome.storage.local.get(['blockedSites', 'allowListMode'], (r) => {
            applyRules(r.blockedSites || [], r.allowListMode || false);
          });
        });
      }
    });
  });

  // ── Export / Import ──
  exportBtn.addEventListener('click', () => {
    chrome.storage.local.get(['blockedSites', 'allowListMode', 'scheduleBlocks'], (result) => {
      const data = JSON.stringify({
        blockedSites: result.blockedSites || [],
        allowListMode: result.allowListMode || false,
        scheduleBlocks: result.scheduleBlocks || []
      }, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'blockguard-export.json'; a.click();
      URL.revokeObjectURL(url);
    });
  });

  importBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.blockedSites && Array.isArray(data.blockedSites)) {
            chrome.storage.local.get(['blockedSites'], (result) => {
              const merged = [...new Set([...(result.blockedSites || []), ...data.blockedSites])];
              const toSave = { blockedSites: merged, allowListMode: data.allowListMode || false };
              if (data.scheduleBlocks) toSave.scheduleBlocks = data.scheduleBlocks;
              chrome.storage.local.set(toSave, () => {
                renderDomains(merged);
                setWhitelistUI(data.allowListMode || false);
                updateFooter(merged.length, null, null, null);
                if (data.scheduleBlocks) renderSchedule(data.scheduleBlocks);
              });
            });
          }
        } catch (err) { console.error('Invalid import', err); }
      };
      reader.readAsText(file);
    });
    input.click();
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
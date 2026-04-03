const MASTER_ENGINE_URL = "https://script.google.com/macros/s/AKfycbxmP0JWumHog423X-Dq8ZIEYtDoJagl2YCOAd1Lse2I4tyX8mzl2mytkI8Z9uj37OeX/exec";
const urlParams = new URLSearchParams(window.location.search);
const userUUID = urlParams.get('uuid');
const userName = urlParams.get('name');

let radarOffset = 0;
let contactsOffset = 0;
let hasMoreRadar = true;
let hasMoreContacts = true;
let isLoadingRadar = false;
let isLoadingContacts = false;
let isSyncing = false;
let searchTimeout;
let refreshInterval;
let appSettings = { radar_scan_freq: 10 };

async function initHUD() {
    // Setup Intersection Observer for Infinite Scroll
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (entry.target.id === "radarSentinel" && hasMoreRadar && !isLoadingRadar) fetchNextPage("radar");
                if (entry.target.id === "contactsSentinel" && hasMoreContacts && !isLoadingContacts) fetchNextPage("contacts");
            }
        });
    }, { rootMargin: '100px' });

    observer.observe(document.getElementById('radarSentinel'));
    observer.observe(document.getElementById('contactsSentinel'));

    const hash = window.location.hash.replace('#', '') || 'radar';
    showTab(hash, false);

    if (!refreshInterval) refreshInterval = setInterval(() => checkStatus(false), 15000);
}

// Listen for back/forward buttons
window.onhashchange = () => {
    const hash = window.location.hash.replace('#', '');
    if (hash) showTab(hash, false);
};

async function checkStatus(isManual = false) {
    if (isSyncing) return;
    isSyncing = true;

    const activeView = document.querySelector('.view.active');
    let tabType = "radar";
    if (activeView.id === "contactsTab") tabType = "contacts";
    if (activeView.id === "settingsTab") { isSyncing = false; return; }

    try {
        if (isManual) { 
            if (tabType === "radar") { radarOffset = 0; hasMoreRadar = true; document.getElementById('radarList').innerHTML = ""; }
            if (tabType === "contacts") { contactsOffset = 0; hasMoreContacts = true; document.getElementById('contactsList').innerHTML = ""; }
            await fetchNextPage(tabType, false);
        } else {
            await fetchNextPage(tabType, true); // SMART SYNC
        }
    } catch (err) {
        console.error(err);
        showErrorInRadar("Connectivity Error: Could not reach Master Engine.");
    } finally {
        isSyncing = false;
    }
}

async function fetchNextPage(type, isSync = false) {
    if (type === "radar" && !isSync && (isLoadingRadar || (!hasMoreRadar))) return;
    if (type === "contacts" && !isSync && (isLoadingContacts || (!hasMoreContacts))) return;

    if (type === "radar") isLoadingRadar = true;
    if (type === "contacts") isLoadingContacts = true;

    const offset = isSync ? 0 : (type === "radar" ? radarOffset : contactsOffset);
    const statusText = document.getElementById('syncText');
    if (isSync) statusText.innerText = "Syncing " + type.charAt(0).toUpperCase() + type.slice(1) + "...";

    let url = `${MASTER_ENGINE_URL}?action=get_data&uuid=${userUUID}&type=${type}&offset=${offset}&limit=10`;
    
    if (type === "radar") {
        const search = document.getElementById('radarSearchInput').value;
        const date = document.getElementById('radarDateInput').value;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (date) url += `&date=${date}`;
    }

    try {
        const response = await fetch(url);
        const result = await response.json();

        if (result.status === "success") {
            if (type === "radar") {
                const items = result.data.radar || [];
                const contacts = result.data.contacts || [];
                if (isSync) renderRadarItemsSmart(items, result.server_time, result.settings?.radar_scan_freq || 10, contacts);
                else { 
                    renderRadarList(items, result.requested_date, result.server_time, result.settings?.radar_scan_freq || 10, contacts, true);
                    radarOffset += items.length;
                }
                hasMoreRadar = result.has_more_radar;
                appSettings = result.settings || appSettings;
            } else if (type === "contacts") {
                renderContacts(result.data.contacts || [], !isSync);
                if (!isSync) contactsOffset += (result.data.contacts || []).length;
                hasMoreContacts = result.has_more_contacts;
            }
            updateSyncTime();
            if (document.querySelector('.view.active').id === 'loadingView') showTab('radar', false);
        }
    } finally {
        if (type === "radar") isLoadingRadar = false;
        if (type === "contacts") isLoadingContacts = false;
    }
}

function showErrorInRadar(msg) {
    const list = document.getElementById('radarList');
    if (list) {
        list.innerHTML = `
            <div style="padding:40px 20px; text-align:center; color:#ef4444;">
                <div style="font-size:32px; margin-bottom:15px;">⚠️</div>
                <div style="font-weight:bold; margin-bottom:8px; color:#fff;">Connection Lost</div>
                <div style="font-size:12px; color:#71717a; line-height:1.5;">${msg}</div>
                <button class="btn" style="margin-top:20px; padding:8px 20px; font-size:11px;" onclick="checkStatus(true)">Try Reconnect</button>
            </div>
        `;
    }
    const statusEl = document.getElementById('syncText');
    if (statusEl) statusEl.innerText = "Status: Sync Error";

    // If we're on the loading screen, jump to radar to show the error
    const currentView = document.querySelector('.view.active');
    if (currentView.id === 'loadingView') showTab('radar');
}

function updateSyncTime() {
    const el = document.getElementById('syncText');
    if (el) el.innerText = "Data Synced: " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.add('active');
        document.getElementById('mainNav').style.display = target.classList.contains('dashboard-tab') ? 'block' : 'none';
    }
}

function showTab(tabName, updateHash = true) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.innerText.toLowerCase() === tabName));
    showView(tabName + 'Tab');
    if (updateHash) window.location.hash = tabName;
    
    // Lazy Load: Only fetch data if the list is empty
    if (tabName === 'radar' && document.getElementById('radarList').children.length === 0) fetchNextPage('radar');
    if (tabName === 'contacts' && document.getElementById('contactsList').children.length === 0) fetchNextPage('contacts');
}

function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => checkStatus(true), 500);
}

function resetRadarFilters() {
    document.getElementById('radarSearchInput').value = "";
    document.getElementById('radarDateInput').value = "";
    checkStatus(true);
}

async function saveSettings() {
    const freq = document.getElementById('scanFreqInput').value;
    const statusText = document.getElementById('syncText');
    statusText.innerText = "Saving Settings...";
    
    try {
        const response = await fetch(`${MASTER_ENGINE_URL}?action=update_settings&uuid=${userUUID}&radar_scan_freq=${freq}`);
        const result = await response.json();
        if (result.status === "success") {
            statusText.innerText = "Settings Saved!";
            updateSyncTime();
            appSettings.radar_scan_freq = parseInt(freq);
        }
    } catch (err) {
        console.error(err);
        statusText.innerText = "Error Saving!";
    }
}

function renderRadarList(items, dateShown, serverTime, scanFreq, contacts, append = false) {
    const list = document.getElementById('radarList');
    const summary = `<div id="radarSummary" style="font-size:11px; color:#71717a; margin-bottom:15px; border-bottom:1px solid #27272a; padding-bottom:10px;">Showing history for: <b style="color:#38bdf8">${dateShown}</b></div>`;

    if (!append && items.length === 0) {
        list.innerHTML = summary + `<div style="padding:40px; text-align:center; color:#71717a;">No records found.</div>`;
        return;
    } else if (!append) {
        list.innerHTML = summary;
    }

    items.forEach(p => {
        const html = getRadarItemHtml(p, serverTime, scanFreq, contacts);
        list.insertAdjacentHTML('beforeend', html);
    });
}

function renderRadarItemsSmart(items, serverTime, scanFreq, contacts) {
    const list = document.getElementById('radarList');
    const summary = document.getElementById('radarSummary');
    
    // Loop backwards to prepend in reverse order (so newest is top)
    for (let i = items.length - 1; i >= 0; i--) {
        const p = items[i];
        const existing = document.querySelector(`.item[data-uuid="${p.key}"]`);
        const html = getRadarItemHtml(p, serverTime, scanFreq, contacts);

        if (existing) {
            // Update in place (Patching)
            existing.outerHTML = html;
        } else {
            // Prepend New Entry
            if (summary) {
                summary.insertAdjacentHTML('afterend', html);
            } else {
                list.insertAdjacentHTML('afterbegin', html);
            }
        }
    }
}

function getRadarItemHtml(p, serverTime, scanFreq, contacts) {
    const formatTime = (ts) => ts ? new Date(ts).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Los_Angeles'
    }) : "??:??";
    const first = formatTime(p.first_seen);
    const last = formatTime(p.last_seen);
    const lastTs = new Date(p.last_seen).getTime();
    const serverTs = new Date(serverTime).getTime();

    const isLive = (serverTs - lastTs) < ((scanFreq + 10) * 1000);
    const nameColor = isLive ? "#22c55e" : "#fff"; 
    const rowDate = p.date ? new Date(p.date + "T00:00:00Z").toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : "";
    const location = p.last_sim && p.last_sim !== "Unknown" ? ` in ${p.last_sim}` : "";

    const isContact = contacts.some(c => c.key === p.key);
    const contactIcon = isContact ? "🗑️" : "➕";
    const contactTitle = isContact ? "Remove Contact" : "Add Contact";

    return `
    <div class="item" data-uuid="${p.key}">
        <div class="item-info">
            <div class="item-name" style="color:${nameColor}">${p.name}</div>
            <div class="item-meta">${rowDate} | ${first} - ${last}${location}</div>
        </div>
        <div class="item-actions">
            <button class="action-icon" onclick="openLink('about','${p.key}')">👤</button>
            <button class="action-icon add-btn" title="${contactTitle}" onclick="handleToggleContact('${p.key}', '${p.name}', this)">${contactIcon}</button>
        </div>
    </div>`;
}

async function handleToggleContact(targetUuid, targetName, btn) {
    const originalIcon = btn.innerText;
    btn.innerText = "⏳";
    btn.style.opacity = "0.5";

    try {
        const fd = new FormData();
        fd.append('action', 'toggle_contact');
        fd.append('uuid', userUUID);
        fd.append('target_uuid', targetUuid);
        fd.append('target_name', targetName);

        const res = await fetch(MASTER_ENGINE_URL, { method: 'POST', body: fd });
        const result = await res.json();

        if (result.status === "success") {
            btn.innerText = result.state === "added" ? "🗑️" : "➕";
            btn.title = result.state === "added" ? "Remove Contact" : "Add Contact";
            // Silently refresh to update the Contacts tab in the background
            checkStatus(false);
        } else {
            btn.innerText = originalIcon;
            alert("Error: " + result.message);
        }
    } catch (err) {
        btn.innerText = originalIcon;
        console.error(err);
    } finally {
        btn.style.opacity = "1";
    }
}

function renderContacts(items, append = false) {
    const list = document.getElementById('contactsList');
    if (!append && items.length === 0) {
        list.innerHTML = `<div style="padding:40px; text-align:center; color:#71717a;">No contacts saved.</div>`;
        return;
    }
    const html = items.map(c => `
        <div class="item">
            <div class="item-info">
                <div class="item-name">${c.name}</div>
                <div class="item-meta">${c.notes || "No notes."}</div>
            </div>
            <div class="item-actions">
                <button class="action-icon add-btn" onclick="handleToggleContact('${c.key}', '${c.name}', this)">🗑️</button>
            </div>
        </div>
    `).join('');

    if (append) list.insertAdjacentHTML('beforeend', html);
    else list.innerHTML = html;
}

window.onload = () => {
    if (userUUID) initHUD();
    else document.getElementById('loadingView').innerHTML = `<div style="text-align:center; padding:50px; color:#ef4444;">Please run this HUD from Second Life.</div>`;
};

function openLink(type, uuid) {
    window.location.href = `secondlife:///app/agent/${uuid}/${type}`;
}

async function handleRegister() {
    const sheetUrl = document.getElementById('sheetUrlInput').value;
    if (!sheetUrl) return;
    const btn = document.getElementById('registerBtn');
    const status = document.getElementById('setupStatus');

    btn.disabled = true;
    status.innerText = "Syncing Database Architecture...";

    try {
        const fd = new FormData();
        fd.append('action', 'register'); fd.append('uuid', userUUID); fd.append('name', userName); fd.append('sheetUrl', sheetUrl);
        const res = await fetch(MASTER_ENGINE_URL, { method: 'POST', body: fd });
        const result = await res.json();
        if (result.status === "success") {
            status.innerText = "Success! Initializing Radar...";
            setTimeout(initHUD, 1000);
        } else throw new Error(result.message);
    } catch (err) {
        status.innerText = "Error: " + err.message;
        btn.disabled = false;
    }
}
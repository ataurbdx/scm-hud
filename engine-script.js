// ==========================================
// SCM HUD - MASTER ENGINE (SaaS CRM BACKEND)
// ==========================================
/**
 * Version: 2.0 (Smart Migration & Data-Safe Mapping)
 * This script handles multi-tenant CRM storage for Second Life HUDs.
 */

const MASTER_REGISTRY_NAME = "Master_Registry";
const SL_TZ = "America/Los_Angeles"; // Second Life Standard Time (PST/PDT)

// 1. MASTER SCHEMA (Blueprint) - Optimized Header/Detail Architecture
const CRM_SCHEMA = {
    "Users": [
        "user_uuid", "user_name", "theme", "transparency", "scale",
        "shared_status", "history_status", "history_clean_freq",
        "radar_scan_freq", "created_at", "updated_at"
    ],
    "Categories": ["owner_uuid", "cat_id", "cat_name", "cat_color", "cat_icon", "created_at"],
    "Tags": ["owner_uuid", "tag_id", "tag_name", "tag_color", "tag_icon", "created_at"],
    "Contacts": ["owner_uuid", "contact_uuid", "contact_name", "cat_ids", "tag_ids", "notes", "created_at"],
    "History": [
        "date", "target_name", "summary_id", "owner_uuid",
        "target_uuid", "total_scans", "is_protected"
    ],
    "Encounters": [
        "summary_id", "first_seen", "last_seen", "dist",
        "sim_name", "sim_pos", "parcel_name"
    ]
};

// 2. SAFE DELETE LIST (Columns removed from here will be deleted from all user sheets)
const COLUMNS_TO_DELETE = ["old_unused_col", "test_garbage"];

function doPost(e) { return handleRequest(e); }
function doGet(e) { return handleRequest(e); }

function handleRequest(e) {
    try {
        // Support both URL parameters and POST body
        const params = e.parameter || {};
        const postData = (e.postData && e.postData.contents) ? e.postData.contents : "";

        // Manual parse for POST if needed
        let dataMap = params;
        if (postData && !dataMap.action) {
            postData.split('&').forEach(part => {
                const pair = part.split('=');
                dataMap[pair[0]] = decodeURIComponent(pair[1]);
            });
        }

        const action = dataMap.action;
        const uuid = dataMap.uuid || dataMap.owner;
        const name = dataMap.name || "Unknown";

        if (!uuid) return jsonResponse({ status: "error", message: "Missing UUID." });
        if (action === "register") return registerUser(uuid, name, dataMap.sheetUrl);

        const sheetId = getUserSheetId(uuid);
        if (!sheetId) return jsonResponse({ status: "unregistered" });

        if (action === "get_data") return getAvatarData(uuid, name, dataMap.date, sheetId, dataMap.type || "all", dataMap.limit || 10, dataMap.offset || 0);
        if (action === "bulk_log") {
            const ss = SpreadsheetApp.openById(sheetId);
            syncDatabase(ss);
            bulkLogData(ss, uuid, dataMap.data);
            
            // Return settings to HUD so it can sync frequency
            const uTab = ss.getSheetByName("Users");
            const uMap = getHeaderMap(uTab);
            const uData = uTab.getDataRange().getValues();
            let scanFreq = 10;
            for (let i = 1; i < uData.length; i++) {
                if (uData[i][uMap["user_uuid"] - 1] == uuid) {
                    scanFreq = uData[i][uMap["radar_scan_freq"] - 1] || 10;
                    break;
                }
            }
            return jsonResponse({ status: "success", radar_scan_freq: scanFreq });
        }
        if (action === "sync_user") return syncUser(uuid, name);
        if (action === "toggle_contact") {
            const ss = SpreadsheetApp.openById(sheetId);
            return toggleContact(ss, uuid, dataMap.target_uuid, dataMap.target_name);
        }
        if (action === "update_settings") {
            const ss = SpreadsheetApp.openById(sheetId);
            syncDatabase(ss);
            return updateSettings(ss, uuid, dataMap.radar_scan_freq);
        }

        throw new Error("Invalid Action: " + action);
    } catch (error) {
        console.error("Critical Engine Error: " + error.toString());
        return jsonResponse({ status: "error", message: "Engine Failure: " + error.toString() });
    }
}

// ---------------------------------------------------------
// REGISTRATION & HUD ATTACH SYNC
// ---------------------------------------------------------

function registerUser(uuid, name, sheetUrl) {
    const sheetId = extractSheetId(sheetUrl);
    const ss = SpreadsheetApp.openById(sheetId);
    if (!ss) throw new Error("Access Denied. Share with service email!");

    syncDatabase(ss);

    const uTab = ss.getSheetByName("Users");
    const uMap = getHeaderMap(uTab);
    const uData = uTab.getDataRange().getValues();

    let exists = false;
    for (let i = 1; i < uData.length; i++) { if (uData[i][uMap["user_uuid"] - 1] == uuid) { exists = true; break; } }

    if (!exists) {
        const row = new Array(uTab.getLastColumn()).fill("");
        row[uMap["user_uuid"] - 1] = uuid;
        row[uMap["user_name"] - 1] = name || "Unknown";
        row[uMap["theme"] - 1] = "Blue"; // Default Theme
        row[uMap["transparency"] - 1] = 0.8; // Default Glass
        row[uMap["scale"] - 1] = 1.0;
        row[uMap["shared_status"] - 1] = 0;
        row[uMap["history_status"] - 1] = 1;
        row[uMap["history_clean_freq"] - 1] = 30;
        row[uMap["radar_scan_freq"] - 1] = 10;
        row[uMap["created_at"] - 1] = new Date();
        row[uMap["updated_at"] - 1] = new Date();
        uTab.appendRow(row);
    }

    // Registry Update
    const master = SpreadsheetApp.getActiveSpreadsheet();
    let reg = master.getSheetByName(MASTER_REGISTRY_NAME) || master.insertSheet(MASTER_REGISTRY_NAME);
    if (reg.getLastRow() === 0) {
        reg.appendRow(["Avatar UUID", "Google Sheet ID", "Date Registered", "Frequency"]);
        reg.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#cfe2f3");
        reg.setFrozenRows(1); // FREEZE HEADER (FRIDGE)
    }

    const mData = reg.getDataRange().getValues();
    let mExists = false;
    for (let i = 1; i < mData.length; i++) {
        if (mData[i][0] === uuid) { reg.getRange(i + 1, 2).setValue(sheetId); mExists = true; break; }
    }
    if (!mExists) reg.appendRow([uuid, sheetId, new Date(), 10]);

    return jsonResponse({ status: "success", message: "Registered!" });
}

function getAvatarData(uuid, name, inputDate, sheetId, type = "all", limit = 10, offset = 0) {
    const ss = SpreadsheetApp.openById(sheetId);
    if (!ss) return jsonResponse({ status: "error", message: "Unauthorized." });
    
    const tz = ss.getSpreadsheetTimeZone();
    const requestedDate = inputDate || Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
    const result = { status: "success", data: {}, server_time: Date.now() };

    // 1. SETTINGS SYNC (Always Return)
    const uTab = ss.getSheetByName("Users");
    const uMap = getHeaderMap(uTab);
    const uData = uTab.getDataRange().getValues();
    let settings = { radar_scan_freq: 10 };
    for (let i = 1; i < uData.length; i++) {
        if (uData[i][uMap["user_uuid"] - 1] == uuid) {
            settings = {
                theme: uData[i][uMap["theme"] - 1],
                glass: uData[i][uMap["transparency"] - 1],
                scale: uData[i][uMap["scale"] - 1],
                radar_scan_freq: uData[i][uMap["radar_scan_freq"] - 1] || 10
            };
            break;
        }
    }
    result.settings = settings;

    // 2. RADAR PAGINATION
    if (type === "all" || type === "radar") {
        const historyTab = ss.getSheetByName("History");
        const encTab = ss.getSheetByName("Encounters");
        if (historyTab && encTab) {
            const hMap = getHeaderMap(historyTab);
            const hData = historyTab.getDataRange().getDisplayValues();
            const eMap = getHeaderMap(encTab);
            const eData = encTab.getDataRange().getValues();

            // Pre-process encounters
            const encountersByHistory = {};
            for (let j = 1; j < eData.length; j++) {
                const sId = eData[j][eMap["summary_id"] - 1];
                if (!encountersByHistory[sId]) encountersByHistory[sId] = [];
                encountersByHistory[sId].push({
                    start: new Date(eData[j][eMap["first_seen"] - 1]).getTime(),
                    end: new Date(eData[j][eMap["last_seen"] - 1]).getTime(),
                    dist: eData[j][eMap["dist"] - 1],
                    sim: eData[j][eMap["sim_name"] - 1]
                });
            }

            const radar = [];
            let matchedCount = 0;
            // Iterate backwards (newest history first)
            for (let i = hData.length - 1; i > 0; i--) {
                if (hData[i][hMap["date"] - 1] !== requestedDate) continue;
                if (hData[i][hMap["owner_uuid"] - 1] != uuid) continue;

                matchedCount++;
                if (matchedCount <= offset) continue; // Skip until we reach our offset
                if (radar.length >= limit) break; // Stop at limit

                const summaryId = hData[i][hMap["summary_id"] - 1];
                const relatedEnc = encountersByHistory[summaryId] || [];
                if (relatedEnc.length === 0) continue;

                let firstSeenMs = Infinity; let lastSeenMs = -Infinity; let lastDist = 0; let lastSim = "Unknown";
                relatedEnc.forEach(e => {
                    if (e.start < firstSeenMs) firstSeenMs = e.start;
                    if (e.end > lastSeenMs) { lastSeenMs = e.end; lastDist = e.dist; lastSim = e.sim; }
                });

                radar.push({
                    name: hData[i][hMap["target_name"] - 1],
                    key: hData[i][hMap["target_uuid"] - 1],
                    first_seen: firstSeenMs,
                    last_seen: lastSeenMs,
                    date: hData[i][hMap["date"] - 1],
                    dist: lastDist,
                    last_sim: lastSim
                });
            }
            result.data.radar = radar;
            result.has_more_radar = matchedCount > (offset + limit);
        }
    }

    // 3. CONTACTS PAGINATION
    if (type === "all" || type === "contacts") {
        const conTab = ss.getSheetByName("Contacts");
        if (conTab) {
            const cMap = getHeaderMap(conTab);
            const cData = conTab.getDataRange().getValues();
            const contacts = [];
            let matchedCount = 0;
            for (let k = 1; k < cData.length; k++) {
                if (cData[k][cMap["owner_uuid"] - 1] == uuid) {
                    matchedCount++;
                    if (matchedCount <= offset) continue;
                    if (contacts.length >= limit) break;
                    
                    contacts.push({
                        name: cData[k][cMap["contact_name"] - 1],
                        key: cData[k][cMap["contact_uuid"] - 1],
                        notes: cData[k][cMap["notes"] - 1]
                    });
                }
            }
            result.data.contacts = contacts;
            result.has_more_contacts = matchedCount > (offset + limit);
        }
    }

    result.requested_date = requestedDate;
    return jsonResponse(result);
}

// ---------------------------------------------------------
// SMART SYNC ENGINE (Safe Add / Move / Delete)
// ---------------------------------------------------------

function syncDatabase(ss) {
    // FORCE SPREADSHEET TO SL TIME
    ss.setSpreadsheetTimeZone(SL_TZ);

    for (var name in CRM_SCHEMA) {
        var sheet = ss.getSheetByName(name);
        var expectedHeaders = CRM_SCHEMA[name];

        if (!sheet) {
            sheet = ss.insertSheet(name);
            sheet.appendRow(expectedHeaders);
            sheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight("bold").setBackground("#cfe2f3");
            sheet.setFrozenRows(1);
        } else {
            // FORCE CORRECT COLUMN ORDER (Professional Sync)
            var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
            var needsRepair = false;

            if (currentHeaders.length < expectedHeaders.length) needsRepair = true;
            else {
                for (var i = 0; i < expectedHeaders.length; i++) {
                    if (currentHeaders[i] !== expectedHeaders[i]) { needsRepair = true; break; }
                }
            }

            if (needsRepair) {
                // If column order is wrong, we fix the headers to match the schema exactly
                sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders])
                    .setFontWeight("bold").setBackground("#cfe2f3");
                sheet.setFrozenRows(1);
            }
        }
    }
    var s1 = ss.getSheetByName("Sheet1");
    if (s1) ss.deleteSheet(s1);
}

// ---------------------------------------------------------
// DATA LOGGING LOGIC
// ---------------------------------------------------------

function bulkLogData(ss, owner, dataJson) {
    // 1. GET A LOCK (Prevent Duplicate Rows from simultaneous scans)
    const lock = LockService.getScriptLock();
    try {
        lock.waitLock(15000); // Wait up to 15 seconds for previous scan to finish

        const historyTab = ss.getSheetByName("History");
        const encTab = ss.getSheetByName("Encounters");
        if (!historyTab || !encTab) return;

        const hMap = getHeaderMap(historyTab);
        const hData = historyTab.getDataRange().getDisplayValues(); // Use DisplayValues for string matching
        const eMap = getHeaderMap(encTab);
        const eData = encTab.getDataRange().getValues();

        const tz = ss.getSpreadsheetTimeZone();
        const today = Utilities.formatDate(new Date(), SL_TZ, "yyyy-MM-dd");
        const now = new Date();

        const data = JSON.parse(dataJson);
        data.forEach(p => {
            const summaryId = owner + "_" + p.target_uuid + "_" + today;

            // --- 1. UPDATE HISTORY (PARENT) ---
            let hRow = -1;
            // Check in-memory hData first
            for (let i = 0; i < hData.length; i++) {
                if (hData[i][hMap["summary_id"] - 1] == summaryId) { hRow = i; break; }
            }

            if (hRow == -1) {
                const newHRow = new Array(historyTab.getLastColumn()).fill("");
                newHRow[hMap["date"] - 1] = today;
                newHRow[hMap["target_name"] - 1] = p.target_name;
                newHRow[hMap["summary_id"] - 1] = summaryId;
                newHRow[hMap["owner_uuid"] - 1] = owner;
                newHRow[hMap["target_uuid"] - 1] = p.target_uuid;
                newHRow[hMap["total_scans"] - 1] = 1;
                newHRow[hMap["is_protected"] - 1] = 0;
                historyTab.appendRow(newHRow);

                // Add to memory so we find it if it appears again in the same batch
                hData.push(newHRow.map(String));
            } else {
                const countCell = historyTab.getRange(hRow + 1, hMap["total_scans"]);
                const currentCount = parseInt(hData[hRow][hMap["total_scans"] - 1]) || 0;
                countCell.setValue(currentCount + 1);
                hData[hRow][hMap["total_scans"] - 1] = (currentCount + 1).toString(); // Update memory

                // Repair name in case it changed
                historyTab.getRange(hRow + 1, hMap["target_name"]).setValue(p.target_name);
            }

            // --- 2. UPDATE ENCOUNTERS (CHILD) ---
            let lastEncRow = -1;
            for (let j = eData.length - 1; j > 0; j--) {
                if (eData[j][eMap["summary_id"] - 1] == summaryId) { lastEncRow = j; break; }
            }

            const isNewSession = (p.new == 1 || lastEncRow == -1);

            if (isNewSession) {
                const newERow = new Array(encTab.getLastColumn()).fill("");
                newERow[eMap["summary_id"] - 1] = summaryId;
                newERow[eMap["first_seen"] - 1] = now;
                newERow[eMap["last_seen"] - 1] = now;
                newERow[eMap["dist"] - 1] = p.dist;
                newERow[eMap["sim_name"] - 1] = p.sim;
                newERow[eMap["sim_pos"] - 1] = p.pos;
                newERow[eMap["parcel_name"] - 1] = p.parcel;
                encTab.appendRow(newERow);
                eData.push(newERow);
            } else {
                encTab.getRange(lastEncRow + 1, eMap["last_seen"]).setValue(now);
                encTab.getRange(lastEncRow + 1, eMap["dist"]).setValue(p.dist);
                encTab.getRange(lastEncRow + 1, eMap["sim_pos"]).setValue(p.pos);
            }
        });
    } catch (e) {
        console.error("Lock Error: " + e.toString());
    } finally {
        lock.releaseLock(); // Always release the lock
    }
}

function syncUser(uuid, name) {
    try {
        const sheetId = getUserSheetId(uuid);
        if (!sheetId) return ContentService.createTextOutput("USER_SYNCED|10");

        const ss = SpreadsheetApp.openById(sheetId);
        syncDatabase(ss); // Auto-heal on sync

        const uTab = ss.getSheetByName("Users");
        const uMap = getHeaderMap(uTab);
        const data = uTab.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
            if (data[i][uMap["user_uuid"] - 1] == uuid) {
                // Return custom radar frequency
                return ContentService.createTextOutput("USER_SYNCED|" + (data[i][uMap["radar_scan_freq"] - 1] || 10));
            }
        }
        return ContentService.createTextOutput("USER_SYNCED|10");
    } catch (e) {
        return ContentService.createTextOutput("USER_SYNCED|10");
    }
}

function updateSettings(ss, uuid, scanFreq) {
    const uTab = ss.getSheetByName("Users");
    const uMap = getHeaderMap(uTab);
    const data = uTab.getDataRange().getValues();
    let updated = false;

    for (let i = 1; i < data.length; i++) {
        if (data[i][uMap["user_uuid"] - 1] == uuid) {
            uTab.getRange(i + 1, uMap["radar_scan_freq"]).setValue(scanFreq);
            updated = true;
            break;
        }
    }
    
    if (updated) return jsonResponse({ status: "success", message: "Settings Updated!" });
    return jsonResponse({ status: "error", message: "User not found for update." });
}

// ---------------------------------------------------------
// HELPERS & CORE ENGINE
// ---------------------------------------------------------

function getHeaderMap(sheet) {
    if (!sheet) return {};
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var map = {};
    for (var i = 0; i < headers.length; i++) { if (headers[i]) map[headers[i]] = i + 1; }
    return map;
}

function getUserSheetId(uuid) {
    const registryTab = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MASTER_REGISTRY_NAME);
    if (!registryTab) return null;
    const data = registryTab.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) { if (data[i][0] === uuid) return data[i][1]; }
    return null;
}

function extractSheetId(url) {
    if (!url) return null;
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : url;
}
function toggleContact(ss, ownerUuid, targetUuid, targetName) {
    const lock = LockService.getScriptLock();
    try {
        lock.waitLock(15000);
        const conTab = ss.getSheetByName("Contacts") || ss.insertSheet("Contacts");
        syncDatabase(ss); // Ensure header is correct
        
        const cMap = getHeaderMap(conTab);
        const cData = conTab.getDataRange().getValues();
        let foundRow = -1;

        // Search for existing
        for (let i = 1; i < cData.length; i++) {
            if (cData[i][cMap["owner_uuid"] - 1] == ownerUuid && 
                cData[i][cMap["contact_uuid"] - 1] == targetUuid) {
                foundRow = i + 1;
                break;
            }
        }

        if (foundRow !== -1) {
            conTab.deleteRow(foundRow);
            return jsonResponse({ status: "success", state: "removed", message: "Contact Removed." });
        } else {
            const row = new Array(conTab.getLastColumn()).fill("");
            row[cMap["owner_uuid"] - 1] = ownerUuid;
            row[cMap["contact_uuid"] - 1] = targetUuid;
            row[cMap["contact_name"] - 1] = targetName;
            row[cMap["created_at"] - 1] = new Date();
            conTab.appendRow(row);
            return jsonResponse({ status: "success", state: "added", message: "Contact Saved!" });
        }
    } finally {
        lock.releaseLock();
    }
}

function jsonResponse(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

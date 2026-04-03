// ==========================================
// SCM HUD - MASTER ENGINE (SaaS CRM BACKEND)
// ==========================================
/**
 * Version: 2.0 (Smart Migration & Data-Safe Mapping)
 * This script handles multi-tenant CRM storage for Second Life HUDs.
 */

const MASTER_REGISTRY_NAME = "Master_Registry";
const SL_TZ = "America/Los_Angeles"; // Second Life Standard Time (PST/PDT)

// 1. MASTER SCHEMA (Blueprint) - Add new columns here to auto-deploy to users.
const CRM_SCHEMA = {
    "Users": ["user_uuid", "user_name", "theme", "transparency", "scale", "shared_mode", "seen_history", "history_delete_days", "history_min_secs", "scan_freq", "last_login", "created_at"],
    "Categories": ["owner_uuid", "cat_id", "cat_name", "cat_color", "cat_icon", "created_at"],
    "Tags": ["owner_uuid", "tag_id", "tag_name", "tag_color", "tag_icon", "created_at"],
    "Contacts": ["owner_uuid", "contact_uuid", "contact_name", "cat_ids", "tag_ids", "notes", "created_at"],
    "Seen_Daily": ["summary_id", "owner_uuid", "target_uuid", "target_name", "date", "is_protected", "total_scans", "last_seen_time", "last_dist", "first_seen_time", "last_sim"],
    "Encounters": ["summary_id", "timestamp", "sim_name", "sim_pos", "parcel_name"]
};

// 2. SAFE DELETE LIST (Columns removed from here will be deleted from all user sheets)
const COLUMNS_TO_DELETE = ["old_unused_col", "test_garbage"];

function doPost(e) { return handleRequest(e); }
function doGet(e) { return handleRequest(e); }

function handleRequest(e) {
    try {
        const action = e.parameter.action;
        const uuid = e.parameter.uuid || e.parameter.owner;
        if (!uuid) return jsonResponse({ status: "error", message: "Missing UUID mapping." });

        if (action === "register") return registerUser(uuid, e.parameter.name, e.parameter.sheetUrl);

        // --- SECURE DATA RETRIEVAL ---
        if (action === "get_data") {
            const sheetId = getUserSheetId(uuid);
            if (!sheetId) return jsonResponse({ status: "unregistered" });
            return getAvatarData(uuid, e.parameter.name, e.parameter.date, sheetId);
        }

        if (action === "bulk_log") return bulkLogData(uuid, JSON.parse(e.parameter.data || e.postData.contents));
        if (action === "sync_user") return syncUser(uuid, e.parameter.name);

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

    syncDatabase(ss); // Build/Update Schema

    const uTab = ss.getSheetByName("Users");
    const uMap = getHeaderMap(uTab);
    const uData = uTab.getDataRange().getValues();

    let exists = false;
    for (let i = 1; i < uData.length; i++) { if (uData[i][uMap["user_uuid"] - 1] == uuid) { exists = true; break; } }

    if (!exists) {
        const row = new Array(uTab.getLastColumn()).fill("");
        row[uMap["user_uuid"] - 1] = uuid;
        row[uMap["user_name"] - 1] = name || "Unknown";
        row[uMap["theme"] - 1] = "Blue";
        row[uMap["shared_mode"] - 1] = 0;
        row[uMap["seen_history"] - 1] = 1;
        row[uMap["scan_freq"] - 1] = 10;
        row[uMap["created_at"] - 1] = new Date();
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

function getAvatarData(uuid, name, inputDate, existingSheetId) {
    const sheetId = existingSheetId || getUserSheetId(uuid);
    if (!sheetId) return jsonResponse({ status: "unregistered" });

    const ss = SpreadsheetApp.openById(sheetId);
    syncDatabase(ss); // Self-healing: Creates missing tabs/columns

    // REPAIR USER NAME (Fixes the "Unknown" user bug automatically)
    if (name && name !== "Unknown") {
        const uTab = ss.getSheetByName("Users");
        if (uTab) {
            const uMap = getHeaderMap(uTab);
            const uData = uTab.getDataRange().getValues();
            for (let i = 1; i < uData.length; i++) {
                if (uData[i][uMap["user_uuid"] - 1] == uuid) {
                    if (uData[i][uMap["user_name"] - 1] == "Unknown") {
                        uTab.getRange(i + 1, uMap["user_name"]).setValue(name);
                    }
                    break;
                }
            }
        }
    }

    const requestedDate = inputDate || Utilities.formatDate(new Date(), SL_TZ, "yyyy-MM-dd");
    const dailyTab = ss.getSheetByName("Seen_Daily");
    if (!dailyTab) return jsonResponse({ status: "error", message: "Database Error: 'Seen_Daily' tab missing." });

    const dMap = getHeaderMap(dailyTab);
    const dData = dailyTab.getDataRange().getValues();

    const radar = [];
    const nowMs = Date.now();
    for (let i = dData.length - 1; i > 0 && radar.length < 100; i--) {
        const rawCellValue = dData[i][dMap["date"] - 1];
        if (!rawCellValue) continue;

        // Robust Date Conversion: Handle both Date objects and strings
        const rowDate = Utilities.formatDate(new Date(rawCellValue), SL_TZ, "yyyy-MM-dd");

        if (dData[i][dMap["owner_uuid"] - 1] == uuid) {
            // Combine Date + Time using ISO format (T...Z) for 100% GMT parsing
            const lastTimeStr = padTime(dData[i][dMap["last_seen_time"] - 1]);
            const firstTimeStr = padTime(dData[i][dMap["first_seen_time"] - 1] || lastTimeStr);

            const lastSeenMs = new Date(rowDate + "T" + lastTimeStr + "Z").getTime();
            const firstSeenMs = new Date(rowDate + "T" + firstTimeStr + "Z").getTime();

            // CLOUD-SIDE NEARBY FILTER (120 seconds) - Unified list indicator
            const isNearby = (nowMs - lastSeenMs) < 120000;

            radar.push({
                name: dData[i][dMap["target_name"] - 1],
                key: dData[i][dMap["target_uuid"] - 1],
                first_seen: firstSeenMs,
                last_seen: lastSeenMs,
                date: rowDate,
                dist: dData[i][dMap["last_dist"] - 1] || 0,
                last_sim: dData[i][dMap["last_sim"] - 1] || "Unknown",
                is_nearby: isNearby
            });
        }
    }

    const conTab = ss.getSheetByName("Contacts");
    const contacts = [];
    if (conTab) {
        const cMap = getHeaderMap(conTab);
        const cData = conTab.getDataRange().getValues();
        for (let i = 1; i < cData.length; i++) {
            if (cData[i][cMap["owner_uuid"] - 1] == uuid) {
                contacts.push({ name: cData[i][cMap["contact_name"] - 1], key: cData[i][cMap["contact_uuid"] - 1], notes: cData[i][cMap["notes"] - 1] });
            }
        }
    }

    return jsonResponse({
        status: "success",
        data: { radar, contacts },
        server_time: Date.now(),
        server_sl_date: Utilities.formatDate(new Date(), SL_TZ, "yyyy-MM-dd")
    });
}

// ---------------------------------------------------------
// SMART SYNC ENGINE (Safe Add / Move / Delete)
// ---------------------------------------------------------

function syncDatabase(ss) {
    for (var name in CRM_SCHEMA) {
        var sheet = ss.getSheetByName(name);
        var expectedHeaders = CRM_SCHEMA[name];

        if (!sheet) {
            sheet = ss.insertSheet(name);
            sheet.appendRow(expectedHeaders);
            sheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight("bold").setBackground("#d9eaf7");
            sheet.setFrozenRows(1);
        } else {
            // 1. SAFE ADD: Add columns that are missing from Schema
            var hMap = getHeaderMap(sheet);
            expectedHeaders.forEach(header => {
                if (!hMap[header]) {
                    sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header).setFontWeight("bold").setBackground("#e6fffa");
                }
            });

            // 2. SAFE DELETE: Only delete if on the "Death List"
            COLUMNS_TO_DELETE.forEach(header => {
                if (hMap[header]) {
                    sheet.deleteColumn(hMap[header]);
                    hMap = getHeaderMap(sheet); // Refresh map after delete shifts columns
                }
            });
        }
    }
    var s1 = ss.getSheetByName("Sheet1");
    if (s1) ss.deleteSheet(s1);
}

// ---------------------------------------------------------
// DATA LOGGING LOGIC
// ---------------------------------------------------------

function bulkLogData(uuid, records) {
    try {
        const sheetId = getUserSheetId(uuid);
        if (!sheetId) return ContentService.createTextOutput("LOG_ERROR|NOT_REGISTERED");

        const ss = SpreadsheetApp.openById(sheetId);
        const dailyTab = ss.getSheetByName("Seen_Daily");
        const dMap = getHeaderMap(dailyTab);
        const dailyData = dailyTab.getDataRange().getValues();

        const encTab = ss.getSheetByName("Encounters");
        const eMap = getHeaderMap(encTab);
        const encData = encTab.getDataRange().getValues();

        const today = Utilities.formatDate(new Date(), SL_TZ, "yyyy-MM-dd");

        records.forEach(p => {
            const owner = p.owner || uuid;
            const summaryId = owner + "_" + p.target_uuid + "_" + today;

            // Daily Summary Update
            let dRow = -1;
            for (let i = 0; i < dailyData.length; i++) { if (dailyData[i][0] == summaryId) { dRow = i; break; } }

            if (dRow == -1) {
                const now = new Date();
                const timeOnly = Utilities.formatDate(new Date(), SL_TZ, "HH:mm:ss");

                const row = new Array(dailyTab.getLastColumn()).fill("");
                row[dMap["summary_id"] - 1] = summaryId;
                row[dMap["owner_uuid"] - 1] = owner;
                row[dMap["target_uuid"] - 1] = p.target_uuid;
                row[dMap["target_name"] - 1] = p.target_name;
                row[dMap["date"] - 1] = today;
                row[dMap["is_protected"] - 1] = 0;
                row[dMap["total_scans"] - 1] = 1;
                row[dMap["last_seen_time"] - 1] = timeOnly;
                row[dMap["last_dist"] - 1] = p.dist || 0;
                row[dMap["first_seen_time"] - 1] = timeOnly;
                row[dMap["last_sim"] - 1] = p.sim;
                dailyTab.appendRow(row);
                dailyData.push(row);
            } else {
                const timeOnly = Utilities.formatDate(new Date(), SL_TZ, "HH:mm:ss");
                dailyTab.getRange(dRow + 1, dMap["total_scans"]).setValue(parseInt(dailyData[dRow][dMap["total_scans"] - 1]) + 1);
                dailyTab.getRange(dRow + 1, dMap["last_seen_time"]).setValue(timeOnly);
                dailyTab.getRange(dRow + 1, dMap["last_dist"]).setValue(p.dist || 0);
                dailyTab.getRange(dRow + 1, dMap["last_sim"]).setValue(p.sim);
            }

            // Encounter Spot Update
            let eRow = -1;
            for (let i = 0; i < encData.length; i++) { if (encData[i][0] == summaryId && encData[i][eMap["sim_name"] - 1] == p.sim) { eRow = i; break; } }
            if (eRow == -1) {
                const row = new Array(encTab.getLastColumn()).fill("");
                row[eMap["summary_id"] - 1] = summaryId;
                row[eMap["timestamp"] - 1] = new Date();
                row[eMap["sim_name"] - 1] = p.sim;
                row[eMap["sim_pos"] - 1] = p.pos;
                row[eMap["parcel_name"] - 1] = p.parcel;
                encTab.appendRow(row);
            } else {
                encTab.getRange(eRow + 1, eMap["timestamp"]).setValue(new Date());
                encTab.getRange(eRow + 1, eMap["sim_pos"]).setValue(p.pos);
            }
        });
        return ContentService.createTextOutput("BULK_SUCCESS");
    } catch (e) {
        return ContentService.createTextOutput("LOG_ERROR|" + e.toString());
    }
}

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

function getHeaderMap(sheet) {
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var map = {};
    for (var i = 0; i < headers.length; i++) { if (headers[i]) map[headers[i]] = i + 1; }
    return map;
}

function padTime(timeStr) {
    if (!timeStr) return "00:00:00";
    if (timeStr instanceof Date) return Utilities.formatDate(timeStr, "GMT", "HH:mm:ss");
    var parts = timeStr.toString().split(':');
    if (parts.length < 3) return timeStr;
    return parts.map(function (p) { return p.toString().trim().padStart(2, '0'); }).join(':');
}

function syncUser(uuid, name) {
    try {
        const sheetId = getUserSheetId(uuid);
        if (!sheetId) return ContentService.createTextOutput("USER_SYNCED|10");

        const ss = SpreadsheetApp.openById(sheetId);
        const uTab = ss.getSheetByName("Users");
        if (!uTab) return ContentService.createTextOutput("USER_SYNCED|10");

        const uMap = getHeaderMap(uTab);
        const data = uTab.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
            if (data[i][uMap["user_uuid"] - 1] == uuid) return ContentService.createTextOutput("USER_SYNCED|" + (data[i][uMap["scan_freq"] - 1] || 10));
        }
        return ContentService.createTextOutput("USER_SYNCED|10");
    } catch (e) {
        return ContentService.createTextOutput("USER_SYNCED|10"); // Always fallback to 10s on error
    }
}

function getUserSheetId(uuid) {
    const registryTab = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MASTER_REGISTRY_NAME);
    if (!registryTab) return null;
    const data = registryTab.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) { if (data[i][0] === uuid) return data[i][1]; }
    return null;
}

function extractSheetId(url) {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : url;
}

function jsonResponse(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

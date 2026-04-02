// ==========================================
// SCM HUD - MASTER ENGINE (SaaS CRM BACKEND)
// ==========================================
/**
 * Version: 2.0 (Smart Migration & Data-Safe Mapping)
 * This script handles multi-tenant CRM storage for Second Life HUDs.
 */

const MASTER_REGISTRY_NAME = "Master_Registry";

// 1. MASTER SCHEMA (Blueprint) - Add new columns here to auto-deploy to users.
const CRM_SCHEMA = {
    "Users": ["user_uuid", "user_name", "theme", "transparency", "scale", "shared_mode", "seen_history", "history_delete_days", "history_min_secs", "scan_freq", "last_login", "created_at"],
    "Categories": ["owner_uuid", "cat_id", "cat_name", "cat_color", "cat_icon", "created_at"],
    "Tags": ["owner_uuid", "tag_id", "tag_name", "tag_color", "tag_icon", "created_at"],
    "Contacts": ["owner_uuid", "contact_uuid", "contact_name", "cat_ids", "tag_ids", "notes", "created_at"],
    "Seen_Daily": ["summary_id", "owner_uuid", "target_uuid", "target_name", "date", "is_protected", "total_scans", "last_seen_time", "last_dist", "first_seen_time"],
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
        if (!uuid) throw new Error("Missing UUID mapping.");

        if (action === "register") return registerUser(uuid, e.parameter.name, e.parameter.sheetUrl);
        if (action === "bulk_log") return bulkLogData(uuid, JSON.parse(e.parameter.data || e.postData.contents));
        if (action === "sync_user") return syncUser(uuid, e.parameter.name);
        if (action === "get_data") return getAvatarData(uuid, e.parameter.name);

        throw new Error("Invalid Action");
    } catch (error) {
        return jsonResponse({ status: "error", message: error.toString() });
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
        row[uMap["scan_freq"] - 1] = 30;
        row[uMap["created_at"] - 1] = new Date();
        uTab.appendRow(row);
    }

    // Registry Update
    const master = SpreadsheetApp.getActiveSpreadsheet();
    let reg = master.getSheetByName(MASTER_REGISTRY_NAME) || master.insertSheet(MASTER_REGISTRY_NAME);
    if (reg.getLastRow() === 0) reg.appendRow(["Avatar UUID", "Google Sheet ID", "Date Registered", "Frequency"]);

    const mData = reg.getDataRange().getValues();
    let mExists = false;
    for (let i = 1; i < mData.length; i++) {
        if (mData[i][0] === uuid) { reg.getRange(i + 1, 2).setValue(sheetId); mExists = true; break; }
    }
    if (!mExists) reg.appendRow([uuid, sheetId, new Date(), 30]);

    return jsonResponse({ status: "success", message: "Registered!" });
}

function getAvatarData(uuid, name) {
    const sheetId = getUserSheetId(uuid);
    const ss = SpreadsheetApp.openById(sheetId);
    syncDatabase(ss); // Runs on every HUD attach to keep user updated

    // REPAIR USER NAME (Fixes the "Unknown" user bug automatically)
    if (name && name !== "Unknown") {
        const uTab = ss.getSheetByName("Users");
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

    const dailyTab = ss.getSheetByName("Seen_Daily");
    const dMap = getHeaderMap(dailyTab);
    const dData = dailyTab.getDataRange().getValues();

    const radar = [];
    for (let i = dData.length - 1; i > 0 && radar.length < 50; i--) {
        if (dData[i][dMap["owner_uuid"] - 1] == uuid) {
            radar.push({
                name: dData[i][dMap["target_name"] - 1],
                key: dData[i][dMap["target_uuid"] - 1],
                last_seen: dData[i][dMap["last_seen_time"] - 1],
                dist: dData[i][dMap["last_dist"] - 1] || 0,
                first_seen: dData[i][dMap["first_seen_time"] - 1] || dData[i][dMap["last_seen_time"] - 1]
            });
        }
    }

    const conTab = ss.getSheetByName("Contacts");
    const cMap = getHeaderMap(conTab);
    const cData = conTab.getDataRange().getValues();
    const contacts = [];
    for (let i = 1; i < cData.length; i++) {
        if (cData[i][cMap["owner_uuid"] - 1] == uuid) {
            contacts.push({ name: cData[i][cMap["contact_name"] - 1], key: cData[i][cMap["contact_uuid"] - 1], notes: cData[i][cMap["notes"] - 1] });
        }
    }

    return jsonResponse({ 
        status: "success", 
        data: { radar, contacts }, 
        server_time: Date.now() // USE NUMBER (MS) FOR 100% ACCURACY
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
    const ss = SpreadsheetApp.openById(getUserSheetId(uuid));
    const dailyTab = ss.getSheetByName("Seen_Daily");
    const dMap = getHeaderMap(dailyTab);
    const dailyData = dailyTab.getDataRange().getValues();

    const encTab = ss.getSheetByName("Encounters");
    const eMap = getHeaderMap(encTab);
    const encData = encTab.getDataRange().getValues();

    const today = Utilities.formatDate(new Date(), "GMT", "yyyy-MM-dd");

    records.forEach(p => {
        const owner = p.owner || uuid;
        const summaryId = owner + "_" + p.target_uuid + "_" + today;

        // Daily Summary Update
        let dRow = -1;
        for (let i = 0; i < dailyData.length; i++) { if (dailyData[i][0] == summaryId) { dRow = i; break; } }

        if (dRow == -1) {
            const row = new Array(dailyTab.getLastColumn()).fill("");
            row[dMap["summary_id"] - 1] = summaryId;
            row[dMap["owner_uuid"] - 1] = owner;
            row[dMap["target_uuid"] - 1] = p.target_uuid;
            row[dMap["target_name"] - 1] = p.target_name;
            row[dMap["date"] - 1] = today;
            row[dMap["total_scans"] - 1] = 1;
            row[dMap["last_seen_time"] - 1] = new Date();
            row[dMap["last_dist"] - 1] = p.dist || 0;
            row[dMap["first_seen_time"] - 1] = new Date();
            dailyTab.appendRow(row);
            dailyData.push(row);
        } else {
            dailyTab.getRange(dRow + 1, dMap["total_scans"]).setValue(parseInt(dailyData[dRow][dMap["total_scans"] - 1]) + 1);
            dailyTab.getRange(dRow + 1, dMap["last_seen_time"]).setValue(new Date());
            dailyTab.getRange(dRow + 1, dMap["last_dist"]).setValue(p.dist || 0);
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

function syncUser(uuid, name) {
    const ss = SpreadsheetApp.openById(getUserSheetId(uuid));
    const uTab = ss.getSheetByName("Users");
    const uMap = getHeaderMap(uTab);
    const data = uTab.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) { if (data[i][uMap["user_uuid"] - 1] == uuid) return ContentService.createTextOutput("USER_SYNCED|" + (data[i][uMap["scan_freq"] - 1] || 30)); }
    return ContentService.createTextOutput("USER_SYNCED|30");
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

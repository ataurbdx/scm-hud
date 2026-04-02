// ==========================================
// SCM HUD - MASTER ENGINE (SaaS CRM BACKEND)
// ==========================================
// This script maps Second Life UUIDs to their personal Google Sheets.
// Supports Multi-Alt (One User Sheet holds data for multiple Avatars)

const MASTER_REGISTRY_NAME = "Master_Registry";

function doPost(e) {
  return handleRequest(e);
}

function doGet(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const action = e.parameter.action;
    const uuid = e.parameter.uuid || e.parameter.owner;

    if (!uuid) throw new Error("Missing UUID mapping.");

    if (action === "register") {
      return registerUser(uuid, e.parameter.name, e.parameter.sheetUrl);
    } 
    else if (action === "bulk_log") {
      return bulkLogData(uuid, JSON.parse(e.parameter.data || e.postData.contents));
    }
    else if (action === "sync_user") {
      return syncUser(uuid, e.parameter.name);
    }
    else if (action === "get_data") {
      return getAvatarData(uuid);
    }
    
    throw new Error("Invalid Action");

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ---------------------------------------------------------
// 1. REGISTRATION LOGIC
// ---------------------------------------------------------
function registerUser(uuid, name, sheetUrl) {
  const sheetId = extractSheetId(sheetUrl);
  if (!sheetId) throw new Error("Invalid Google Sheet URL format.");
  
  // 1. Verify access
  let userSheet;
  try {
    userSheet = SpreadsheetApp.openById(sheetId);
  } catch (err) {
    throw new Error("Could not access sheet. Share it with your Service Email!");
  }

  // 2. Setup Full CRM
  setupUserSheet(userSheet);
  
  // 3. Register Alt in the User's Personal Sheet
  const uTab = userSheet.getSheetByName("Users");
  if (uTab) {
    const uData = uTab.getDataRange().getValues();
    let altExists = false;
    for (let i = 1; i < uData.length; i++) {
        if (uData[i][0] == uuid) { altExists = true; break; }
    }
    if (!altExists) {
        // "user_uuid", "user_name", "theme", "transparency", "scale", "shared_mode", "seen_history", "history_delete_days", "history_min_secs", "scan_freq", "last_login", "created_at"
        uTab.appendRow([uuid, name || "Unknown", "Blue", 20, 100, "FALSE", "TRUE", 30, 0, 30, new Date(), new Date()]);
    }
  }

  // 4. Save to Master Registry
  const masterDb = SpreadsheetApp.getActiveSpreadsheet();
  let registryTab = masterDb.getSheetByName(MASTER_REGISTRY_NAME);
  if (!registryTab) {
    registryTab = masterDb.insertSheet(MASTER_REGISTRY_NAME);
    registryTab.appendRow(["Avatar UUID", "Google Sheet ID", "Date Registered", "Frequency"]);
  }

  const data = registryTab.getDataRange().getValues();
  let exists = false;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === uuid) {
      registryTab.getRange(i + 1, 2).setValue(sheetId);
      exists = true;
      break;
    }
  }
  
  if (!exists) {
    registryTab.appendRow([uuid, sheetId, new Date(), 30]);
  }

  return jsonResponse({ status: "success", message: "User Successfully Registered!" });
}

// ---------------------------------------------------------
// 1.5. SYNC USER SETTINGS
// ---------------------------------------------------------
function syncUser(uuid, name) {
  const sheetId = getUserSheetId(uuid);
  if (!sheetId) return ContentService.createTextOutput("ERROR: Not Registered.");

  const ss = SpreadsheetApp.openById(sheetId);
  const uTab = ss.getSheetByName("Users");
  const data = uTab.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == uuid) {
      return ContentService.createTextOutput("USER_SYNCED|" + (data[i][9]||30));
    }
  }
  return ContentService.createTextOutput("USER_SYNCED|30");
}

// ---------------------------------------------------------
// 2. LOG DATA TO USER'S SHEET
// ---------------------------------------------------------
function bulkLogData(uuid, records) {
  const sheetId = getUserSheetId(uuid);
  if (!sheetId) throw new Error("User not registered in Master Database.");

  const ss = SpreadsheetApp.openById(sheetId);
  const dailyTab = ss.getSheetByName("Seen_Daily");
  const encounterTab = ss.getSheetByName("Encounters");
  
  if (!dailyTab || !encounterTab) throw new Error("Target sheet missing database tabs.");

  const today = Utilities.formatDate(new Date(), "GMT", "yyyy-MM-dd");

  const dailyData = dailyTab.getDataRange().getValues();
  const encounterData = encounterTab.getDataRange().getValues();

  records.forEach(p => {
    const owner = p.owner || uuid;
    const summaryId = owner + "_" + p.target_uuid + "_" + today;

    // Process Seen_Daily
    let dRow = -1;
    for (let i = 0; i < dailyData.length; i++) {
      if (dailyData[i][0] == summaryId) { dRow = i; break; }
    }

    if (dRow == -1) {
      // summary_id, owner_uuid, target_uuid, target_name, date, is_protected, total_scans, last_seen_time
      dailyTab.appendRow([summaryId, owner, p.target_uuid, p.target_name, today, "FALSE", 1, new Date()]);
      // Manually add to working array to prevent duplicates in same packet
      dailyData.push([summaryId, owner, p.target_uuid, p.target_name, today, "FALSE", 1, new Date()]);
    } else {
      dailyTab.getRange(dRow + 1, 7).setValue(parseInt(dailyData[dRow][6]) + 1);
      dailyTab.getRange(dRow + 1, 8).setValue(new Date());
    }

    // Process Encounters
    let eRow = -1;
    for (let i = 0; i < encounterData.length; i++) {
      if (encounterData[i][0] == summaryId && encounterData[i][2] == p.sim) { eRow = i; break; }
    }

    if (eRow == -1) {
      encounterTab.appendRow([summaryId, new Date(), p.sim, p.pos, p.parcel]);
      encounterData.push([summaryId, new Date(), p.sim, p.pos, p.parcel]);
    } else {
      encounterTab.getRange(eRow + 1, 2).setValue(new Date());
      encounterTab.getRange(eRow + 1, 4).setValue(p.pos);
      encounterTab.getRange(eRow + 1, 5).setValue(p.parcel);
    }
  });

  return ContentService.createTextOutput("BULK_SUCCESS");
}

// ---------------------------------------------------------
// 3. FETCH DATA FOR HTML HUD
// ---------------------------------------------------------
function getAvatarData(uuid) {
  const sheetId = getUserSheetId(uuid);
  if (!sheetId) throw new Error("Not Registered.");

  const userSheet = SpreadsheetApp.openById(sheetId);
  const dailyTab = userSheet.getSheetByName("Seen_Daily");
  const contactsTab = userSheet.getSheetByName("Contacts");
  
  const responseData = { radar: [], contacts: [] };

  if (dailyTab) {
    const data = dailyTab.getDataRange().getValues();
    for (let i = data.length - 1; i > 0 && responseData.radar.length < 50; i--) {
        // Only return stuff logged by THIS alt (or if shared_mode is true later)
        if (data[i][1] == uuid) {
            responseData.radar.push({ name: data[i][3], key: data[i][2], last_seen: data[i][7] });
        }
    }
  }

  if (contactsTab) {
    const data = contactsTab.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
        if (data[i][0] == uuid) {
            responseData.contacts.push({ name: data[i][2], key: data[i][1], notes: data[i][5] });
        }
    }
  }

  return jsonResponse({ status: "success", data: responseData });
}

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------
function getUserSheetId(uuid) {
  const registryTab = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MASTER_REGISTRY_NAME);
  if (!registryTab) return null;

  const data = registryTab.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === uuid) return data[i][1];
  }
  return null;
}

function extractSheetId(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return url; 
}

function setupUserSheet(ss) {
  var sheetsToCreate = {
    "Users": ["user_uuid", "user_name", "theme", "transparency", "scale", "shared_mode", "seen_history", "history_delete_days", "history_min_secs", "scan_freq", "last_login", "created_at"],
    "Categories": ["owner_uuid", "cat_id", "cat_name", "cat_color", "cat_icon", "created_at"],
    "Tags": ["owner_uuid", "tag_id", "tag_name", "tag_color", "tag_icon", "created_at"],
    "Contacts": ["owner_uuid", "contact_uuid", "contact_name", "cat_ids", "tag_ids", "notes", "created_at"],
    "Seen_Daily": ["summary_id", "owner_uuid", "target_uuid", "target_name", "date", "is_protected", "total_scans", "last_seen_time"],
    "Encounters": ["summary_id", "timestamp", "sim_name", "sim_pos", "parcel_name"]
  };

  for (var name in sheetsToCreate) {
    var oldSheet = ss.getSheetByName(name);
    if (!oldSheet) {
      var newSheet = ss.insertSheet(name);
      newSheet.appendRow(sheetsToCreate[name]);
      newSheet.getRange(1, 1, 1, sheetsToCreate[name].length).setFontWeight("bold").setBackground("#d9d9d9");
      newSheet.setFrozenRows(1);
    }
  }
  
  var sheet1 = ss.getSheetByName("Sheet1");
  if (sheet1) ss.deleteSheet(sheet1);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

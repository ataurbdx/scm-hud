/* 
   SCM MASTER ENGINE - VERSION 3.5 (STABLE & SMART)
   - Features: Bulk Log, Smart Sim Update, Reset Database, User Sync
*/

function doPost(e) {
  var p = e.parameter;
  var action = p.action;
  if (action == "sync_user") return syncUser(p);
  if (action == "bulk_log") {
    var dataArray = JSON.parse(p.data);
    dataArray.forEach(function(item) { logHistory(item); });
    return ContentService.createTextOutput("BULK_SUCCESS");
  }
  return ContentService.createTextOutput("ERROR");
}

function syncUser(p) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");
  var data = sheet.getDataRange().getValues();
  var rowIdx = -1;

  for (var i = 0; i < data.length; i++) {
    if (data[i][0] == p.uuid) { rowIdx = i; break; }
  }

  if (rowIdx == -1) {
    // New User - Column J (index 9) is 30
    sheet.appendRow([p.uuid, p.name, "Blue", 20, 100, "FALSE", "TRUE", 30, 0, 30, new Date(), new Date()]);
    return ContentService.createTextOutput("USER_SYNCED|30"); 
  } else {
    // Existing User
    var freq = data[rowIdx][9] || 30;
    return ContentService.createTextOutput("USER_SYNCED|" + freq);
  }
}

function logHistory(p) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var daily = ss.getSheetByName("Seen_Daily");
  var detail = ss.getSheetByName("Encounters");
  var today = Utilities.formatDate(new Date(), "GMT", "yyyy-MM-dd");
  var summaryId = p.owner + "_" + p.target_uuid + "_" + today;

  var dailyData = daily.getDataRange().getValues();
  var dRow = -1;
  for (var i = 0; i < dailyData.length; i++) {
    if (dailyData[i][0] == summaryId) { dRow = i; break; }
  }

  if (dRow == -1) {
    daily.appendRow([summaryId, p.owner, p.target_uuid, p.target_name, today, "FALSE", 1, new Date()]);
  } else {
    daily.getRange(dRow + 1, 7).setValue(parseInt(dailyData[dRow][6]) + 1);
    daily.getRange(dRow + 1, 8).setValue(new Date());
  }

  var detailData = detail.getDataRange().getValues();
  var eRow = -1;
  for (var i = 0; i < detailData.length; i++) {
    if (detailData[i][0] == summaryId && detailData[i][2] == p.sim) { eRow = i; break; }
  }

  if (eRow == -1) {
    detail.appendRow([summaryId, new Date(), p.sim, p.pos, p.parcel]);
  } else {
    detail.getRange(eRow + 1, 2).setValue(new Date());
    detail.getRange(eRow + 1, 4).setValue(p.pos);
    detail.getRange(eRow + 1, 5).setValue(p.parcel);
  }
}





function doGet(e) {
  var owner = e.parameter.owner;
  var page = e.parameter.page || "contacts";
  
  if (page == "contacts") {
    return generateContactsPage(owner);
  }
  
  // Default fallback
  return HtmlService.createHtmlOutput("<h1>Page Not Found</h1>");
}

function generateContactsPage(ownerUUID) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var contactData = ss.getSheetByName("Contacts").getDataRange().getValues();
  var catData = ss.getSheetByName("Categories").getDataRange().getValues();
  var tagData = ss.getSheetByName("Tags").getDataRange().getValues();

  // Create HTML Template
  var html = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { background: #1a1a1a; color: #e0e0e0; font-family: 'Segoe UI', Arial; margin: 10px; }
      .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; }
      .contact-card { background: #262626; border-radius: 8px; padding: 15px; margin-bottom: 10px; border-left: 4px solid #00aaff; }
      .name { font-size: 18px; font-weight: bold; color: #fff; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-right: 5px; text-transform: uppercase; }
      .cat-badge { background: #3d3d3d; border: 1px solid #00aaff; color: #00aaff; }
      .tag-badge { background: #333; color: #888; border: 1px solid #555; }
      .notes { font-size: 13px; color: #aaa; margin-top: 8px; font-style: italic; }
    </style>
  </head>
  <body>
    <div class="header">
      <span>MY CONTACTS</span>
      <span style="color:#00aaff; font-size:12px;">Active: ${ownerUUID.substring(0,8)}...</span>
    </div>
  `;

  // Loop through Contacts and build the list
  for (var i = 1; i < contactData.length; i++) {
    if (contactData[i][0] == ownerUUID) {
      var name = contactData[i][2];
      var catIds = contactData[i][3].toString().split(",");
      var tagIds = contactData[i][4].toString().split(",");
      var notes = contactData[i][5] || "No notes.";

      html += '<div class="contact-card">';
      html += '<div class="name">' + name + '</div>';

      // Resolve Category Names
      catIds.forEach(id => {
        var catName = resolveName(catData, id);
        if (catName) html += '<span class="badge cat-badge">' + catName + '</span>';
      });

      // Resolve Tag Names
      tagIds.forEach(id => {
        var tagName = resolveName(tagData, id);
        if (tagName) html += '<span class="badge tag-badge">' + tagName + '</span>';
      });

      html += '<div class="notes">' + notes + '</div>';
      html += '</div>';
    }
  }

  html += '</body></html>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Helper to find Category/Tag name by ID
function resolveName(data, id) {
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] == id.trim()) return data[i][2];
  }
  return null;
}







// --- INITIALIZE / RESET DATABASE (DO NOT REMOVE) ---
function resetDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
    if (oldSheet) ss.deleteSheet(oldSheet); 
    
    var newSheet = ss.insertSheet(name);
    newSheet.appendRow(sheetsToCreate[name]);
    newSheet.getRange(1, 1, 1, sheetsToCreate[name].length).setFontWeight("bold").setBackground("#d9d9d9");
    newSheet.setFrozenRows(1);
  }
  
  var sheet1 = ss.getSheetByName("Sheet1");
  if (sheet1) ss.deleteSheet(sheet1);
}

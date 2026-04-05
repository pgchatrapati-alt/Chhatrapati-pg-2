// ============================================================
// PG TENANT MANAGER — Google Apps Script Web App (v4 - SIMPLE)
// ============================================================
// SIMPLIFIED VERSION - No complex fallback logic
// Just show us EXACTLY what's being received
//
// Paste this in: Extensions > Apps Script > Code.gs
// Then: Deploy > NEW Deployment > Web App
//   - Execute as: Me
//   - Who has access: Anyone
// ============================================================

function makeResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    Logger.log("=== SIMPLE DIAGNOSTIC START ===");
    
    // Raw body logging
    let bodyStr = "";
    if (e.postData && e.postData.contents) {
      bodyStr = e.postData.contents;
      Logger.log("✓ POST body received");
      Logger.log("  Length: " + bodyStr.length + " chars");
      Logger.log("  First 1000 chars: " + bodyStr.substring(0, 1000));
    } else {
      Logger.log("✗ No POST body!");
      return makeResponse({ success: false, error: "No POST body received" });
    }
    
    // Parse it
    let parsed;
    try {
      parsed = JSON.parse(bodyStr);
      Logger.log("✓ JSON parsed successfully");
    } catch (err) {
      Logger.log("✗ JSON parse failed: " + err.message);
      return makeResponse({ success: false, error: "Invalid JSON: " + err.message });
    }
    
    // Show structure
    Logger.log("=== STRUCTURE ===");
    const keys = Object.keys(parsed);
    Logger.log("Root keys: " + keys.join(", "));
    Logger.log("Total keys: " + keys.length);
    
    keys.forEach(function(key) {
      const val = parsed[key];
      const type = typeof val;
      const isArr = Array.isArray(val);
      const len = isArr ? val.length : "N/A";
      Logger.log("  '" + key + "': type=" + type + ", array=" + isArr + ", length=" + len);
      
      // If it's an array, show first item
      if (isArr && val.length > 0) {
        Logger.log("    First item: " + JSON.stringify(val[0]).substring(0, 150));
      }
    });
    
    // Determine action
    const action = parsed.action || "unknown";
    Logger.log("Action: " + action);
    
    // Try to find pgData
    let pgData = null;
    if (typeof parsed.data === 'object' && parsed.data !== null) {
      Logger.log("Found 'data' property");
      pgData = parsed.data;
    } else {
      Logger.log("No 'data' property, looking for array-valued keys...");
      pgData = {};
      keys.forEach(function(key) {
        if (key !== 'action' && Array.isArray(parsed[key])) {
          pgData[key] = parsed[key];
          Logger.log("  Added '" + key + "' to pgData");
        }
      });
      
      if (Object.keys(pgData).length === 0) {
        Logger.log("No pgData found via either method!");
        pgData = null;
      }
    }
    
    // Handle action
    if (action === 'ping') {
      Logger.log("✓ PING request");
      return makeResponse({ success: true, message: "Connected! ✅" });
    }
    
    if (action === 'write') {
      if (!pgData) {
        Logger.log("✗ WRITE: No pgData found!");
        return makeResponse({
          success: false,
          error: "No pgData in write request",
          debug: {
            receivedKeys: keys,
            hasDataProperty: typeof parsed.data !== 'undefined'
          }
        });
      }
      
      Logger.log("✓ WRITE: Found pgData with " + Object.keys(pgData).length + " PGs");
      return writeData(pgData);
    }
    
    if (action === 'read') {
      Logger.log("✓ READ request");
      return readAllData();
    }
    
    Logger.log("✗ Unknown action: " + action);
    return makeResponse({ success: false, error: "Unknown action: " + action });
    
  } catch (err) {
    Logger.log("FATAL ERROR: " + err.message);
    Logger.log("Stack: " + err.stack);
    return makeResponse({ success: false, error: err.message });
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (action === 'ping') {
      return makeResponse({ success: true, message: "Connected!" });
    }
    if (action === 'read') {
      return readAllData();
    }
    
    return makeResponse({ success: false, error: "Unknown action: " + action });
  } catch (err) {
    return makeResponse({ success: false, error: err.message });
  }
}

// ── READ: Saari sheets se data lao ──────────────────────────
function readAllData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const allData = {};

  const MONTHS = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  sheets.forEach(function(sheet) {
    const name = sheet.getName();
    if (name.startsWith("_")) return;

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      allData[name] = [];
      return;
    }

    const tenants = [];

    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      if (!row[0]) continue;

      const formatDate = function(val) {
        if (!val) return "";
        try {
          return Utilities.formatDate(new Date(val), Session.getScriptTimeZone(), "yyyy-MM-dd");
        } catch(e) {
          return String(val);
        }
      };

      const tenant = {
        name:        String(row[0] || ""),
        contact:     String(row[1] || ""),
        deposit:     String(row[2] || ""),
        rent:        String(row[3] || ""),
        dateJoining: formatDate(row[4]),
        dateLeaving: formatDate(row[5]),
        note:        String(row[6] || ""),
        monthly:     {}
      };

      MONTHS.forEach(function(month, i) {
        const base = 7 + (i * 4);
        tenant.monthly[month] = {
          amount:    String(row[base]     || ""),
          halfFull:  String(row[base + 1] || ""),
          collector: String(row[base + 2] || ""),
          note:      String(row[base + 3] || "")
        };
      });

      tenants.push(tenant);
    }

    allData[name] = tenants;
  });

  return makeResponse({ success: true, data: allData });
}

// ── WRITE: Poora PG data sheets mein likho ──────────────────
function writeData(pgData) {
  Logger.log("=== writeData() START ===");
  Logger.log("pgData type: " + typeof pgData);
  Logger.log("pgData value: " + JSON.stringify(pgData).substring(0, 200));
  
  // DEFENSIVE: Build pgData if undefined
  let finalPgData = pgData;
  if (!finalPgData || typeof finalPgData !== 'object') {
    Logger.log("⚠️ pgData is invalid, cannot write");
    throw new Error("Invalid pgData: " + typeof pgData);
  }
  
  const pgNames = Object.keys(finalPgData);
  Logger.log("PGs to write: " + pgNames.join(", "));

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const MONTHS = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  const headers = ["Name","Contact","Deposit","Rent","Date Joining","Date Leaving","Note"];
  MONTHS.forEach(function(m) {
    headers.push(m+" Amount", m+" Half/Full", m+" Collector", m+" Note");
  });

  pgNames.forEach(function(pgName) {
    let sheet = ss.getSheetByName(pgName);
    if (!sheet) {
      sheet = ss.insertSheet(pgName);
    }

    const tenants = pgData[pgName] || [];
    Logger.log("Writing " + pgName + ": " + tenants.length + " tenants");

    const rows = [headers];

    tenants.forEach(function(t) {
      const row = [
        t.name        || "",
        t.contact     || "",
        t.deposit     || "",
        t.rent        || "",
        t.dateJoining || "",
        t.dateLeaving || "",
        t.note        || ""
      ];

      MONTHS.forEach(function(m) {
        const md = (t.monthly && t.monthly[m]) ? t.monthly[m] : {};
        row.push(
          md.amount    || "",
          md.halfFull  || "",
          md.collector || "",
          md.note      || ""
        );
      });

      rows.push(row);
    });

    // Clear old data rows, keep header
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }

    // Write new data
    if (rows.length > 1) {
      sheet.getRange(2, 1, rows.length - 1, headers.length).setValues(rows.slice(1));
    }

    // Ensure header exists
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    // Style header
    try {
      const hr = sheet.getRange(1, 1, 1, headers.length);
      hr.setBackground("#1a1a2e");
      hr.setFontColor("#ffffff");
      hr.setFontWeight("bold");
      sheet.setFrozenRows(1);
    } catch(e) {}
  });

  Logger.log("✓ Write completed for " + pgNames.length + " sheets");
  return makeResponse({ success: true, message: "Written to " + pgNames.length + " sheets ✅" });
}

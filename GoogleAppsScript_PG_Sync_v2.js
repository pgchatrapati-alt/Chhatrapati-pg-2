// ============================================================
// PG TENANT MANAGER — Google Apps Script Web App  (FIXED v2)
// ============================================================
// Paste this in: Extensions > Apps Script > Code.gs
// Then: Deploy > NEW Deployment > Web App
//   - Execute as: Me
//   - Who has access: Anyone
// IMPORTANT: Har baar code change karne ke baad NEW deployment karo
// ============================================================

// ── CORS headers helper ──────────────────────────────────────
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
}

function makeResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Entry points ─────────────────────────────────────────────
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    // Support both GET params and POST body
    let action, data;
    
    Logger.log("Request received. postData exists: " + (e.postData ? "yes" : "no"));

    if (e.postData && e.postData.contents) {
      // POST with JSON body
      Logger.log("Raw POST body length: " + e.postData.contents.length);
      Logger.log("Raw POST body (first 500 chars): " + e.postData.contents.substring(0, 500));
      
      try {
        const body = JSON.parse(e.postData.contents);
        Logger.log("Parsed body keys: " + Object.keys(body).join(", "));
        Logger.log("Body structure: " + JSON.stringify(body).substring(0, 300));
        
        action = body.action;
        data = body.data;
        
        // Fallback: if data is undefined but body looks like pgData, use the whole body
        if (action === "write" && (typeof data === 'undefined' || data === null)) {
          if (typeof body === 'object' && Object.keys(body).length > 0 && !body.action) {
            Logger.log("Fallback: body doesn't have 'action', treating whole body as pgData");
            data = body;
            action = "write";
          }
        }
        
        Logger.log("Final: action=" + action + ", data type=" + typeof data);
        if (typeof data === 'object' && data !== null) {
          Logger.log("Data keys: " + Object.keys(data).join(", ").substring(0, 200));
        }
      } catch (parseErr) {
        throw new Error("Failed to parse POST body: " + parseErr.message + ". Body: " + (e.postData.contents || '').substring(0, 300));
      }
    } else {
      // GET with URL params
      action = e.parameter.action;
      const raw = e.parameter.data;
      data = raw ? JSON.parse(raw) : null;
      Logger.log("GET params: action=" + action + ", data received=" + (raw ? "yes" : "no"));
    }

    let result;

    if (action === "ping") {
      result = { success: true, message: "PG Sync connected! ✅" };

    } else if (action === "read") {
      result = readAllData();

    } else if (action === "write") {
      // Check that data exists and is an object
      Logger.log("Write validation: typeof data = " + typeof data + ", data = " + JSON.stringify(data).substring(0, 100));
      
      if (typeof data !== 'object' || data === null) {
        throw new Error("Write action requires pgData object. Received type: " + typeof data);
      }
      result = writeData(data);

    } else {
      result = { success: false, error: "Unknown action: " + action };
    }

    return makeResponse(result);

  } catch (err) {
    Logger.log("ERROR in handleRequest: " + err.message);
    Logger.log("Stack: " + err.stack);
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
    if (name.startsWith("_")) return; // skip meta sheets

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

      // Monthly: col 7 onward, 4 cols per month
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

  return { success: true, data: allData };
}

// ── WRITE: Poora PG data sheets mein likho ──────────────────
function writeData(pgData) {
  Logger.log("writeData called with type: " + typeof pgData);
  Logger.log("pgData value (first 300 chars): " + JSON.stringify(pgData).substring(0, 300));
  
  // SAFETY: Validate pgData before processing
  if (typeof pgData === 'undefined' || pgData === null) {
    throw new Error("pgData is undefined or null");
  }
  
  if (typeof pgData !== 'object') {
    throw new Error("pgData must be an object, got: " + typeof pgData);
  }
  
  if (Array.isArray(pgData)) {
    throw new Error("pgData must be an object with PG names as keys, got an array");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const MONTHS = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  const headers = ["Name","Contact","Deposit","Rent","Date Joining","Date Leaving","Note"];
  MONTHS.forEach(function(m) {
    headers.push(m+" Amount", m+" Half/Full", m+" Collector", m+" Note");
  });

  const pgNames = Object.keys(pgData);
  Logger.log("PG names to write: " + pgNames.join(", "));

  pgNames.forEach(function(pgName) {
    let sheet = ss.getSheetByName(pgName);
    if (!sheet) {
      sheet = ss.insertSheet(pgName);
    }

    const tenants = pgData[pgName] || [];
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

    // FIXED: Only clear and rewrite the data area (not entire sheet)
    // Delete old rows but keep formatting/metadata
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);  // Keep header, delete data rows only
    }

    // Write new data below header
    if (rows.length > 1) {  // rows has header + data
      sheet.getRange(2, 1, rows.length - 1, headers.length).setValues(rows.slice(1));
    }
    
    // Ensure header exists and is styled
    if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() === "") {
      sheet.insertRows(1, 1);
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

  return { success: true, message: "Written to " + pgNames.length + " sheets ✅" };
}

// ============================================================
// PG TENANT MANAGER — Google Apps Script Web App (v3 - DIAGNOSTIC)
// ============================================================
// IMPORTANT: This is a complete rewrite with better debugging
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

function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  try {
    let action = null;
    let data = null;

    Logger.log("=== START REQUEST ===");
    Logger.log("Method: " + method);
    Logger.log("Parameter keys: " + Object.keys(e.parameter).join(", "));

    // Step 1: Extract action
    if (method === 'POST' && e.postData && e.postData.contents) {
      Logger.log("POST body exists, length: " + e.postData.contents.length);
      Logger.log("POST body (first 500): " + e.postData.contents.substring(0, 500));
      
      try {
        const parsed = JSON.parse(e.postData.contents);
        Logger.log("Successfully parsed JSON");
        Logger.log("Parsed keys: " + Object.keys(parsed).join(", "));
        Logger.log("Parsed content (first 500): " + JSON.stringify(parsed).substring(0, 500));
        
        action = parsed.action;
        data = parsed.data;
        
        Logger.log("Extracted action: " + action);
        Logger.log("Extracted data type: " + typeof data);
        Logger.log("Data is null: " + (data === null));
        Logger.log("Data is undefined: " + (typeof data === 'undefined'));
        
        if (data && typeof data === 'object') {
          Logger.log("Data keys: " + Object.keys(data).join(", ").substring(0, 200));
          Logger.log("Data entries: " + JSON.stringify(data).substring(0, 400));
        }
        
        // DETAILED LOGGING FOR FALLBACK
        Logger.log("=== DETAILED BODY INSPECTION ===");
        Object.keys(parsed).forEach(function(key, idx) {
          const value = parsed[key];
          const typeStr = typeof value;
          const isArr = Array.isArray(value);
          const arrLen = isArr ? value.length : 'N/A';
          Logger.log("  [" + idx + "] '" + key + "': type=" + typeStr + ", array=" + isArr + ", length=" + arrLen);
        });
        Logger.log("=== END BODY INSPECTION ===");
        
        // FALLBACK: If data is missing/undefined, check if body IS the pgData structure
        if (action === 'write' && (!data || typeof data !== 'object')) {
          Logger.log("⚠️ FALLBACK TRIGGERED: Write action but data is " + typeof data);
          
          // The pgData structure has PG names as keys with array values
          // Build pgData by taking ALL keys except 'action' from the parsed body
          const potentialPGData = {};
          let pgCount = 0;
          let tenantCount = 0;
          
          Object.keys(parsed).forEach(function(key) {
            if (key === 'action') {
              Logger.log("  - Skipping 'action' key");
              return;
            }
            
            const value = parsed[key];
            const isArr = Array.isArray(value);
            
            Logger.log("  Processing '" + key + "': isArray=" + isArr + ", type=" + typeof value);
            
            // Accept it as a PG if it's an array
            if (isArr) {
              potentialPGData[key] = value;
              pgCount++;
              if (value.length > 0) tenantCount += value.length;
              Logger.log("    ✓ ADDED PG '" + key + "' with " + value.length + " tenants");
            } else {
              Logger.log("    ✗ SKIPPED (not array)");
            }
          });
          
          Logger.log("Fallback results: pgCount=" + pgCount + ", tenantCount=" + tenantCount);
          Logger.log("potentialPGData keys: " + Object.keys(potentialPGData).join(", "));
          
          if (pgCount > 0) {
            Logger.log("✅ FALLBACK SUCCESS: Using detected pgData");
            data = potentialPGData;
            Logger.log("Data now set to: " + JSON.stringify(data).substring(0, 200));
          } else {
            Logger.log("❌ FALLBACK FAILED: No array keys found");
            Logger.log("Available keys to check were: " + Object.keys(parsed).join(", "));
          }
        }
      } catch (err) {
        Logger.log("ERROR parsing JSON: " + err.message);
        return makeResponse({
          success: false,
          error: "Failed to parse POST body: " + err.message,
          debug: {
            bodyLength: e.postData.contents.length,
            bodyPreview: e.postData.contents.substring(0, 200)
          }
        });
      }
    } else if (method === 'GET' || e.parameter.action) {
      action = e.parameter.action;
      const dataParam = e.parameter.data;
      if (dataParam) {
        try {
          data = JSON.parse(dataParam);
        } catch (err) {
          Logger.log("Failed to parse GET data param");
        }
      }
      Logger.log("GET action: " + action);
    }

    // Step 2: Handle actions
    if (!action) {
      return makeResponse({ success: false, error: "No action specified" });
    }

    Logger.log("Processing action: " + action);

    let result;

    switch (action) {
      case "ping":
        result = { success: true, message: "PG Sync connected! ✅" };
        break;

      case "diagnostics":
        result = {
          success: true,
          message: "Diagnostic info",
          environment: {
            scriptId: ScriptApp.getScriptId(),
            timezone: Session.getScriptTimeZone(),
          },
          receivedData: {
            method: method,
            action: action,
            dataType: typeof data,
            dataKeys: (data && typeof data === 'object') ? Object.keys(data) : null,
            dataPreview: (data && typeof data === 'object') ? JSON.stringify(data).substring(0, 300) : null
          }
        };
        break;

      case "read":
        result = readAllData();
        break;

      case "write":
        Logger.log("Write action detected");
        Logger.log("Data final check:");
        Logger.log("  - typeof data: " + typeof data);
        Logger.log("  - data === null: " + (data === null));
        Logger.log("  - data === undefined: " + (typeof data === 'undefined'));
        if (data) {
          Logger.log("  - data keys: " + Object.keys(data).join(", "));
          Logger.log("  - data preview: " + JSON.stringify(data).substring(0, 200));
        }
        
        if (!data || typeof data !== 'object') {
          Logger.log("❌ WRITE ERROR: Valid data object required");
          return makeResponse({
            success: false,
            error: "Write requires pgData object. Received type: " + typeof data,
            debug: {
              dataType: typeof data,
              dataIsNull: data === null,
              dataIsUndefined: typeof data === 'undefined',
              dataValue: data ? JSON.stringify(data) : 'N/A',
              originalParsedKeys: "Check logs for POST body content"
            }
          });
        }

        Logger.log("✅ Data validation passed, proceeding to writeData()");
        // Proceed with write
        result = writeData(data);
        break;

      default:
        result = { success: false, error: "Unknown action: " + action };
    }

    Logger.log("Result: " + JSON.stringify(result).substring(0, 200));
    Logger.log("=== END REQUEST ===");
    return makeResponse(result);

  } catch (err) {
    Logger.log("FATAL ERROR: " + err.message);
    Logger.log("Stack: " + err.stack);
    return makeResponse({
      success: false,
      error: err.message,
      stack: err.stack
    });
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

  return { success: true, data: allData };
}

// ── WRITE: Poora PG data sheets mein likho ──────────────────
function writeData(pgData) {
  Logger.log("=== writeData() CALLED ===");
  Logger.log("Checking pgData:");
  Logger.log("  typeof: " + typeof pgData);
  Logger.log("  === null: " + (pgData === null));
  Logger.log("  === undefined: " + (typeof pgData === 'undefined'));
  Logger.log("  isArray: " + Array.isArray(pgData));
  
  if (pgData && typeof pgData === 'object') {
    Logger.log("  keys: " + Object.keys(pgData).join(", "));
    Logger.log("  preview: " + JSON.stringify(pgData).substring(0, 300));
  }

  if (!pgData || typeof pgData !== 'object') {
    const errorMsg = "pgData validation failed: type=" + typeof pgData;
    Logger.log("❌ " + errorMsg);
    throw new Error(errorMsg);
  }

  if (Array.isArray(pgData)) {
    throw new Error("pgData must be object with PG names as keys, got array");
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
  Logger.log("Writing to sheets: " + pgNames.join(", "));

  pgNames.forEach(function(pgName) {
    let sheet = ss.getSheetByName(pgName);
    if (!sheet) {
      Logger.log("Creating new sheet: " + pgName);
      sheet = ss.insertSheet(pgName);
    }

    const tenants = pgData[pgName] || [];
    Logger.log("Sheet " + pgName + ": " + tenants.length + " tenants");

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

    // Only delete and rewrite data rows (keep header)
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }

    // Write new data
    if (rows.length > 1) {
      sheet.getRange(2, 1, rows.length - 1, headers.length).setValues(rows.slice(1));
    }

    // Ensure header
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
    } catch(e) {
      Logger.log("Styling error: " + e.message);
    }
  });

  Logger.log("Write completed successfully");
  return { success: true, message: "Written to " + pgNames.length + " sheets ✅" };
}

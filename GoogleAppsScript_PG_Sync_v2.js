// ============================================================
// PG TENANT MANAGER — Google Apps Script Web App
// v5 — Name-Based Safe Write (no clearContents, no data loss)
// ============================================================
// Setup: Extensions > Apps Script > paste here > Deploy > Web App
//   Execute as: Me | Access: Anyone
// ============================================================

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
}
function makeResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e)  { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  try {
    var action, data;
    if (e.postData && e.postData.contents) {
      var body = JSON.parse(e.postData.contents);
      action = body.action; data = body.data;
    } else {
      action = e.parameter.action;
      var raw = e.parameter.data;
      data = raw ? JSON.parse(raw) : null;
    }
    var result;
    if      (action === "ping")  result = { success: true, message: "PG Sync connected! ✅" };
    else if (action === "read")  result = readAllData();
    else if (action === "write") {
      if (!data) throw new Error("No data provided");
      result = writeData(data);
    } else result = { success: false, error: "Unknown action: " + action };
    return makeResponse(result);
  } catch (err) {
    return makeResponse({ success: false, error: err.message });
  }
}

// ── READ ──────────────────────────────────────────────────────
function readAllData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var allData = {};
  var MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

  ss.getSheets().forEach(function(sheet) {
    var name = sheet.getName();
    if (name.startsWith("_")) return;

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) { allData[name] = []; return; }

    var tenants = [];
    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      if (!row[0] || String(row[0]).trim() === '') continue;

      var formatDate = function(val) {
        if (!val) return "";
        try { return Utilities.formatDate(new Date(val), Session.getScriptTimeZone(), "yyyy-MM-dd"); }
        catch(e) { return String(val); }
      };

      var tenant = {
        name:        String(row[0] || ""),
        contact:     String(row[1] || ""),
        deposit:     String(row[2] || ""),
        depositPaid: String(row[3] || ""),
        rent:        String(row[4] || ""),
        dateJoining: formatDate(row[5]),
        dateLeaving: formatDate(row[6]),
        note:        String(row[7] || ""),
        monthly:     {}
      };

      // Monthly: col 8 onward, 4 cols per month
      MONTHS.forEach(function(month, i) {
        var base = 8 + (i * 4);
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

// ── WRITE — Name-based safe write, NO clearContents ───────────
//
// Logic:
//   1. Read existing rows, build name→rowNumber map
//   2. For each incoming tenant:
//      - Found by name → smart update that row only
//      - Not found     → append new row
//   3. NEVER clearContents(), NEVER overwrite whole sheet
//   4. Partial data: blank incoming value → keep existing value
//
function writeData(pgData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

  // Header row (col layout matches readAllData above)
  var headers = ["Name","Contact","Deposit","DepositPaid","Rent",
                 "Date Joining","Date Leaving","Note"];
  MONTHS.forEach(function(m) {
    headers.push(m+" Amount", m+" Half/Full", m+" Collector", m+" Note");
  });
  var TOTAL_COLS = headers.length; // 8 + 48 = 56

  var pgNames = Object.keys(pgData);
  var totalUpdated = 0, totalAdded = 0;

  pgNames.forEach(function(pgName) {
    try {
      // Get or create sheet
      var sheet = ss.getSheetByName(pgName);
      if (!sheet) {
        sheet = ss.insertSheet(pgName);
        Logger.log("Created sheet: " + pgName);
      }

      // Ensure sheet has enough columns
      if (sheet.getMaxColumns() < TOTAL_COLS) {
        sheet.insertColumnsAfter(sheet.getMaxColumns(),
          TOTAL_COLS - sheet.getMaxColumns());
      }

      // Write header if sheet is empty OR first cell is not "Name"
      var firstCell = sheet.getLastRow() > 0
        ? String(sheet.getRange(1,1).getValue()).trim() : "";
      if (firstCell !== "Name") {
        // Expand rows if needed
        if (sheet.getMaxRows() < 1) sheet.insertRowAfter(1);
        sheet.getRange(1, 1, 1, TOTAL_COLS).setValues([headers]);
        // Style header
        try {
          var hr = sheet.getRange(1, 1, 1, TOTAL_COLS);
          hr.setBackground("#1a1a2e");
          hr.setFontColor("#ffffff");
          hr.setFontWeight("bold");
          sheet.setFrozenRows(1);
        } catch(e) {}
      }

      // Build name → rowNumber map from existing sheet data
      // nameMap["ravi kumar"] = 5  (1-based row number)
      var nameMap = {};
      var lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        var nameCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < nameCol.length; i++) {
          var n = String(nameCol[i][0] || "").trim().toLowerCase();
          if (n) nameMap[n] = i + 2; // row index (1-based, header=1)
        }
      }

      var tenants = pgData[pgName] || [];

      // Sort: day-of-month ascending, left tenants at bottom
      tenants.sort(function(a, b) {
        var aLeft = a.dateLeaving && a.dateLeaving !== "";
        var bLeft = b.dateLeaving && b.dateLeaving !== "";
        if (aLeft && !bLeft) return 1;
        if (!aLeft && bLeft) return -1;
        var dA = a.dateJoining ? new Date(a.dateJoining).getDate() : 32;
        var dB = b.dateJoining ? new Date(b.dateJoining).getDate() : 32;
        return dA - dB;
      });

      tenants.forEach(function(t) {
        if (!t || !t.name || String(t.name).trim() === '') return;

        var incomingName = String(t.name).trim().toLowerCase();
        var targetRow = nameMap[incomingName] || null;

        if (targetRow) {
          // UPDATE existing row — smart merge (blank incoming → keep existing)
          var existing = sheet.getRange(targetRow, 1, 1, TOTAL_COLS).getValues()[0];
          var updated  = buildRow(t, existing, MONTHS);
          sheet.getRange(targetRow, 1, 1, TOTAL_COLS).setValues([updated]);
          totalUpdated++;
        } else {
          // APPEND new row
          var emptyExisting = new Array(TOTAL_COLS).fill("");
          var newRow = buildRow(t, emptyExisting, MONTHS);
          sheet.appendRow(newRow);
          // Register in map to avoid duplicates within same batch
          var newIdx = sheet.getLastRow();
          nameMap[incomingName] = newIdx;
          totalAdded++;
        }
      });

      // Re-style header after writes (safe)
      try {
        sheet.getRange(1,1,1,TOTAL_COLS).setBackground("#1a1a2e")
             .setFontColor("#ffffff").setFontWeight("bold");
        sheet.setFrozenRows(1);
      } catch(e) {}

    } catch(pgErr) {
      Logger.log("ERROR on " + pgName + ": " + pgErr.message);
    }
  });

  return {
    success: true,
    message: "Done ✅ — Updated: " + totalUpdated + ", Added: " + totalAdded
  };
}

// ── Helper: build one row array, merging incoming + existing ──
// Rule: if incoming value is blank → use existing (PRESERVE)
function buildRow(t, existing, MONTHS) {
  function safe(incoming, existingVal) {
    var v = String(incoming || "").trim();
    return v !== "" ? v : String(existingVal || "");
  }

  var isLeft  = t.dateLeaving && String(t.dateLeaving).trim() !== "";
  var noteVal = String(t.note || "").trim();
  if (isLeft && noteVal.indexOf("[LEFT]") === -1) {
    noteVal = noteVal ? noteVal + " [LEFT]" : "[LEFT]";
  }
  if (!noteVal) noteVal = String(existing[7] || "");

  var row = [
    safe(t.name,        existing[0]),
    safe(t.contact,     existing[1]),
    safe(t.deposit,     existing[2]),
    safe(t.depositPaid, existing[3]),
    safe(t.rent,        existing[4]),
    safe(t.dateJoining, existing[5]),
    safe(t.dateLeaving, existing[6]),
    noteVal
  ];

  // Monthly columns (4 per month)
  MONTHS.forEach(function(m, i) {
    var base = 8 + (i * 4);
    var md   = (t.monthly && t.monthly[m]) ? t.monthly[m] : {};
    row.push(
      safe(md.amount,    existing[base    ]),
      safe(md.halfFull,  existing[base + 1]),
      safe(md.collector, existing[base + 2]),
      safe(md.note,      existing[base + 3])
    );
  });

  return row;
}

// ============================================================
// PG TENANT MANAGER — Google Apps Script Web App
// Version: v4 — ID-Based Safe Write System
// ============================================================
//
// KEY CHANGE in this version:
//   writeData() ab smart ID-based system use karta hai
//   - clearContents() KABHI nahi use hota
//   - Sirf required rows update ya append hote hain
//   - Unique tenant ID se identify karta hai (name se nahi)
//   - Partial data aaye → existing values preserve hoti hain
//   - Duplicate rows kabhi nahi bante
//
// SETUP:
//   1. Extensions > Apps Script > Code.gs mein paste karo
//   2. Deploy > New Deployment > Web App
//      Execute as: Me | Who has access: Anyone
//   3. Backup triggers: Run > setupBackupTriggers
// ============================================================


// ════════════════════════════════════════════════════════════
// ── CONFIGURATION
// ════════════════════════════════════════════════════════════

var BACKUP_SPREADSHEET_ID = "YOUR_BACKUP_SPREADSHEET_ID_HERE";
var SKIP_SHEETS            = ["Dashboard", "Monthly_Calculation"];
var BACKUP_MORNING_HOUR    = 8;
var BACKUP_EVENING_HOUR    = 20;

// ── Column layout constants ───────────────────────────────────
// COL_ID is the first column — stores unique tenant ID
// All other columns shift by 1 because of this new ID column
var COL_ID          = 1;   // A — Tenant unique ID (new)
var COL_NAME        = 2;   // B
var COL_CONTACT     = 3;   // C
var COL_DEPOSIT     = 4;   // D
var COL_DEPOSITPAID = 5;   // E — partial deposit tracking
var COL_RENT        = 6;   // F
var COL_JOINING     = 7;   // G
var COL_LEAVING     = 8;   // H
var COL_NOTE        = 9;   // I
// Columns 10+ → monthly data (4 cols per month × 12 months = 48 cols)
var COL_MONTHLY_START = 10;

var MONTHS_LIST = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

// Full header row (matches column layout above)
function buildHeaders() {
  var h = ["ID","Name","Contact","Deposit","DepositPaid","Rent",
           "Date Joining","Date Leaving","Note"];
  MONTHS_LIST.forEach(function(m) {
    h.push(m+" Amount", m+" Half/Full", m+" Collector", m+" Note");
  });
  return h;
}

// Total number of columns
var TOTAL_COLS = 9 + (12 * 4); // 57


// ════════════════════════════════════════════════════════════
// ── EXISTING FUNCTIONS — UNTOUCHED
// ════════════════════════════════════════════════════════════

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type":                 "application/json"
  };
}

function makeResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e)  { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  try {
    var action, data;
    if (e.postData && e.postData.contents) {
      var body = JSON.parse(e.postData.contents);
      action   = body.action;
      data     = body.data;
    } else {
      action   = e.parameter.action;
      var raw  = e.parameter.data;
      data     = raw ? JSON.parse(raw) : null;
    }

    var result;
    if      (action === "ping")  { result = { success: true, message: "PG Sync connected! ✅" }; }
    else if (action === "read")  { result = readAllData(); }
    else if (action === "write") {
      if (!data) throw new Error("No data provided");
      result = writeData(data);
    }
    else { result = { success: false, error: "Unknown action: " + action }; }

    return makeResponse(result);
  } catch (err) {
    return makeResponse({ success: false, error: err.message });
  }
}


// ── READ — updated to include ID column ──────────────────────
function readAllData() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var allData = {};

  sheets.forEach(function(sheet) {
    var name = sheet.getName();
    if (name.startsWith("_")) return;

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) { allData[name] = []; return; }

    // Detect whether this sheet uses new (ID column) or old (no ID) layout
    var firstHeader = String(data[0][0] || "").trim();
    var hasIdCol    = (firstHeader === "ID");

    var tenants = [];
    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      if (!row[hasIdCol ? 1 : 0]) continue; // skip empty name rows

      var offset = hasIdCol ? 1 : 0; // col offset for name/contact etc.

      var formatDate = function(val) {
        if (!val) return "";
        try { return Utilities.formatDate(new Date(val), Session.getScriptTimeZone(), "yyyy-MM-dd"); }
        catch(e) { return String(val); }
      };

      var tenant = {
        id:          hasIdCol ? String(row[0] || "") : "",
        name:        String(row[offset + 0] || ""),
        contact:     String(row[offset + 1] || ""),
        deposit:     String(row[offset + 2] || ""),
        depositPaid: hasIdCol ? String(row[offset + 3] || "") : "",
        rent:        String(row[offset + (hasIdCol ? 4 : 3)] || ""),
        dateJoining: formatDate(row[offset + (hasIdCol ? 5 : 4)]),
        dateLeaving: formatDate(row[offset + (hasIdCol ? 6 : 5)]),
        note:        String(row[offset + (hasIdCol ? 7 : 6)] || ""),
        monthly:     {}
      };

      var monthBase = hasIdCol ? COL_MONTHLY_START - 1 : 7; // 0-indexed
      MONTHS_LIST.forEach(function(month, i) {
        var base = monthBase + (i * 4);
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


// ════════════════════════════════════════════════════════════
// ── writeData() — ID-BASED SAFE WRITE (main change)
// ════════════════════════════════════════════════════════════
//
// Strategy:
//   1. Sheet load karo (ya banao agar nahi hai)
//   2. Header row check karo — upgrade karo agar old format hai
//   3. Existing rows ka ID → rowNumber map banao
//   4. Incoming tenants loop karo:
//      a. ID hai + sheet mein hai  → smart row UPDATE
//      b. ID hai + sheet mein nahi → APPEND as new row
//      c. ID nahi hai              → name+contact se dhundho (legacy)
//                                    → mila: UPDATE; nahi mila: APPEND
//   5. clearContents() KABHI NAHI use karna
//   6. Partial data: incoming blank → existing value rakhna
//
function writeData(pgData) {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var pgNames = Object.keys(pgData);
  var headers = buildHeaders();
  var updated = 0;
  var added   = 0;
  var errors  = 0;

  pgNames.forEach(function(pgName) {

    try {
      // ── Step 1: Sheet get or create ───────────────────────
      var sheet = ss.getSheetByName(pgName);
      if (!sheet) {
        sheet = ss.insertSheet(pgName);
        Logger.log("Created new sheet: " + pgName);
      }

      // ── Step 2: Ensure header row exists & is up-to-date ──
      ensureHeaders(sheet, headers);

      // ── Step 3: Build ID → rowNumber lookup from sheet ────
      // rowMap[id]          = row number (1-based, including header row)
      // nameContactMap[key] = row number (fallback for old rows without ID)
      var rowMap         = {};   // { "TENANT-123": 5 }
      var nameContactMap = {};   // { "ravi|9876543210": 5 }

      var lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        // Read only ID, Name, Contact columns for the lookup (efficient)
        var lookupRange = sheet.getRange(2, COL_ID, lastRow - 1, 3);
        var lookupVals  = lookupRange.getValues();

        for (var i = 0; i < lookupVals.length; i++) {
          var existingId      = String(lookupVals[i][0] || "").trim();
          var existingName    = String(lookupVals[i][1] || "").trim().toLowerCase();
          var existingContact = String(lookupVals[i][2] || "").trim().replace(/\s/g, "");
          var sheetRow        = i + 2; // +2 because row 1 is header

          if (existingId)   rowMap[existingId] = sheetRow;

          var ncKey = existingName + "|" + existingContact;
          if (ncKey !== "|") nameContactMap[ncKey] = sheetRow;
        }
      }

      // ── Step 4: Process each incoming tenant ──────────────
      var tenants = pgData[pgName] || [];

      tenants.forEach(function(t) {

        // 4a. Assign ID if missing
        var tenantId = String(t.id || "").trim();
        if (!tenantId) {
          tenantId = generateId(t);
        }

        // 4b. Find existing row
        var targetRow = null;

        if (rowMap[tenantId]) {
          targetRow = rowMap[tenantId]; // found by ID
        } else {
          // Fallback: match by name + contact (legacy support)
          var incomingName    = String(t.name || "").trim().toLowerCase();
          var incomingContact = String(t.contact || "").trim().replace(/\s/g, "");
          var ncKey           = incomingName + "|" + incomingContact;
          if (ncKey !== "|" && nameContactMap[ncKey]) {
            targetRow = nameContactMap[ncKey];
          }
        }

        if (targetRow) {
          // ── UPDATE existing row (smart partial update) ────
          smartUpdateRow(sheet, targetRow, tenantId, t, headers);
          updated++;
        } else {
          // ── APPEND new row ────────────────────────────────
          appendNewRow(sheet, tenantId, t, headers);
          // Register in maps so duplicates are caught within same batch
          var newRow = sheet.getLastRow();
          rowMap[tenantId] = newRow;
          var ncKey2 = String(t.name||"").trim().toLowerCase() + "|" +
                       String(t.contact||"").trim().replace(/\s/g,"");
          if (ncKey2 !== "|") nameContactMap[ncKey2] = newRow;
          added++;
        }
      });

      // ── Step 5: Style header (safe, no content change) ────
      try {
        var hr = sheet.getRange(1, 1, 1, headers.length);
        hr.setBackground("#1a1a2e");
        hr.setFontColor("#ffffff");
        hr.setFontWeight("bold");
        sheet.setFrozenRows(1);
      } catch(e) {}

      Logger.log(pgName + ": " + updated + " updated, " + added + " added");

    } catch (sheetErr) {
      Logger.log("ERROR on " + pgName + ": " + sheetErr.message);
      errors++;
    }
  });

  return {
    success: true,
    message: "Done ✅ — Updated: " + updated + ", Added: " + added +
             (errors > 0 ? ", Errors: " + errors : "")
  };
}


// ════════════════════════════════════════════════════════════
// ── HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════

/**
 * generateId()
 * Tenant ke liye unique ID banao
 * Format: PG-YYYYMMDD-RANDOM4
 * Example: PG-20250401-A3F9
 */
function generateId(tenant) {
  var dateStr = "";
  if (tenant.dateJoining) {
    dateStr = tenant.dateJoining.replace(/-/g, "").slice(0, 8);
  } else {
    var now = new Date();
    dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyyMMdd");
  }
  var rand = Math.random().toString(36).toUpperCase().slice(2, 6);
  return "PG-" + dateStr + "-" + rand;
}


/**
 * ensureHeaders()
 * Sheet ka first row check karo.
 * Agar blank hai ya old format hai → new headers likh do.
 * NEVER clears data rows — sirf row 1 touch karta hai.
 */
function ensureHeaders(sheet, headers) {
  var lastCol     = Math.max(sheet.getLastColumn(), headers.length);
  var currentRows = sheet.getLastRow();

  // Expand columns if needed
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(),
      headers.length - sheet.getMaxColumns());
  }

  if (currentRows === 0) {
    // Sheet empty hai — header likhna safe hai
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  // Check if header row has "ID" in first cell
  var firstCell = String(sheet.getRange(1, 1).getValue() || "").trim();
  if (firstCell !== "ID") {
    // Old format ya no header — write new header to row 1 only
    // (Data rows start from row 2 — untouched)
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  // If already "ID" → headers are fine, skip
}


/**
 * smartUpdateRow()
 * Existing row ko update karo — sirf wahi fields jo incoming mein hain
 * Blank/missing incoming value → existing value PRESERVE karo
 * clearContents() NEVER called
 */
function smartUpdateRow(sheet, rowNum, tenantId, incoming, headers) {
  // Read existing row
  var existingRange = sheet.getRange(rowNum, 1, 1, TOTAL_COLS);
  var existingVals  = existingRange.getValues()[0];

  // Build updated row — merge incoming with existing
  var updatedRow = buildRowArray(tenantId, incoming, existingVals);

  // Write only if values changed (avoid unnecessary writes)
  var hasChange = false;
  for (var c = 0; c < updatedRow.length; c++) {
    if (String(updatedRow[c]) !== String(existingVals[c] || "")) {
      hasChange = true;
      break;
    }
  }

  if (hasChange) {
    existingRange.setValues([updatedRow]);
  }
}


/**
 * appendNewRow()
 * Sheet ke end mein naya row append karo
 * clearContents() use nahi hota
 */
function appendNewRow(sheet, tenantId, tenant, headers) {
  // Expand rows if needed
  if (sheet.getMaxRows() <= sheet.getLastRow()) {
    sheet.insertRowAfter(sheet.getLastRow());
  }

  var emptyExisting = new Array(TOTAL_COLS).fill("");
  var newRow = buildRowArray(tenantId, tenant, emptyExisting);
  sheet.appendRow(newRow);
}


/**
 * buildRowArray()
 * Ek complete row array banao incoming + existing values ko merge karke
 *
 * Rules:
 *   - incoming value hai (non-blank) → use incoming
 *   - incoming blank/undefined → use existing (PRESERVE)
 *   - ID column always use tenantId
 */
function buildRowArray(tenantId, t, existing) {
  // Helper: use incoming value only if non-blank, else keep existing
  function safe(incomingVal, existingVal) {
    var v = String(incomingVal || "").trim();
    return v !== "" ? v : String(existingVal || "");
  }

  var isLeft   = t.dateLeaving && String(t.dateLeaving).trim() !== "";
  var noteVal  = String(t.note || "").trim();
  if (isLeft && noteVal.indexOf("[LEFT]") === -1) {
    noteVal = noteVal ? noteVal + " [LEFT]" : "[LEFT]";
  }

  // COL indices are 1-based, array is 0-based → subtract 1
  var row = new Array(TOTAL_COLS).fill("");

  row[COL_ID          - 1] = tenantId;
  row[COL_NAME        - 1] = safe(t.name,        existing[COL_NAME        - 1]);
  row[COL_CONTACT     - 1] = safe(t.contact,     existing[COL_CONTACT     - 1]);
  row[COL_DEPOSIT     - 1] = safe(t.deposit,     existing[COL_DEPOSIT     - 1]);
  row[COL_DEPOSITPAID - 1] = safe(t.depositPaid, existing[COL_DEPOSITPAID - 1]);
  row[COL_RENT        - 1] = safe(t.rent,        existing[COL_RENT        - 1]);
  row[COL_JOINING     - 1] = safe(t.dateJoining, existing[COL_JOINING     - 1]);
  row[COL_LEAVING     - 1] = safe(t.dateLeaving, existing[COL_LEAVING     - 1]);
  row[COL_NOTE        - 1] = noteVal || String(existing[COL_NOTE - 1] || "");

  // Monthly data
  MONTHS_LIST.forEach(function(month, i) {
    var base = COL_MONTHLY_START - 1 + (i * 4); // 0-indexed
    var md   = (t.monthly && t.monthly[month]) ? t.monthly[month] : {};
    var ex   = existing; // shorthand

    row[base    ] = safe(md.amount,    ex[base    ]);
    row[base + 1] = safe(md.halfFull,  ex[base + 1]);
    row[base + 2] = safe(md.collector, ex[base + 2]);
    row[base + 3] = safe(md.note,      ex[base + 3]);
  });

  return row;
}


// ════════════════════════════════════════════════════════════
// ── BACKUP SYSTEM
// ════════════════════════════════════════════════════════════

/**
 * backupSpreadsheet()
 * Source → Destination backup, formula-safe, cell-by-cell
 * SKIP_SHEETS skip hoti hain
 * clearContents() use nahi hota
 */
function backupSpreadsheet() {
  var startTime = new Date();
  Logger.log("Backup started: " + startTime.toLocaleString());

  var srcSS, dstSS;
  try { srcSS = SpreadsheetApp.getActiveSpreadsheet(); }
  catch(e) { Logger.log("ERROR: Source open fail: " + e.message); return; }
  try { dstSS = SpreadsheetApp.openById(BACKUP_SPREADSHEET_ID); }
  catch(e) { Logger.log("ERROR: Backup spreadsheet open fail. ID check karo."); return; }

  var backedUp = 0, skipped = 0, created = 0, errors = 0;

  srcSS.getSheets().forEach(function(srcSheet) {
    var sheetName = srcSheet.getName();
    if (SKIP_SHEETS.indexOf(sheetName) !== -1) { skipped++; return; }

    try {
      var srcRange    = srcSheet.getDataRange();
      var srcValues   = srcRange.getValues();
      var srcFormulas = srcRange.getFormulas();
      var numRows     = srcValues.length;
      var numCols     = srcValues[0] ? srcValues[0].length : 0;
      if (numRows === 0 || numCols === 0) { skipped++; return; }

      var dstSheet = dstSS.getSheetByName(sheetName);
      if (!dstSheet) { dstSheet = dstSS.insertSheet(sheetName); created++; }

      if (dstSheet.getMaxRows()    < numRows) dstSheet.insertRowsAfter(dstSheet.getMaxRows(), numRows - dstSheet.getMaxRows());
      if (dstSheet.getMaxColumns() < numCols) dstSheet.insertColumnsAfter(dstSheet.getMaxColumns(), numCols - dstSheet.getMaxColumns());

      var dstRange        = dstSheet.getRange(1, 1, numRows, numCols);
      var dstFormulas     = dstRange.getFormulas();
      var dstCurrentVals  = dstRange.getValues();
      var updateMatrix    = [];
      var changed         = 0;

      for (var r = 0; r < numRows; r++) {
        var rowArr = [];
        for (var c = 0; c < numCols; c++) {
          var sF = (srcFormulas[r]  && srcFormulas[r][c])  ? srcFormulas[r][c]  : "";
          var dF = (dstFormulas[r]  && dstFormulas[r][c])  ? dstFormulas[r][c]  : "";
          if (sF !== "" || dF !== "") {
            rowArr.push(dstCurrentVals[r][c]); // formula cell — preserve
          } else {
            rowArr.push(srcValues[r][c]);       // normal cell — copy
            if (srcValues[r][c] !== dstCurrentVals[r][c]) changed++;
          }
        }
        updateMatrix.push(rowArr);
      }

      dstRange.setValues(updateMatrix);
      Logger.log("Backed up: " + sheetName + " (" + changed + " cells changed)");
      backedUp++;

    } catch(e) { Logger.log("ERROR on " + sheetName + ": " + e.message); errors++; }
  });

  var dur = Math.round((new Date() - startTime) / 1000);
  Logger.log("Backup done in " + dur + "s — " + backedUp + " sheets, " +
             created + " new, " + skipped + " skipped, " + errors + " errors");
}


/**
 * setupBackupTriggers()
 * Morning + evening auto-backup triggers setup
 * Run once from Apps Script editor
 */
function setupBackupTriggers() {
  // Delete old backup triggers first
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "backupSpreadsheet") ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger("backupSpreadsheet").timeBased().everyDays(1).atHour(BACKUP_MORNING_HOUR).create();
  ScriptApp.newTrigger("backupSpreadsheet").timeBased().everyDays(1).atHour(BACKUP_EVENING_HOUR).create();

  Logger.log("✅ Triggers set: " + BACKUP_MORNING_HOUR + ":00 and " + BACKUP_EVENING_HOUR + ":00 daily");
}


/**
 * deleteAllBackupTriggers() — emergency use
 */
function deleteAllBackupTriggers() {
  var count = 0;
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "backupSpreadsheet") { ScriptApp.deleteTrigger(t); count++; }
  });
  Logger.log("Deleted " + count + " backup trigger(s).");
}


/**
 * testBackup() — manual test
 */
function testBackup() {
  if (BACKUP_SPREADSHEET_ID === "YOUR_BACKUP_SPREADSHEET_ID_HERE") {
    Logger.log("❌ BACKUP_SPREADSHEET_ID set nahi kiya!"); return;
  }
  backupSpreadsheet();
}

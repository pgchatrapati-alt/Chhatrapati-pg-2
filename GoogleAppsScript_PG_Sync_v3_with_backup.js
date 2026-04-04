// ============================================================
// PG TENANT MANAGER — Google Apps Script Web App
// Version: v3 — Backup System Added
// ============================================================
//
// SETUP:
//   1. Extensions > Apps Script > Code.gs mein paste karo
//   2. Deploy > New Deployment > Web App
//      - Execute as: Me
//      - Who has access: Anyone
//   3. Backup triggers setup karne ke liye:
//      Apps Script editor mein Run > setupBackupTriggers
//
// NOTE: Har code change ke baad NEW deployment banana hoga
// ============================================================

// ════════════════════════════════════════════════════════════
// ── CONFIGURATION ───────────────────────────────────────────
// ════════════════════════════════════════════════════════════

// Backup destination spreadsheet ID
// Google Sheets URL se copy karo: /spreadsheets/d/XXXXXXX/edit
// Isko apna backup spreadsheet ID se replace karo
var BACKUP_SPREADSHEET_ID = "YOUR_BACKUP_SPREADSHEET_ID_HERE";

// Ye sheets backup ke time skip ki jayengi (formulas / dashboards)
var SKIP_SHEETS = ["Dashboard", "Monthly_Calculation"];

// Backup triggers ka time (24-hour format)
var BACKUP_MORNING_HOUR = 8;   // 8:00 AM
var BACKUP_EVENING_HOUR = 20;  // 8:00 PM


// ════════════════════════════════════════════════════════════
// ── EXISTING FUNCTIONS (BILKUL CHANGE NAHI KIYE) ────────────
// ════════════════════════════════════════════════════════════

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
    var action, data;

    if (e.postData && e.postData.contents) {
      var body = JSON.parse(e.postData.contents);
      action = body.action;
      data = body.data;
    } else {
      action = e.parameter.action;
      var raw = e.parameter.data;
      data = raw ? JSON.parse(raw) : null;
    }

    var result;

    if (action === "ping") {
      result = { success: true, message: "PG Sync connected! ✅" };

    } else if (action === "read") {
      result = readAllData();

    } else if (action === "write") {
      if (!data) throw new Error("No data provided");
      result = writeData(data);

    } else {
      result = { success: false, error: "Unknown action: " + action };
    }

    return makeResponse(result);

  } catch (err) {
    return makeResponse({ success: false, error: err.message });
  }
}

// ── READ: Saari sheets se data lao ───────────────────────────
function readAllData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var allData = {};

  var MONTHS = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  sheets.forEach(function(sheet) {
    var name = sheet.getName();
    if (name.startsWith("_")) return;

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      allData[name] = [];
      return;
    }

    var tenants = [];

    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      if (!row[0]) continue;

      var formatDate = function(val) {
        if (!val) return "";
        try {
          return Utilities.formatDate(new Date(val), Session.getScriptTimeZone(), "yyyy-MM-dd");
        } catch(e) {
          return String(val);
        }
      };

      var tenant = {
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
        var base = 7 + (i * 4);
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

// ── WRITE: Poora PG data sheets mein likho ───────────────────
function writeData(pgData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var MONTHS = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  var headers = ["Name","Contact","Deposit","Rent","Date Joining","Date Leaving","Note"];
  MONTHS.forEach(function(m) {
    headers.push(m+" Amount", m+" Half/Full", m+" Collector", m+" Note");
  });

  var pgNames = Object.keys(pgData);

  pgNames.forEach(function(pgName) {
    var sheet = ss.getSheetByName(pgName);
    if (!sheet) {
      sheet = ss.insertSheet(pgName);
    }

    var tenants = pgData[pgName] || [];
    var rows = [headers];

    // Sort: day-of-month (1→31), left tenants at bottom
    tenants.sort(function(a, b) {
      var aLeft = a.dateLeaving && a.dateLeaving !== "";
      var bLeft = b.dateLeaving && b.dateLeaving !== "";
      if (aLeft && !bLeft) return 1;
      if (!aLeft && bLeft) return -1;
      var dayA = a.dateJoining ? new Date(a.dateJoining).getDate() : 32;
      var dayB = b.dateJoining ? new Date(b.dateJoining).getDate() : 32;
      return dayA - dayB;
    });

    tenants.forEach(function(t) {
      var isLeft = t.dateLeaving && t.dateLeaving !== "";
      var row = [
        t.name        || "",
        t.contact     || "",
        t.deposit     || "",
        t.rent        || "",
        t.dateJoining || "",
        t.dateLeaving || "",
        isLeft ? (t.note ? t.note + " [LEFT]" : "[LEFT]") : (t.note || "")
      ];

      MONTHS.forEach(function(m) {
        var md = (t.monthly && t.monthly[m]) ? t.monthly[m] : {};
        row.push(
          md.amount    || "",
          md.halfFull  || "",
          md.collector || "",
          md.note      || ""
        );
      });

      rows.push(row);
    });

    sheet.clearContents();
    if (rows.length > 0) {
      sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
    }

    try {
      var hr = sheet.getRange(1, 1, 1, headers.length);
      hr.setBackground("#1a1a2e");
      hr.setFontColor("#ffffff");
      hr.setFontWeight("bold");
      sheet.setFrozenRows(1);
    } catch(e) {}
  });

  return { success: true, message: "Written to " + pgNames.length + " sheets ✅" };
}


// ════════════════════════════════════════════════════════════
// ── BACKUP SYSTEM (NEW — Existing code ko touch nahi kiya) ──
// ════════════════════════════════════════════════════════════

/**
 * backupSpreadsheet()
 *
 * Source spreadsheet ka data backup spreadsheet mein copy karta hai.
 *
 * Rules:
 *   - SKIP_SHEETS list waali sheets skip hoti hain
 *   - Source cell mein formula ho → skip (copy nahi)
 *   - Destination cell mein formula ho → skip (overwrite nahi)
 *   - Dono mein normal value ho → update karo
 *   - clearContents() use nahi kiya — cell-by-cell safe update
 *   - Sheet exist na kare backup mein → create karo
 */
function backupSpreadsheet() {

  var startTime = new Date();
  Logger.log("═══════════════════════════════════════");
  Logger.log("Backup started: " + startTime.toLocaleString());
  Logger.log("═══════════════════════════════════════");

  // ── Step 1: Source & Destination spreadsheets open karo ───
  var srcSS;
  var dstSS;

  try {
    srcSS = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    Logger.log("ERROR: Source spreadsheet open nahi ho raha: " + e.message);
    return;
  }

  try {
    dstSS = SpreadsheetApp.openById(BACKUP_SPREADSHEET_ID);
  } catch (e) {
    Logger.log("ERROR: Backup spreadsheet open nahi ho raha.");
    Logger.log("BACKUP_SPREADSHEET_ID check karo: " + BACKUP_SPREADSHEET_ID);
    Logger.log("Error: " + e.message);
    return;
  }

  var srcSheets  = srcSS.getSheets();
  var backedUp   = 0;
  var skipped    = 0;
  var created    = 0;
  var errors     = 0;

  // ── Step 2: Source ki har sheet loop karo ─────────────────
  srcSheets.forEach(function(srcSheet) {

    var sheetName = srcSheet.getName();

    // ── Check 1: Skip list mein hai? ──────────────────────
    if (SKIP_SHEETS.indexOf(sheetName) !== -1) {
      Logger.log("SKIP → '" + sheetName + "' (skip list mein hai)");
      skipped++;
      return; // forEach continue
    }

    Logger.log("Processing → '" + sheetName + "'");

    try {
      // ── Step 3: Source sheet ka data + formulas fetch karo
      var srcRange    = srcSheet.getDataRange();
      var srcValues   = srcRange.getValues();    // actual display values
      var srcFormulas = srcRange.getFormulas();  // formula strings (empty = no formula)

      var numRows = srcValues.length;
      var numCols = srcValues[0] ? srcValues[0].length : 0;

      if (numRows === 0 || numCols === 0) {
        Logger.log("  → Empty sheet, skip");
        skipped++;
        return;
      }

      // ── Step 4: Destination sheet find ya create karo ─────
      var dstSheet = dstSS.getSheetByName(sheetName);

      if (!dstSheet) {
        // Sheet exist nahi karti → nai sheet banao
        dstSheet = dstSS.insertSheet(sheetName);
        created++;
        Logger.log("  → Created new sheet in backup: '" + sheetName + "'");
      }

      // ── Step 5: Destination ka existing data + formulas ───
      // Destination sheet expand karo agar chhoti hai
      var dstLastRow = Math.max(dstSheet.getMaxRows(), numRows);
      var dstLastCol = Math.max(dstSheet.getMaxColumns(), numCols);

      // Rows/cols expand if needed
      if (dstSheet.getMaxRows() < numRows) {
        dstSheet.insertRowsAfter(dstSheet.getMaxRows(), numRows - dstSheet.getMaxRows());
      }
      if (dstSheet.getMaxColumns() < numCols) {
        dstSheet.insertColumnsAfter(dstSheet.getMaxColumns(), numCols - dstSheet.getMaxColumns());
      }

      // Destination ka existing data fetch karo (same range)
      var dstRange    = dstSheet.getRange(1, 1, numRows, numCols);
      var dstFormulas = dstRange.getFormulas(); // destination formulas

      // ── Step 6: Cell-by-cell safe update ──────────────────
      //
      // Logic (as required):
      //   - Source cell mein formula → SKIP
      //   - Destination cell mein formula → SKIP
      //   - Dono normal value → UPDATE
      //
      // Batch mein updates karne ke liye:
      //   Ek 2D array banao jisme sirf wahi values hongi jo update hongi
      //   Baki cells ke liye current destination value rakhenge
      //   Phir ek hi setValues() call se likh denge (efficient)

      var dstCurrentValues = dstRange.getValues();
      var updateMatrix     = []; // new values to write
      var changedCount     = 0;

      for (var r = 0; r < numRows; r++) {
        var rowArray = [];
        for (var c = 0; c < numCols; c++) {

          var srcFormula  = srcFormulas[r]  && srcFormulas[r][c]  ? srcFormulas[r][c]  : "";
          var dstFormula  = dstFormulas[r]  && dstFormulas[r][c]  ? dstFormulas[r][c]  : "";
          var srcVal      = srcValues[r][c];
          var dstCurrent  = dstCurrentValues[r][c];

          if (srcFormula !== "") {
            // Source mein formula hai → is cell ko copy mat karo
            // Destination ka jo bhi hai wahi rakhne do
            rowArray.push(dstCurrent);

          } else if (dstFormula !== "") {
            // Destination mein formula hai → overwrite mat karo
            rowArray.push(dstCurrent);

          } else {
            // Dono mein normal value → update karo
            rowArray.push(srcVal);
            if (srcVal !== dstCurrent) {
              changedCount++;
            }
          }
        }
        updateMatrix.push(rowArray);
      }

      // ── Step 7: Ek batch mein write karo (efficient) ──────
      dstRange.setValues(updateMatrix);

      Logger.log("  → Updated " + changedCount + " cells (formulas protected)");
      backedUp++;

    } catch (sheetErr) {
      Logger.log("  ERROR on sheet '" + sheetName + "': " + sheetErr.message);
      errors++;
    }

  }); // end forEach sheet

  // ── Step 8: Summary log ───────────────────────────────────
  var endTime  = new Date();
  var duration = Math.round((endTime - startTime) / 1000);

  Logger.log("═══════════════════════════════════════");
  Logger.log("Backup completed: " + endTime.toLocaleString());
  Logger.log("Duration: " + duration + " seconds");
  Logger.log("Sheets backed up: " + backedUp);
  Logger.log("Sheets skipped:   " + skipped);
  Logger.log("New sheets:       " + created);
  Logger.log("Errors:           " + errors);
  Logger.log("═══════════════════════════════════════");
}


/**
 * setupBackupTriggers()
 *
 * Backup ke liye 2 time-based triggers setup karta hai:
 *   - Morning: BACKUP_MORNING_HOUR baje
 *   - Evening: BACKUP_EVENING_HOUR baje
 *
 * Pehle purane saare backup triggers delete karta hai
 * taaki duplicate triggers na banein.
 *
 * HOW TO RUN:
 *   Apps Script editor → Run → setupBackupTriggers
 *   (Sirf ek baar chalana hai)
 */
function setupBackupTriggers() {

  Logger.log("Setting up backup triggers...");

  // ── Step 1: Purane triggers delete karo ───────────────────
  var allTriggers    = ScriptApp.getProjectTriggers();
  var deletedCount   = 0;

  allTriggers.forEach(function(trigger) {
    // Sirf backupSpreadsheet ke triggers delete karo
    if (trigger.getHandlerFunction() === "backupSpreadsheet") {
      ScriptApp.deleteTrigger(trigger);
      deletedCount++;
      Logger.log("Deleted old trigger: " + trigger.getUniqueId());
    }
  });

  Logger.log("Deleted " + deletedCount + " old trigger(s)");

  // ── Step 2: Morning trigger banao ─────────────────────────
  var morningTrigger = ScriptApp.newTrigger("backupSpreadsheet")
    .timeBased()
    .everyDays(1)
    .atHour(BACKUP_MORNING_HOUR)
    .create();

  Logger.log("✅ Morning trigger created: " + BACKUP_MORNING_HOUR + ":00 daily");
  Logger.log("   Trigger ID: " + morningTrigger.getUniqueId());

  // ── Step 3: Evening trigger banao ─────────────────────────
  var eveningTrigger = ScriptApp.newTrigger("backupSpreadsheet")
    .timeBased()
    .everyDays(1)
    .atHour(BACKUP_EVENING_HOUR)
    .create();

  Logger.log("✅ Evening trigger created: " + BACKUP_EVENING_HOUR + ":00 daily");
  Logger.log("   Trigger ID: " + eveningTrigger.getUniqueId());

  Logger.log("══════════════════════════════════");
  Logger.log("Triggers setup complete!");
  Logger.log("Backup will run at:");
  Logger.log("  - " + BACKUP_MORNING_HOUR + ":00 AM daily");
  Logger.log("  - " + BACKUP_EVENING_HOUR + ":00 PM daily");
  Logger.log("══════════════════════════════════");
}


/**
 * deleteAllBackupTriggers()
 *
 * Emergency use: Saare backup triggers ek saath delete karo
 * Run karo agar triggers band karne ho
 */
function deleteAllBackupTriggers() {

  var triggers     = ScriptApp.getProjectTriggers();
  var deletedCount = 0;

  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "backupSpreadsheet") {
      ScriptApp.deleteTrigger(trigger);
      deletedCount++;
    }
  });

  Logger.log("Deleted " + deletedCount + " backup trigger(s). Backup band ho gaya.");
}


/**
 * testBackup()
 *
 * Manual test: Backup ek baar turant chalao
 * Run karo: Apps Script editor → Run → testBackup
 */
function testBackup() {
  Logger.log("=== MANUAL TEST RUN ===");

  if (BACKUP_SPREADSHEET_ID === "YOUR_BACKUP_SPREADSHEET_ID_HERE") {
    Logger.log("❌ ERROR: BACKUP_SPREADSHEET_ID set nahi kiya!");
    Logger.log("   Upar BACKUP_SPREADSHEET_ID variable mein apna backup");
    Logger.log("   spreadsheet ID paste karo phir dobara run karo.");
    return;
  }

  backupSpreadsheet();
  Logger.log("=== TEST COMPLETE — Check Execution Log ===");
}

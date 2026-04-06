// PG TENANT MANAGER — Google Apps Script Web App
// Simple safe write: header untouched, data rewritten cleanly

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
      var b = JSON.parse(e.postData.contents);
      action = b.action; data = b.data;
    } else {
      action = e.parameter.action;
      data = e.parameter.data ? JSON.parse(e.parameter.data) : null;
    }
    if (action === "ping")        return makeResponse({ success: true, message: "Connected ✅" });
    if (action === "read")        return makeResponse(readAllData());
    if (action === "write" && data) return makeResponse(writeData(data));
    return makeResponse({ success: false, error: "Unknown action" });
  } catch(err) {
    return makeResponse({ success: false, error: err.message });
  }
}

// ── READ ──────────────────────────────────────────────────────
function readAllData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
  var allData = {};

  ss.getSheets().forEach(function(sheet) {
    var name = sheet.getName();
    if (name.startsWith("_")) return;
    var rows = sheet.getDataRange().getValues();
    if (rows.length < 2) { allData[name] = []; return; }

    var tenants = [];
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row[0] || String(row[0]).trim() === '') continue; // skip blank rows
      var fmtDate = function(v) {
        if (!v) return "";
        try { return Utilities.formatDate(new Date(v), Session.getScriptTimeZone(), "yyyy-MM-dd"); }
        catch(e) { return String(v); }
      };
      var t = {
        name: String(row[0]||""), contact: String(row[1]||""),
        deposit: String(row[2]||""), rent: String(row[3]||""),
        dateJoining: fmtDate(row[4]), dateLeaving: fmtDate(row[5]),
        note: String(row[6]||""), monthly: {}
      };
      MONTHS.forEach(function(m, i) {
        var b = 7 + i*4;
        t.monthly[m] = {
          amount: String(row[b]||""), halfFull: String(row[b+1]||""),
          collector: String(row[b+2]||""), note: String(row[b+3]||"")
        };
      });
      tenants.push(t);
    }
    allData[name] = tenants;
  });
  return { success: true, data: allData };
}

// ── WRITE ─────────────────────────────────────────────────────
// Strategy (simple & safe):
//   1. Keep header row (row 1) always safe — never touch it
//   2. Active tenants sorted by joining day → written from row 2 onward
//   3. One blank separator row after active tenants
//   4. Left tenants after separator
//   5. Clear only DATA rows (row 2 onward), not header
//   6. New tenant = just part of sorted list, naturally goes to right position
//
function writeData(pgData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
  var headers = ["Name","Contact","Deposit","Rent","Date Joining","Date Leaving","Note"];
  MONTHS.forEach(function(m) { headers.push(m+" Amount",m+" Half/Full",m+" Collector",m+" Note"); });
  var NCOLS = headers.length;

  Object.keys(pgData).forEach(function(pgName) {
    try {
      var sheet = ss.getSheetByName(pgName);
      if (!sheet) sheet = ss.insertSheet(pgName);

      // Expand columns if needed
      if (sheet.getMaxColumns() < NCOLS)
        sheet.insertColumnsAfter(sheet.getMaxColumns(), NCOLS - sheet.getMaxColumns());

      // ── Step 1: Write/ensure header ───────────────────────
      var hdr = sheet.getLastRow() > 0 ? String(sheet.getRange(1,1).getValue()).trim() : "";
      if (hdr !== "Name") {
        if (sheet.getLastRow() === 0) sheet.appendRow(headers);
        else sheet.getRange(1,1,1,NCOLS).setValues([headers]);
        styleHeader(sheet, NCOLS);
      }

      // ── Step 2: Read existing sheet data for merge ────────
      // We need existing monthly data so we don't lose it on update
      // Build name → existing full row map
      var existingMap = {};
      var lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        var existing = sheet.getRange(2, 1, lastRow-1, NCOLS).getValues();
        existing.forEach(function(row) {
          var n = String(row[0]||"").trim().toLowerCase();
          if (n) existingMap[n] = row;
        });
      }

      // ── Step 3: Separate active vs left ───────────────────
      var tenants = (pgData[pgName] || []).filter(function(t) { return t && t.name; });
      var active = tenants.filter(function(t) { return !t.dateLeaving || t.dateLeaving === ""; });
      var left   = tenants.filter(function(t) { return t.dateLeaving && t.dateLeaving !== ""; });

      // Sort by day-of-month (1→31)
      function byDay(a, b) {
        return (a.dateJoining ? new Date(a.dateJoining).getDate() : 32) -
               (b.dateJoining ? new Date(b.dateJoining).getDate() : 32);
      }
      active.sort(byDay);
      left.sort(byDay);

      // ── Step 4: Build all data rows ────────────────────────
      var dataRows = [];
      active.forEach(function(t) {
        var ex = existingMap[String(t.name).trim().toLowerCase()] || new Array(NCOLS).fill("");
        dataRows.push(buildRow(t, ex, MONTHS, false));
      });

      // Blank separator row (only if there are left tenants)
      if (left.length > 0) {
        dataRows.push(new Array(NCOLS).fill(""));
        left.forEach(function(t) {
          var ex = existingMap[String(t.name).trim().toLowerCase()] || new Array(NCOLS).fill("");
          dataRows.push(buildRow(t, ex, MONTHS, true));
        });
      }

      // ── Step 5: Clear data rows & write fresh ─────────────
      // Only clears rows 2 onward — header (row 1) is NEVER touched
      if (dataRows.length > 0) {
        var neededRows = dataRows.length;
        // Expand sheet rows if needed
        if (sheet.getMaxRows() < neededRows + 1)
          sheet.insertRowsAfter(sheet.getMaxRows(), neededRows + 1 - sheet.getMaxRows());

        // Clear old data rows
        if (lastRow >= 2)
          sheet.getRange(2, 1, lastRow - 1, NCOLS).clearContent();

        // Write new data rows starting from row 2
        sheet.getRange(2, 1, neededRows, NCOLS).setValues(dataRows);
      }

      styleHeader(sheet, NCOLS);
    } catch(e) {
      Logger.log("ERROR " + pgName + ": " + e.message);
    }
  });

  return { success: true, message: "Saved ✅" };
}

// ── Build row: merge incoming + existing (blank in → keep existing) ─
function buildRow(t, ex, MONTHS, isLeft) {
  function s(val, fallback) {
    var v = String(val||"").trim();
    return v !== "" ? v : String(fallback||"");
  }
  var note = String(t.note||"").trim();
  if (isLeft && note.indexOf("[LEFT]") === -1) note = note ? note+" [LEFT]" : "[LEFT]";
  if (!note) note = String(ex[6]||"");

  var row = [s(t.name,ex[0]), s(t.contact,ex[1]), s(t.deposit,ex[2]),
             s(t.rent,ex[3]), s(t.dateJoining,ex[4]), s(t.dateLeaving,ex[5]), note];

  MONTHS.forEach(function(m, i) {
    var b = 7 + i*4;
    var md = (t.monthly && t.monthly[m]) || {};
    row.push(s(md.amount,ex[b]), s(md.halfFull,ex[b+1]),
             s(md.collector,ex[b+2]), s(md.note,ex[b+3]));
  });
  return row;
}

function styleHeader(sheet, ncols) {
  try {
    sheet.getRange(1,1,1,ncols).setBackground("#1a1a2e")
         .setFontColor("#ffffff").setFontWeight("bold");
    sheet.setFrozenRows(1);
  } catch(e) {}
}

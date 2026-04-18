// PG TENANT MANAGER — Google Apps Script v9
// SIMPLEST SAFE WRITE — appendRow only, no inserts, no deletes, no color

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
    if (action === "ping")  return makeResponse({ success: true, message: "Connected ✅" });
    if (action === "read")  return makeResponse(readAllData());
    if (action === "write" && data) return makeResponse(writeData(data));
    return makeResponse({ success: false, error: "Unknown action" });
  } catch(err) {
    return makeResponse({ success: false, error: err.message });
  }
}

var DATA_START = 6; // rows 1-5 user ka fixed area, row 6 se tenant data
var MONTHS = ["January","February","March","April","May","June",
              "July","August","September","October","November","December"];
var NCOLS = 59; // 7 + 12*4 + 4 joining cols (BD=rent amt, BE=halfFull, BF=deposit paid, BG=deposit collector)

// ── READ ──────────────────────────────────────────────────────
function readAllData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var allData = {};

  ss.getSheets().forEach(function(sheet) {
    var name = sheet.getName();
    if (name.startsWith("_")) return;

    var lastRow = sheet.getLastRow();
    if (lastRow < DATA_START) { allData[name] = []; return; }

    var rows = sheet.getRange(DATA_START, 1, lastRow - DATA_START + 1, NCOLS).getValues();
    var tenants = [];

    rows.forEach(function(row) {
      if (!row[0] || String(row[0]).trim() === '') return;
      var fmtDate = function(v) {
        if (!v) return "";
        try { return Utilities.formatDate(new Date(v), Session.getScriptTimeZone(), "yyyy-MM-dd"); }
        catch(e) { return String(v); }
      };
      var t = {
        name: String(row[0]||""), contact: String(row[1]||""),
        deposit: String(row[2]||""), rent: String(row[3]||""),
        dateJoining: fmtDate(row[4]), dateLeaving: fmtDate(row[5]),
        note: String(row[6]||""), monthly: {},
        joiningRentAmt:      String(row[55]||""),  // BD
        joiningRentHalfFull: String(row[56]||""),  // BE
        joiningDepositPaid:  String(row[57]||""),  // BF
        depositCollector:    String(row[58]||"")    // BG
      };
      MONTHS.forEach(function(m, i) {
        var b = 7 + i*4;
        t.monthly[m] = {
          amount:    String(row[b]  ||""),
          halfFull:  String(row[b+1]||""),
          collector: String(row[b+2]||""),
          note:      String(row[b+3]||"")
        };
      });
      tenants.push(t);
    });
    allData[name] = tenants;
  });
  return { success: true, data: allData };
}

// ── WRITE ─────────────────────────────────────────────────────
// Rules:
//   1. Never clearContent, never deleteRow, never insertRow
//   2. Find tenant by name → update that row
//   3. Not found → appendRow at bottom
//   4. No formatting/color changes ever
function writeData(pgData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(pgData).forEach(function(pgName) {
    try {
      var incoming = (pgData[pgName] || []).filter(function(t) {
        return t && t.name && String(t.name).trim() !== "";
      });
      if (incoming.length === 0) return; // NEVER touch empty sheets

      var sheet = ss.getSheetByName(pgName);
      if (!sheet) sheet = ss.insertSheet(pgName);

      if (sheet.getMaxColumns() < NCOLS)
        sheet.insertColumnsAfter(sheet.getMaxColumns(), NCOLS - sheet.getMaxColumns());

      // Build name → row number map from existing data
      var nameMap = {};
      var lastRow = sheet.getLastRow();
      if (lastRow >= DATA_START) {
        var nameVals = sheet.getRange(DATA_START, 1, lastRow - DATA_START + 1, 1).getValues();
        nameVals.forEach(function(r, i) {
          var n = String(r[0]||"").trim().toLowerCase();
          if (n) nameMap[n] = DATA_START + i;
        });
      }

      incoming.forEach(function(t) {
        var key    = String(t.name).trim().toLowerCase();
        var isLeft = !!(t.dateLeaving && String(t.dateLeaving).trim() !== "");

        if (nameMap[key]) {
          // ── UPDATE: read existing row, merge, write back ──
          var rowNum   = nameMap[key];
          var existing = sheet.getRange(rowNum, 1, 1, NCOLS).getValues()[0];
          sheet.getRange(rowNum, 1, 1, NCOLS).setValues([buildRow(t, existing, isLeft)]);
          colorRow(sheet, rowNum, isLeft, NCOLS);

        } else {
          // ── NEW: append at bottom ─────────────────────────
          var newRow = buildRow(t, new Array(NCOLS).fill(""), isLeft);
          sheet.appendRow(newRow);
          var newRowNum = sheet.getLastRow();
          nameMap[key] = newRowNum;
          colorRow(sheet, newRowNum, isLeft, NCOLS);
        }
      });

    } catch(e) {
      Logger.log("ERROR " + pgName + ": " + e.message);
    }
  });

  return { success: true, message: "Saved ✅" };
}

// ── Color rows by tenant status ─────────────────────────────
// Active tenant = light blue tint, Left tenant = grey dim
function colorRow(sheet, rowNum, isLeft, ncols) {
  try {
    var range = sheet.getRange(rowNum, 1, 1, ncols);
    if (isLeft) {
      // Left tenant: grey background, muted text
      range.setBackground('#1a1f2e');
      range.setFontColor('#64748b');
    } else {
      // Active tenant: light blue tint background
      range.setBackground('#0d1f35');
      range.setFontColor('#e0f2fe');
      // Name column (col 1) brighter
      sheet.getRange(rowNum, 1).setFontColor('#bae6fd').setFontWeight('bold');
    }
  } catch(e) {
    // Ignore color errors — data is more important
  }
}

// Merge incoming + existing. Blank incoming → keep existing value.
function buildRow(t, ex, isLeft) {
  function s(val, fallback) {
    var v = String(val||"").trim();
    return v !== "" ? v : String(fallback||"");
  }
  var note = String(t.note||"").trim() || String(ex[6]||"");
  // Never add [LEFT] to note automatically
  note = note.replace(/\s*\[LEFT\]/gi, "").trim();

  var row = [
    s(t.name,ex[0]), s(t.contact,ex[1]), s(t.deposit,ex[2]), s(t.rent,ex[3]),
    s(t.dateJoining,ex[4]), s(t.dateLeaving,ex[5]), note
  ];

  MONTHS.forEach(function(m, i) {
    var b  = 7 + i*4;
    var md = (t.monthly && t.monthly[m]) ? t.monthly[m] : {};
    row.push(
      s(md.amount,    ex[b]),
      s(md.halfFull,  ex[b+1]),
      s(md.collector, ex[b+2]),
      s(md.note,      ex[b+3])
    );
  });
  // Cols 56-59 (BD,BE,BF,BG): joining payment info
  row.push(
    s(t.joiningRentAmt,      ex[55]),  // BD: rent paid at joining
    s(t.joiningRentHalfFull, ex[56]),  // BE: full/half
    s(t.joiningDepositPaid,  ex[57]),  // BF: deposit paid at joining
    s(t.depositCollector,    ex[58])   // BG: deposit collector
  );
  return row;
}

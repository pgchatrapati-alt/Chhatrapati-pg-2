// ============================================================
// PG TENANT MANAGER — Google Apps Script Web App
// v6 — Smart row placement: active above separator, left below
// ============================================================

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":  "*",
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
      data = e.parameter.data ? JSON.parse(e.parameter.data) : null;
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
      if (!row[0] || String(row[0]).trim() === '') continue; // skip blank/separator rows

      var formatDate = function(val) {
        if (!val) return "";
        try { return Utilities.formatDate(new Date(val), Session.getScriptTimeZone(), "yyyy-MM-dd"); }
        catch(e2) { return String(val); }
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

// ── WRITE — Smart placement: active above separator, left below ─
//
// Sheet structure:
//   Row 1     : Header
//   Row 2..N  : Active tenants (sorted by day)
//   Row N+1   : BLANK separator row  ← always maintained
//   Row N+2.. : Left tenants (sorted by day)
//
// New active tenant → inserted ABOVE separator
// New left tenant   → appended BELOW separator
// Existing tenant   → updated in-place (same row, no movement)
//
function writeData(pgData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

  var headers = ["Name","Contact","Deposit","Rent",
                 "Date Joining","Date Leaving","Note"];
  MONTHS.forEach(function(m) {
    headers.push(m+" Amount", m+" Half/Full", m+" Collector", m+" Note");
  });
  var NCOLS = headers.length; // 55

  var totalUpdated = 0, totalAdded = 0;

  Object.keys(pgData).forEach(function(pgName) {
    try {
      var sheet = ss.getSheetByName(pgName);
      if (!sheet) sheet = ss.insertSheet(pgName);

      if (sheet.getMaxColumns() < NCOLS)
        sheet.insertColumnsAfter(sheet.getMaxColumns(), NCOLS - sheet.getMaxColumns());

      // Ensure header
      var firstCell = sheet.getLastRow() > 0
        ? String(sheet.getRange(1,1).getValue()).trim() : "";
      if (firstCell !== "Name") {
        sheet.getRange(1, 1, 1, NCOLS).setValues([headers]);
        styleHeader(sheet, NCOLS);
      }

      // ── Read sheet: build maps & find separator row ──────
      var lastRow = sheet.getLastRow();

      // nameMap: tenant name (lowercase) → row number
      var nameMap   = {};
      var sepRow    = 0; // row number of blank separator (0 = not found yet)

      if (lastRow >= 2) {
        var allVals = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < allVals.length; i++) {
          var cellVal = String(allVals[i][0] || "").trim();
          var rowNum  = i + 2;
          if (cellVal === '') {
            // First blank row = separator
            if (sepRow === 0) sepRow = rowNum;
          } else {
            nameMap[cellVal.toLowerCase()] = rowNum;
          }
        }
      }

      // ── Separate incoming into active vs left ─────────────
      var tenants = pgData[pgName] || [];
      var active = tenants.filter(function(t) {
        return t && t.name && (!t.dateLeaving || t.dateLeaving === "");
      });
      var left = tenants.filter(function(t) {
        return t && t.name && t.dateLeaving && t.dateLeaving !== "";
      });

      // Sort both by day-of-month (1→31)
      function sortByDay(arr) {
        arr.sort(function(a, b) {
          var dA = a.dateJoining ? new Date(a.dateJoining).getDate() : 32;
          var dB = b.dateJoining ? new Date(b.dateJoining).getDate() : 32;
          return dA - dB;
        });
      }
      sortByDay(active);
      sortByDay(left);

      // ── Process active tenants ────────────────────────────
      active.forEach(function(t) {
        var key = String(t.name).trim().toLowerCase();
        if (nameMap[key]) {
          // UPDATE in place
          var existing = sheet.getRange(nameMap[key], 1, 1, NCOLS).getValues()[0];
          sheet.getRange(nameMap[key], 1, 1, NCOLS)
               .setValues([buildRow(t, existing, MONTHS, false)]);
          totalUpdated++;
        } else {
          // NEW active tenant → insert ABOVE separator row
          // so it stays in the active section
          if (sepRow > 0) {
            // Insert a new row just before separator
            sheet.insertRowBefore(sepRow);
            // sepRow and all subsequent rows shift down by 1
            // Write to the newly inserted row (which is now at sepRow)
            sheet.getRange(sepRow, 1, 1, NCOLS)
                 .setValues([buildRow(t, new Array(NCOLS).fill(""), MONTHS, false)]);
            // Update nameMap and shift sepRow
            nameMap[key] = sepRow;
            sepRow++;  // separator moved down
          } else {
            // No separator yet → just append (first-time setup)
            sheet.appendRow(buildRow(t, new Array(NCOLS).fill(""), MONTHS, false));
            nameMap[key] = sheet.getLastRow();
          }
          totalAdded++;
        }
      });

      // ── Ensure separator row exists after active section ──
      if (sepRow === 0 && left.length > 0) {
        // Insert separator after all active rows
        sheet.appendRow(new Array(NCOLS).fill(""));
        sepRow = sheet.getLastRow();
      }

      // ── Process left tenants ──────────────────────────────
      left.forEach(function(t) {
        var key = String(t.name).trim().toLowerCase();
        if (nameMap[key]) {
          // UPDATE in place (already in left section)
          var existing = sheet.getRange(nameMap[key], 1, 1, NCOLS).getValues()[0];
          sheet.getRange(nameMap[key], 1, 1, NCOLS)
               .setValues([buildRow(t, existing, MONTHS, true)]);
          totalUpdated++;
        } else {
          // NEW left tenant → append at very end (below separator)
          sheet.appendRow(buildRow(t, new Array(NCOLS).fill(""), MONTHS, true));
          nameMap[key] = sheet.getLastRow();
          totalAdded++;
        }
      });

      styleHeader(sheet, NCOLS);

    } catch(pgErr) {
      Logger.log("ERROR on " + pgName + ": " + pgErr.message);
    }
  });

  return {
    success: true,
    message: "Done ✅ — Updated: " + totalUpdated + ", Added: " + totalAdded
  };
}

// ── buildRow: merge incoming + existing (blank → keep existing) ─
function buildRow(t, existing, MONTHS, isLeft) {
  function safe(incoming, existingVal) {
    var v = String(incoming || "").trim();
    return v !== "" ? v : String(existingVal || "");
  }
  var noteVal = String(t.note || "").trim();
  if (isLeft && noteVal.indexOf("[LEFT]") === -1)
    noteVal = noteVal ? noteVal + " [LEFT]" : "[LEFT]";
  if (!noteVal) noteVal = String(existing[6] || "");

  var row = [
    safe(t.name,        existing[0]),
    safe(t.contact,     existing[1]),
    safe(t.deposit,     existing[2]),
    safe(t.rent,        existing[3]),
    safe(t.dateJoining, existing[4]),
    safe(t.dateLeaving, existing[5]),
    noteVal
  ];
  MONTHS.forEach(function(m, i) {
    var base = 7 + (i * 4);
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

function styleHeader(sheet, ncols) {
  try {
    sheet.getRange(1,1,1,ncols)
      .setBackground("#1a1a2e")
      .setFontColor("#ffffff")
      .setFontWeight("bold");
    sheet.setFrozenRows(1);
  } catch(e) {}
}

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

    if (e.postData && e.postData.contents) {
      // POST with JSON body
      const body = JSON.parse(e.postData.contents);
      action = body.action;
      data = body.data;
    } else {
      // GET with URL params
      action = e.parameter.action;
      const raw = e.parameter.data;
      data = raw ? JSON.parse(raw) : null;
    }

    let result;

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

    // Clear and rewrite
    sheet.clearContents();
    if (rows.length > 0) {
      sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
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

// PG TENANT MANAGER — Apps Script v12 — NO COLOR, MAX SPEED

function makeResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function doGet(e)  { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  try {
    var action, data;
    if (e.postData && e.postData.contents) {
      var b = JSON.parse(e.postData.contents); action = b.action; data = b.data;
    } else {
      action = e.parameter.action;
      data = e.parameter.data ? JSON.parse(e.parameter.data) : null;
    }
    if (action === "ping")  return makeResponse({ success: true, message: "Connected ✅" });
    if (action === "read")  return makeResponse(readAllData());
    if (action === "write" && data) return makeResponse(writeData(data));
    if (action === "getPending")  return makeResponse(getPendingTenants());
    if (action === "approve" && data) return makeResponse(approveTenant(data));
    if (action === "reject"  && data) return makeResponse(rejectTenant(data));
    return makeResponse({ success: false, error: "Unknown action" });
  } catch(err) {
    return makeResponse({ success: false, error: err.message });
  }
}

var DATA_START = 6;
var MONTHS = ["January","February","March","April","May","June",
              "July","August","September","October","November","December"];
var NCOLS = 59;

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
        joiningRentAmt: String(row[55]||""), joiningRentHalfFull: String(row[56]||""),
        joiningDepositPaid: String(row[57]||""), depositCollector: String(row[58]||"")
      };
      MONTHS.forEach(function(m, i) {
        var b = 7 + i*4;
        t.monthly[m] = { amount: String(row[b]||""), halfFull: String(row[b+1]||""),
                         collector: String(row[b+2]||""), note: String(row[b+3]||"") };
      });
      tenants.push(t);
    });
    allData[name] = tenants;
  });
  return { success: true, data: allData };
}

// WRITE — zero formatting calls, name-based, pure data
function writeData(pgData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(pgData).forEach(function(pgName) {
    try {
      var incoming = (pgData[pgName]||[]).filter(function(t) {
        return t && t.name && String(t.name).trim() !== "";
      });
      if (incoming.length === 0) return;

      var sheet = ss.getSheetByName(pgName);
      if (!sheet) sheet = ss.insertSheet(pgName);
      if (sheet.getMaxColumns() < NCOLS)
        sheet.insertColumnsAfter(sheet.getMaxColumns(), NCOLS - sheet.getMaxColumns());

      // ONE read — name column only to build map
      var lastRow = sheet.getLastRow();
      var nameMap = {};
      if (lastRow >= DATA_START) {
        var nameCol = sheet.getRange(DATA_START, 1, lastRow - DATA_START + 1, 1).getValues();
        nameCol.forEach(function(r, i) {
          var n = String(r[0]||"").trim().toLowerCase();
          if (n) nameMap[n] = DATA_START + i;
        });
      }

      incoming.forEach(function(t) {
        var key  = String(t.name).trim().toLowerCase();
        var dl   = String(t.dateLeaving||"").trim();
        var isLeft = !!(dl && dl !== "null");

        if (nameMap[key]) {
          // Existing: read 1 row → write 1 row
          var rn = nameMap[key];
          var ex = sheet.getRange(rn, 1, 1, NCOLS).getValues()[0];
          sheet.getRange(rn, 1, 1, NCOLS).setValues([buildRow(t, ex, isLeft)]);
        } else {
          // New: append + color only this one row
          sheet.appendRow(buildRow(t, new Array(NCOLS).fill(""), isLeft));
          var nr = sheet.getLastRow();
          nameMap[key] = nr;
          try {
            // Color only first 7 cols (Name to Note) — fast
            var rng = sheet.getRange(nr, 1, 1, 7);
            if (isLeft) { rng.setBackground('#1a1f2e').setFontColor('#64748b'); }
            else { rng.setBackground('#0d1f35').setFontColor('#e0f2fe'); }
          } catch(ce) {}
        }
      });
    } catch(e) { Logger.log("ERR " + pgName + ": " + e.message); }
  });
  return { success: true, message: "Saved ✅" };
}

function buildRow(t, ex, isLeft) {
  function s(v, f) { var x = String(v||"").trim(); return x !== "" ? x : String(f||""); }
  var note = String(t.note||"").trim() || String(ex[6]||"");
  note = note.replace(/\s*\[LEFT\]/gi, "").trim();
  var row = [s(t.name,ex[0]), s(t.contact,ex[1]), s(t.deposit,ex[2]), s(t.rent,ex[3]),
             s(t.dateJoining,ex[4]), s(t.dateLeaving,ex[5]), note];
  MONTHS.forEach(function(m, i) {
    var b = 7 + i*4;
    var md = (t.monthly && t.monthly[m]) || {};
    row.push(s(md.amount,ex[b]), s(md.halfFull,ex[b+1]), s(md.collector,ex[b+2]), s(md.note,ex[b+3]));
  });
  row.push(s(t.joiningRentAmt,ex[55]), s(t.joiningRentHalfFull,ex[56]),
           s(t.joiningDepositPaid,ex[57]), s(t.depositCollector,ex[58]));
  return row;
}

var PENDING_SHEET = '_PendingTenants';
function getPendingTenants() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PENDING_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return { success: true, pending: [] };
  var rows = sheet.getRange(2,1,sheet.getLastRow()-1,10).getValues();
  var pending = rows.map(function(r,i){
    return { rowIndex:i+2, timestamp:String(r[0]||''), name:String(r[1]||''),
      contact:String(r[2]||''), deposit:String(r[3]||''), rent:String(r[4]||''),
      dateJoining:String(r[5]||''), pgName:String(r[6]||''), note:String(r[7]||''),
      status:String(r[8]||'PENDING') };
  }).filter(function(t){ return t.status==='PENDING' && t.name; });
  return { success:true, pending:pending };
}
function approveTenant(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pending = ss.getSheetByName(PENDING_SHEET);
  if (!pending) return { success:false, error:'No pending sheet' };
  var row = pending.getRange(data.rowIndex,1,1,10).getValues()[0];
  pending.getRange(data.rowIndex,9).setValue('APPROVED');
  pending.getRange(data.rowIndex,10).setValue('Admin');
  var pgName = data.pgName || String(row[6]||'');
  var pgSheet = ss.getSheetByName(pgName);
  if (!pgSheet) return { success:false, error:'PG not found: '+pgName };
  var emptyM = []; MONTHS.forEach(function(){ emptyM.push('','','',''); });
  var tRow = [String(row[1]||''),String(row[2]||''),String(row[3]||''),String(row[4]||''),
    String(row[5]||''),'',String(row[7]||'')].concat(emptyM);
  pgSheet.insertRowBefore(DATA_START);
  pgSheet.getRange(DATA_START,1,1,tRow.length).setValues([tRow]);
  return { success:true, message:String(row[1])+' added to '+pgName };
}
function rejectTenant(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pending = ss.getSheetByName(PENDING_SHEET);
  if (!pending) return { success:false, error:'No pending sheet' };
  pending.getRange(data.rowIndex,9).setValue('REJECTED');
  return { success:true, message:'Rejected' };
}

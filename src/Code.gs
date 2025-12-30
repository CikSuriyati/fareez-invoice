// CODE.GS
const SHEET_PROJECTS = "Projects"; 
const SHEET_ITEMS = "Line Items"; 

// 1. GET Request: Fetch Next ID
function doGet(e) {
  var action = e.parameter.action;

  if (action === "getNextId") {
    return getNextProjectId();
  }

  // Debugging or other reads
  return ContentService.createTextOutput("Action not specified or recognized.");
}

function getNextProjectId() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_PROJECTS);
  if (!sheet) return jsonResponse({ error: "Sheet not found" });

  var data = sheet.getDataRange().getValues();
  // Assume Row 1 is Headers
  // Assume Column B (Index 1) is Project ID

  var now = new Date();
  var year = now.getFullYear();
  var month = String(now.getMonth() + 1).padStart(2, '0'); // "01", "12"
  
  // We look for ANY prefix (JOB, QTN, INV, RCT) because they share the same numbering sequence
  // e.g. JOB-2025-12-001, INV-2025-12-002... next should be 003.
  var pattern = new RegExp(`.*-${year}-${month}-(\\d+)`);

  var maxId = 0;
  for (var i = 1; i < data.length; i++) {
    var val = data[i][1];
    if (val && typeof val === 'string') {
      var match = val.match(pattern);
      if (match) {
        var numPart = parseInt(match[1], 10);
        if (!isNaN(numPart) && numPart > maxId) {
          maxId = numPart;
        }
      }
    }
  }

  var nextNum = String(maxId + 1).padStart(3, '0');
  var nextId = `JOB-${year}-${month}-${nextNum}`; // Default base ID

  return ContentService.createTextOutput(nextId);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// 2. POST Request: Save Data
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Save Header to 'Projects' Tab
    var projectSheet = ss.getSheetByName(SHEET_PROJECTS);
    if (!projectSheet) throw new Error("Sheet '" + SHEET_PROJECTS + "' not found");

    var timestamp = new Date();
    var projectId = data.project.id; 

    // Describe items for summary
    var strDesc = (data.items || []).map(i => i.type + ": " + i.desc).join(", ");

    var projectRow = [
      timestamp,
      projectId,
      data.project.customer,
      data.project.email,
      data.project.phone,
      data.project.address,
      strDesc,
      "Generated (" + data.type + ")",
      "",                              // Doc Link
      data.totals.total,
      data.totals.deposit,
      data.totals.balance,
      data.status,
      "New"
    ];

    projectSheet.appendRow(projectRow);

    // Save Items to 'Line Items' Tab
    var itemSheet = ss.getSheetByName(SHEET_ITEMS);
    if (itemSheet && data.items && data.items.length > 0) {
      // User Requested Headers:
      // Project ID, Room / Area, Installation Type, Description, 
      // Unit Price(RM), Quantity, Materials Cost (RM), Transport Fee (RM), 
      // Discount (RM), Total (RM), Status, Brand/Type, Model

      var itemRows = data.items.map(item => [
        projectId,                    // 0. Project ID
        item.room,                    // 1. Room / Area
        item.type,                    // 2. Installation Type
        item.desc,                    // 3. Description
        item.unitPrice,               // 4. Unit Price(RM)
        item.qty,                     // 5. Quantity
        item.materialCost || 0,       // 6. Materials Cost (RM)
        item.transportFee || 0,       // 7. Transport Fee (RM)
        item.discount || 0,           // 8. Discount (RM)
        (item.unitPrice * item.qty),  // 9. Total (RM) - (Note: Logic matches frontend, ignores extras for now)
        data.status || "New",         // 10. Status (Inherit from Project Status)
        item.brand || "",             // 11. Brand/Type
        item.model || ""              // 12. Model
      ]);
      itemSheet.getRange(itemSheet.getLastRow() + 1, 1, itemRows.length, itemRows[0].length).setValues(itemRows);
    }

    return jsonResponse({ result: "success", id: projectId });

  } catch (e) {
    return jsonResponse({ result: "error", error: e.toString() });
  } finally {
    lock.releaseLock();
  }
}

// CODE.GS
const SHEET_PROJECTS = "Projects"; 
const SHEET_ITEMS = "Line Items"; 

// 1. GET Request: Fetch Next ID
function doGet(e) {
  var action = e.parameter.action;

  if (action === "getNextId") {
    return getNextProjectId();
  } else if (action === "getProject") {
    var id = e.parameter.id;
    return getProjectById(id);
  }

  // Debugging or other reads
  return ContentService.createTextOutput("Action not specified or recognized.");
}

function getProjectById(projectId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    // 1. Fetch Project Details
    var projectSheet = ss.getSheetByName(SHEET_PROJECTS);
    if (!projectSheet) return jsonResponse({ error: "Projects sheet not found" });
    
    var pData = projectSheet.getDataRange().getValues();
    var projectRow = null;
    var searchId = String(projectId).trim(); // Clean search ID

    // Start from 1 to skip header
    for (var i = 1; i < pData.length; i++) {
      if (String(pData[i][1]).trim() === searchId) { // Col B is Project ID
        projectRow = pData[i];
        break;
      }
    }
    
    if (!projectRow) return jsonResponse({ error: "Project ID not found" });

    // Safe Date Parsing
    var dateStr = "";
    try {
      if (projectRow[0]) {
        var timestamp = new Date(projectRow[0]);
        if (!isNaN(timestamp.getTime())) {
          dateStr = timestamp.toISOString().split('T')[0];
        }
      }
    } catch (err) {
      // Fallback if date is garbage
      dateStr = new Date().toISOString().split('T')[0];
    }
    if (!dateStr) dateStr = new Date().toISOString().split('T')[0];

    var projectData = {
      id: projectRow[1],
      customer: projectRow[2],
      email: projectRow[3],
      phone: projectRow[4],
      address: projectRow[5],
      date: dateStr
    };
    
    // 2. Fetch Line Items
    var itemSheet = ss.getSheetByName(SHEET_ITEMS);
    var items = [];
    if (itemSheet) {
      var iData = itemSheet.getDataRange().getValues();
      // Start from 1 to skip header
      for (var j = 1; j < iData.length; j++) {
        // Index 0 is Project ID (Column A)
        if (String(iData[j][0]).trim() === searchId) {
          var row = iData[j];
          items.push({
            room: row[1],         // Col B
            type: row[2],         // Col C
            desc: row[3],         // Col D
            unitPrice: row[4],    // Col E
            qty: row[5],          // Col F
            materialCost: row[6], // Col G
            transportFee: row[7], // Col H
            discount: row[8],     // Col I
            brand: row[11],       // Col L (Brand/Type)
            model: row[12] || ""  // Col M (Model) - Check if exists
          });
        }
      }
    }

    // DEBUG: Capture what we see in the first few rows of Line Items to diagnose column mismatch
    var debugInfo = [];
    if (itemSheet) {
        var rawDebug = itemSheet.getDataRange().getValues().slice(0, 5); // Header + 4 rows
        debugInfo = rawDebug.map(function(r) { return "ColA: " + r[0] + ", ColB: " + r[1]; });
    }

    return jsonResponse({
      type: 'INVOICE', 
      status: projectRow[12] || 'UNPAID',
      project: projectData,
      items: items,
      depositPaid: projectRow[10],
      debug: debugInfo // <--- TEMPORARY DEBUG FIELD
    });

  } catch (e) {
    return jsonResponse({ error: "Server Error: " + e.toString() });
  }
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
    
    // ---------------------------------------------------------
    // 1. SAVE/UPDATE HEADER in 'Projects' Tab
    // ---------------------------------------------------------
    var projectSheet = ss.getSheetByName(SHEET_PROJECTS);
    if (!projectSheet) throw new Error("Sheet '" + SHEET_PROJECTS + "' not found");

    var timestamp = new Date();
    var projectId = data.project.id; 
    
    // Describe items for summary
    var strDesc = (data.items || []).map(function(i) { return i.type + ": " + i.desc; }).join(", ");

    var projectRowData = [
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
      "New" // Sync Status
    ];

    // Check if Project ID exists to Update vs Append
    var pData = projectSheet.getDataRange().getValues();
    var rowIndexToUpdate = -1;
    var searchId = String(projectId).trim();

    // Start from 1 to skip header
    for (var i = 1; i < pData.length; i++) {
        if (String(pData[i][1]).trim() === searchId) { // Col B is Project ID
            rowIndexToUpdate = i + 1; // 1-based index
            break;
        }
    }

    if (rowIndexToUpdate > 0) {
        // UPDATE EXISTING ROW
        // We preserve the original timestamp (Col A) if preferred, or update it. 
        // Here we update everything to match the latest save.
        projectSheet.getRange(rowIndexToUpdate, 1, 1, projectRowData.length).setValues([projectRowData]);
    } else {
        // APPEND NEW ROW
        projectSheet.appendRow(projectRowData);
    }

    // ---------------------------------------------------------
    // 2. SAVE/REPLACE ITEMS in 'Line Items' Tab
    // ---------------------------------------------------------
    var itemSheet = ss.getSheetByName(SHEET_ITEMS);
    if (!itemSheet) throw new Error("Sheet '" + SHEET_ITEMS + "' not found. Please create it.");

    // STRATEGY: Delete ALL existing items for this Project ID, then append new ones.
    // This allows re-ordering, deleting, and adding items freely in the UI.
    
    var iData = itemSheet.getDataRange().getValues();
    // We walk backwards to delete rows without messing up indices
    for (var j = iData.length - 1; j >= 1; j--) {
        if (String(iData[j][1]).trim() === searchId) {
            itemSheet.deleteRow(j + 1);
        }
    }

    if (data.items && data.items.length > 0) {
      // User Requested Headers:
      // Timestamp, Project ID, Room / Area, Installation Type, Description, ...

      var itemRows = data.items.map(function(item) {
        return [
          new Date(),                   // Timestamp
          projectId,                    // 0. Project ID
          item.room,                    // 1. Room / Area
          item.type,                    // 2. Installation Type
          item.desc,                    // 3. Description
          item.unitPrice,               // 4. Unit Price(RM)
          item.qty,                     // 5. Quantity
          item.materialCost || 0,       // 6. Materials Cost (RM)
          item.transportFee || 0,       // 7. Transport Fee (RM)
          item.discount || 0,           // 8. Discount (RM)
          (item.unitPrice * item.qty),  // 9. Total (RM)
          data.status || "New",         // 10. Status
          item.brand || "",             // 11. Brand/Type
          item.model || ""              // 12. Model
        ];
      });
      
      // Bulk write for performance
      itemSheet.getRange(itemSheet.getLastRow() + 1, 1, itemRows.length, itemRows[0].length).setValues(itemRows);
    }

    return jsonResponse({ result: "success", id: projectId, action: rowIndexToUpdate > 0 ? "updated" : "created" });

  } catch (e) {
    return jsonResponse({ result: "error", error: e.toString() });
  } finally {
    lock.releaseLock();
  }
}

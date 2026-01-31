// CODE.GS
const SHEET_PROJECTS = "Projects"; 
const SHEET_ITEMS = "Line Items";
const SHEET_EXPENSES = "Expenses";
const SHEET_PAYMENT_HISTORY_GID = 1772447495; // Payment History sheet GID

// 1. GET Request: Fetch Next ID
function doGet(e) {
  var action = e.parameter.action;

  if (action === "getNextId") {
    return getNextProjectId();
  } else if (action === "getProject") {
    return getProjectById(e.parameter.id);
  } else if (action === "sendTestEmail") {
     // Explicit endpoint for generic test
     var result = sendMonthlyReport(); 
     return jsonResponse({ result: result });
  } else if (action === "getDashboardStats") {
    return getDashboardStats(e.parameter.period);
  } else if (action === "getExpenses") {
    return getExpenses(e.parameter.period); // PASS PERIOD HERE
  } else if (action === "getMonthlyTrends") {
    return getMonthlyTrends(e.parameter.year);
  } else if (action === "getProjectProfit") {
    return getProjectProfit(e.parameter.id);
  } else if (action === "getInventoryStats") {
    return getInventoryStats();
  } else if (action === "getAllProjectsProfit") {
    return getAllProjectsProfit(e.parameter.period);
  } else if (action === "getServiceReport") {
    return getServiceReport(e.parameter.period); 
  } else if (action === "getCompanyReport") {
    return getCompanyReport(e.parameter.period);
  } else if (action === "getProjects") {
    return getProjects();
  } else if (action === "getCustomers") {
    return getCustomers();
  } else if (action === "getProjectDocs") {
    return getProjectDocuments(e.parameter.id);
  } else if (action === "getFileData") {
    return getFileData(e.parameter.fileId);
  }

  return jsonResponse({ error: "Action not specified or recognized." });
}




function getCompanyReport(period) {
  var data = getCompanyReportData(period);
  return jsonResponse(data);
}


function getServiceReport(period) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pSheet = ss.getSheetByName(SHEET_PROJECTS);
  var iSheet = ss.getSheetByName(SHEET_ITEMS);
  
  if (!pSheet || !iSheet) return jsonResponse({ error: "Sheets missing" });

  // 1. Map Project ID -> Date AND Aggregate Discounts
  var pData = pSheet.getDataRange().getValues();
  var projectDates = {};
  var totalDiscounts = 0;
  
  var now = new Date();
  var currentMonth = now.getMonth();
  var currentYear = now.getFullYear();

  // Determine filtering range first
  // Re-use same logic logic as loop below or pre-calc? 
  // Loop below checks logic inside the loop.
  // We need to check logic here for discounts.
  
  for (var i = 1; i < pData.length; i++) {
    var pid = String(pData[i][1]).trim();
    var status = String(pData[i][12]).toUpperCase(); 
    
    if (status !== 'PAID') continue;

    if (pid) {
      var pDate = new Date(pData[i][0]);
      projectDates[pid] = pDate;

      // Check date range for discount aggregation
      var include = false;
      if (!period || period === 'ALL') {
        include = true;
      } else if (period === 'YEAR') {
        if (pDate.getFullYear() === currentYear) include = true;
      } else if (period === 'MONTH') {
        if (pDate.getFullYear() === currentYear && pDate.getMonth() === currentMonth) include = true;
      }

      if (include) {
         var discount = Number(pData[i][14]) || 0; // Col O (Index 14)
         totalDiscounts += discount;
      }
    }
  }

  // 2. Aggregate Items (Existing Logic)
  var iData = iSheet.getDataRange().getValues();
  var stats = {}; 

  // ... (Header detection logic) ...
  var headers = iData[0];
  var colTotal = -1;
  var colType = -1;
  var colQty = -1;

  for (var h=0; h<headers.length; h++) {
    var hdr = String(headers[h]).toLowerCase().trim();
    if (hdr === 'total' || hdr === 'total (rm)' || hdr === 'amount') colTotal = h;
    if (hdr === 'type' || hdr === 'item type') colType = h;
    if (hdr === 'qty' || hdr === 'quantity') colQty = h;
  }
  if (colType === -1) colType = 2; 
  if (colQty === -1) colQty = 5;   
  if (colTotal === -1) colTotal = 9; 

  for (var j = 1; j < iData.length; j++) {
    var itemPid = String(iData[j][0]).trim();
    var pDate = projectDates[itemPid];

    // Filter by Date
    if (!pDate) continue; 
    
    var include = false;
    if (!period || period === 'ALL') {
      include = true;
    } else if (period === 'YEAR') {
      if (pDate.getFullYear() === currentYear) include = true;
    } else if (period === 'MONTH') {
      if (pDate.getFullYear() === currentYear && pDate.getMonth() === currentMonth) include = true;
    }

    if (include) {
      var type = iData[j][colType]; 
      if (!type) type = "Other";

      var qty = Number(iData[j][colQty]) || 0;
      var total = Number(iData[j][colTotal]) || 0; 

      if (!stats[type]) {
        stats[type] = { qty: 0, revenue: 0 };
      }
      stats[type].qty += qty;
      stats[type].revenue += total;
    }
  }

  // Convert to Array
  var report = [];
  for (var key in stats) {
    report.push({
      type: key,
      qty: stats[key].qty,
      revenue: stats[key].revenue
    });
  }

  // Add Global Discount Entry if exists
  if (totalDiscounts > 0) {
      report.push({
          type: "Global Discounts",
          qty: 0, // Or count of projects? Keep 0 to avoid skewing "Jobs" count? Or 1? 
          // Qty 0 is safer for "Items Sold" metrics.
          revenue: -totalDiscounts
      });
  }

  // Sort by Revenue DESC (Profitability more important than qty for this view?)
  // Original was Qty. Let's keep Qty but ensure Discount is at bottom?
  report.sort(function(a, b) { return b.qty - a.qty; });

  return jsonResponse({ report: report, period: period || 'ALL' });
}


// Helper to strip "RM", commas (,), and spaces from manually entered values.
function parseFinanceValue(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  var str = String(val).replace(/[^0-9.-]+/g, "");
  return parseFloat(str) || 0;
}

function getInventoryStats() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_EXPENSES);
  if (!sheet) return jsonResponse({ totalInventory: 0 });

  var data = sheet.getDataRange().getValues();
  // Headers: [Date, ProjectID, RefNo, Store, Desc, Qty, UnitPrice, Amount]
  // Indices:   0       1         2       3      4     5       6        7

  var totalInventory = 0;
  
  // Start from 1 to skip header
  for (var i = 1; i < data.length; i++) {
    var pid = String(data[i][1]).trim().toUpperCase(); // Project ID
    var amt = parseFinanceValue(data[i][7]);   // Amount
    
    // User Requirement: Check if Project ID is specifically "INVENTORY" or "UNASSIGNED"
    // Also keeping empty check just in case, or user specifically said "Inventory".
    // "no u just need to check Project ID = Inventory"
    if (pid === "INVENTORY") {
        totalInventory += amt;
    }
  }

  return jsonResponse({ totalInventory: totalInventory });
}

function getAllProjectsProfit(period) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pSheet = ss.getSheetByName(SHEET_PROJECTS);
  var eSheet = ss.getSheetByName(SHEET_EXPENSES);

  // 1. Determine Date Range
  var now = new Date();
  var pStart = new Date(1970, 0, 1);
  var pEnd = new Date(2100, 0, 1);

   if (!period || period === 'MONTH') {
    pStart = new Date(now.getFullYear(), now.getMonth(), 1);
    pEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else if (period === 'LAST_MONTH') {
    pStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    pEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  } else if (period === 'YEAR') {
    pStart = new Date(now.getFullYear(), 0, 1);
    pEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  }

  // 2. Map Expenses by Project ID
  var expenseMap = {}; // { 'JOB-101': 500.00 }
  if (eSheet) {
      var eData = eSheet.getDataRange().getValues();
      for (var j = 1; j < eData.length; j++) {
          var eDate = new Date(eData[j][0]);
          if (period === 'ALL' || (eDate >= pStart && eDate <= pEnd)) {
             var epid = String(eData[j][1]).trim().toUpperCase();
             var amt = parseFinanceValue(eData[j][7]);
             if (!expenseMap[epid]) expenseMap[epid] = 0;
             expenseMap[epid] += amt;
          }
      }
  }

  // 3. Map Projects
  var projects = [];
  if (pSheet) {
      var pData = pSheet.getDataRange().getValues();
      for (var i = 1; i < pData.length; i++) {
        var pid = String(pData[i][1]).trim().toUpperCase();
        var date = new Date(pData[i][0]);
        var status = pData[i][12]; 
        
        // Filter by Date
        if (period !== 'ALL' && (date < pStart || date > pEnd)) continue;
        if (status === 'CANCELLED') continue;

        var revenue = Number(pData[i][9]) || 0;
        var discount = Number(pData[i][14]) || 0; // Col O: Discount (Index 14)
        var netRevenue = revenue - discount;
        
        var cost = expenseMap[pid] || 0;
        
        // Only show if there is financial activity OR recent project
        if (netRevenue !== 0 || cost !== 0) {
            projects.push({
                id: pData[i][1], // maintain original casing for display
                customer: pData[i][2],
                status: status,
                revenue: netRevenue,
                cost: cost,
                profit: netRevenue - cost
            });
        }
      }
  }

  // 4. Find Orphaned Expenses (Expenses for projects not in the list/deleted)
  // (Optional: skipped for simplicity, usually assume Project exists)

  // Sort by Profit (Low to High - to see losses first)
  projects.sort(function(a, b) { return a.profit - b.profit; });

  return jsonResponse({ projects: projects });
}

function getProjectProfit(projectId) {
  // ... (Single Project Logic preserved if needed, or can be deprecated)
  // For now, keeping it as helper or legacy.
  var ss = SpreadsheetApp.getActiveSpreadsheet();
   var searchId = String(projectId).trim();
  
  // 1. Get Revenue from Projects Tab
  var pSheet = ss.getSheetByName(SHEET_PROJECTS);
  if (!pSheet) return jsonResponse({ error: "No Projects Sheet" });
  
  var pData = pSheet.getDataRange().getValues();
  var revenue = 0;
  var found = false;
  
  for (var i = 1; i < pData.length; i++) {
    if (String(pData[i][1]).trim() === searchId) {
       revenue = Number(pData[i][9]) || 0; // Total
       found = true;
       break;
    }
  }

  // 2. Get Costs from Expenses Tab
  var eSheet = ss.getSheetByName(SHEET_EXPENSES);
  var totalCost = 0;
  var expensesList = [];

  if (eSheet) {
      var eData = eSheet.getDataRange().getValues();
      for (var j = 1; j < eData.length; j++) {
         if (String(eData[j][1]).trim() === searchId) {
             var amt = Number(eData[j][7]) || 0;
             totalCost += amt;
             expensesList.push({
                 desc: eData[j][4],
                 amount: amt
             });
         }
      }
  }
  
  return jsonResponse({
      id: projectId,
      found: found,
      revenue: revenue,
      cost: totalCost,
      profit: revenue - totalCost,
      details: expensesList
  });
}

function getExpenses(period) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_EXPENSES);
  if (!sheet) return jsonResponse({ error: "Expenses sheet not found", expenses: [] });

  var data = sheet.getDataRange().getValues();
  var expenses = [];

  // Determine Date Range
  var now = new Date();
  var pStart = new Date(1970, 0, 1);
  var pEnd = new Date(2100, 0, 1);

  if (!period || period === 'MONTH') {
    pStart = new Date(now.getFullYear(), now.getMonth(), 1);
    pEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else if (period === 'LAST_MONTH') {
    pStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    pEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  } else if (period === 'YEAR') {
    pStart = new Date(now.getFullYear(), 0, 1);
    pEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  }
  
  // Iterate all rows (skip header) backwards
  for (var i = data.length - 1; i >= 1; i--) {
    var row = data[i];
    var dateVal = new Date(row[0]);
    
    // Only add if inside date range (or Period is ALL)
    if (period === 'ALL' || (dateVal >= pStart && dateVal <= pEnd)) {
        expenses.push({
          date: dateToStr(row[0]),
          projectId: row[1],
          refNo: row[2],
          store: row[3],
          desc: row[4],
          qty: row[5],
          unitPrice: parseFinanceValue(row[6]),
          amount: parseFinanceValue(row[7]),
          category: row[8] || "General"
        });
    }
  }
  
  return jsonResponse({ 
      expenses: expenses,
      debug: {
        filter: period,
        start: pStart.toString(),
        end: pEnd.toString(),
        serverTime: now.toString(),
        timeZone: Session.getScriptTimeZone()
      }
  });
}

function dateToStr(d) {
    try {
        if (!d) return "";
        var dt = new Date(d);
        if (isNaN(dt.getTime())) return "";
        return dt.toISOString().split('T')[0];
    } catch(e) { return ""; }
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
    
    // Use GID 663549614 to match the Save Logic and ensure we read from correct source
    var itemSheet = getSheetById(ss, 663549614);
    if (!itemSheet) itemSheet = ss.getSheetByName(SHEET_ITEMS); // Fallback

    var items = [];
    var searchIdUpper = String(projectRow[1]).trim().toUpperCase(); // Col B of Projects is the ID? No, passed in arg is better? 
    // Wait, getProjectById takes 'projectId' arg.
    // Line 521 uses 'searchId'. 
    // Line 425: var searchId = String(projectId).trim();
    // I should use that, normalized.
    
    if (itemSheet) {
      var iData = itemSheet.getDataRange().getValues();
      for (var j = 1; j < iData.length; j++) {
        // Match Col A (Index 0)
        if (String(iData[j][0]).trim().toUpperCase() === searchId.toUpperCase()) {
          var row = iData[j];
          items.push({
            room: row[1],         // Col B
            type: row[2],         // Col C
            desc: row[3],         // Col D
            unitPrice: row[4],    // Col E
            qty: row[5],          // Col F
            total: row[6] || 0,   // Col G (Total)
            brand: row[8],        // Col I (was L)
            model: row[9] || ""   // Col J (was M)
          });
        }
      }
    }

    return jsonResponse({
      type: 'INVOICE', 
      status: projectRow[12] || 'UNPAID',
      project: projectData,
      items: items,
      depositPaid: projectRow[10],
      discount: Number(projectRow[14]) || 0 // Col O (Index 14)
    });

  } catch (e) {
    return jsonResponse({ error: "Server Error: " + e.toString() });
  }
}

// Internal helper: Get project data without HTTP wrapper (for use within Apps Script)
function getProjectDataRaw(projectId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    // 1. Fetch Project Details
    var projectSheet = ss.getSheetByName(SHEET_PROJECTS);
    if (!projectSheet) return { error: "Projects sheet not found" };
    
    var pData = projectSheet.getDataRange().getValues();
    var projectRow = null;
    var searchId = String(projectId).trim();

    for (var i = 1; i < pData.length; i++) {
      if (String(pData[i][1]).trim() === searchId) {
        projectRow = pData[i];
        break;
      }
    }
    
    if (!projectRow) return { error: "Project ID not found" };

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
      dateStr = new Date().toISOString().split('T')[0];
    }
    if (!dateStr) dateStr = new Date().toISOString().split('T')[0];

    var projectData = {
      id: projectRow[1],
      customer: projectRow[2],
      email: projectRow[3],
      phone: projectRow[4],
      address: projectRow[5],
      date: dateStr,
      status: projectRow[12] || 'UNPAID',
      deposit: projectRow[10] || 0,
      discount: Number(projectRow[14]) || 0
    };
    
    // Use GID 663549614
    var itemSheet = getSheetById(ss, 663549614);
    if (!itemSheet) itemSheet = ss.getSheetByName(SHEET_ITEMS);

    var items = [];
    if (itemSheet) {
      var iData = itemSheet.getDataRange().getValues();
      for (var j = 1; j < iData.length; j++) {
        if (String(iData[j][0]).trim().toUpperCase() === searchId.toUpperCase()) {
          var row = iData[j];
          items.push({
            room: row[1],
            type: row[2],
            desc: row[3],
            unitPrice: row[4],
            qty: row[5],
            total: row[6] || 0,
            brand: row[8],
            model: row[9] || ""
          });
        }
      }
    }

    return {
      type: 'INVOICE', 
      status: projectRow[12] || 'UNPAID',
      project: projectData,
      items: items
    };

  } catch (e) {
    return { error: "Server Error: " + e.toString() };
  }
}

function getNextProjectId() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_PROJECTS);
  if (!sheet) return jsonResponse({ error: "Sheet not found" });

  var data = sheet.getDataRange().getValues();
  var now = new Date();
  var year = now.getFullYear();
  var month = String(now.getMonth() + 1).padStart(2, '0');
  
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
  var nextId = `JOB-${year}-${month}-${nextNum}`; 

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
    var requestData = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // --- EXPENSE HANDLING ---
    if (requestData.action === 'SAVE_EXPENSE') {
      var expSheet = ss.getSheetByName(SHEET_EXPENSES);
      if (!expSheet) throw new Error("Sheet '" + SHEET_EXPENSES + "' not found.");

      var exp = requestData.expense;
      var receiptData = requestData.receiptData || null;
      var receiptFileName = requestData.receiptFileName || '';
      var receiptMimeType = requestData.receiptMimeType || '';
      var existingReceiptUrl = requestData.existingReceiptUrl || null;
      
      // Upload receipt if provided, or use existing URL
      var receiptUrl = '';
      if (existingReceiptUrl) {
        receiptUrl = existingReceiptUrl;
      } else if (receiptData) {
        var uploadResult = uploadExpenseReceipt(exp.refNo, receiptData, receiptFileName, receiptMimeType);
        if (uploadResult.error) {
          return jsonResponse({ result: "error", error: uploadResult.error });
        }
        receiptUrl = uploadResult.url;
      }
      
      // User Specified Headers:
      // Col A: Date
      // Col B: Project ID
      // Col C: Receipt/Invoice No
      // Col D: Store
      // Col E: Description
      // Col F: Quantity
      // Col G: Unit Price
      // Col H: Amount
      // Col I: Category
      // Col J: Receipt Link (NEW)

      var row = [
        exp.date ? new Date(exp.date) : new Date(), // Date (A) - User provided or Now
        exp.projectId || "",        // Project ID (B)
        exp.refNo || "",            // Receipt/Invoice No (C)
        exp.store || "",            // Store (D)
        exp.desc || "",             // Description (E)
        exp.qty || 1,               // Quantity (F)
        exp.unitPrice || 0,         // Unit Price (G)
        exp.amount || 0,            // Amount (H)
        exp.category || "General",  // Category (I)
        receiptUrl                  // Receipt Link (J)
      ];
      expSheet.appendRow(row);
      SpreadsheetApp.flush();
      return jsonResponse({ result: "success", type: "expense" });
    }
    
    if (requestData.action === 'SCAN_RECEIPT') {
      return scanReceipt(requestData.image, requestData.apiKey);
    }

    if (requestData.action === 'SEND_TEST_EMAIL') {
       var res = sendMonthlyReport();
       return jsonResponse({ result: res });
    }

    if (requestData.action === 'SEND_INVOICE_EMAIL') {
       var res = sendInvoiceEmail(requestData.payload);
       return jsonResponse({ result: res });
    }

    if (requestData.action === 'SAVE_INVOICE_PDF') {
      Logger.log('=== SAVE_INVOICE_PDF START ===');
      var projectId = requestData.projectId;
      var type = requestData.type;
      var base64 = requestData.base64;
      
      Logger.log('Project ID: ' + projectId);
      Logger.log('Type: ' + type);
      Logger.log('Base64 Length: ' + (base64 ? base64.length : 0));

      if (!projectId || !type || !base64) {
        Logger.log('❌ Error: Missing required fields');
        return jsonResponse({ result: "error", error: "Missing required fields for PDF save" });
      }

      try {
        // Remove dataurl prefix if present
        if (base64.indexOf(',') > -1) {
          base64 = base64.split(',')[1];
        }

        var blob = Utilities.newBlob(Utilities.base64Decode(base64), 'application/pdf');
        var docInfo = getDocTypeFromStatus(type);
        var docId = projectId.replace(/^[A-Z]+/, docInfo.prefix);
        var filename = docId + ".pdf";
        blob.setName(filename);
        Logger.log('Calculated Filename: ' + filename);

        // Get year from project ID or current year
        var year = new Date().getFullYear();
        var idMatch = projectId.match(/(\d{4})/);
        if (idMatch) year = idMatch[1];
        Logger.log('Year Folder: ' + year);

        // Get target folder
        var targetFolder = getOrCreateYearSubfolder(FOLDER_NAME, year, docInfo.subfolder);
        Logger.log('Target Folder ID: ' + targetFolder.getId());
        
        // Save to Drive
        var fileUrl = savePDFToDrive(blob, filename, targetFolder);
        Logger.log('File Saved. URL: ' + fileUrl);

        // Update Doc Link in Projects sheet
        var projectSheet = ss.getSheetByName(SHEET_PROJECTS);
        if (projectSheet) {
          var pData = projectSheet.getDataRange().getValues();
          var found = false;
          for (var i = 1; i < pData.length; i++) {
            if (String(pData[i][1]).trim() === projectId) {
              projectSheet.getRange(i + 1, 9).setValue(fileUrl);
              Logger.log('✅ Sheet updated Col I row ' + (i+1));
              found = true;
              break;
            }
          }
          if (!found) Logger.log('⚠ Project ID ' + projectId + ' not found in sheet for link update');
        }

        Logger.log('=== SAVE_INVOICE_PDF SUCCESS ===');
        return jsonResponse({ result: "success", url: fileUrl });
      } catch (err) {
        Logger.log('❌ SAVE_INVOICE_PDF FAILED: ' + err.toString());
        return jsonResponse({ result: "error", error: err.toString() });
      }
    }

    if (requestData.action === 'SETUP_TRIGGER') {
       setupMonthlyTrigger();
       return jsonResponse({ result: "Trigger configured for 1st of each month." });
    }

    // --- UPDATE_STATUS HANDLING (Quick Update) ---
    if (requestData.action === 'UPDATE_STATUS') {
      var projectId = requestData.projectId;
      var newStatus = requestData.status;
      var paidAmount = requestData.paidAmount || null;
      var paymentMethod = requestData.paymentMethod || 'Bank Transfer';
      var notes = requestData.notes || '';
      var receiptData = requestData.receiptData || null;
      var receiptFileName = requestData.receiptFileName || '';
      var receiptMimeType = requestData.receiptMimeType || '';
      
      if (!projectId || !newStatus) {
        return jsonResponse({ result: "error", error: "Missing projectId or status" });
      }
      
      var projectSheet = ss.getSheetByName(SHEET_PROJECTS);
      var itemSheet = getSheetById(ss, 663549614);
      if (!itemSheet) itemSheet = ss.getSheetByName(SHEET_ITEMS);
      
      if (!projectSheet) {
        return jsonResponse({ result: "error", error: "Projects sheet not found" });
      }
      
      // Find project row
      var pData = projectSheet.getDataRange().getValues();
      var projectRow = -1;
      var searchId = String(projectId).trim();
      
      for (var i = 1; i < pData.length; i++) {
        if (String(pData[i][1]).trim() === searchId) {
          projectRow = i + 1; // 1-indexed for sheet
          break;
        }
      }
      
      if (projectRow === -1) {
        return jsonResponse({ result: "error", error: "Project not found: " + projectId });
      }
      
      // Handle payment recording ONLY if receipt is provided
      var receiptUrl = null;
      var paymentRefId = null;
      var actualStatus = newStatus; // Will be recalculated based on deposit
      
      // === DEBUGGING: Log incoming data ===
      Logger.log('=== UPDATE_STATUS DEBUG ===');
      Logger.log('Project ID: ' + projectId);
      Logger.log('Project Row: ' + projectRow);
      Logger.log('New Status: ' + newStatus);
      Logger.log('Paid Amount: ' + paidAmount + ' (type: ' + typeof paidAmount + ')');
      Logger.log('Has Receipt Data: ' + (receiptData ? 'YES' : 'NO'));
      Logger.log('Condition Check: receiptData=' + !!receiptData + ', paidAmount=' + !!paidAmount + ', paidAmount>0=' + (paidAmount > 0));
      // === END DEBUG ===
      
      if (receiptData && paidAmount && paidAmount > 0) {
        Logger.log('✓ Entering payment update branch');

        // Upload receipt
        var uploadResult = uploadPaymentReceipt(projectId, receiptData, receiptFileName, receiptMimeType);
        if (uploadResult.error) {
          return jsonResponse({ result: "error", error: uploadResult.error });
        }
        receiptUrl = uploadResult.url;
        
        // Save to Payment History - ROBUST LOOKUP
        Logger.log('🔍 Looking for Payment History sheet...');
        
        // Try 1: By GID
        var paymentHistorySheet = getSheetById(ss, SHEET_PAYMENT_HISTORY_GID);
        if (paymentHistorySheet) {
          Logger.log('✓ Found Payment History by GID: ' + SHEET_PAYMENT_HISTORY_GID);
        } else {
          Logger.log('⚠ GID lookup failed, trying name-based lookup...');
          
          // Try 2: Common names
          var possibleNames = ['Payment History', 'payment history', 'PaymentHistory', 'Payment_History'];
          for (var n = 0; n < possibleNames.length; n++) {
            paymentHistorySheet = ss.getSheetByName(possibleNames[n]);
            if (paymentHistorySheet) {
              Logger.log('✓ Found Payment History by name: "' + possibleNames[n] + '"');
              break;
            }
          }
        }
        
        if (!paymentHistorySheet) {
          // List all available sheets for debugging
          var allSheets = ss.getSheets();
          var sheetNames = [];
          for (var s = 0; s < allSheets.length; s++) {
            sheetNames.push(allSheets[s].getName() + ' (GID: ' + allSheets[s].getSheetId() + ')');
          }
          Logger.log('❌ Available sheets: ' + sheetNames.join(', '));
          return jsonResponse({ 
            result: "error", 
            error: "Payment History sheet not found. Available: " + sheetNames.join(', ')
          });
        }
        
        // Generate Payment Ref ID
        var timestamp = new Date();
        var year = timestamp.getFullYear();
        var month = String(timestamp.getMonth() + 1).padStart(2, '0');
        
        // Get next sequence number
        var paymentData = paymentHistorySheet.getDataRange().getValues();
        var maxSeq = 0;
        var refPrefix = 'PAY-' + year + '-' + month + '-';
        
        for (var i = 1; i < paymentData.length; i++) {
          var refId = String(paymentData[i][6] || ''); // Col G: Ref ID
          if (refId.startsWith(refPrefix)) {
            var seqStr = refId.split('-')[3];
            var seq = parseInt(seqStr) || 0;
            if (seq > maxSeq) maxSeq = seq;
          }
        }
        
        paymentRefId = refPrefix + String(maxSeq + 1).padStart(3, '0');
        
        // Append payment record
        paymentHistorySheet.appendRow([
          timestamp,                // Date
          projectId,                // Project ID
          paidAmount,               // Paid Amount
          paymentMethod,            // Payment Method
          receiptUrl,               // Receipt File Link
          notes,                    // Notes
          paymentRefId              // Ref ID
        ]);
        
        // Update deposit in Projects sheet and determine actual status
        var currentTotal = Number(pData[projectRow - 1][9]) || 0; // Col J: Total
        var currentDeposit = Number(pData[projectRow - 1][10]) || 0; // Col K: Current Deposit
        var currentDiscount = Number(pData[projectRow - 1][14]) || 0; // Col O: Discount
        var netTotal = currentTotal - currentDiscount;
        
        // Add paid amount to existing deposit
        var newDeposit = currentDeposit + paidAmount;
        projectSheet.getRange(projectRow, 11).setValue(newDeposit); // Col K: Deposit
        Logger.log('✓ Updated Deposit: ' + currentDeposit + ' + ' + paidAmount + ' = ' + newDeposit);
        
        // Calculate balance
        var balance = netTotal - newDeposit;
        projectSheet.getRange(projectRow, 12).setValue(balance); // Col L: Balance
        Logger.log('✓ Updated Balance: ' + netTotal + ' - ' + newDeposit + ' = ' + balance);
        
        // Determine actual status based on payment (rounded comparison)
        var rNetTotal = Math.round(netTotal * 100);
        var rNewDeposit = Math.round(newDeposit * 100);

        if (rNewDeposit >= rNetTotal && rNetTotal > 0) {
          actualStatus = 'PAID';
        } else if (rNewDeposit > 0) {
          actualStatus = 'PARTIAL';
        } else {
          actualStatus = 'UNPAID';
        }
        Logger.log('✓ Calculated Status: ' + actualStatus);
      } else {
        Logger.log('⚠ Skipping payment update - condition not met');
      }
      
      // Update status in sheet with the calculated actual status
      projectSheet.getRange(projectRow, 13).setValue(actualStatus); // Col M: Status
      Logger.log('✓ Set Status in Sheet: ' + actualStatus);

      // Flush changes to ensure they are visible to the next stage
      SpreadsheetApp.flush();

      
      // --- GENERATE & SAVE PDF DOCUMENT ---
      var fileUrl = null;
      var glPdfBase64 = null;
      var pdfName = null;
      
      // AUTO-PDF GENERATION (Restored for QuickUpdate as it has no frontend capture)
      try {
        // 1. Re-fetch full project data for the PDF
        var projectData = getProjectDataRaw(projectId); // Returns raw data, not HTTP-wrapped
        
        // Validate we fetched the data successfully
        if (!projectData || projectData.error) {
            throw new Error('Failed to fetch project data: ' + (projectData ? projectData.error : 'Unknown error'));
        }
        
        // Validate we have the required data structure
        if (!projectData.project || !projectData.project.id) {
            throw new Error('Invalid project data structure - missing project.id');
        }
        
        // Fix: Ensure item totals are calculated (for PDF generation)
        if (projectData.items && projectData.items.length > 0) {
            projectData.items.forEach(function(item) {
                // Always recalculate to ensure accuracy
                var calculatedTotal = (Number(item.qty) || 0) * (Number(item.unitPrice) || 0);
                item.total = calculatedTotal;
                Logger.log('Item: ' + item.desc + ' | Qty: ' + item.qty + ' | Price: ' + item.unitPrice + ' | Total: ' + item.total);
            });
        }
        
        if (projectData && !projectData.error) {
           // 2. Prepare data for PDF Generation
           // projectData has { project: {...}, items: [...], ... }
           // generatePDFfromData expects (projectData, lineItems, docType)
           
           // Determine Doc Type based on the NEW status
           var docType = 'INVOICE';
           if (actualStatus === 'PAID' || actualStatus === 'PARTIAL') {
               // Usually PAID = Receipt, PARTIAL = Invoice (with partial payment shown)
               // Let's use the helper
               var docInfo = getDocTypeFromStatus(actualStatus);
               docType = docInfo.type;
           }
           
           Logger.log('Generating PDF type: ' + docType);
           
           var pdfResult = generatePDFfromData(projectData.project, projectData.items, docType);
           // pdfResult = { blob, filename }
           
           // 3. Save to Drive
           // Get year from project ID or current
           var pYear = new Date().getFullYear();
           var idMatch = projectId.match(/(\d{4})/);
           if (idMatch) pYear = idMatch[1];
           
           var docInfo = getDocTypeFromStatus(docType); // Helper
           var targetFolder = getOrCreateYearSubfolder(FOLDER_NAME, pYear, docInfo.subfolder);
           
           fileUrl = savePDFToDrive(pdfResult.blob, pdfResult.filename, targetFolder);
           pdfName = pdfResult.filename;
           glPdfBase64 = Utilities.base64Encode(pdfResult.blob.getBytes());
           
           Logger.log('PDF Saved: ' + fileUrl);
           
           // 4. Update "Doc Link" in Sheet (Col I / Index 8)
           projectSheet.getRange(projectRow, 9).setValue(fileUrl);
           
           // 5. Update "Document Type Generated" in Sheet (Col H / Index 7)
           projectSheet.getRange(projectRow, 8).setValue("Generated (" + docType + ")");
           Logger.log('✓ Updated Document Type: Generated (' + docType + ')');
        }
      } catch (pdfErr) {
        Logger.log("❌ Auto-PDF Generation Failed: " + pdfErr.toString());
        Logger.log("Error Stack: " + pdfErr.stack);
        // Return error info to frontend for debugging
        return jsonResponse({ 
          result: "error", 
          error: "PDF generation failed: " + pdfErr.toString(),
          debug: {
            projectId: projectId,
            actualStatus: actualStatus,
            errorDetails: pdfErr.message
          }
        });
      }

      // Flush changes to ensure they're committed
      SpreadsheetApp.flush();
      
      return jsonResponse({ 
        result: "success", 
        message: "Status updated to " + actualStatus + (fileUrl ? ". Document generated." : ""),
        receiptUrl: receiptUrl,
        fileUrl: fileUrl,       // For Frontend "Copy Link"
        pdfBase64: glPdfBase64, // For Frontend "Share via WhatsApp" (Preview)
        pdfFileName: pdfName,
        debug: {
          updatedDeposit: receiptData && paidAmount && paidAmount > 0,
          paidAmount: paidAmount,
          actualStatus: actualStatus
        }
      });
    }

    // --- INVOICE HANDLING (Default) ---
    // If no action or action is undefined, assume it's the old Invoice/Project save
    var data = requestData; // Standard Invoice Payload

    // ---------------------------------------------------------
    // 1. SAVE/UPDATE HEADER in 'Projects' Tab
    // ---------------------------------------------------------
    var projectSheet = ss.getSheetByName(SHEET_PROJECTS);
    var projectSheet = ss.getSheetByName(SHEET_PROJECTS);
    if (!projectSheet) throw new Error("Sheet '" + SHEET_PROJECTS + "' not found");

    // Ensure we have enough columns for Discount (Col O / Index 15)
    if (projectSheet.getMaxColumns() < 15) {
      projectSheet.insertColumnsAfter(projectSheet.getMaxColumns(), 15 - projectSheet.getMaxColumns());
    }

    var timestamp = new Date();
    var projectId = data.project.id; 
    
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
      "New", // Sync Status
      data.discount || 0 // Col N: Global Discount
    ];

    var pData = projectSheet.getDataRange().getValues();
    var rowIndexToUpdate = -1;
    var searchId = String(projectId).trim();

    for (var i = 1; i < pData.length; i++) {
        if (String(pData[i][1]).trim() === searchId) { 
            rowIndexToUpdate = i + 1; 
            break;
        }
    }

    if (rowIndexToUpdate > 0) {
        // UPDATE EXISTING ROW
        
        // CHECK IF CANCELLED
        var existingStatus = String(pData[rowIndexToUpdate - 1][12]).toUpperCase(); 
        if (existingStatus === 'CANCELLED') {
             return jsonResponse({ result: "error", error: "Cannot Modify a CANCELLED Project. Please create a new one." });
        }

        projectSheet.getRange(rowIndexToUpdate, 1, 1, projectRowData.length).setValues([projectRowData]);
    } else {
        projectSheet.appendRow(projectRowData);
    }

    // ---------------------------------------------------------
    // 2. SAVE/REPLACE ITEMS in 'Line Items' Tab
    // ---------------------------------------------------------
    // ---------------------------------------------------------
    // 2. SAVE/REPLACE ITEMS in 'Line Items' Tab
    // ---------------------------------------------------------
    // ---------------------------------------------------------
    // 2. SAVE/REPLACE ITEMS in 'Line Items' Tab
    // ---------------------------------------------------------
    // Use GID to be 100% sure per user request (GID: 663549614)
    var itemSheet = getSheetById(ss, 663549614);
    if (!itemSheet) {
        // Fallback to name if GID fails for some reason (e.g. copy of sheet)
        itemSheet = ss.getSheetByName(SHEET_ITEMS);
    }
    if (!itemSheet) throw new Error("Sheet Line Items not found (GID: 663549614).");
    
    // METHOD: Filter in memory and rewrite (More robust than deleting rows one by one)
    var allData = itemSheet.getDataRange().getValues();
    var header = allData[0];
    var keptRows = [];
    var searchIdsUpper = searchId.toUpperCase();
    
    // 1. Keep headers? No, we write header or assume it exists? 
    // Usually clearContent leaves header if we start from row 2.
    // Let's keep all rows that DO NOT match ID (Case Insensitive)
    for (var i = 1; i < allData.length; i++) {
         if (String(allData[i][0]).trim().toUpperCase() !== searchIdsUpper) {
             keptRows.push(allData[i]);
         }
    }

    // 2. Prepare New Rows
    var newRows = [];
    var colCount = header ? header.length : 10; // Default to 10 if header missing (unlikely)
    if (colCount < 10) colCount = 10; // Ensure at least 10 columns for our data
    
    if (data.items && data.items.length > 0) {
      newRows = data.items.map(function(item) {
        var row = [
          projectId,                    
          item.room || "",                    
          item.type || "",                   
          item.desc || "",                    
          item.unitPrice || 0,               
          item.qty || 1,                         
          (item.unitPrice * item.qty) || 0,  // Total
          data.status || "New",              // Status
          item.brand || "",             
          item.model || ""              
        ];
        
        // PAD ROW if header has more columns
        while (row.length < colCount) {
            row.push("");
        }
        return row;
      });
    }

    // 3. Rewrite Sheet
    itemSheet.clearContents(); // Clears all data
    
    var finalData = [];
    if (header) {
      finalData.push(header);
    } else {
      // Emergency Fallback if sheet was totally blank
      finalData.push(['Project ID', 'Room / Area', 'Installation Type', 'Description', 'Unit Price(RM)', 'Quantity', 'Total (RM)', 'Status', 'Brand/Type', 'Model']);
    }
    
    finalData = finalData.concat(keptRows).concat(newRows);
    
    // Write back everything
    if (finalData.length > 0) {
        itemSheet.getRange(1, 1, finalData.length, finalData[0].length).setValues(finalData);
    }
    
    SpreadsheetApp.flush();

    // ---------------------------------------------------------
    // 3. GENERATE & SAVE PDF AUTOMATICALLY
    // ---------------------------------------------------------
    var fileUrl = null;
    var glPdfBase64 = null;
    
    /* AUTO-PDF GENERATION DISABLED
    try {
        // Prepare line items for PDF generator (needs strictly 'item', 'qty', 'total', 'desc')
        // data.items structure: { desc, qty, unitPrice, ... }
        // generatePDFfromData expects Items array
        
        // Ensure data.type is valid
        var docType = data.type || 'INVOICE';
        
        // 2026-01-25 Fix: Calculate item totals if missing (frontend state doesn't store 'total')
        if (data.items && data.items.length > 0) {
            data.items.forEach(function(item) {
                if (item.total === undefined || item.total === null) {
                    item.total = (Number(item.qty) || 0) * (Number(item.unitPrice) || 0);
                }
            });
        }
        
        // 2026-01-26 Fix: Ensure all data (status, deposit, discount) is passed in the project object
        var pdfProjectData = {
          id: data.project.id,
          customer: data.project.customer,
          email: data.project.email,
          phone: data.project.phone,
          address: data.project.address,
          date: data.project.date || new Date().toLocaleDateString(),
          status: data.status,
          deposit: data.totals.deposit || 0,
          discount: data.discount || 0
        };
        
        var pdfResult = generatePDFfromData(pdfProjectData, data.items, docType);
        
        // Save to Drive
        var pYear = new Date().getFullYear();
        var idMatch = projectId.match(/(\d{4})/);
        if (idMatch) pYear = idMatch[1];
        
        var docInfo = getDocTypeFromStatus(docType); // Will map correctly now
        // Force docType driven folder if helper fallback isn't perfect for "Quotation" passed as type
        var folderName = docType === 'QUOTATION' ? 'Quotation' : docInfo.subfolder;
        var targetFolder = getOrCreateYearSubfolder(FOLDER_NAME, pYear, folderName);
        
        fileUrl = savePDFToDrive(pdfResult.blob, pdfResult.filename, targetFolder);
        glPdfBase64 = Utilities.base64Encode(pdfResult.blob.getBytes());
        
        // Update Sheet with Link
        var pSheet = ss.getSheetByName(SHEET_PROJECTS);
        if (rowIndexToUpdate > 0) {
             pSheet.getRange(rowIndexToUpdate, 9).setValue(fileUrl);
        } else {
             // It's the last row
             pSheet.getRange(pSheet.getLastRow(), 9).setValue(fileUrl);
        }
        
    } catch (pdfErr) {
        Logger.log("❌ Auto-Save PDF Failed: " + pdfErr.toString());
    }
    */

    SpreadsheetApp.flush();

    return jsonResponse({ 
      result: "success", 
      id: projectId, 
      action: rowIndexToUpdate > 0 ? "updated" : "created",
      fileUrl: fileUrl,
      pdfBase64: glPdfBase64
    });

  } catch (e) {
    return jsonResponse({ result: "error", error: e.toString() });
  } finally {
    lock.releaseLock();
  }
}

function getDashboardStats(period) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_PROJECTS);
  if (!sheet) return jsonResponse({ error: "Projects sheet not found" });

  var data = sheet.getDataRange().getValues();

  var totalSales = 0;      // Total Invoiced (Valid projects)
  var totalCollected = 0;  // Total Cash Received (Deposit or Full)
  var totalUnpaid = 0;     // Outstanding
  var recentProjects = [];
  
  var now = new Date();
  var pStart = new Date(1970, 0, 1);
  var pEnd = new Date(2100, 0, 1);

  // Determine Date Range
  if (!period || period === 'MONTH') {
    pStart = new Date(now.getFullYear(), now.getMonth(), 1);
    pEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else if (period === 'LAST_MONTH') {
    pStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    pEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  } else if (period === 'YEAR') {
    pStart = new Date(now.getFullYear(), 0, 1);
    pEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  } else if (period === 'ALL') {
    // defaults ok
  }

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var date = new Date(row[0]);
    var status = String(row[12]).toUpperCase(); 
    var total = Number(row[9]) || 0;
    var deposit = Number(row[10]) || 0;
    var unpaid = Number(row[11]) || 0;

    // Filter by Date
    if (date >= pStart && date <= pEnd) {
       // Filter out CANCELLED and QUOTATIONS from financial stats
       // Quote is not a Sale yet.
       var type = String(row[7]).toUpperCase();
       var isQuote = type.includes("QUOTATION");
       var isCancelled = (status === 'CANCELLED');

       if (!isCancelled && !isQuote) {
          var discount = Number(row[14]) || 0; // Col O (Index 14)
          var netTotal = total - discount;

          totalSales += netTotal;
          
          if (status === 'PAID') {
            totalCollected += netTotal;
          } else {
             // PARTIAL or UNPAID -> Collect Deposit, rest is Unpaid
             if (deposit > 0) {
                 totalCollected += deposit;
                 totalUnpaid += (netTotal - deposit);
             } else {
                 totalUnpaid += netTotal;
             }
          }
       }
    }
  }

  // ... (Project Loop Logic) ...
  
  // 3. Calculate Expenses for the same period
  var eSheet = ss.getSheetByName(SHEET_EXPENSES);
  var totalExpenses = 0;
  
  if (eSheet) {
    var eData = eSheet.getDataRange().getValues();
    // Col A: Date (Index 0), Col H: Amount (Index 7)
    for (var k = 1; k < eData.length; k++) {
       var eRow = eData[k];
       var eDate = new Date(eRow[0]);
       var eAmount = Number(eRow[7]) || 0;
       
       if (eDate >= pStart && eDate <= pEnd) {
          totalExpenses += eAmount;
       }
    }
  }

  // Get Recent Projects
  var count = 0;
  for (var j = data.length - 1; j >= 1; j--) {
    if (count >= 10) break;
    var row = data[j];
    var rDate = new Date(row[0]);
    
    // Only show if matches filter
    if (rDate >= pStart && rDate <= pEnd) {
        if (row[1]) { 
          recentProjects.push({
            id: row[1],
            customer: row[2],
            date: rDate.toISOString().split('T')[0],
            total: row[9],
            status: row[12],
            type: String(row[7]).includes("QUOTATION") ? "QUOTATION" : "INVOICE"
          });
          count++;
        }
    }
  }

  // Return the stats
  return jsonResponse({
    sales: totalSales,
    collected: totalCollected,
    expenses: totalExpenses,
    net: (totalCollected - totalExpenses),
    unpaid: totalUnpaid,
    recent: recentProjects,
    period: period || 'MONTH'
  });
}


// -------------------------------------------------------------
// LEGACY HANDYMAN TOOLS AUTOMATION
// -------------------------------------------------------------

const FOLDER_NAME = "Handyman Docs"; 

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Handyman Tools')
    .addItem('1. Generate Quote', 'generateQuote')
    .addItem('2. Convert to Invoice', 'generateInvoice')
    .addItem('3. Send Receipt', 'generateReceipt')
    .addToUi();
}

function onFormSubmit(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PROJECTS);
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); 
  const prefix = `JOB-${year}-${month}-`; 
  
  let maxId = 0;
  for (let i = 1; i < data.length; i++) {
    const val = data[i][1]; 
    if (val && typeof val === 'string' && val.startsWith(prefix)) {
      const numPart = parseInt(val.replace(prefix, ""), 10);
      if (!isNaN(numPart) && numPart > maxId) {
        maxId = numPart;
      }
    }
  }
  let nextId = maxId + 1;
  for (let i = 1; i < data.length; i++) {
    if (!data[i][1] && data[i][0]) { 
       const idStr = String(nextId).padStart(3, '0'); 
       const newId = prefix + idStr;
       sheet.getRange(i + 1, 2).setValue(newId);
       nextId++; 
    }
  }
}

function generateQuote() { generateDocument("QUOTATION"); }
function generateInvoice() { generateDocument("INVOICE"); }
function generateReceipt() { generateDocument("RECEIPT"); }

function generateDocument(type) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const projectSheet = ss.getSheetByName(SHEET_PROJECTS);
  // Use GID 663549614 for consistency
  var itemSheet = getSheetById(ss, 663549614);
  if (!itemSheet) itemSheet = ss.getSheetByName(SHEET_ITEMS);

  const ui = SpreadsheetApp.getUi();

  const row = projectSheet.getActiveRange().getRow();
  if (row === 1) { 
    ui.alert("Please select a project row (not the header).");
    return;
  }
  
  const projectData = projectSheet.getRange(row, 1, 1, projectSheet.getLastColumn()).getValues()[0];
  const projectId = projectData[1]; 
  
  if (!projectId) {
    ui.alert("No Project ID found in this row.");
    return;
  }
  
  const allItems = itemSheet.getDataRange().getValues();
  const lineItems = [];
  let totalAmount = 0;
  
  // Normalize Search ID
  const searchIdUpper = String(projectId).trim().toUpperCase();

  // NEW Columns: [0]ID | [1]Room | [2]Type | [3]Desc | [4]Price | [5]Qty | [6]Total | [7]Status | [8]Brand | [9]Model
  for (let i = 1; i < allItems.length; i++) {
    if (String(allItems[i][0]).trim().toUpperCase() === searchIdUpper) {
      
      const room = allItems[i][1];
      const itemType = allItems[i][2];
      const desc = allItems[i][3];
      const unitPrice = Number(allItems[i][4]) || 0;
      const qty = Number(allItems[i][5]) || 0;
      
      // Removed Mat/Trans/Disc calculation
      const total = (unitPrice * qty);
      
      lineItems.push({
        room: room,
        type: itemType,
        desc: desc, 
        unitPrice: unitPrice,
        qty: qty,
        total: total
      });
      totalAmount += total;
    }
  }

  if (lineItems.length === 0) {
    ui.alert("No items found in '" + SHEET_ITEMS + "' for Project ID: " + projectId);
    return;
  }

  
  let docPrefix = "";
  if (type === "QUOTATION") docPrefix = "QTN";
  else if (type === "INVOICE") docPrefix = "INV";
  else if (type === "RECEIPT") docPrefix = "RCT";
  
  const docId = projectId.replace(/^(JOB|HM|INV)/, docPrefix);

  try {
    const template = HtmlService.createTemplateFromFile('template');
    template.type = type; 
    template.project = {
      id: docId,       
      originalId: projectId, 
      customer: projectData[2], 
      address: projectData[5],  
      phone: projectData[4],    
      email: projectData[3],    
      date: new Date().toLocaleDateString()
    };
    template.items = lineItems;
    template.total = totalAmount;

    // --- WRITE TOTAL, DEPOSIT, BALANCE INTO PROJECT SHEET ---
    const TOTAL_COL = 10;     // Col J
    const DEPOSIT_COL = 11;   // Col K
    const BALANCE_COL = 12;   // Col L
    const STATUS_COL = 13;    // Col M
    const DISCOUNT_COL = 15;  // Col O
    
    let depositPaid = projectData[DEPOSIT_COL - 1] ? Number(projectData[DEPOSIT_COL - 1]) : 0;
    const discount = projectData[DISCOUNT_COL - 1] ? Number(projectData[DISCOUNT_COL - 1]) : 0;
    const currentStatus = String(projectData[STATUS_COL - 1]).toUpperCase();
    
    // Net Total (after discount)
    const netTotal = totalAmount - discount;

    // Fallback: If it's marked as PAID but deposit is 0, assume it's fully paid
    if (currentStatus === 'PAID' && depositPaid === 0) {
      depositPaid = netTotal;
    }

    const balanceDue = netTotal - depositPaid;

    template.deposit = depositPaid;
    template.discount = discount;
    template.balance = balanceDue;
    template.subtotal = totalAmount; 
    template.netTotal = netTotal;

    let status = "UNPAID";
    // Use rounded values for financial comparison
    const rDeposit = Math.round(depositPaid * 100);
    const rNetTotal = Math.round(netTotal * 100);

    if (rDeposit >= rNetTotal && rNetTotal > 0) {
      status = "PAID";
    } else if (rDeposit > 0) {
      status = "PARTIAL";
    }

    template.status = status;

    // Write values to sheet
    projectSheet.getRange(row, TOTAL_COL).setValue(totalAmount);
    projectSheet.getRange(row, BALANCE_COL).setValue(balanceDue);
    projectSheet.getRange(row, 13).setValue(status); 

    // 4. Generate PDF
    const htmlObj = template.evaluate();
    const pdfBlob = Utilities.newBlob(htmlObj.getContent(), 'text/html', docId + ".html")
                    .getAs(MimeType.PDF)
                    .setName(docId + ".pdf");
    
    // 5. Save to Drive
    const folder = getOrCreateFolder(FOLDER_NAME);
    const file = folder.createFile(pdfBlob);
    const fileUrl = file.getUrl();
    
    // 6. Update Sheet
    projectSheet.getRange(row, 8).setValue(type + " Generated"); 
    projectSheet.getRange(row, 9).setValue(fileUrl); 
    
    ui.alert("Success! " + type + " created: " + fileUrl);
    
  } catch (e) {
    ui.alert("Error: " + e.toString() + ". Make sure 'template.html' exists!");
  }
}

function getOrCreateFolder(name) {
  // Try to get ROOT_FOLDER_ID from Script Properties first (the "env")
  var props = PropertiesService.getScriptProperties();
  var rootId = props.getProperty('ROOT_FOLDER_ID');
  
  if (rootId) {
    try {
      return DriveApp.getFolderById(rootId);
    } catch(e) {
      Logger.log("Configured ROOT_FOLDER_ID not found, falling back to name search.");
    }
  }

  // Fallback to name search
  const folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(name);
  }
}

// Helper: Get or Create Year-Based Subfolder
// Creates structure: Handyman Docs/{YEAR}/{Type}/
function getOrCreateYearSubfolder(parentFolderName, year, docType) {
  // 1. Get/Create parent folder
  var parentFolder = getOrCreateFolder(parentFolderName);
  
  // 2. Get/Create year folder
  var yearFolderName = String(year);
  var yearFolder = null;
  var yearFolders = parentFolder.getFoldersByName(yearFolderName);
  if (yearFolders.hasNext()) {
    yearFolder = yearFolders.next();
  } else {
    yearFolder = parentFolder.createFolder(yearFolderName);
  }
  
  // 3. Get/Create type folder within year folder
  var typeFolder = null;
  var typeFolders = yearFolder.getFoldersByName(docType);
  if (typeFolders.hasNext()) {
    typeFolder = typeFolders.next();
  } else {
    typeFolder = yearFolder.createFolder(docType);
  }
  
  return typeFolder;
}

// Helper: Determine Document Type from Status or Type
function getDocTypeFromStatus(statusOrType) {
  var upper = String(statusOrType).toUpperCase().trim();
  
  // Direct type match
  if (upper === 'QUOTATION') {
    return { type: 'QUOTATION', prefix: 'QTN', subfolder: 'Quotation' };
  } else if (upper === 'INVOICE') {
    return { type: 'INVOICE', prefix: 'INV', subfolder: 'Invoice' };
  } else if (upper === 'RECEIPT') {
    return { type: 'RECEIPT', prefix: 'RCT', subfolder: 'Receipt' };
  }
  
  // Status-based mapping
  if (upper === 'PAID') {
    return { type: 'RECEIPT', prefix: 'RCT', subfolder: 'Receipt' };
  } else if (upper === 'QUOTATION') {
    return { type: 'QUOTATION', prefix: 'QTN', subfolder: 'Quotation' };
  } else {
    // Default: INVOICE (for UNPAID, PARTIAL, or others)
    return { type: 'INVOICE', prefix: 'INV', subfolder: 'Invoice' };
  }
}

// Helper: Generate PDF from Project Data
function generatePDFfromData(projectData, lineItems, docType) {
  try {
    var template = HtmlService.createTemplateFromFile('template');
    
    // Get document info
    var docInfo = getDocTypeFromStatus(docType);
    
    // Replace prefix in project ID
    var docId = String(projectData.id).replace(/^(JOB|HM|INV|QTN)/, docInfo.prefix);
    
    template.type = docInfo.type;
    template.project = {
      id: docId,
      originalId: projectData.id,
      customer: projectData.customer,
      address: projectData.address,
      phone: projectData.phone,
      email: projectData.email,
      date: new Date().toLocaleDateString()
    };
    
    // Sanitize items to ensure numbers for toFixed() template calls
    template.items = lineItems.map(function(item) {
      return {
        room: item.room || "",
        type: item.type || "",
        desc: item.desc || "",
        qty: Number(item.qty) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        total: Number(item.total) || 0
      };
    });
    
    // Calculate totals
    var subtotal = 0;
    for (var i = 0; i < lineItems.length; i++) {
      subtotal += lineItems[i].total || 0;
    }
    
    var discount = Number(projectData.discount) || 0;
    var netTotal = subtotal - discount;
    var depositPaid = Number(projectData.deposit) || 0;
    var currentStatus = String(projectData.status).toUpperCase();

    // Fallback: If it's marked as PAID but deposit is 0, assume it's fully paid
    if (currentStatus === 'PAID' && depositPaid === 0) {
      depositPaid = netTotal;
    }

    var balanceDue = netTotal - depositPaid;
    
    template.subtotal = subtotal;
    template.total = subtotal;
    template.discount = discount;
    template.netTotal = netTotal;
    template.deposit = depositPaid;
    template.balance = balanceDue;
    
    // Determine status
    var status = 'UNPAID';
    var rDeposit = Math.round(depositPaid * 100);
    var rNetTotal = Math.round(netTotal * 100);

    if (docInfo.type === 'QUOTATION') {
        status = ''; // Hide status for Quotations
    } else if (rDeposit >= rNetTotal && rNetTotal > 0) {
      status = 'PAID';
    } else if (rDeposit > 0) {
      status = 'PARTIAL';
    }
    template.status = status;
    
    // Generate PDF Blob
    var htmlObj = template.evaluate();
    var pdfBlob = Utilities.newBlob(htmlObj.getContent(), 'text/html', docId + ".html")
                    .getAs(MimeType.PDF)
                    .setName(docId + ".pdf");
    
    return { blob: pdfBlob, filename: docId + ".pdf" };
  } catch (e) {
    throw new Error("PDF Generation Failed: " + e.toString());
  }
}

function getMonthlyTrends(year) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var targetYear = year; // Can be 'ALL' or a specific year (e.g. 2025)
  if (!targetYear) targetYear = new Date().getFullYear();
  
  var monthlyData = [];
  var monthMap = {}; // Key: "YYYY-MM", Value: { month: "Jan 2025", revenue: 0, ... }
  
  // Helper to get key/label
  function getKey(date) {
    var y = date.getFullYear();
    var m = date.getMonth(); // 0-11
    var padM = String(m + 1).padStart(2, '0');
    return y + "-" + padM;
  }
  
  function getLabel(date) {
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[date.getMonth()] + " " + date.getFullYear();
  }

  // initialize if specific year
  if (targetYear !== 'ALL') {
     var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
     for (var m = 0; m < 12; m++) {
       monthlyData.push({
         month: monthNames[m],
         revenue: 0,
         expenses: 0,
         profit: 0
       });
     }
  }

  // 1. PROJECT REVENUE
  var pSheet = ss.getSheetByName(SHEET_PROJECTS);
  if (pSheet) {
    var pData = pSheet.getDataRange().getValues();
    for (var i = 1; i < pData.length; i++) {
        var row = pData[i];
        if (!row[0]) continue;
        var date = new Date(row[0]);
        
        var match = false;
        if (targetYear === 'ALL') match = true;
        else if (date.getFullYear() == targetYear) match = true;
        
        if (match) {
            var status = String(row[12]).toUpperCase();
            var type = String(row[7]).toUpperCase();
            if (status !== 'CANCELLED' && !type.includes('QUOTATION')) {
                var total = Number(row[9]) || 0;
                var discount = Number(row[14]) || 0;
                var netRevenue = total - discount;
                
                if (targetYear === 'ALL') {
                   var key = getKey(date);
                   if (!monthMap[key]) monthMap[key] = { month: getLabel(date), revenue: 0, expenses: 0, profit: 0, sortKey: key };
                   monthMap[key].revenue += netRevenue;
                } else {
                   var monthIdx = date.getMonth(); 
                   if (monthIdx >= 0 && monthIdx < 12) monthlyData[monthIdx].revenue += netRevenue;
                }
            }
        }
    }
  }
  
  // 2. EXPENSES
  var eSheet = ss.getSheetByName(SHEET_EXPENSES);
  if (eSheet) {
    var eData = eSheet.getDataRange().getValues();
    for (var k = 1; k < eData.length; k++) {
       var eRow = eData[k];
       if (!eRow[0]) continue;
       var eDate = new Date(eRow[0]);
       
        var match = false;
        if (targetYear === 'ALL') match = true;
        else if (eDate.getFullYear() == targetYear) match = true;

       if (match) {
          var amount = Number(eRow[7]) || 0;
          if (targetYear === 'ALL') {
             var key = getKey(eDate);
             if (!monthMap[key]) monthMap[key] = { month: getLabel(eDate), revenue: 0, expenses: 0, profit: 0, sortKey: key };
             monthMap[key].expenses += amount;
          } else {
             var monthIdx = eDate.getMonth();
             if (monthIdx >= 0 && monthIdx < 12) monthlyData[monthIdx].expenses += amount;
          }
       }
    }
  }
  
  // 3. FINALIZE
  if (targetYear === 'ALL') {
     // Convert map to array and sort
     var keys = Object.keys(monthMap).sort();
     for (var i = 0; i < keys.length; i++) {
        var item = monthMap[keys[i]];
        item.profit = item.revenue - item.expenses;
        monthlyData.push(item);
     }
  } else {
     // Calc profit for fixed months
     for (var m = 0; m < 12; m++) {
       monthlyData[m].profit = monthlyData[m].revenue - monthlyData[m].expenses;
     }
  }
  
  return jsonResponse({ trends: monthlyData, year: targetYear });
}

// Helper: Save PDF to Drive with Version Control
function savePDFToDrive(pdfBlob, filename, targetFolder) {
  // Check if file already exists
  var existingFiles = targetFolder.getFilesByName(filename);
  
  if (existingFiles.hasNext()) {
    // File exists, create versioned copy
    var version = 2;
    var baseName = filename.replace('.pdf', '');
    var versionedName = baseName + '_v' + version + '.pdf';
    
    // Find next available version number
    while (targetFolder.getFilesByName(versionedName).hasNext()) {
      version++;
      versionedName = baseName + '_v' + version + '.pdf';
    }
    
    var file = targetFolder.createFile(pdfBlob.setName(versionedName));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } else {
    // Create new file
    var file = targetFolder.createFile(pdfBlob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  }
}

function getSheetById(ss, id) {
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
        if (sheets[i].getSheetId() == id) {
            return sheets[i];
        }
    }
    return null;
}


// --- AUTOMATED EMAIL REPORTING & INVOICE EMAILING ---

function setupMonthlyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendMonthlyReport') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('sendMonthlyReport')
      .timeBased()
      .onMonthDay(1)
      .atHour(9)
      .create();
}

function sendMonthlyReport() {
  try {
    // Session.getEffectiveUser() fails for anonymous web app users.
    // Use hardcoded admin email or default.
    var userEmail = "fareezfauzimy@gmail.com"; 

    var rawData = getCompanyReportData('LAST_MONTH');
    
    // Calculate Readable Date
    var d = new Date();
    d.setMonth(d.getMonth() - 1);
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var periodStr = months[d.getMonth()] + " " + d.getFullYear();

    var html = buildReportHtml(rawData);
    // Basic validations
    if (!rawData) throw new Error("No data returned from getCompanyReportData");
    if (!html) throw new Error("HTML generation failed");

    var blob = Utilities.newBlob(html, 'text/html', 'Monthly_Report.html');
    var pdf = blob.getAs('application/pdf').setName('Report_' + periodStr.replace(' ', '_') + '.pdf');

    // Professional Email Template
    var emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background: #312e81; padding: 20px; text-align: center;">
             <h2 style="color: white; margin: 0;">Monthly Performance Report</h2>
        </div>
        <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
            <p>Dear Administrator,</p>
            <p>Here is your automated business summary for <strong>${periodStr}</strong>.</p>
            
            <div style="background: #f3f4f6; padding: 15px; margin: 15px 0; border-radius: 5px;">
                <p style="margin: 0; font-size: 13px; color: #666;"><strong>Performance Snapshot:</strong></p>
                <ul style="margin: 5px 0 0 20px; font-size: 14px;">
                   <li><strong>Total Sales:</strong> RM ${rawData.financials.sales.toFixed(2)}</li>
                   <li><strong>Net Profit:</strong> RM ${rawData.financials.net.toFixed(2)}</li>
                </ul>
            </div>

            <p>The full detailed PDF report is attached.</p>
            <br>
            <p style="font-size: 12px; color: #888;">instaliQ | Automated System</p>
        </div>
      </div>
    `;

    GmailApp.sendEmail(userEmail, "Business Report: " + periodStr, "Please find attached report.", {
      htmlBody: emailBody,
      attachments: [pdf],
      name: "instaliQ Reporting System"
    });

    return "Sent to " + userEmail;
  } catch (e) {
    return "Error: " + e.toString();
  }
}

function sendInvoiceEmail(data) {
  var recipient = data.to || Session.getEffectiveUser().getEmail();
  var subject = data.subject || "Invoice Document";
  var body = data.body || "Please find attached your invoice.";
  var blob;

  if (data.base64) {
      var decoded = Utilities.base64Decode(data.base64.split(',')[1] || data.base64);
      blob = Utilities.newBlob(decoded, 'application/pdf', data.filename || 'Invoice.pdf');
  } else {
      return "Error: No PDF content provided";
  }

  GmailApp.sendEmail(recipient, subject, body, {
    htmlBody: body,
    attachments: [blob]
  });

  return "Email sent to " + recipient;
}

function getCompanyReportData(period) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pSheet = ss.getSheetByName(SHEET_PROJECTS);
  var iSheet = ss.getSheetByName(SHEET_ITEMS);
  var eSheet = ss.getSheetByName(SHEET_EXPENSES);

  var now = new Date();
  var pStart = new Date(1970, 0, 1);
  var pEnd = new Date(2100, 0, 1);

  if (!period || period === 'MONTH') {
    pStart = new Date(now.getFullYear(), now.getMonth(), 1);
    pEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else if (period === 'LAST_MONTH') {
    pStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    pEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  } else if (period === 'YEAR') {
    pStart = new Date(now.getFullYear(), 0, 1);
    pEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  }

  var financials = { sales: 0, collected: 0, expenses: 0, net: 0, unpaid: 0 };
  var projectStats = { total: 0, paid: 0, unpaid: 0, cancelled: 0, quotation: 0 };
  var projectDates = {};

  if (pSheet) {
    var pData = pSheet.getDataRange().getValues();
    for (var i = 1; i < pData.length; i++) {
        var row = pData[i];
        var pid = String(row[1]).trim();
        var date = new Date(row[0]);
        var status = String(row[12]).toUpperCase();
        var type = String(row[7]).toUpperCase();
        var total = Number(row[9]) || 0;
        var deposit = Number(row[10]) || 0;
        
        if (pid && status !== 'CANCELLED' && !type.includes('QUOTATION')) {
            projectDates[pid] = date;
        }

        if (date >= pStart && date <= pEnd) {
             projectStats.total++;
             if (status === 'CANCELLED') projectStats.cancelled++;
             else if (status === 'PAID') projectStats.paid++;
             else projectStats.unpaid++;
             
             if (status !== 'CANCELLED' && !type.includes('QUOTATION')) {
                 var discount = Number(row[14]) || 0; 
                 var netTotal = total - discount;

                 financials.sales += netTotal;
                 if (status === 'PAID') {
                     financials.collected += netTotal; 
                 } else if (status === 'PARTIAL' || status === 'UNPAID') {
                     financials.collected += deposit;
                     financials.unpaid += (netTotal - deposit);
                 }
             }
        }
    }
  }

  var expenseBreakdown = {};
  if (eSheet) {
      var eData = eSheet.getDataRange().getValues();
      for (var k = 1; k < eData.length; k++) {
          var eRow = eData[k];
          var eDate = new Date(eRow[0]);
          var store = String(eRow[3]).trim() || "Other"; 
          var amount = parseFinanceValue(eRow[7]); 

          if (eDate >= pStart && eDate <= pEnd) {
              financials.expenses += amount;
              if (!expenseBreakdown[store]) expenseBreakdown[store] = 0;
              expenseBreakdown[store] += amount;
          }
      }
  }
  financials.net = financials.collected - financials.expenses;

  var serviceStats = {};
  if (iSheet) {
      var iData = iSheet.getDataRange().getValues();
      var headers = iData[0];
      var colTotal = -1, colType = -1, colQty = -1;
      for (var h=0; h<headers.length; h++) {
        var hdr = String(headers[h]).toLowerCase().trim();
        if (hdr === 'total' || hdr === 'total (rm)' || hdr === 'amount') colTotal = h;
        if (hdr === 'type' || hdr === 'item type') colType = h;
        if (hdr === 'qty' || hdr === 'quantity') colQty = h;
      }
      if (colType === -1) colType = 2; 
      if (colQty === -1) colQty = 5;   
      if (colTotal === -1) colTotal = 6;

      for (var j = 1; j < iData.length; j++) {
         var itemPid = String(iData[j][0]).trim();
         var pDate = projectDates[itemPid]; 
         if (!pDate) continue;

         if (pDate >= pStart && pDate <= pEnd) {
             var type = String(iData[j][colType] || "Other").trim();
             var qty = Number(iData[j][colQty]) || 0;
             var total = parseFinanceValue(iData[j][colTotal]);

             if (!serviceStats[type]) serviceStats[type] = { qty: 0, revenue: 0 };
             serviceStats[type].qty += qty;
             serviceStats[type].revenue += total;
         }
      }
  }

  var topServices = [];
  for (var key in serviceStats) {
      topServices.push({ type: key, qty: serviceStats[key].qty, revenue: serviceStats[key].revenue });
  }
  topServices.sort(function(a,b){ return b.revenue - a.revenue; }); 

  var topExpenses = [];
  for (var key in expenseBreakdown) {
      topExpenses.push({ store: key, amount: expenseBreakdown[key] });
  }
  topExpenses.sort(function(a,b){ return b.amount - a.amount; });

  return {
      period: period || 'MONTH',
      financials: financials,
      projects: projectStats,
      services: topServices.slice(0, 10), 
      expenses: topExpenses.slice(0, 10) 
  };
}

function buildReportHtml(data) {
  var f = data.financials;
  
  // Format period to "Month Year"
  var periodStr = data.period;
  if (data.period === 'LAST_MONTH') {
      var d = new Date();
      d.setMonth(d.getMonth() - 1);
      var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      periodStr = months[d.getMonth()] + " " + d.getFullYear();
  }

  var css = `
    @page { size: A4 portrait; margin: 10mm; }
    body { font-family: 'Helvetica', sans-serif; color: #333; font-size: 10px; line-height: 1.3; }
    h1 { color: #312e81; border-bottom: 2px solid #312e81; padding-bottom: 5px; font-size: 16px; margin: 0 0 5px 0; }
    p.meta { color: #666; font-size: 9px; margin-bottom: 20px; }
    .summary-grid { display: table; width: 100%; margin-bottom: 20px; table-layout: fixed; }
    .card { display: table-cell; background: #f9fafb; padding: 10px; border: 1px solid #e5e7eb; border-radius: 4px; vertical-align: middle; }
    .card + .card { border-left: 5px solid white; }
    .card.profit { background: #eef2ff; border-color: #c7d2fe; }
    .card h3 { font-size: 9px; text-transform: uppercase; color: #6b7280; margin: 0 0 2px 0; }
    .card p { font-size: 14px; font-weight: bold; margin: 0; }
    .section { margin-bottom: 15px; page-break-inside: avoid; }
    h2 { font-size: 11px; background: #f3f4f6; padding: 5px; margin: 0 0 5px 0; color: #1f2937; }
    table { width: 100%; border-collapse: collapse; font-size: 9px; }
    th { text-align: left; background: #f9fafb; padding: 4px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #4b5563; }
    td { padding: 4px; border-bottom: 1px solid #f3f4f6; }
    .right { text-align: right; }
    .footer { font-size: 8px; color: #9ca3af; margin-top: 10px; text-align: center; border-top: 1px solid #eee; padding-top: 5px; }
  `;

  var html = `
    <html>
      <head><style>${css}</style></head>
      <body>
        <h1>Monthly Business Report</h1>
        <p class="meta">Period: <strong>${periodStr}</strong> | Generated: ${new Date().toLocaleDateString()}</p>
        
        <div class="summary-grid">
           <div class="card">
              <h3>Total Sales</h3>
              <p>RM ${f.sales.toFixed(2)}</p>
           </div>
           <div class="card">
              <h3>Collected</h3>
              <p style="color: green;">RM ${f.collected.toFixed(2)}</p>
           </div>
           <div class="card">
              <h3>Expenses</h3>
              <p style="color: red;">RM ${f.expenses.toFixed(2)}</p>
           </div>
           <div class="card profit">
              <h3>Net Profit</h3>
              <p style="color: #312e81;">RM ${f.net.toFixed(2)}</p>
           </div>
        </div>

        <div class="section">
           <h2>Top Performing Services</h2>
           <table>
             <thead><tr><th>Service Type</th><th class="right">Qty</th><th class="right">Revenue</th></tr></thead>
             <tbody>
               ${data.services.slice(0, 10).map(s => `<tr><td>${s.type}</td><td class="right">${s.qty}</td><td class="right">RM ${s.revenue.toFixed(2)}</td></tr>`).join('')}
             </tbody>
           </table>
        </div>
        
        <div class="section">
           <h2>Top Expenses (By Store)</h2>
           <table>
             <thead><tr><th>Store/Category</th><th class="right">Amount</th></tr></thead>
             <tbody>
               ${data.expenses.slice(0, 10).map(e => `<tr><td>${e.store}</td><td class="right">RM ${e.amount.toFixed(2)}</td></tr>`).join('')}
             </tbody>
           </table>
        </div>
        
        <div class="footer">
          Automated Report by instaliQ | Generated via Google Apps Script
        </div>
      </body>
    </html>
  `;
  
  return html;
}

function getProjects() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_PROJECTS);
  
  if (!sheet) {
    return jsonResponse([]);
  }
  
  var data = sheet.getDataRange().getValues();
  var projects = [];
  
  // Skip header, start at 1
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var id = row[1]; // Col B
    
    // Only include if ID exists
    if (id) {
       projects.push({
         id: String(id),
         customer: row[2], // Col C
         status: row[12] || 'UNPAID' // Col M
       });
    }
  }
  
  // Return reversed to show newest first
  return jsonResponse(projects.reverse());
}

// ============================================
// PAYMENT RECEIPT UPLOAD
// ============================================

function uploadPaymentReceipt(projectId, fileData, fileName, mimeType) {
  try {
    // Validate file type
    var allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowedTypes.indexOf(mimeType) === -1) {
      return { error: 'Invalid file type. Only JPG, PNG, and PDF are allowed.' };
    }
    
    // Decode base64
    var blob = Utilities.newBlob(Utilities.base64Decode(fileData), mimeType, fileName);
    
    // Check file size (10MB limit)
    if (blob.getBytes().length > 10 * 1024 * 1024) {
      return { error: 'File too large. Maximum size is 10MB.' };
    }
    
    // Get or create folder structure
    var receiptFolder = getOrCreateReceiptFolder(projectId);
    
    // Generate timestamped filename
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss');
    var ext = fileName.split('.').pop();
    var newFileName = 'RECEIPT_' + projectId + '_' + timestamp + '.' + ext;
    
    // Save file
    var file = receiptFolder.createFile(blob);
    file.setName(newFileName);
    
    // Return file URL
    return { 
      success: true, 
      url: file.getUrl(),
      fileName: newFileName
    };
    
  } catch (e) {
    return { error: 'Upload failed: ' + e.toString() };
  }
}

function getOrCreateReceiptFolder(projectId) {
  // Navigate to: Receipt > payment receipts > {PROJECT_ID}
  var rootFolderId = '1VBUwuWOCvLDK6ktO4ynxQOSUgAm9e3Ul';
  var rootFolder = DriveApp.getFolderById(rootFolderId);
  
  // Get or create "payment receipts" subfolder
  var paymentReceiptsFolder;
  var folders = rootFolder.getFoldersByName('payment receipts');
  if (folders.hasNext()) {
    paymentReceiptsFolder = folders.next();
  } else {
    paymentReceiptsFolder = rootFolder.createFolder('payment receipts');
  }
  
  // Get or create project-specific subfolder
  var projectFolder;
  var projectFolders = paymentReceiptsFolder.getFoldersByName(projectId);
  if (projectFolders.hasNext()) {
    projectFolder = projectFolders.next();
  } else {
    projectFolder = paymentReceiptsFolder.createFolder(projectId);
  }
  
  return projectFolder;
}

// ============================================
// EXPENSE RECEIPT UPLOAD
// ============================================

function uploadExpenseReceipt(refNo, fileData, fileName, mimeType) {
  try {
    // Validate file type
    var allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowedTypes.indexOf(mimeType) === -1) {
      return { error: 'Invalid file type. Only JPG, PNG, and PDF are allowed.' };
    }
    
    // Decode base64
    var blob = Utilities.newBlob(Utilities.base64Decode(fileData), mimeType, fileName);
    
    // Check file size (10MB limit)
    if (blob.getBytes().length > 10 * 1024 * 1024) {
      return { error: 'File too large. Maximum size is 10MB.' };
    }
    
    // Get or create folder structure: Receipt > expenses receipts > {REF_NO}
    var expenseFolder = getOrCreateExpenseReceiptFolder(refNo);
    
    // Generate timestamped filename
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss');
    var ext = fileName.split('.').pop();
    var newFileName = 'EXPENSE_' + refNo + '_' + timestamp + '.' + ext;
    
    // Save file
    var file = expenseFolder.createFile(blob);
    file.setName(newFileName);
    
    // Return file URL
    return { 
      success: true, 
      url: file.getUrl(),
      fileName: newFileName
    };
    
  } catch (e) {
    return { error: 'Upload failed: ' + e.toString() };
  }
}

function getOrCreateExpenseReceiptFolder(refNo) {
  // Navigate to: Receipt > expenses receipts > {REF_NO}
  var rootFolderId = '1VBUwuWOCvLDK6ktO4ynxQOSUgAm9e3Ul';
  var rootFolder = DriveApp.getFolderById(rootFolderId);
  
  // Get or create "expenses receipts" subfolder
  var expensesReceiptsFolder;
  var folders = rootFolder.getFoldersByName('expenses receipts');
  if (folders.hasNext()) {
    expensesReceiptsFolder = folders.next();
  } else {
    expensesReceiptsFolder = rootFolder.createFolder('expenses receipts');
  }
  
  // Get or create ref-specific subfolder (use refNo or timestamp if no refNo)
  var folderName = refNo || 'EXP_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  var refFolder;
  var refFolders = expensesReceiptsFolder.getFoldersByName(folderName);
  if (refFolders.hasNext()) {
    refFolder = refFolders.next();
  } else {
    refFolder = expensesReceiptsFolder.createFolder(folderName);
  }
  
  return refFolder;
}

// ============================================
// RECEIPT OCR SCANNING (Google Cloud Vision API)
// ============================================

function scanReceipt(imageData, providedKey) {
  try {
    // Prefer key provided in request payload (from frontend .env)
    // Fallback to Script Properties (if configured)
    var apiKey = providedKey || PropertiesService.getScriptProperties().getProperty('VISION_API_KEY');
    
    if (!apiKey) {
      return jsonResponse({
        success: false,
        error: 'Vision API Key not configured in Script Properties.'
      });
    }
    
    // Remove data URL prefix if present
    var base64Image = imageData;
    if (imageData.indexOf('base64,') !== -1) {
      base64Image = imageData.split('base64,')[1];
    }
    
    // Prepare Vision API request
    var visionUrl = 'https://vision.googleapis.com/v1/images:annotate?key=' + apiKey;
    var payload = {
      requests: [{
        image: {
          content: base64Image
        },
        features: [{
          type: 'TEXT_DETECTION',
          maxResults: 1
        }]
      }]
    };
    
    // Call Vision API
    var response = UrlFetchApp.fetch(visionUrl, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    var result = JSON.parse(response.getContentText());
    
    // Check for errors
    if (result.error) {
      return jsonResponse({
        success: false,
        error: 'Vision API error: ' + result.error.message
      });
    }
    
    // Extract text from response
    var annotations = result.responses[0].textAnnotations;
    if (!annotations || annotations.length === 0) {
      return jsonResponse({
        success: false,
        error: 'No text detected in image. Please ensure receipt is clear and well-lit.'
      });
    }
    
    var fullText = annotations[0].description;
    
    // Parse receipt data
    var extracted = parseReceiptText(fullText);
    
    // NOTE: Receipt image is NOT saved to Drive during OCR scan
    // It will be saved later when the user actually saves the expense/payment
    // This prevents duplicate Drive operations and orphaned files if user cancels
    
    return jsonResponse({
      success: true,
      extracted: extracted,
      rawText: fullText
    });
    
  } catch (e) {
    return jsonResponse({
      success: false,
      error: 'Scan failed: ' + e.toString()
    });
  }
}

/**
 * Extract individual line items from receipt text
 * @param {string} text - Full OCR text from receipt
 * @returns {Array} Array of items with {description, qty, unitPrice}
 */
function extractLineItems(text) {
  var lines = text.split('\n');
  var items = [];
  
  // Common patterns for line items on receipts:
  // "2 x Cement Bag @ 12.50"
  // "Paint Brush     5.00"
  // "3 Screws RM1.50"
  // "Item Name    2   @5.00   10.00"
  
  // Define exclusion keywords (headers, footers, totals)
  var excludeKeywords = /total|subtotal|tax|gst|sst|discount|cash|change|balance|tender|payment|paid|thank|you|terima|kasih|tel|phone|fax|date|time|receipt|no\.|bill|invoice|address|email|website|http/i;
  
  // Price pattern: matches numbers like 12.50, 1,234.56
  var pricePattern = /([0-9,]+\.[0-9]{2})/;
  
  // Skip first 5 lines (likely store header) and last 10 lines (likely footer/totals)
  var startIdx = Math.min(5, Math.floor(lines.length * 0.1));
  var endIdx = Math.max(startIdx + 1, lines.length - 10);
  
  for (var i = startIdx; i < endIdx; i++) {
    var line = lines[i].trim();
    
    // Skip empty lines
    if (!line || line.length < 3) continue;
    
    // Skip lines with exclusion keywords
    if (excludeKeywords.test(line)) continue;
    
    // Look for price indicators
    var priceMatch = line.match(pricePattern);
    if (!priceMatch) continue;
    
    var price = parseFloat(priceMatch[1].replace(/,/g, ''));
    if (isNaN(price) || price <= 0) continue;
    
    // Skip if price is too high (likely a total, not a line item)
    // This is heuristic - adjust threshold as needed
    if (price > 999) continue;
    
    // Extract quantity if present
    var qty = 1;
    var description = line;
    
    // Pattern: "2 x Item" or "2x Item" or "2 Item"
    var qtyPatterns = [
      /^(\d+)\s*x\s+(.+)/i,  // "2 x ItemName ..."
      /^(\d+)\s+(.+)/,        // "2 ItemName ..."
      /(\d+)\s*@/             // "... 2 @ ..."
    ];
    
    for (var p = 0; p < qtyPatterns.length; p++) {
      var qtyMatch = line.match(qtyPatterns[p]);
      if (qtyMatch && qtyMatch[1]) {
        var parsedQty = parseInt(qtyMatch[1]);
        if (!isNaN(parsedQty) && parsedQty > 0 && parsedQty <= 100) {
          qty = parsedQty;
          // Extract description (text before price)
          if (qtyMatch[2]) {
            description = qtyMatch[2];
          }
          break;
        }
      }
    }
    
    // Clean description: remove price and numeric patterns at the end
    description = description
      .replace(pricePattern, '')  // Remove price
      .replace(/\s*@\s*/g, ' ')   // Remove @ symbols
      .replace(/RM|MYR|\$/gi, '') // Remove currency symbols
      .replace(/\s{2,}/g, ' ')    // Normalize whitespace
      .trim();
    
    // Skip if description is too short or just numbers
    if (description.length < 2 || /^\d+$/.test(description)) continue;
    
    // Calculate unit price
    var unitPrice = price;
    if (qty > 1) {
      // Check if the price is already a line total or unit price
      // Heuristic: If dividing by qty gives a "nice" number, it's likely a total
      var possibleUnitPrice = price / qty;
      if (possibleUnitPrice > 0.01 && possibleUnitPrice < price) {
        // Check if result is a round number or has 2 decimals
        if (possibleUnitPrice.toFixed(2) === possibleUnitPrice.toFixed(2)) {
          unitPrice = possibleUnitPrice;
        }
      }
    }
    
    items.push({
      description: description,
      qty: qty,
      unitPrice: parseFloat(unitPrice.toFixed(2))
    });
  }
  
  // Remove duplicates (same description)
  var uniqueItems = [];
  var seen = {};
  for (var i = 0; i < items.length; i++) {
    var key = items[i].description.toLowerCase();
    if (!seen[key]) {
      uniqueItems.push(items[i]);
      seen[key] = true;
    }
  }
  
  return uniqueItems;
}

function parseReceiptText(text) {
  var lines = text.split('\n');
  var result = {
    amount: null,
    store: null,
    refNo: null,
    items: []  // NEW: Array of extracted line items
  };
  
  // Try to find store name (first 5 lines)
  for (var i = 0; i < Math.min(5, lines.length); i++) {
    var line = lines[i].trim();
    if (line.length > 3 && line.length < 50 && !line.match(/\d{5,}/) && !line.match(/Tel|Phone|Fax|Date|Time/i)) {
      result.store = line;
      break;
    }
  }
  
  // NEW: Extract line items
  result.items = extractLineItems(text);
  
  // Improved Amount Extraction
  var possibleAmounts = [];
  // Regex: Matches 1,234.56 or 1234.56 or 50.00 (with optional currency)
  var priceRegex = /(?:RM|MYR|RP|Rp|Total|Amount|Jumlah|\$)\s*[:=]?\s*([0-9,]+(?:\.[0-9]{2})?)/i;
  // Regex strict number: 12.34
  var strictNumRegex = /([0-9,]+\.[0-9]{2})/; 

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    
    // Clean weird OCR artifacts (replace 'O' with '0' in numbers? risky, skip for now)
    
    // Check for explicit keywords
    if (line.match(/total|jumlah|amount|net|payable|bayaran|due/i)) {
      
      // Check same line
      var match = line.match(strictNumRegex);
      if (match) {
        var val = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(val)) possibleAmounts.push(val);
      }
      
      // Check next line (common in OCR)
      if (i + 1 < lines.length) {
        var nextLine = lines[i+1];
        var nextMatch = nextLine.match(strictNumRegex);
        if (nextMatch) {
          var val = parseFloat(nextMatch[1].replace(/,/g, ''));
          if (!isNaN(val)) possibleAmounts.push(val);
        }
      }
    }
  }
  
  // Strategy: Max amount associated with keywords
  if (possibleAmounts.length > 0) {
    result.amount = Math.max.apply(null, possibleAmounts);
  }
  
  // Fallback: If no keyword associations found, look for ANY price at the bottom
  if (!result.amount) {
     var allPrices = [];
     // Scan from bottom up
     for (var i = lines.length - 1; i >= 0; i--) {
         var match = lines[i].match(strictNumRegex);
         if (match) {
             var val = parseFloat(match[1].replace(/,/g, ''));
             if (!isNaN(val)) allPrices.push(val);
         }
         // Limit fallback scan to bottom 10 lines
         if (lines.length - i > 15) break;
     }
     if (allPrices.length > 0) {
         result.amount = Math.max.apply(null, allPrices);
     }
  }
  
  // Try to find receipt/invoice number
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.match(/no\.|#|inv|receipt|bill|ref/i)) {
      var numMatch = line.match(/[A-Z0-9-]{5,}/);
      if (numMatch) {
        result.refNo = numMatch[0];
        break;
      }
    }
  }
  
  return result;
}

function getCustomers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_PROJECTS);
  if (!sheet) return jsonResponse({ customers: [] });

  var data = sheet.getDataRange().getValues();
  var customersMap = {};

  // Skip header
  for (var i = 1; i < data.length; i++) {
    var name = String(data[i][2]).trim(); // Col C: Customer Name
    var email = String(data[i][3]).trim(); // Col D: Email
    var phone = String(data[i][4]).trim(); // Col E: Phone
    var address = String(data[i][5]).trim(); // Col F: Address

    if (!name) continue;

    // Create a composite key to identify unique customers (Name + Phone/Email)
    // Or just Name if that's how user identifies them (simplest for autocomplete)
    // Let's use Name as primary key for simplicity, but update details if we find 'fuller' info.
    var key = name.toUpperCase();

    if (!customersMap[key]) {
      customersMap[key] = {
        name: name,
        email: email,
        phone: phone,
        address: address,
        projectCount: 1
      };
    } else {
      customersMap[key].projectCount++;
      // Update details if missing in previous entry
      if (!customersMap[key].email && email) customersMap[key].email = email;
      if (!customersMap[key].phone && phone) customersMap[key].phone = phone;
      if (!customersMap[key].address && address) customersMap[key].address = address;
    }
  }

  // Convert to array
  var customersList = [];
  for (var k in customersMap) {
    customersList.push(customersMap[k]);
  }

  // Sort by Name
  customersList.sort(function(a, b) {
    return a.name.localeCompare(b.name);
  });

  return jsonResponse({ customers: customersList });
}

function getProjectDocuments(projectId) {
  try {
    var parentFolder = getOrCreateFolder(FOLDER_NAME);
    // Strip prefix (JOB-, HM-, etc.) to match across different doc types (INV-, QTN-, RCT-)
    var searchIdSuffix = String(projectId).replace(/^[A-Z]+-/, "").toUpperCase(); 
    var documents = [];
    
    Logger.log("--- STARTING RECURSIVE DOC SEARCH ---");
    Logger.log("Original ID: " + projectId);
    Logger.log("Search Suffix: " + searchIdSuffix);
    Logger.log("Parent Folder: " + parentFolder.getName() + " (" + parentFolder.getId() + ")");

    // Robust Recursive Search
    function traverse(folder) {
      Logger.log("Scanning Folder: " + folder.getName());
      
      // 1. Check files in current folder
      var files = folder.getFiles();
      while (files.hasNext()) {
        var file = files.next();
        var fileName = file.getName();
        if (fileName.toUpperCase().includes(searchIdSuffix)) {
           Logger.log("  ✓ FOUND: " + fileName);
           documents.push({
             id: file.getId(),
             name: fileName,
             type: folder.getName(), // Use folder name as type (e.g. Invoice, Receipt)
             url: file.getUrl(),
             date: dateToStr(file.getDateCreated())
           });
        }
      }
      
      // 2. Travese subfolders
      var subfolders = folder.getFolders();
      while (subfolders.hasNext()) {
        traverse(subfolders.next());
      }
    }

    // Start traversal
    traverse(parentFolder);
    
    Logger.log("--- SEARCH COMPLETE: Found " + documents.length + " docs ---");
    
    // Sort by date descending
    documents.sort(function(a, b) {
      return new Date(b.date) - new Date(a.date);
    });
    
    return jsonResponse({ 
      result: "success", 
      documents: documents,
      diagnostics: {
        searchedFolder: parentFolder.getName(),
        searchedFolderId: parentFolder.getId(),
        foundCount: documents.length,
        searchSuffix: searchIdSuffix
      }
    });
  } catch (e) {
    return jsonResponse({ result: "error", error: e.toString() });
  }
}

function getFileData(fileId) {
  try {
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    var base64 = Utilities.base64Encode(blob.getBytes());
    
    return jsonResponse({
      result: "success",
      base64: base64,
      fileName: file.getName(),
      mimeType: blob.getContentType()
    });
  } catch (e) {
    return jsonResponse({ result: "error", error: e.toString() });
  }
}

/**
 * HELPER: Use this to manually set your Root Folder ID if you don't want to use the Apps Script UI.
 * Run this once from the Apps Script editor.
 */
function setupRootFolder() {
  var rootId = "18TfoisB8sFva5-hfK"; // This is the ID of your 'Handyman Docs' folder
  PropertiesService.getScriptProperties().setProperty('ROOT_FOLDER_ID', rootId);
  Logger.log("ROOT_FOLDER_ID set to: " + rootId);
}

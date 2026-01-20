/* =========================================
   ZEPHYR PRO API (vFinal - Roles, perms, RTO, Hashed Passwords, Form Support)
   ========================================= */

const TASK_SHEET_ID = "1_8VSzZdn8rKrzvXpzIfY_oz3XT9gi30jgzdxzQP4Bac";
const ADVANCE_SHEET_NAME = "Advance_Records";

function doGet(e) {
  // Serves the HTML page
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Zephyr Express Portal')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  let hasLock = false;

  try {
    let body = {};
    // Handle JSON payloads vs Form Data
    if (e.postData && e.postData.contents) {
        try {
            const content = e.postData.contents;
            if (content.trim().startsWith('{')) {
                 body = JSON.parse(content);
            } else {
                 body = e.parameter;
            }
        } catch (err) {
            body = e.parameter;
        }
    } else {
        body = e.parameter;
    }

    if (!body) body = {};

    // ⚡ Bolt Fix: Robust Action Parsing & Normalization
    let act = body.action;
    if (!act && e.parameter && e.parameter.action) act = e.parameter.action; // Fallback
    act = String(act || "").trim();

    // ⚡ Bolt Optimization: Only lock for Write operations to prevent 'System Busy' on concurrent reads
    const READ_ACTIONS = ['login', 'getAllData', 'getAdminRequests', 'getUsers', 'getRecent', 'getShipmentDetails', 'getBillingData'];
    if (!READ_ACTIONS.includes(act)) {
        // Only try to lock if it's NOT a read action.
        // If action is unknown or empty, we lock to be safe (prevent concurrent writes).
        if (!lock.tryLock(10000)) return jsonResponse("error", "System Busy");
        hasLock = true;
    }

    // --- 1. AUTH ---
    if (act === "login") return handleLogin(body.username, body.password);

    // --- 2. DATA RETRIEVAL ---
    if (act === 'getAllData') return getAllData(body.user);
    if (act === 'getAdminRequests') return getAdminRequests();
    if (act === 'getUsers') return getUsersJson(body.user);
    if (act === 'getRecent') return getRecentShipments();
    if (act === 'getShipmentDetails') return getShipmentDetails(body.awb);

    // --- 3. WRITE ACTIONS ---
    if (act === "submit") {
        if (typeof body.boxes === 'string') {
             try { body.boxes = JSON.parse(body.boxes); } catch(e){}
        }
        return handleSubmit(body);
    }
    if (act === "assignTask") return handleAssignTask(body);
    if (act === "markPaperworkDone") return handlePaperDone(body);
    if (act === "directTransfer") return handleDirectTransfer(body);

    if (act === "updateManifestBatch") {
         if (typeof body.ids === 'string') try { body.ids = JSON.parse(body.ids); } catch(e){}
         return handleManifestBatch(body);
    }

    if (act === "requestTransfer") return handleTransferRequest(body);
    if (act === "approveTransfer") return handleApproveTransfer(body);

    if (act === "manageData") {
        CacheService.getScriptCache().remove('static_data');
        return handleDropdowns(body);
    }

    if (act === "addUser") return handleAddUser(body);
    if (act === "deleteUser") return handleDeleteUser(body.username);
    if (act === "changePassword") return handleChangePassword(body);

    if (act === "manageHold") return handleManageHold(body);
    if (act === "manageUserRole") return handleManageUserRole(body);
    if (act === "updateUserPerms") return handleUpdateUserPerms(body);

    if (act === "generateAwb") return handleGenerateAwb();
    if (act === "updateShipmentDetails") return handleUpdateShipmentDetails(body);
    if (act === 'setConfig') return handleSetConfig(body);

    // ⚡ Bolt New Features
    if (act === "bulkAssign") return handleBulkAssign(body);
    if (act === "editShipment") return handleEditShipment(body);
    if (act === "getBillingData") return getBillingData(body.from, body.to, body.net, body.client);
    if (act === "moveAdvance") return handleMoveAdvance(body);
    if (act === "handleBulkDataUpload") return handleBulkDataUpload(body);
    if (act === "handleConnectedScan") return handleConnectedScan(body);
    if (act === "handleAutomationScan") return handleAutomationScan(body);

    if (act === "bulkPaperDone") return handleBulkPaperDone(body);

    return jsonResponse("error", "Unknown Action: " + act);

  } catch (err) {
      return jsonResponse("error", err.toString());
  } finally {
      if (hasLock) lock.releaseLock();
  }
}

// --- UTILS ---
function hashString(str) {
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str);
  let txtHash = '';
  for (let i = 0; i < rawHash.length; i++) {
    let hashVal = rawHash[i];
    if (hashVal < 0) hashVal += 256;
    if (hashVal.toString(16).length == 1) txtHash += '0';
    txtHash += hashVal.toString(16);
  }
  return txtHash;
}

// ⚡ Bolt Optimization: Cache Users Map to reduce read operations
function getUserMap() {
    try {
        const cache = CacheService.getScriptCache();
        const cached = cache.get('users_map');
        if (cached) return JSON.parse(cached);

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const uSheet = ss.getSheetByName("Users");
        if (!uSheet || uSheet.getLastRow() < 2) return {};

        const data = uSheet.getDataRange().getValues();
        const map = {};
        // Skip header
        for (let i = 1; i < data.length; i++) {
            const u = String(data[i][0]).trim().toLowerCase();
            if (u) {
                map[u] = {
                    username: data[i][0], // Keep original case
                    name: data[i][2],
                    role: data[i][3],
                    perms: data[i][4] || ""
                };
            }
        }
        try { cache.put('users_map', JSON.stringify(map), 21600); } catch(e){} // Cache for 6 hours
        return map;
    } catch(e) { console.error("getUserMap Error", e); return {}; }
}

function clearUserCache() {
    try { CacheService.getScriptCache().remove('users_map'); } catch(e){}
}

// --- MAIN DATA FETCH ---
function getAllData(username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let taskSS = null;
  const getTaskSS = () => {
      if(!taskSS) {
          try { taskSS = SpreadsheetApp.openById(TASK_SHEET_ID); }
          catch(e){ console.error("FMS Access Error", e); taskSS = null; }
      }
      return taskSS;
  };

  const sh = ss.getSheetByName("Shipments");
  if (!sh) return jsonResponse("error", "Shipments Sheet Missing");

  // ⚡ Bolt: Ensure Sheet Columns (need 35 for Hold Date - Index 34, Category is 33)
  if (sh.getMaxColumns() < 35) sh.insertColumnsAfter(sh.getMaxColumns(), 35 - sh.getMaxColumns());

  // ⚡ Bolt: Get Advance Sheet (Create if missing)
  let advSh = ss.getSheetByName(ADVANCE_SHEET_NAME);
  if (!advSh) {
      advSh = ss.insertSheet(ADVANCE_SHEET_NAME);
  }

  // ⚡ Bolt: Ensure Advance Sheet Columns (need 35)
  if (advSh.getMaxColumns() < 35) advSh.insertColumnsAfter(advSh.getMaxColumns(), 35 - advSh.getMaxColumns());

  // Copy header if empty
  if (advSh.getLastRow() < 1 || advSh.getRange(1,1).getValue() === "") {
      try {
          const h = sh.getRange(1,1,1,33).getValues();
          advSh.getRange(1,1,1,33).setValues(h);
      } catch(e) {}
  }

  const targetUser = String(username).trim().toLowerCase();

  const cache = CacheService.getScriptCache();
  let staticDataStr = cache.get('static_data');
  let staticData = null;

  // Fetch Config
  const props = PropertiesService.getScriptProperties();
  const autoAwbEnabled = props.getProperty('AUTO_AWB') !== 'false'; // Default true

  if (!staticDataStr) {
    try {
      const ddSheet = ss.getSheetByName("Sheet2");
      const lastR = ddSheet ? ddSheet.getLastRow() : 1;
      const rawDD = lastR > 1 ? ddSheet.getRange(2, 1, lastR-1, 6).getValues() : [];
      const dd = {
        networks: rawDD.map(r=>r[0]).filter(String),
        clients: rawDD.map(r=>r[1]).filter(String),
        destinations: rawDD.map(r=>r[2]).filter(String),
        extraCharges: rawDD.map(r=>r[3]).filter(String),
        holdReasons: rawDD.map(r=>({code:r[4], desc:r[5]})).filter(x=>x.code)
      };
      let staff = [];
      try {
        const remoteSS = getTaskSS();
        const stSh = remoteSS ? remoteSS.getSheetByName("Subordinate Staff") : null;
        if(stSh) staff = stSh.getRange(2,1,50).getValues().flat().filter(String);
      } catch(e) { console.error(e); }

      staticData = { staff: staff, dropdowns: dd };
      if (dd.networks.length > 0) {
        cache.put('static_data', JSON.stringify(staticData), 1800);
      }
    } catch(e) { staticData = { staff: [], dropdowns: {} }; }
  } else { staticData = JSON.parse(staticDataStr); }

  staticData.config = { autoAwb: autoAwbEnabled };

  let role = "Staff";
  let perms = [];
  let targetName = "";

  // 1. Try Optimized Map Lookup
  const userMap = getUserMap();
  if (userMap[targetUser]) {
      role = userMap[targetUser].role;
      targetName = String(userMap[targetUser].name || "").trim().toLowerCase();
      const pStr = userMap[targetUser].perms;
      perms = pStr.split(',').map(s=>s.trim()).filter(Boolean);
  }

  // 2. Fallback: Linear Search (If Map fails or user not found in map)
  // This ensures "Manoj Kumar" is found even if map logic fails.
  if (!role || (role === 'Staff' && perms.length === 0 && !userMap[targetUser])) {
      try {
         const uSheet = ss.getSheetByName("Users");
         const uData = uSheet.getDataRange().getValues();
         for(let i=1; i<uData.length; i++) {
             if(String(uData[i][0]).trim().toLowerCase() === targetUser) {
                 role = uData[i][3];
                 perms = (uData[i][4]||"").split(',').map(s=>s.trim()).filter(Boolean);
                 break;
             }
         }
      } catch(e) { console.error("Fallback User Lookup Error", e); }
  }

  // 3. Legacy Admin Fallback
  if ((!role || role === 'Staff') && (targetUser.includes("admin") || targetUser.includes("owner"))) {
      role = "Admin";
  }

  const lastRow = sh.getLastRow();
  // ⚡ Bolt Optimization: Use getValues() for speed. Single read.
  const range = lastRow > 1 ? sh.getRange(2, 1, lastRow-1, 35) : null;
  const data = range ? range.getValues() : [];

  // ⚡ Bolt: Read Advance Data
  const advLast = advSh.getLastRow();
  // ⚡ Bolt: Read 35 columns from Advance sheet too
  // ⚡ Bolt Optimization: Use getValues() for speed
  const advData = advLast>1 ? advSh.getRange(2, 1, advLast-1, 35).getValues() : [];

  // ⚡ Bolt Optimization: FMS updates aggregation
  let fmsUpdates = [];

  // ⚡ Bolt Optimization: Debounce Booking Report Sync
  // Only sync if cache key expired (every 5 mins) to prevent massive slow-down on every read
  const SYNC_CACHE_KEY = 'last_br_sync_time';
  const lastSync = cache.get(SYNC_CACHE_KEY);
  const shouldSync = !lastSync;

  if (shouldSync) {
      try {
          const brSheet = ss.getSheetByName("Booking_Report") || (taskSS ? taskSS.getSheetByName("Booking_Report") : null);
          if(brSheet) {
              const brData = brSheet.getDataRange().getValues();
              // Create map of AWB -> First Row (Latest)
              const brMap = {};
              // Assuming Header Row 1
              for(let i=1; i<brData.length; i++) {
                  const r = brData[i];
                  const awbKey = String(r[0]).replace(/'/g,"").trim().toLowerCase();
                  if(awbKey && !brMap[awbKey]) {
                      brMap[awbKey] = {
                          dest: r[3], // D
                          clientCode: r[4], // E
                          clientName: r[5], // F
                          net: r[19], // T
                          netNo: r[20], // U
                          type: r[22], // W
                          boxes: r[23], // X
                          act: r[24], // Y
                          vol: r[25], // Z
                          chg: r[26], // AA
                          user: r[40], // AO
                      autoDoer: r[40] // ⚡ Bolt Fix: Use Col AO (40) for AutoDoer as per request
                      };
                  }
              }

              let hasChange = false;

              for(let i=0; i<data.length; i++) {
                  const r = data[i]; // Row data
                  const awb = String(r[0]).replace(/'/g,"").trim().toLowerCase();

                  // ⚡ Bolt Optimization: Skip sync for old completed/manifested items to save time
                  // If status is Completed and manifest date is not empty, skip unless very recent
                  const pStat = r[16]; // PaperStatus (Col Q/17)
                  if(pStat === 'Completed' && r[24] && r[25]) { // Has Batch & Manifest Date
                      continue;
                  }

                  if(brMap[awb]) {
                      const br = brMap[awb];
                      // Helper to check diff
                      const ch = (idx, val) => {
                          if(String(r[idx]) !== String(val)) {
                              r[idx] = val;
                              hasChange = true;
                          }
                      };

                      // Update Columns (Index = Col - 1)
                      ch(5, br.dest); // Col F (Dest) index 5
                      ch(4, `${br.clientName}-${br.clientCode}`.slice(-4) === br.clientCode ? `${br.clientName}-${br.clientCode}` : br.clientName);

                      ch(3, br.net); // Col D (Network) index 3

                      const categoryVal = r[33] || r[32] || "Normal";
                      if (categoryVal !== 'Direct_Skip' && categoryVal !== 'Direct_Paperwork' && categoryVal !== 'Connected' && categoryVal !== 'Automation') {
                          ch(20, br.netNo); // Col U (NetNo) index 20
                      }

                      ch(2, br.type); // Col C (Type) index 2
                      ch(6, br.boxes); // Col G (Boxes) index 6
                      ch(10, br.act); // Col K (Act) index 10
                      ch(11, br.vol); // Col L (Vol) index 11
                      ch(12, br.chg); // Col M (Chg) index 12

                      // For Auto Doer (Col P / 15) and Status (Col O / 14)
                      if(r[14] !== 'Done' && r[14] !== 'Completed') ch(14, 'Done');

                      if(br.autoDoer) {
                          ch(15, br.autoDoer);
                          fmsUpdates.push({ awb: awb, autoDoer: br.autoDoer });
                      }
                  }
              }

              if(hasChange && range) {
                  range.setValues(data);
              }
              // Set Cache (5 mins)
              try { cache.put(SYNC_CACHE_KEY, 'true', 300); } catch(e){}
          }
      } catch(e) { console.error("Sync BR Error", e); }
  }

  // ⚡ Bolt Optimization: Batch write FMS updates
  if(fmsUpdates.length > 0) {
      try {
          const remoteSS = getTaskSS();
          const fms = remoteSS ? remoteSS.getSheetByName("FMS") : null;
          if(fms && fms.getLastRow() >= 7) {
              const numRows = fms.getLastRow() - 6;
              // ⚡ Bolt Fix: Shift +2 (N=14 -> P=16)
              const range = fms.getRange(7, 16, numRows, 1);
              const doerData = range.getValues();

              // ⚡ Bolt: Also sync Auto Status to Col N (14)
              const statusRange = fms.getRange(7, 14, numRows, 1);
              const statusData = statusRange.getValues();

              const ids = fms.getRange(7, 2, numRows, 1).getValues().flat().map(x=>String(x).replace(/'/g,"").trim().toLowerCase());

              let changed = false;
              let statusChanged = false;

              fmsUpdates.forEach(u => {
                  const idx = ids.indexOf(u.awb);
                  if(idx > -1) {
                      if(doerData[idx][0] !== u.autoDoer) {
                          doerData[idx][0] = u.autoDoer;
                          changed = true;
                      }
                      // Only write 'Done' if not already done/completed
                      const currentStatus = String(statusData[idx][0]).toLowerCase();
                      if(currentStatus !== 'done' && currentStatus !== 'completed') {
                          statusData[idx][0] = "Done";
                          statusChanged = true;
                      }
                  }
              });

              if(changed) range.setValues(doerData);
              if(statusChanged) statusRange.setValues(statusData);
          }
      } catch(e) { console.error("FMS Sync Error", e); }
  }

  let pendingAuto = [];
  let pendingPaper = [];
  let toAssign = [];
  let myToDo = [];
  let completedManifest = [];
  let holdings = [];
  let allAwbs = []; // ⚡ Bolt: Lightweight list for instant duplicate checks

  // ⚡ Bolt: New Categories
  let advance = [];
  let directPaper = [];
  let directSkip = [];

  let inboundTodayCount = 0;
  const getNormDate = (d) => new Date(d).setHours(0,0,0,0);
  const todayTime = getNormDate(new Date());
  const todayStr = new Date().toLocaleDateString();

  // ⚡ Bolt Helper: Format raw numbers to fixed decimals (simulate getDisplayValues)
  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? v : n.toFixed(2); };

  // ⚡ Bolt Optimization: Filter data processing
  // Only process rows that are ACTIVE or RECENT.
  // Criteria:
  // 1. On Hold
  // 2. Pending Automation or Paperwork
  // 3. Completed TODAY (for Daily Manifest)
  // 4. Assigned to user (ToDo)
  // 5. Automated by user (ToAssign)
  // Skip old completed shipments to reduce payload size.

  data.forEach(r => {
    const rId = String(r[0]).replace(/'/g, "").trim();
    if(rId) allAwbs.push(rId);

    const category = "Normal";
    const dateVal = getNormDate(r[1]);
    if(dateVal === todayTime) inboundTodayCount++;

    const holdStatus = r[27];
    const paperStatus = r[16];
    const autoStatus = r[14];
    const batchNo = r[24];
    const manifestDate = r[25] instanceof Date ? r[25].toLocaleDateString() : String(r[25]);

    // Check if Active
    const isHold = holdStatus === "On Hold";
    const isRTO = holdStatus === "RTO";
    const isPending = (autoStatus === "Pending" || autoStatus === "") || (paperStatus !== "Completed");

    // ⚡ Bolt Fix: Include items that are Completed but NOT yet in a batch (Pending Manifest)
    // Also include items manifested TODAY.
    const isPendingManifest = (paperStatus === "Completed" && !batchNo);
    const isTodayManifest = (paperStatus === "Completed" && (manifestDate === todayStr || dateVal === todayTime));

    if (isRTO) return; // Skip RTO completely from active lists

    if (isHold || isPending || isPendingManifest || isTodayManifest) {
        const item = {
          id: r[0], date: r[1], net: r[3], client: r[4], dest: r[5],
          details: `${r[6]} Boxes | ${num(r[12])} Kg`,
          user: r[8], autoDoer: r[15], assignee: r[17], assigner: r[18],
          actWgt: num(r[10]), volWgt: num(r[11]), chgWgt: num(r[12]), type: r[2], boxes: r[6], extra: r[7], rem: r[13],
          netNo: r[20], payTotal: num(r[21]), payPaid: num(r[22]), payPending: num(r[23]),
          batchNo: batchNo, manifestDate: manifestDate, paperwork: r[26],
          holdStatus: holdStatus, holdReason: r[28], holdRem: r[29], heldBy: r[30],
          category: category, holdDate: r[34],
          paperStatus: r[16] // ⚡ Bolt Fix: Explicitly store paperStatus for filtering
        };

        if (isHold) {
            holdings.push(item);
        } else {
            // ⚡ Bolt Fix: Trim inputs to prevent "invisible" tasks due to whitespace
            const assignee = String(r[17]).trim().toLowerCase();
            const autoBy = String(r[15]).trim().toLowerCase();
            // const entryUser = String(r[8]).trim().toLowerCase(); // Not used for status logic anymore

            if (paperStatus === "Completed") {
                completedManifest.push(item);
            }
            // ⚡ Bolt Fix: Prioritize Auto Doer (Col P) presence.
            // If Auto Doer is present (Col P), treat as Done even if Status is Pending.
            // Reverted fallback to Entry User to ensure Pending Automation list is populated correctly.
            else if ((autoStatus === "Pending" || autoStatus === "") && !autoBy) {
                pendingAuto.push(item);
            }
            else {
                pendingPaper.push(item);
                // ⚡ Bolt Logic: Staff see ONLY tasks they automated. Admin see all (handled in adminPool).
                // Broadened check to include Name to prevent missing tasks.
                const isMyAuto = (autoBy === targetUser) || (targetName && autoBy === targetName);

                // ⚡ Bolt Fix: Staff see only tasks they Automated (Col P/I). Unassigned check uses PaperStatus (Col Q).
                // If PaperStatus is empty or Pending (not Assigned), show in pool.
                // Robust check: trim and lowercase. Also check if assignee is empty (fallback for inconsistent data).
                const paperStatusNorm = String(paperStatus || "").trim().toLowerCase();
                const isUnassigned = (paperStatusNorm !== "assigned") || (assignee === "");

                if (isMyAuto && isUnassigned) toAssign.push(item);
                if (assignee === targetUser) myToDo.push({...item, subtitle: `Assigned by ${r[18]}`});
            }
        }
    }
  });

  // Process Advance/Direct Data (Advance_Records Sheet)
  advData.forEach(r => {
      const rId = String(r[0]).replace(/'/g, "").trim();
      if(rId) allAwbs.push(rId); // Add to global duplicate check list

      // ⚡ Bolt Fix: Category is at Index 33 (Col 34/AH), fallback 32
      const category = (r[33] || r[32]) ? String(r[33] || r[32]).trim() : "Advance";

      // ⚡ Bolt: Format raw values (since we switched to getValues)
      const manifestDate = r[25] instanceof Date ? r[25].toLocaleDateString() : String(r[25] || "");

      const item = {
        id: r[0], date: r[1], net: r[3], client: r[4], dest: r[5],
        details: `${r[6]} Boxes | ${num(r[12])} Kg`,
        user: r[8],
        actWgt: num(r[10]), volWgt: num(r[11]), chgWgt: num(r[12]), type: r[2], boxes: r[6], extra: r[7], rem: r[13],
        netNo: r[20], payTotal: num(r[21]), payPaid: num(r[22]), payPending: num(r[23]),
        batchNo: r[24], manifestDate: manifestDate, paperwork: r[26],
        holdStatus: r[27], category: category
      };

      if (category === "Advance") advance.push(item);
      else if (category === "Direct_Paperwork") directPaper.push(item);
      else if (category === "Direct_Skip") directSkip.push(item);
  });

  let reqList = [];
  try {
      const rs = ss.getSheetByName("Requests");
      if(rs) {
          const reqs = rs.getLastRow()>1 ? rs.getRange(2, 1, rs.getLastRow()-1, 7).getValues().filter(r => r[5]==="Pending") : [];
          reqList = reqs.map(r => ({ reqId:r[0], taskId:r[1], type:r[2], by:r[3], to:r[4], date:r[6] }));
      }
  } catch(e) { console.error("Requests Sheet Error", e); }

  return jsonResponse("success", "OK", {
    role: role,
    perms: perms,
    static: staticData,
    stats: { inbound: inboundTodayCount, auto: pendingAuto.length, paper: pendingPaper.length, requests: reqList.length, holdings: holdings.length },
    overview: { auto: pendingAuto, paper: pendingPaper, directPaper: directPaper },
    workflow: { toAssign: toAssign, toDo: myToDo },
    manifest: completedManifest,
    holdings: holdings,
    allAwbs: allAwbs,
    advance: advance,
    // ⚡ Bolt Fix: Admin Pool now shows ONLY UNASSIGNED pending paperwork.
    // Logic matches toAssign: Status != assigned OR Assignee is empty.
    adminPool: pendingPaper.filter(x => String(x.paperStatus||"").trim().toLowerCase() !== "assigned" || !x.assignee)
  });
}

function handleMoveAdvance(b) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const advSh = ss.getSheetByName(ADVANCE_SHEET_NAME);
    if(!advSh) return jsonResponse("error", "Advance Sheet Missing");

    const row = findRow(advSh, b.awb);
    if(row === -1) return jsonResponse("error", "AWB Not Found in Advance Records");

    // Get Data
    // ⚡ Bolt Fix: Read 35 columns
    const data = advSh.getRange(row, 1, 1, 35).getValues()[0];

    // Modify for Transfer
    data[1] = new Date(); // Update Date to Today (Received)
    data[33] = "Normal";  // Update Category to Normal (Index 33)

    // Append to Shipments
    const sh = ss.getSheetByName("Shipments");
    sh.appendRow(data);

    // Delete from Advance
    advSh.deleteRow(row);

    return jsonResponse("success", "Moved to Inbound");
}

function getRecentShipments() {
    const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Shipments");
    const lastRow = ss.getLastRow();
    const data = lastRow > 1 ? ss.getRange(Math.max(2, lastRow - 99), 1, Math.min(100, lastRow-1), 30).getDisplayValues() : [];
    // Map to object
    const list = data.reverse().map(r => ({
      id: r[0], date: r[1], net: r[3], client: r[4], dest: r[5],
      wgt: r[12], boxes: r[6], type: r[2], netNo: r[20], status: r[27] || r[16] || r[14] || "Pending"
    }));
    return jsonResponse("success", "OK", { shipments: list });
}

function getShipmentDetails(id) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName("Shipments");
    const idx = findRow(sh, id);
    if(idx === -1) return jsonResponse("error", "Not Found");
    const r = sh.getRange(idx, 1, 1, 30).getDisplayValues()[0];
    const ship = {
      id: r[0], date: r[1], type: r[2], net: r[3], client: r[4], dest: r[5],
      boxes: r[6], extra: r[7], user: r[8],
      actWgt: r[10], volWgt: r[11], chgWgt: r[12], rem: r[13],
      netNo: r[20], payTotal: r[21], payPaid: r[22], payPending: r[23]
    };

    // Get Boxes
    let boxList = [];
    try {
        const bx = ss.getSheetByName("BoxDetails");
        if(bx && bx.getLastRow() > 1) {
            const allBx = bx.getRange(2, 1, bx.getLastRow()-1, 8).getDisplayValues();
            const target = String(id).replace(/'/g,"").trim().toLowerCase();
            boxList = allBx.filter(b => String(b[0]).replace(/'/g,"").trim().toLowerCase() === target).map(b => ({
                no: b[1], wgt: b[2], l: b[3], b: b[4], h: b[5], vol: b[6], chg: b[7]
            }));
        }
    } catch(e) { console.error(e); }

    return jsonResponse("success", "OK", { shipment: ship, boxes: boxList });
}

function handleGenerateAwb() {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty('AUTO_AWB') === 'false') return jsonResponse("error", "Auto Generation Disabled");

    const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Shipments");
    const lastRow = ss.getLastRow();
    const data = lastRow > 1 ? ss.getRange(2, 1, lastRow-1, 1).getValues().flat() : [];

    let currentMax = 0;
    data.forEach(x => {
        const s = String(x).replace(/'/g,"").trim();
        const match = s.match(/^(3001\d{5})/);
        if (match) {
            const n = parseInt(match[1], 10);
            if (n > currentMax) currentMax = n;
        }
    });

    const nextAwb = currentMax > 0 ? currentMax + 1 : 300100000;
    return jsonResponse("success", "Generated", { awb: String(nextAwb) });
}

function handleUpdateShipmentDetails(b) {
    const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Shipments");
    const row = findRow(ss, b.awb);
    if(row === -1) return jsonResponse("error", "AWB Not Found");
    if(b.network) ss.getRange(row, 4).setValue(b.network);
    if(b.destination) ss.getRange(row, 6).setValue(b.destination);
    return jsonResponse("success", "Details Updated");
}

function handleManageHold(b) {
    const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Shipments");
    const row = findRow(ss, b.awb);
    if(row === -1) return jsonResponse("error", "AWB Not Found");

    if(b.subAction === "set") {
        // Write Status(28), Reason(29), Remarks(30), HeldBy(31), Empty, Empty, Category(34), HoldDate(35)
        // ⚡ Bolt: Write timestamp to Col 35 (AI) - leaving Category (Col 34) intact
        ss.getRange(row, 28, 1, 4).setValues([["On Hold", b.reason, b.remarks, b.user || ""]]);
        ss.getRange(row, 35).setValue(new Date());
    } else if(b.subAction === "clear") {
        const net = String(ss.getRange(row, 4).getValue()).toUpperCase();
        const dest = String(ss.getRange(row, 6).getValue()).toUpperCase();

        // ⚡ Bolt Fix: Broaden check for "Not Known" logic
        if(net.startsWith("NA") || dest.startsWith("NA") || net.includes("NOT KNOWN") || dest.includes("NOT KNOWN")) {
            return jsonResponse("error", "Update Network/Dest before clearing hold");
        }

        if(!b.remarks || !b.remarks.trim()) return jsonResponse("error", "Remarks are mandatory");
        ss.getRange(row, 28, 1, 4).setValues([["", "", "", ""]]);
        ss.getRange(row, 35).setValue(""); // Clear Hold Date
        const oldLog = ss.getRange(row, 20).getValue();
        ss.getRange(row, 20).setValue(`${oldLog} [${new Date().toLocaleDateString()} Hold Cleared: ${b.remarks}]`);
    } else if(b.subAction === "rto") {
        if(!b.remarks || !b.remarks.trim()) return jsonResponse("error", "Remarks are mandatory");
        ss.getRange(row, 28, 1, 3).setValues([["RTO", "RTO", b.remarks]]);
        const oldLog = ss.getRange(row, 20).getValue();
        ss.getRange(row, 20).setValue(`${oldLog} [${new Date().toLocaleDateString()} Marked RTO: ${b.remarks}]`);
    }
    return jsonResponse("success", "Updated");
}

function handleManageUserRole(b) {
    clearUserCache(); // Invalidate cache
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const uSheet = ss.getSheetByName("Users");
    const d = uSheet.getDataRange().getValues();
    let requesterRole = "Staff";
    for(let i=1; i<d.length; i++) if(d[i][0]===b.requester) requesterRole = d[i][3];

    if(requesterRole !== "Owner") return jsonResponse("error", "Unauthorized");

    for(let i=1; i<d.length; i++) {
        if(d[i][0] === b.targetUser) {
            uSheet.getRange(i+1, 4).setValue(b.newRole);
            return jsonResponse("success", "Role Updated");
        }
    }
    return jsonResponse("error", "User Not Found");
}

function handleUpdateUserPerms(b) {
    clearUserCache(); // Invalidate cache
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const uSheet = ss.getSheetByName("Users");
    const d = uSheet.getDataRange().getValues();
    let requesterRole = "Staff";
    for(let i=1; i<d.length; i++) if(d[i][0]===b.requester) requesterRole = d[i][3];

    if(requesterRole === "Staff") return jsonResponse("error", "Unauthorized");

    for(let i=1; i<d.length; i++) {
        if(d[i][0] === b.targetUser) {
            if(d[i][3] === "Owner" && requesterRole !== "Owner") return jsonResponse("error", "Cannot edit Owner");
            uSheet.getRange(i+1, 5).setValue(b.perms);
            return jsonResponse("success", "Permissions Updated");
        }
    }
    return jsonResponse("error", "User Not Found");
}

function handleManifestBatch(b) {
  const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Shipments");
  if(!b.ids || !b.batchNo) return jsonResponse("error", "Invalid Data");
  const allIds = ss.getRange(2, 1, ss.getLastRow()-1, 1).getValues().flat();
  const awbMap = {};
  allIds.forEach((id, i) => { awbMap[String(id).replace(/'/g,"").trim().toLowerCase()] = i + 2; });
  const fms = SpreadsheetApp.openById(TASK_SHEET_ID).getSheetByName("FMS");
  let fmsIds = [];
  if(fms && fms.getLastRow() >= 7) fmsIds = fms.getRange(7, 2, fms.getLastRow()-6, 1).getValues().flat().map(x => String(x).replace(/'/g,"").trim().toLowerCase());

  const localRangesCol25 = []; // Batch ID (Y)
  const localRangesCol26 = []; // Manifest Date (Z)
  const fmsRanges = [];

  // Helper to convert (row, col) to A1 Notation
  // ⚡ Bolt Fix: Update A1 notation for shifted columns
  const getA1 = (r, c) => {
      // Y(25)->AA(27), AD(30)->AF(32), AI(35)->AK(37), AN(40)->AP(42), AS(45)->AU(47)
      // Also local sheet (Y=25, Z=26)
      if(c === 25) return `Y${r}`;
      if(c === 26) return `Z${r}`;

      const colMap = {
          27: 'AA', 32: 'AF', 37: 'AK', 42: 'AP', 47: 'AU'
      };
      return `${colMap[c] || '?'}${r}`;
  };

  b.ids.forEach(id => {
      const key = String(id).replace(/'/g,"").trim().toLowerCase();
      // Local Sheet Updates
      if(awbMap[key]) {
          const r = awbMap[key];
          localRangesCol25.push(`Y${r}`);
          localRangesCol26.push(`Z${r}`);
      }
      // FMS Updates
      if(fms) {
          const idx = fmsIds.indexOf(key);
          if(idx > -1) {
              const r = idx + 7;
              const net = b.network.toLowerCase();
              let col = 0;
              if(net.includes("dhl")) col = 25; // Y
              else if(net.includes("aramex")) col = 30; // AD
              else if(net.includes("fedex")) col = 35; // AI
              else if(net.includes("ups")) col = 40; // AN
              else if(net.includes("self")) col = 45; // AS

              if(col > 0) fmsRanges.push(getA1(r, col));
          }
      }
  });

  // ⚡ Bolt Optimization: Batch updates using RangeList to reduce API calls
  if(localRangesCol25.length) ss.getRangeList(localRangesCol25).setValue(b.batchNo);
  if(localRangesCol26.length) ss.getRangeList(localRangesCol26).setValue(b.date);
  if(fmsRanges.length && fms) fms.getRangeList(fmsRanges).setValue(b.user);

  return jsonResponse("success", "Batch Updated");
}

function handleSubmit(body){
  if(!body.awb) return jsonResponse("error","Missing Fields");
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const sh=ss.getSheetByName("Shipments");
  const bx=ss.getSheetByName("BoxDetails");

  // ⚡ Bolt: Check BOTH sheets for duplicates
  const lastRow = sh.getLastRow();
  const shipIds = lastRow > 1 ? sh.getRange(2, 1, lastRow - 1, 1).getValues().flat() : [];

  let advIds = [];
  const advSh = ss.getSheetByName(ADVANCE_SHEET_NAME);
  if(advSh && advSh.getLastRow() > 1) {
      advIds = advSh.getRange(2, 1, advSh.getLastRow() - 1, 1).getValues().flat();
  }

  const targetAwb = String(body.awb).trim().toLowerCase();
  const existsShip = shipIds.some(x => String(x).replace(/'/g, "").trim().toLowerCase() === targetAwb);
  const existsAdv = advIds.some(x => String(x).replace(/'/g, "").trim().toLowerCase() === targetAwb);

  if(existsShip || existsAdv) return jsonResponse("error","AWB Exists");

  let tA=0,tV=0,tC=0,br=[];
  if(body.boxes) br=body.boxes.map(b=>{
    const w=parseFloat(b.weight)||0,l=parseFloat(b.length)||0,br=parseFloat(b.breath)||0,h=parseFloat(b.height)||0;
    const v=(l*br*h)/5000;
    const c=Math.max(w,v);
    tA+=w;tV+=v;tC+=c;
    return["'"+body.awb,b.no,w,l,br,h,v.toFixed(2),c.toFixed(2)];
  });

  let holdStatus = "Pending";
  let holdReason = "";
  const net = String(body.network).toUpperCase();
  const dest = String(body.destination).toUpperCase();
  // ⚡ Bolt Fix: Broaden check for "Not Known" logic
  if(net.startsWith("NA") || dest.startsWith("NA") || net.includes("NOT KNOWN") || dest.includes("NOT KNOWN")) {
      holdStatus = "On Hold";
      holdReason = "Invalid Data";
  }

  // ⚡ Bolt: Handle Categories (Col 32/AF)
  const category = body.category || "Normal";

  // ⚡ Bolt Fix: Automation Mode Status
  // If mode is Automation, status should be Done, Doer is client name?
  // User said: "its automaton should be marked done in FMS by the Doer as 'client Name'." for Direct (Connected).
  // For Automation by Client: "Automation by Client... it will be recored as imbound".
  // Assuming "Automation by Client" also implies Automation is DONE.
  // We check if body.isAutomationMode is true.

  let autoStatus = "Pending";
  let autoDoer = "";

  // If explicitly flagged as Automation Mode OR Connected Mode (though Connected usually goes via scan handler)
  if(body.isAutomationMode === true || body.isAutomationMode === "true") {
      autoStatus = "Done";
      // Use Client Name as Doer, or explicit user if needed.
      // User said "Doer as 'client Name'" for Connected. Let's assume same for Automation by Client.
      autoDoer = body.client;
  }

  const rowData = [
      "'"+body.awb, body.date, body.type, body.network, body.client, body.destination,
      body.totalBoxes, body.extraCharges, body.username, new Date(),
      tA.toFixed(2), tV.toFixed(2), tC.toFixed(2), body.extraRemarks,
      autoStatus, autoDoer, "", "", "", "", body.netNo,
      body.payTotal, body.payPaid, body.payPending, "", "", body.paperwork,
      holdStatus, holdReason, "", (holdStatus==="On Hold" ? body.username : ""), body.payeeName, body.payeeContact,
      category, "" // Col 33 (AH) = Category, 34 (AI) = Hold Date (Empty initially)
  ];

  if(category === "Normal") {
      sh.appendRow(rowData);
  } else {
      // Write to Advance Sheet
      let targetSh = ss.getSheetByName(ADVANCE_SHEET_NAME);
      if(!targetSh) targetSh = ss.insertSheet(ADVANCE_SHEET_NAME);
      targetSh.appendRow(rowData);
  }

  if(br.length) bx.getRange(bx.getLastRow()+1,1,br.length,8).setValues(br);

  // ⚡ Bolt: Single Unified FMS Write
  // If autoStatus is "Done", we pass that. Else default (Pending, No Doer).
  addToFMS({
      awb: body.awb, date: body.date, type: body.type, net: body.network,
      client: body.client, dest: body.destination, boxes: body.totalBoxes,
      wgt: tC.toFixed(2), user: body.username,
      status: autoStatus, doer: autoDoer
  });

  return jsonResponse("success","Saved");
}

function addToFMS(d) {
    try {
        const remoteSS = SpreadsheetApp.openById(TASK_SHEET_ID);
        const fms = remoteSS.getSheetByName("FMS");
        if(fms) {
            // Status: Col 14 (N), Doer: Col 16 (P)
            // Default Status: "Pending" (or from d.status)
            // Default Doer: "" (or from d.doer)
            const stat = d.status || "Pending";
            const doer = d.doer || "";

            fms.appendRow([
                 "", "'"+d.awb, d.date, d.type, d.net, d.client, d.dest,
                 d.boxes, "", "", d.wgt, d.wgt, d.wgt,
                 stat, "", doer, "", "", "Pending", "", "", "" // Paperwork Status (S/19) default Pending
            ]);
        }
    } catch(e) { console.error("FMS Add Error", e); }
}

function findRow(sheet, id) {
  const lr = sheet.getLastRow();
  if (lr < 2) return -1;
  const ids = sheet.getRange(2, 1, lr-1, 1).getValues().flat();
  const target = String(id).replace(/'/g,"").trim().toLowerCase();
  const idx = ids.findIndex(x => String(x).replace(/'/g,"").trim().toLowerCase() === target);
  return idx > -1 ? idx + 2 : -1;
}

function syncFMS(id, data) {
    try {
        const fms = SpreadsheetApp.openById(TASK_SHEET_ID).getSheetByName("FMS");
        if(fms.getLastRow() < 7) return;
        const ids = fms.getRange(7, 2, fms.getLastRow()-6, 1).getValues().flat();
        const idx = ids.findIndex(x => String(x).replace(/'/g,"").trim().toLowerCase() === String(id).replace(/'/g,"").trim().toLowerCase());
        if(idx > -1) {
            const row = idx + 7;
            // ⚡ Bolt Fix: Shift +2 columns
            if(data.assignee) fms.getRange(row, 21).setValue(data.assignee); // U (was S/19)
            if(data.assigner) fms.getRange(row, 22).setValue(data.assigner); // V (was T/20)
            if(data.autoDoer) fms.getRange(row, 16).setValue(data.autoDoer); // P (was N/14)
            if(data.paperStatus) fms.getRange(row, 19).setValue(data.paperStatus); // S (was Q/17)
        }
    } catch(e){}
}

function handleAssignTask(b) {
  const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Shipments");
  const row = findRow(ss, b.id);
  if (row === -1) return jsonResponse("error", "AWB Not Found");
  ss.getRange(row, 17, 1, 3).setValues([["Assigned", b.staff, b.assigner]]);
  syncFMS(b.id, { assignee: b.staff, assigner: b.assigner });
  return jsonResponse("success", "Task Assigned");
}

// ⚡ Bolt: Bulk Assignment
function handleBulkAssign(b) {
    // ⚡ Bolt Fix: Parse stringified assignments
    if (typeof b.assignments === 'string') {
        try { b.assignments = JSON.parse(b.assignments); } catch(e){}
    }

    const assignments = b.assignments; // [{id, staff}, ...]
    if (!assignments || !Array.isArray(assignments) || !assignments.length) return jsonResponse("error", "No assignments");

    const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Shipments");
    const lr = ss.getLastRow();
    if (lr < 2) return jsonResponse("error", "No data");

    const ids = ss.getRange(2, 1, lr - 1, 1).getValues().flat();
    const idMap = {};
    ids.forEach((id, i) => { idMap[String(id).replace(/'/g, "").trim().toLowerCase()] = i + 2; });

    // ⚡ Bolt Fix: Explicitly EXCLUDE 'user' column (9) from updates
    // We can't use RangeList easily for different values, so we iterate
    // But we can optimize by reading existing data if needed, though here we just write.
    // For max speed in GAS, fewer calls is better. But random access writes are slow.
    // Since users usually assign 10-20 at a time, loop is acceptable IF we don't open SS every time.
    // We already have 'ss'.

    const fmsData = [];

    assignments.forEach(a => {
        const key = String(a.id).replace(/'/g, "").trim().toLowerCase();
        if (idMap[key]) {
            const r = idMap[key];
            // Write: Status (17), Assignee (18), Assigner (19) -> Cols Q, R, S
            ss.getRange(r, 17, 1, 3).setValues([["Assigned", a.staff, b.assigner]]);
            fmsData.push({ id: a.id, assignee: a.staff, assigner: b.assigner });
        }
    });

    // Sync FMS (Batched lookup)
    if (fmsData.length > 0) {
        try {
            const fms = SpreadsheetApp.openById(TASK_SHEET_ID).getSheetByName("FMS");
            if (fms && fms.getLastRow() >= 7) {
                const fmsIds = fms.getRange(7, 2, fms.getLastRow() - 6, 1).getValues().flat().map(x => String(x).replace(/'/g, "").trim().toLowerCase());
                fmsData.forEach(item => {
                    const idx = fmsIds.indexOf(String(item.id).trim().toLowerCase());
                    if (idx > -1) {
                        const r = idx + 7;
                        // ⚡ Bolt Fix: Shift +2
                        fms.getRange(r, 21).setValue(item.assignee); // U (was S/19)
                        fms.getRange(r, 22).setValue(item.assigner); // V (was T/20)
                    }
                });
            }
        } catch (e) { console.error("FMS Bulk Sync Error", e); }
    }

    return jsonResponse("success", "Bulk Assigned");
}

// ⚡ Bolt: Edit Shipment & Logging
function handleEditShipment(b) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName("Shipments");
    const row = findRow(sh, b.awb);
    if (row === -1) return jsonResponse("error", "AWB Not Found");

    const updates = b.updates;
    const newAwb = updates.awb ? String(updates.awb).trim() : null;
    let logMsg = `[${new Date().toLocaleString()} Edit by ${b.user}]: `;
    let hasChange = false;
    let awbChanged = false;

    // Handle AWB Rename
    if(newAwb && newAwb !== String(b.awb)) {
        // Check duplicate
        const existing = findRow(sh, newAwb);
        if(existing !== -1) return jsonResponse("error", "New AWB already exists");

        sh.getRange(row, 1).setValue("'" + newAwb); // Update ID

        // Update BoxDetails
        try {
            const bx = ss.getSheetByName("BoxDetails");
            if(bx) {
                const lr = bx.getLastRow();
                if(lr > 1) {
                    const bxData = bx.getRange(2, 1, lr-1, 1).getValues();
                    const oldKey = "'" + b.awb;
                    bxData.forEach((r, i) => {
                        if(String(r[0]) === oldKey) {
                            bx.getRange(i+2, 1).setValue("'" + newAwb);
                        }
                    });
                }
            }
        } catch(e){ console.error("Box update fail", e); }

        logMsg += `AWB: ${b.awb} -> ${newAwb}, `;
        hasChange = true;
        awbChanged = true;
    }

    // Handle other fields
    // Map fields to columns
    const colMap = {
        'date': 2, 'net': 4, 'client': 5, 'dest': 6, 'boxes': 7,
        'extra': 8, 'actWgt': 11, 'volWgt': 12, 'chgWgt': 13, 'remarks': 14
    };

    const changes = [];
    const currentRow = sh.getRange(row, 1, 1, 30).getValues()[0];

    for (const key in updates) {
        if(key === 'awb') continue;
        if (colMap[key]) {
            const col = colMap[key];
            let oldVal = currentRow[col - 1];

            // Safe Date Comparison
            if (key === 'date' && oldVal instanceof Date) {
                try { oldVal = oldVal.toISOString().split('T')[0]; } catch(e){}
            }

            const newVal = updates[key];

            if (String(oldVal) !== String(newVal)) {
                sh.getRange(row, col).setValue(newVal);
                changes.push(`${key}: ${oldVal} -> ${newVal}`);
                hasChange = true;
            }
        }
    }

    if (hasChange) {
        logMsg += changes.join(", ");
        const oldLog = sh.getRange(row, 20).getValue();
        sh.getRange(row, 20).setValue(oldLog + " | " + logMsg);
        return jsonResponse("success", "Updated & Logged");
    }

    return jsonResponse("success", "No Changes");
}

function getBillingData(from, to, netFilter, clientFilter) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let brSheet = ss.getSheetByName("Booking_Report");
        if (!brSheet) {
            const remoteSS = SpreadsheetApp.openById(TASK_SHEET_ID); // Or reuse getTaskSS logic if accessible
            brSheet = remoteSS ? remoteSS.getSheetByName("Booking_Report") : null;
        }
        if(!brSheet) return jsonResponse("error", "Booking Report not found");

        const data = brSheet.getDataRange().getValues();
        if(data.length < 2) return jsonResponse("success", "OK", { data: [] });

        const fromDate = new Date(from).getTime();
        const toDate = new Date(to).getTime();
        const headers = data[0];

        // Identify Indices for Filter
        // Col T (19) is Network, Col E (4) is Client Code, Col F (5) is Client Name

        // Latest Data Logic (Top-down first match)
        const unique = {};
        const result = [];

        // Assuming Row 1 is header
        for(let i=1; i<data.length; i++) {
            const r = data[i];
            const awb = String(r[0]).trim(); // AWB is Col A (0)
            if(!awb) continue;

            if(!unique[awb]) {
                // Check Filters
                if (netFilter && String(r[19]).toLowerCase() !== String(netFilter).toLowerCase()) continue;
                // Client check: Check both Code (Col 4) and Name (Col 5)
                if (clientFilter) {
                    const cf = String(clientFilter).toLowerCase();
                    if (!String(r[4]).toLowerCase().includes(cf) && !String(r[5]).toLowerCase().includes(cf)) continue;
                }

                // Check Date (Col B / 1) - M/D/YYYY Strict
                const dStr = String(r[1]).trim();
                let rowDate = 0;
                // Try Parsing M/D/YYYY
                const parts = dStr.split('/');
                if(parts.length === 3) {
                   // Month is 0-indexed in JS Date(y, m, d) but 1-based in string
                   // new Date(y, m-1, d)
                   // parts[0]=M, parts[1]=D, parts[2]=Y
                   const dt = new Date(parts[2], parts[0]-1, parts[1]);
                   rowDate = dt.getTime();
                } else {
                   // Fallback to standard parse if not slash separated
                   rowDate = new Date(dStr).getTime();
                }

                if(!isNaN(rowDate) && rowDate >= fromDate && rowDate <= toDate + 86400000) { // Include end date (full day buffer)
                    unique[awb] = true;
                    // Create object based on headers
                    const obj = {};
                    headers.forEach((h, idx) => obj[h] = r[idx]);
                    result.push(obj);
                }
            }
        }

        return jsonResponse("success", "OK", { data: result });

    } catch(e) { return jsonResponse("error", e.toString()); }
}

function handleDirectTransfer(b) {
  const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Shipments");
  const row = findRow(ss, b.taskId);
  if (row === -1) return jsonResponse("error", "Shipment Not Found");
  const holdStatus = ss.getRange(row, 28).getValue();
  if(holdStatus === "On Hold") return jsonResponse("error", "Shipment is On Hold");
  const oldLog = ss.getRange(row, 20).getValue();
  ss.getRange(row, 20).setValue(`${oldLog} [${new Date().toLocaleDateString()} Direct Transfer by ${b.by} to ${b.to}]`);
  // ⚡ Bolt Fix: Update Status (17), Assignee (18), Assigner (19) atomically
  ss.getRange(row, 17, 1, 3).setValues([["Assigned", b.to, b.by]]);
  syncFMS(b.taskId, { assignee: b.to, assigner: b.by });
  return jsonResponse("success", "Transferred");
}

function handlePaperDone(b) {
  const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Shipments");
  const row = findRow(ss, b.id);
  if (row === -1) return jsonResponse("error", "AWB Not Found");
  const holdStatus = ss.getRange(row, 28).getValue();
  if(holdStatus === "On Hold") return jsonResponse("error", "Shipment is On Hold");
  ss.getRange(row, 17).setValue("Completed");
  syncFMS(b.id, { paperStatus: "Completed" });
  return jsonResponse("success", "Completed");
}

// ⚡ Bolt: Bulk Paperwork Done
function handleBulkPaperDone(b) {
    if (typeof b.ids === 'string') {
        try { b.ids = JSON.parse(b.ids); } catch(e){}
    }
    const ids = b.ids;
    if (!ids || !Array.isArray(ids) || !ids.length) return jsonResponse("error", "No IDs provided");

    const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Shipments");
    const lr = ss.getLastRow();
    if (lr < 2) return jsonResponse("error", "No data");

    const allAwbs = ss.getRange(2, 1, lr - 1, 1).getValues().flat();
    const idMap = {};
    allAwbs.forEach((id, i) => { idMap[String(id).replace(/'/g, "").trim().toLowerCase()] = i + 2; });

    const rangesToUpdate = [];
    const fmsSyncIds = [];

    ids.forEach(id => {
        const key = String(id).replace(/'/g, "").trim().toLowerCase();
        if (idMap[key]) {
            const r = idMap[key];
            rangesToUpdate.push(`Q${r}`); // Col 17 is Q
            fmsSyncIds.push(id);
        }
    });

    if (rangesToUpdate.length > 0) {
        ss.getRangeList(rangesToUpdate).setValue("Completed");

        // FMS Sync
        try {
            const fms = SpreadsheetApp.openById(TASK_SHEET_ID).getSheetByName("FMS");
            if (fms && fms.getLastRow() >= 7) {
                const fmsIds = fms.getRange(7, 2, fms.getLastRow() - 6, 1).getValues().flat().map(x => String(x).replace(/'/g, "").trim().toLowerCase());
                const fmsRanges = [];
                fmsSyncIds.forEach(id => {
                    const idx = fmsIds.indexOf(String(id).trim().toLowerCase());
                    if (idx > -1) {
                        fmsRanges.push(`S${idx + 7}`); // Paperwork Status is Col S (19)
                    }
                });
                if(fmsRanges.length > 0) fms.getRangeList(fmsRanges).setValue("Completed");
            }
        } catch (e) { console.error("FMS Bulk Sync Error", e); }
    }

    return jsonResponse("success", "Bulk Update Complete");
}

function handleApproveTransfer(b) {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const req=ss.getSheetByName("Requests");
  const sh=ss.getSheetByName("Shipments");
  const row = findRow(sh, b.taskId);
  if(row === -1) return jsonResponse("error", "Shipment Not Found");
  const holdStatus = sh.getRange(row, 28).getValue();
  if(holdStatus === "On Hold") return jsonResponse("error", "Shipment is On Hold");
  const d=req.getDataRange().getValues();
  let r=-1; for(let i=0;i<d.length;i++) if(String(d[i][0])==String(b.reqId)){r=i+1;break;}
  if(r==-1) return jsonResponse("error","Request Not Found");
  if(b.decision==="Reject"){ req.getRange(r,6).setValue("Rejected"); return jsonResponse("success","Rejected"); }
  const oldLog = sh.getRange(row, 20).getValue();
  sh.getRange(row, 20).setValue(`${oldLog} [${new Date().toLocaleDateString()} ${b.type} Transfer to ${b.to}]`);
  if(b.type==="Automation") { sh.getRange(row, 16).setValue(b.to); }
  else {
      sh.getRange(row, 18).setValue(b.to);
      // If transferring paperwork, sync assignment to FMS
      syncFMS(b.taskId, { assignee: b.to });
  }
  req.getRange(r,6).setValue("Approved");
  return jsonResponse("success","Transferred");
}

function handleChangePassword(b) {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const uSheet = ss.getSheetByName("Users");
  const d = uSheet.getDataRange().getValues();
  for(let i=1; i<d.length; i++) {
    if(String(d[i][0]).toLowerCase() === String(b.username).toLowerCase()) {
      uSheet.getRange(i+1, 2).setValue(hashString(b.newPass)); // STORE HASH
      return jsonResponse("success", "Password Updated");
    }
  }
  return jsonResponse("error", "User Not Found");
}

function handleTransferRequest(b) { SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Requests").appendRow([new Date().getTime().toString().slice(-6), b.taskId, b.type, b.by, b.to, "Pending", new Date()]); return jsonResponse("success", "Request Sent"); }

function handleLogin(u,p){
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");
  const d = s.getDataRange().getValues();

  // Robust input handling
  const inputStr = String(p).trim();
  const hashedInput = hashString(inputStr);

  for(let i=1;i<d.length;i++) {
    if(String(d[i][0]).trim().toLowerCase() == String(u).trim().toLowerCase()) {
        // Robust stored value handling
        const storedVal = d[i][1];
        const storedStr = String(storedVal).trim();

        // 1. Check Hash Match
        if (storedStr === hashedInput) {
             return jsonResponse("success","OK",{username:d[i][0],name:d[i][2],role:d[i][3]});
        }

        // 2. Check Plain Text Match
        if (storedStr === inputStr) {
            s.getRange(i+1, 2).setValue(hashedInput);
            return jsonResponse("success","OK",{username:d[i][0],name:d[i][2],role:d[i][3]});
        }
    }
  }
  return jsonResponse("error","Invalid Credentials");
}

function handleDropdowns(b){ const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet2"); const col = {network:1, client:2, destination:3, extra:4, hold:5}[b.category]; if(b.subAction==="add"){ let r=2; while(s.getRange(r,col).getValue()!=="") r++; s.getRange(r,col).setValue(b.value); if(b.category==="hold") s.getRange(r,6).setValue(b.desc); } else { const v=s.getRange(2,col,s.getLastRow()).getValues().flat(); const i=v.indexOf(b.value); if(i>-1) s.getRange(i+2,col,1,2).deleteCells(SpreadsheetApp.Dimension.ROWS); } return jsonResponse("success","Updated"); }

function getUsersJson(requestingUser) {
    const d = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users").getDataRange().getValues();
    const users = d.slice(1).map(r => ({ user: r[0], pass: "****", name: r[2], role: r[3], perms: r[4] }));
    return jsonResponse("success", "OK", { users: users });
}

function getAdminRequests() { const d = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Requests").getDataRange().getValues(); const p = []; for(let i=1;i<d.length;i++) if(d[i][5]==="Pending") p.push({reqId:d[i][0], taskId:d[i][1], type:d[i][2], by:d[i][3], to:d[i][4], date:d[i][6]}); return jsonResponse("success", "OK", { requests: p }); }
function handleAddUser(b){
  clearUserCache();
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users").appendRow([b.u, hashString(b.p), b.n, b.r]);
  return jsonResponse("success","Added");
}
function handleDeleteUser(u){clearUserCache(); const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users"),d=s.getDataRange().getValues();for(let i=1;i<d.length;i++)if(String(d[i][0]).toLowerCase()==String(u).toLowerCase()){s.deleteRow(i+1);return jsonResponse("success","Deleted");}return jsonResponse("error","Not Found");}
function handleSetConfig(b) { PropertiesService.getScriptProperties().setProperty(b.key, b.value); return jsonResponse("success", "Config Saved"); }
function jsonResponse(s,m,d){return ContentService.createTextOutput(JSON.stringify({result:s,message:m,...d})).setMimeType(ContentService.MimeType.JSON);}
// ⚡ Bolt: Bulk Data Upload
function handleBulkDataUpload(b) {
    try {
        const rows = JSON.parse(b.data);
        if (!rows || !rows.length) return jsonResponse("error", "No Data");

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let sh = ss.getSheetByName("Bulk_Data");
        if (!sh) sh = ss.insertSheet("Bulk_Data");

        sh.clear();
        sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
        return jsonResponse("success", "Bulk Data Uploaded");
    } catch(e) { return jsonResponse("error", e.toString()); }
}

// ⚡ Bolt: Helper to search Bulk Data
function searchBulkData(netNo) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName("Bulk_Data");
    if (!sh || sh.getLastRow() < 2) return null;

    const data = sh.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());

    // Find Columns
    // Try dynamic search first, else fallback to Col U (Index 20) if headers are ambiguous
    let cNetNo = headers.findIndex(h => h.includes("net no") || h.includes("network no"));
    let useStandardMap = false;

    if (cNetNo === -1) {
        if (headers.length > 20) {
             cNetNo = 20;
             useStandardMap = true;
        } else {
             return null; // Can't find and not enough columns for standard
        }
    }

    const target = String(netNo).trim().toLowerCase();

    for(let i=1; i<data.length; i++) {
        // Safe check for undefined if row is short
        const cellVal = data[i][cNetNo] ? String(data[i][cNetNo]).trim().toLowerCase() : "";

        if(cellVal === target) {
            const row = data[i];

            if (useStandardMap) {
                // Standard Booking Report Map
                // AWB:0, Date:1, Dest:3, Client:5, Net:19, NetNo:20, Boxes:23, Wgt:26(Chg)
                return {
                    awb: row[0],
                    date: row[1],
                    dest: row[3],
                    net: row[19],
                    netNo: row[20],
                    boxes: row[23],
                    wgt: row[26],
                    client: row[5]
                };
            } else {
                // Dynamic Header Map
                const getVal = (k) => {
                    // Try multiple variations
                    const idx = headers.findIndex(h => h.includes(k));
                    return idx > -1 ? row[idx] : "";
                };

                // Enhanced Dynamic Lookup
                const netVal = getVal("network") || getVal("net") || "DHL";
                const pcsVal = getVal("pcs") || getVal("box");
                const wgtVal = getVal("wgt") || getVal("weight") || getVal("chg");

                return {
                    awb: getVal("awb"),
                    date: getVal("date"),
                    dest: getVal("dest"),
                    net: netVal,
                    netNo: row[cNetNo],
                    boxes: pcsVal,
                    wgt: wgtVal,
                    client: getVal("client")
                };
            }
        }
    }
    return null;
}

function handleConnectedScan(b) {
    const res = searchBulkData(b.netNo);
    if(!res) return jsonResponse("error", "Network No not found in Bulk Data");

    // Check Duplicates
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName("Shipments");
    if(findRow(sh, res.awb) !== -1) return jsonResponse("error", "AWB already exists");

    // Create Shipment
    // Category: "Connected"
    // FMS Doer: Client Name (res.client)

    const rowData = [
        "'"+res.awb, new Date(), "Ndox", "DHL", res.client, res.dest, // Assuming Net=DHL default if missing
        res.boxes, "", b.user, new Date(),
        res.wgt, res.wgt, res.wgt, "Connected Scan",
        "Done", res.client, "Pending", "", // Auto Done (by Client), Paper Pending
        "", "", res.netNo, "0", "0", "0",
        "", "", "N/A",
        "", "", "", "", "", "",
        "Connected", ""
    ];

    sh.appendRow(rowData);

    // Add to FMS
    // Status: Done, Doer: Client Name
    addToFMS({
        awb: res.awb, date: new Date(), type: "Ndox", net: "DHL",
        client: res.client, dest: res.dest, boxes: res.boxes,
        wgt: res.wgt, user: b.user,
        status: "Done", doer: res.client
    });

    return jsonResponse("success", "Created", { awb: res.awb });
}

function handleAutomationScan(b) {
    const res = searchBulkData(b.netNo);
    if(!res) return jsonResponse("error", "Network No not found in Bulk Data");
    return jsonResponse("success", "Found", { data: res });
}


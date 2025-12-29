/* =========================================
   ZEPHYR PRO API (vFinal - Roles, perms, RTO, Hashed Passwords, Form Support)
   ========================================= */

const TASK_SHEET_ID = "1_8VSzZdn8rKrzvXpzIfY_oz3XT9gi30jgzdxzQP4Bac";

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
  if (!lock.tryLock(10000)) return jsonResponse("error", "System Busy");

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
    const act = body.action;

    // --- 1. AUTH ---
    if (act === "login") return handleLogin(body.username, body.password);

    // --- 2. DATA RETRIEVAL (FIXED: Added to doPost) ---
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

    return jsonResponse("error", "Unknown Action: " + act);

  } catch (err) {
      return jsonResponse("error", err.toString());
  } finally {
      lock.releaseLock();
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

// --- MAIN DATA FETCH ---
function getAllData(username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let taskSS = null;
  const getTaskSS = () => { if(!taskSS) try { taskSS = SpreadsheetApp.openById(TASK_SHEET_ID); } catch(e){console.error(e);} return taskSS; };

  const sh = ss.getSheetByName("Shipments");
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
  try {
      const uSheet = ss.getSheetByName("Users");
      if (uSheet && uSheet.getLastRow() > 1) {
          const uData = uSheet.getDataRange().getValues();
          for(let i=1; i<uData.length; i++) {
            if(String(uData[i][0]).toLowerCase() === targetUser) {
                role = uData[i][3];
                const pStr = uData[i][4] || "";
                perms = pStr.split(',').map(s=>s.trim()).filter(Boolean);
                break;
            }
          }
      } else {
          if(targetUser.includes("admin") || targetUser.includes("owner")) role = "Admin";
      }
  } catch(e) { console.error("User Fetch Error", e); }

  const lastRow = sh.getLastRow();
  const data = lastRow>1 ? sh.getRange(2, 1, lastRow-1, 30).getDisplayValues() : [];

  let updates = [];
  let fmsUpdates = [];
  try {
      const remoteSS = getTaskSS();
      const brSheet = remoteSS ? remoteSS.getSheetByName("Booking_Report") : null;
      if(brSheet) {
          const brLast = brSheet.getLastRow();
          if(brLast > 1) {
              const brData = brSheet.getRange(2, 1, brLast-1, 41).getValues();
              const brMap = {};
              brData.forEach(r => {
                 const k = String(r[0]).replace(/'/g,"").trim().toLowerCase();
                 if(k) brMap[k] = { netNo: r[20], user: r[40] };
              });

              data.forEach((r, i) => {
                  const awb = String(r[0]).replace(/'/g,"").trim().toLowerCase();
                  const autoStatus = r[14];
                  if((autoStatus === "Pending" || autoStatus === "") && r[27] !== "On Hold" && brMap[awb]) {
                      const match = brMap[awb];
                      const user = match.user || "System";
                      const netNo = match.netNo || "";
                      r[14] = "Done"; r[15] = user; r[20] = netNo;
                      updates.push({ row: i+2, vals: [["Done", user]] });
                      updates.push({ row: i+2, col: 21, val: [[netNo]] });
                      fmsUpdates.push({ awb: awb, autoDoer: user });
                  }
              });
          }
      }
  } catch(e) {}

  if(updates.length > 0) {
      updates.forEach(u => {
          if(u.col) sh.getRange(u.row, u.col, 1, 1).setValues(u.val);
          else sh.getRange(u.row, 15, 1, 2).setValues(u.vals);
      });
  }

  if(fmsUpdates.length > 0) {
      try {
          const remoteSS = getTaskSS();
          const fms = remoteSS ? remoteSS.getSheetByName("FMS") : null;
          if(fms && fms.getLastRow() >= 7) {
              const rangeHeight = fms.getLastRow() - 6;
              const ids = fms.getRange(7, 2, rangeHeight, 1).getValues().flat().map(x=>String(x).replace(/'/g,"").trim().toLowerCase());

              // Read current values of Col 14 (Auto Doer)
              const col14Range = fms.getRange(7, 14, rangeHeight, 1);
              const col14Values = col14Range.getValues();
              let isModified = false;

              fmsUpdates.forEach(u => {
                  const idx = ids.indexOf(u.awb);
                  if(idx > -1) {
                      if (col14Values[idx][0] !== u.autoDoer) {
                          col14Values[idx][0] = u.autoDoer;
                          isModified = true;
                      }
                  }
              });

              if (isModified) {
                  col14Range.setValues(col14Values);
              }
          }
      } catch(e) { console.error("FMS Sync Error", e); }
  }

  let pendingAuto = [];
  let pendingPaper = [];
  let toAssign = [];
  let myToDo = [];
  let completedManifest = [];
  let holdings = [];

  let inboundTodayCount = 0;
  const getNormDate = (d) => new Date(d).setHours(0,0,0,0);
  const todayTime = getNormDate(new Date());

  data.forEach(r => {
    if(getNormDate(r[1]) === todayTime) inboundTodayCount++;

    const item = {
      id: r[0], date: r[1], net: r[3], client: r[4], dest: r[5],
      details: `${r[6]} Boxes | ${r[12]} Kg`,
      user: r[8], autoDoer: r[15], assignee: r[17],
      actWgt: r[10], volWgt: r[11], chgWgt: r[12], type: r[2], boxes: r[6], extra: r[7], rem: r[13],
      netNo: r[20], payTotal: r[21], payPaid: r[22], payPending: r[23],
      batchNo: r[24], manifestDate: r[25], paperwork: r[26],
      holdStatus: r[27], holdReason: r[28], holdRem: r[29]
    };

    if (item.holdStatus === "On Hold") {
        holdings.push(item);
    } else if (item.holdStatus === "RTO") {
        // Skip RTO
    } else {
        const paperStatus = r[16];
        const autoStatus = r[14];
        const assignee = String(r[17]).toLowerCase();
        const autoBy = String(r[15]).toLowerCase();

        if (paperStatus === "Completed") {
          completedManifest.push(item);
        }
        else if (autoStatus === "Pending" || autoStatus === "") {
          pendingAuto.push(item);
        }
        else {
          pendingPaper.push(item);
          if (autoBy === targetUser && assignee === "") toAssign.push(item);
          if (assignee === targetUser) myToDo.push({...item, subtitle: `Assigned by ${r[18]}`});
        }
    }
  });

  const rs = ss.getSheetByName("Requests");
  const reqs = rs.getLastRow()>1 ? rs.getRange(2, 1, rs.getLastRow()-1, 7).getValues().filter(r => r[5]==="Pending") : [];
  const reqList = reqs.map(r => ({ reqId:r[0], taskId:r[1], type:r[2], by:r[3], to:r[4], date:r[6] }));

  return jsonResponse("success", "OK", {
    role: role,
    perms: perms,
    static: staticData,
    stats: { inbound: inboundTodayCount, auto: pendingAuto.length, paper: pendingPaper.length, requests: reqList.length, holdings: holdings.length },
    overview: { auto: pendingAuto, paper: pendingPaper },
    workflow: { toAssign: toAssign, toDo: myToDo },
    manifest: completedManifest,
    holdings: holdings,
    adminPool: pendingPaper.filter(x => !x.assignee)
  });
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
        ss.getRange(row, 28, 1, 3).setValues([["On Hold", b.reason, b.remarks]]);
    } else if(b.subAction === "clear") {
        const net = String(ss.getRange(row, 4).getValue()).toUpperCase();
        const dest = String(ss.getRange(row, 6).getValue()).toUpperCase();

        if(net.startsWith("NA") || dest.startsWith("NA")) {
            return jsonResponse("error", "Update Network/Dest before clearing hold");
        }

        if(!b.remarks || !b.remarks.trim()) return jsonResponse("error", "Remarks are mandatory");
        ss.getRange(row, 28, 1, 3).setValues([["", "", ""]]);
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

  b.ids.forEach(id => {
      const key = String(id).replace(/'/g,"").trim().toLowerCase();
      if(awbMap[key]) ss.getRange(awbMap[key], 25, 1, 2).setValues([[b.batchNo, b.date]]);
      if(fms) {
          const idx = fmsIds.indexOf(key);
          if(idx > -1) {
              const r = idx + 7;
              const net = b.network.toLowerCase();
              const doer = b.user;
              if(net.includes("dhl")) { fms.getRange(r, 25).setValue(doer); }
              else if(net.includes("aramex")) { fms.getRange(r, 30).setValue(doer); }
              else if(net.includes("fedex")) { fms.getRange(r, 35).setValue(doer); }
          }
      }
  });
  return jsonResponse("success", "Batch Updated");
}

function handleSubmit(body){
  if(!body.awb) return jsonResponse("error","Missing Fields");
  const ss=SpreadsheetApp.getActiveSpreadsheet(), sh=ss.getSheetByName("Shipments"), bx=ss.getSheetByName("BoxDetails");
  const lr=sh.getRange(Math.max(1,sh.getLastRow()-100),1,Math.min(101,sh.getLastRow())).getValues().flat();
  const exists = lr.some(existing => String(existing).replace(/'/g, "").trim().toLowerCase() === String(body.awb).trim().toLowerCase());
  if(exists) return jsonResponse("error","AWB Exists");

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
  if(net.startsWith("NA") || dest.startsWith("NA")) {
      holdStatus = "On Hold";
      holdReason = "Invalid Data";
  }

  sh.appendRow([
      "'"+body.awb, body.date, body.type, body.network, body.client, body.destination,
      body.totalBoxes, body.extraCharges, body.username, new Date(),
      tA.toFixed(2), tV.toFixed(2), tC.toFixed(2), body.extraRemarks,
      "Pending", "", "", "", "", "", "",
      body.payTotal, body.payPaid, body.payPending, "", "", body.paperwork,
      holdStatus, holdReason, "", body.payeeName, body.payeeContact
  ]);

  if(br.length) bx.getRange(bx.getLastRow()+1,1,br.length,8).setValues(br);

  addToFMS({
      awb: body.awb, date: body.date, type: body.type, net: body.network,
      client: body.client, dest: body.destination, boxes: body.totalBoxes,
      wgt: tC.toFixed(2), user: body.username
  });

  return jsonResponse("success","Saved");
}

function addToFMS(d) {
    try {
        // const fms = SpreadsheetApp.openById(TASK_SHEET_ID).getSheetByName("FMS");
        // if(fms) {
        //     const lr = fms.getLastRow();
        //     const row = lr + 1;
        //     // fms.getRange(row, 2).setValue("'"+d.awb);
        // }
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
            if(data.assignee) fms.getRange(row, 19).setValue(data.assignee); // S
            if(data.assigner) fms.getRange(row, 20).setValue(data.assigner); // T
            if(data.autoDoer) fms.getRange(row, 14).setValue(data.autoDoer); // N
            if(data.paperStatus) fms.getRange(row, 17).setValue(data.paperStatus); // Q (Status)
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

function handleDirectTransfer(b) {
  const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Shipments");
  const row = findRow(ss, b.taskId);
  if (row === -1) return jsonResponse("error", "Shipment Not Found");
  const holdStatus = ss.getRange(row, 28).getValue();
  if(holdStatus === "On Hold") return jsonResponse("error", "Shipment is On Hold");
  const oldLog = ss.getRange(row, 20).getValue();
  ss.getRange(row, 20).setValue(`${oldLog} [${new Date().toLocaleDateString()} Direct Transfer by ${b.by} to ${b.to}]`);
  ss.getRange(row, 18).setValue(b.to);
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
  const hashedInput = hashString(p);

  for(let i=1;i<d.length;i++) {
    if(String(d[i][0]).toLowerCase() == String(u).toLowerCase()) {
        const storedPass = String(d[i][1]);
        if (storedPass === hashedInput) {
             return jsonResponse("success","OK",{username:d[i][0],name:d[i][2],role:d[i][3]});
        }
        if (storedPass === String(p)) {
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
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users").appendRow([b.u, hashString(b.p), b.n, b.r]);
  return jsonResponse("success","Added");
}
function handleDeleteUser(u){const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users"),d=s.getDataRange().getValues();for(let i=1;i<d.length;i++)if(String(d[i][0]).toLowerCase()==String(u).toLowerCase()){s.deleteRow(i+1);return jsonResponse("success","Deleted");}return jsonResponse("error","Not Found");}
function handleSetConfig(b) { PropertiesService.getScriptProperties().setProperty(b.key, b.value); return jsonResponse("success", "Config Saved"); }
function jsonResponse(s,m,d){return ContentService.createTextOutput(JSON.stringify({result:s,message:m,...d})).setMimeType(ContentService.MimeType.JSON);}
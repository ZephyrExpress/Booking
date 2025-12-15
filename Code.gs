/* =========================================
   ZEPHYR PRO API (v4.1 - Robust + Fixes)
   ========================================= */

const TASK_SHEET_ID = "1_8VSzZdn8rKrzvXpzIfY_oz3XT9gi30jgzdxzQP4Bac";

function doGet(e) {
  const act = e ? e.parameter.action : 'index';
  const user = e ? e.parameter.user : '';

  if (act === 'getAllData') return getAllData(user);
  if (act === 'getAdminRequests') return getAdminRequests();
  if (act === 'getUsers') return getUsersJson();

  return HtmlService.createTemplateFromFile('Index').evaluate()
      .setTitle('Zephyr Express Portal')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return jsonResponse("error", "System Busy");

  try {
    const body = JSON.parse(e.postData.contents);
    const act = body.action;

    if (act === "login") return handleLogin(body.username, body.password);
    if (act === "submit") return handleSubmit(body);

    // WORKFLOW
    if (act === "assignTask") return handleAssignTask(body);
    if (act === "markPaperworkDone") return handlePaperDone(body);

    // MANIFEST
    if (act === "updateManifestBatch") return handleManifestBatch(body);

    // ADMIN
    if (act === "requestTransfer") return handleTransferRequest(body);
    if (act === "approveTransfer") return handleApproveTransfer(body);
    if (act === "manageData") { CacheService.getScriptCache().remove('static_data'); return handleDropdowns(body); }
    if (act === "addUser") return handleAddUser(body);
    if (act === "deleteUser") return handleDeleteUser(body.username);

    return jsonResponse("error", "Unknown Action");
  } catch (err) {
    return jsonResponse("error", err.toString());
  } finally {
    lock.releaseLock();
  }
}

// --- MAIN DATA FETCH & SYNC ---
function getAllData(username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Shipments");
  const targetUser = String(username).trim().toLowerCase();

  // 1. Static Data Cache
  const cache = CacheService.getScriptCache();
  let staticDataStr = cache.get('static_data');
  let staticData = null;

  if (!staticDataStr) {
    // Robust Fetch
    try {
      // Local Sheet Dropdowns (Always available hopefully)
      const ddSheet = ss.getSheetByName("Sheet2");
      const rawDD = ddSheet && ddSheet.getLastRow()>1 ? ddSheet.getRange(2, 1, ddSheet.getLastRow()-1, 4).getValues() : [];
      const dd = {
        networks: rawDD.map(r=>r[0]).filter(String),
        clients: rawDD.map(r=>r[1]).filter(String),
        destinations: rawDD.map(r=>r[2]).filter(String),
        extraCharges: rawDD.map(r=>r[3]).filter(String)
      };

      // Remote Staff (Might fail)
      let staff = [];
      try {
        const remoteSS = SpreadsheetApp.openById(TASK_SHEET_ID);
        staff = remoteSS.getSheetByName("Subordinate Staff").getRange(2,1,50).getValues().flat().filter(String);
      } catch(e) {
        console.error("Staff Fetch Error", e);
        staff = ["Error Loading Staff"]; // Fallback
      }

      staticData = { staff: staff, dropdowns: dd };
      cache.put('static_data', JSON.stringify(staticData), 1800);
    } catch(e) {
      console.error("Static Data Error", e);
      staticData = { staff: [], dropdowns: {} };
    }
  } else {
    staticData = JSON.parse(staticDataStr);
  }

  // 2. Identify Role
  const uData = ss.getSheetByName("Users").getDataRange().getValues();
  let role = "Staff";
  for(let i=1; i<uData.length; i++) {
    if(String(uData[i][0]).toLowerCase() === targetUser) { role = uData[i][3]; break; }
  }

  // 3. READ SHIPMENTS (Cols A-Z -> 26 cols)
  const lastRow = sh.getLastRow();
  const data = lastRow>1 ? sh.getRange(2, 1, lastRow-1, 26).getDisplayValues() : [];

  // 4. SYNC AUTOMATION
  let updates = [];
  try {
      const remoteSS = SpreadsheetApp.openById(TASK_SHEET_ID);
      const brSheet = remoteSS.getSheetByName("Booking_Report");
      if(brSheet) {
          const brLast = brSheet.getLastRow();
          if(brLast > 1) {
              // Read only needed columns to save memory if possible, but they are far apart (A, U, AO)
              // Let's read A(0), U(20), AO(40). Range: 1 to 41.
              const brData = brSheet.getRange(2, 1, brLast-1, 41).getValues();
              const brMap = {};
              brData.forEach(r => {
                 const k = String(r[0]).replace(/'/g,"").trim().toLowerCase();
                 if(k) brMap[k] = { netNo: r[20], user: r[40] };
              });

              data.forEach((r, i) => {
                  const awb = String(r[0]).replace(/'/g,"").trim().toLowerCase();
                  const autoStatus = r[14];
                  if((autoStatus === "Pending" || autoStatus === "") && brMap[awb]) {
                      const match = brMap[awb];
                      const user = match.user || "System";
                      const netNo = match.netNo || "";

                      r[14] = "Done"; r[15] = user; r[20] = netNo;
                      updates.push({ row: i+2, vals: [["Done", user]] }); // O, P
                      updates.push({ row: i+2, col: 21, val: [[netNo]] }); // U
                  }
              });
          }
      }
  } catch(e) { console.error("Booking Report Sync Error", e); }

  if(updates.length > 0) {
      updates.forEach(u => {
          if(u.col) sh.getRange(u.row, u.col, 1, 1).setValues(u.val);
          else sh.getRange(u.row, 15, 1, 2).setValues(u.vals);
      });
  }

  // 5. PROCESS LISTS
  let pendingAuto = [];
  let pendingPaper = [];
  let toAssign = [];
  let myToDo = [];
  let completedManifest = [];

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
      batchNo: r[24], manifestDate: r[25]
    };

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
      if (autoBy === targetUser) toAssign.push(item);
      if (assignee === targetUser) myToDo.push({...item, subtitle: `Assigned by ${r[18]}`});
    }
  });

  const rs = ss.getSheetByName("Requests");
  const reqs = rs.getLastRow()>1 ? rs.getRange(2, 1, rs.getLastRow()-1, 7).getValues().filter(r => r[5]==="Pending") : [];
  const reqList = reqs.map(r => ({ reqId:r[0], taskId:r[1], type:r[2], by:r[3], to:r[4], date:r[6] }));

  return jsonResponse("success", "OK", {
    role: role,
    static: staticData,
    stats: { inbound: inboundTodayCount, auto: pendingAuto.length, paper: pendingPaper.length, requests: reqList.length },
    overview: { auto: pendingAuto, paper: pendingPaper },
    workflow: { toAssign: toAssign, toDo: myToDo },
    manifest: completedManifest,
    adminPool: pendingPaper.filter(x => !x.assignee)
  });
}

// --- ACTIONS ---

function handleAssignTask(b) {
  const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Shipments");
  const row = findRow(ss, b.id);
  if (row === -1) return jsonResponse("error", "AWB Not Found");
  ss.getRange(row, 17, 1, 3).setValues([["Assigned", b.staff, b.assigner]]);
  syncFMS(b.id, { assignee: b.staff, assigner: b.assigner });
  return jsonResponse("success", "Task Assigned");
}

function handlePaperDone(b) {
  const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Shipments");
  const row = findRow(ss, b.id);
  if (row === -1) return jsonResponse("error", "AWB Not Found");
  ss.getRange(row, 17).setValue("Completed");
  syncFMS(b.id, { status: "COMPLETED" });
  return jsonResponse("success", "Completed");
}

function handleManifestBatch(b) {
  const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Shipments");
  if(!b.ids || !b.batchNo) return jsonResponse("error", "Invalid Data");
  const allIds = ss.getRange(2, 1, ss.getLastRow()-1, 1).getValues().flat();
  const awbMap = {};
  allIds.forEach((id, i) => { awbMap[String(id).replace(/'/g,"").trim().toLowerCase()] = i + 2; });
  b.ids.forEach(id => {
      const key = String(id).replace(/'/g,"").trim().toLowerCase();
      if(awbMap[key]) ss.getRange(awbMap[key], 25, 1, 2).setValues([[b.batchNo, b.date]]);
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

  sh.appendRow([
      "'"+body.awb, body.date, body.type, body.network, body.client, body.destination,
      body.totalBoxes, body.extraCharges, body.username, new Date(),
      tA.toFixed(2), tV.toFixed(2), tC.toFixed(2), body.extraRemarks,
      "Pending", "", "", "", "", "", "",
      body.payTotal, body.payPaid, body.payPending, "", ""
  ]);

  if(br.length) bx.getRange(bx.getLastRow()+1,1,br.length,8).setValues(br);
  return jsonResponse("success","Saved");
}

function findRow(sheet, id) {
  const ids = sheet.getRange(2, 1, sheet.getLastRow()-1, 1).getValues().flat();
  const idx = ids.findIndex(x => String(x).replace(/'/g,"").trim().toLowerCase() === String(id).replace(/'/g,"").trim().toLowerCase());
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
            if(data.assignee) fms.getRange(row, 19).setValue(data.assignee);
            if(data.assigner) fms.getRange(row, 20).setValue(data.assigner);
            if(data.status) fms.getRange(row, 17).setValue(data.status);
        }
    } catch(e){}
}

function handleApproveTransfer(b) {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const req=ss.getSheetByName("Requests");
  const sh=ss.getSheetByName("Shipments");
  const d=req.getDataRange().getValues();
  let r=-1; for(let i=0;i<d.length;i++) if(String(d[i][0])==String(b.reqId)){r=i+1;break;}
  if(r==-1) return jsonResponse("error","Request Not Found");
  if(b.decision==="Reject"){ req.getRange(r,6).setValue("Rejected"); return jsonResponse("success","Rejected"); }
  const row = findRow(sh, b.taskId);
  if(row === -1) return jsonResponse("error", "Shipment Not Found");
  const oldLog = sh.getRange(row, 20).getValue();
  sh.getRange(row, 20).setValue(`${oldLog} [${new Date().toLocaleDateString()} ${b.type} Transfer to ${b.to}]`);
  if(b.type==="Automation") { sh.getRange(row, 16).setValue(b.to); }
  else { sh.getRange(row, 18).setValue(b.to); syncFMS(b.taskId, { assignee: b.to }); }
  req.getRange(r,6).setValue("Approved");
  return jsonResponse("success","Transferred");
}

function handleTransferRequest(b) { SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Requests").appendRow([new Date().getTime().toString().slice(-6), b.taskId, b.type, b.by, b.to, "Pending", new Date()]); return jsonResponse("success", "Request Sent"); }
function handleLogin(u,p){ const d=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users").getDataRange().getValues(); for(let i=1;i<d.length;i++) if(String(d[i][0]).toLowerCase()==String(u).toLowerCase() && String(d[i][1])==String(p)) return jsonResponse("success","OK",{username:d[i][0],name:d[i][2],role:d[i][3]}); return jsonResponse("error","Invalid Credentials"); }
function handleDropdowns(b){ const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet2"); const col = {network:1, client:2, destination:3, extra:4}[b.category]; if(b.subAction==="add"){ let r=2; while(s.getRange(r,col).getValue()!=="") r++; s.getRange(r,col).setValue(b.value); } else { const v=s.getRange(2,col,s.getLastRow()).getValues().flat(); const i=v.indexOf(b.value); if(i>-1) s.getRange(i+2,col).deleteCells(SpreadsheetApp.Dimension.ROWS); } return jsonResponse("success","Updated"); }
function getUsersJson() { return jsonResponse("success", "OK", { users: SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users").getDataRange().getValues().slice(1) }); }
function getAdminRequests() { const d = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Requests").getDataRange().getValues(); const p = []; for(let i=1;i<d.length;i++) if(d[i][5]==="Pending") p.push({reqId:d[i][0], taskId:d[i][1], type:d[i][2], by:d[i][3], to:d[i][4], date:d[i][6]}); return jsonResponse("success", "OK", { requests: p }); }
function handleAddUser(b){SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users").appendRow([b.u,b.p,b.n,b.r]);return jsonResponse("success","Added");}
function handleDeleteUser(u){const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users"),d=s.getDataRange().getValues();for(let i=1;i<d.length;i++)if(String(d[i][0]).toLowerCase()==String(u).toLowerCase()){s.deleteRow(i+1);return jsonResponse("success","Deleted");}return jsonResponse("error","Not Found");}
function jsonResponse(s,m,d){return ContentService.createTextOutput(JSON.stringify({result:s,message:m,...d})).setMimeType(ContentService.MimeType.JSON);}

/* =========================================
   ZEPHYR PRO API (v3.1 - Bolt Optimized + Manifest Tracking)
   ========================================= */

const TASK_SHEET_ID = "1_8VSzZdn8rKrzvXpzIfY_oz3XT9gi30jgzdxzQP4Bac";

function doGet(e) {
  const act = e.parameter.action;
  const user = e.parameter.user;

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

    // WORKFLOW ACTIONS
    if (act === "markAutoDone") return handleAutoDone(body);
    if (act === "assignTask") return handleAssignTask(body);
    if (act === "markPaperworkDone") return handlePaperDone(body);

    // MANIFEST ACTIONS
    if (act === "updateManifestBatch") return handleManifestBatch(body);

    // ADMIN ACTIONS
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

// --- MAIN DATA FETCH ---
function getAllData(username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Shipments");
  const targetUser = String(username).trim().toLowerCase();

  // 1. Static Data
  const cache = CacheService.getScriptCache();
  let staticData = cache.get('static_data');
  if (!staticData) {
    const remoteSS = SpreadsheetApp.openById(TASK_SHEET_ID);
    const staff = remoteSS.getSheetByName("Subordinate Staff").getRange(2,1,50).getValues().flat().filter(String);
    const ddSheet = ss.getSheetByName("Sheet2");
    const rawDD = ddSheet.getLastRow()>1 ? ddSheet.getRange(2, 1, ddSheet.getLastRow()-1, 4).getValues() : [];
    const dd = {
      networks: rawDD.map(r=>r[0]).filter(String),
      clients: rawDD.map(r=>r[1]).filter(String),
      destinations: rawDD.map(r=>r[2]).filter(String),
      extraCharges: rawDD.map(r=>r[3]).filter(String)
    };
    staticData = JSON.stringify({ staff: staff, dropdowns: dd });
    cache.put('static_data', staticData, 1800);
  }

  // 2. Identify Role
  const uData = ss.getSheetByName("Users").getDataRange().getValues();
  let role = "Staff";
  for(let i=1; i<uData.length; i++) {
    if(String(uData[i][0]).toLowerCase() === targetUser) { role = uData[i][3]; break; }
  }

  // 3. Process Shipments
  // Reading Cols A-V (22 columns)
  // U (20): Manifest Batch, V (21): Manifest Date
  const data = sh.getLastRow()>1 ? sh.getRange(2, 1, sh.getLastRow()-1, 22).getDisplayValues() : [];

  let pendingAuto = [];
  let pendingPaper = [];
  let toAssign = [];
  let myToDo = [];
  let completedManifest = [];

  data.forEach(r => {
    // Cols: 0:AWB, 1:Date, 3:Net, 4:Client, 12:ChgWgt, 14:AutoStatus, 15:AutoBy, 16:PaperStatus, 17:Assignee, 18:Assigner
    const awb = r[0];
    const autoStatus = r[14];
    const paperStatus = r[16];
    const autoBy = String(r[15]).toLowerCase();
    const assignee = String(r[17]).toLowerCase();
    const batchNo = r[20];
    const manDate = r[21];

    const item = {
      id: awb, date: r[1], net: r[3], client: r[4], dest: r[5],
      details: `${r[6]} Boxes | ${r[12]} Kg`,
      user: r[8], autoDoer: r[15], assignee: r[17],
      actWgt: r[10], volWgt: r[11], chgWgt: r[12], type: r[2], boxes: r[6], extra: r[7], rem: r[13],
      batchNo: batchNo, manifestDate: manDate
    };

    if (paperStatus === "Completed") {
      completedManifest.push(item);
    }
    else if (autoStatus === "Pending" || autoStatus === "") {
      pendingAuto.push(item);
    }
    else {
      pendingPaper.push(item);
      if (autoBy === targetUser && assignee === "") toAssign.push(item);
      if (assignee === targetUser) myToDo.push({...item, subtitle: `By ${r[18]}`});
    }
  });

  // 4. Admin Requests
  const rs = ss.getSheetByName("Requests");
  const reqs = rs.getLastRow()>1 ? rs.getRange(2, 1, rs.getLastRow()-1, 7).getValues().filter(r => r[5]==="Pending") : [];
  const reqList = reqs.map(r => ({ reqId:r[0], taskId:r[1], type:r[2], by:r[3], to:r[4], date:r[6] }));

  return jsonResponse("success", "OK", {
    role: role,
    static: JSON.parse(staticData),
    stats: { inbound: data.length, auto: pendingAuto.length, paper: pendingPaper.length, requests: reqList.length },
    overview: { auto: pendingAuto, paper: pendingPaper },
    workflow: { toAssign: toAssign, toDo: myToDo },
    manifest: completedManifest,
    adminPool: pendingPaper
  });
}

// --- WORKFLOW ACTIONS ---

function findFMSRow(sheet, id) {
  if(sheet.getLastRow() < 7) return -1;
  const ids = sheet.getRange(7, 2, sheet.getLastRow()-6, 1).getValues().flat();
  const idx = ids.findIndex(x => String(x).replace(/'/g,"").trim().toLowerCase() === String(id).replace(/'/g,"").trim().toLowerCase());
  return idx > -1 ? idx + 7 : -1;
}

function handleAutoDone(b) {
  const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Shipments");
  const row = findRow(ss, b.id);
  if (row === -1) return jsonResponse("error", "AWB Not Found");

  ss.getRange(row, 15, 1, 3).setValues([["Done", b.user, "Pending"]]);

  const fms = SpreadsheetApp.openById(TASK_SHEET_ID).getSheetByName("FMS");
  let fmsRow = findFMSRow(fms, b.id);
  const details = ss.getRange(row, 1, 1, 14).getValues()[0];

  if (fmsRow === -1) {
     fmsRow = fms.getLastRow() + 1;
     fms.getRange(fmsRow, 2).setValue("'"+details[0].replace(/'/g,"")); // B: AWB
     fms.getRange(fmsRow, 5).setValue(details[3]); // E: Net
     fms.getRange(fmsRow, 6).setValue(details[4]); // F: Client
     fms.getRange(fmsRow, 9).setValue(details[12]); // I: Weight
     fms.getRange(fmsRow, 14).setValue(b.user); // N: Auto Doer
     fms.getRange(fmsRow, 17).setValue("PENDING"); // Q: Status
  } else {
     fms.getRange(fmsRow, 14).setValue(b.user);
  }

  return jsonResponse("success", "Automation Done & Synced");
}

function handleAssignTask(b) {
  const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Shipments");
  const row = findRow(ss, b.id);
  if (row === -1) return jsonResponse("error", "AWB Not Found");

  ss.getRange(row, 17, 1, 3).setValues([["Assigned", b.staff, b.assigner]]);

  const fms = SpreadsheetApp.openById(TASK_SHEET_ID).getSheetByName("FMS");
  const fmsRow = findFMSRow(fms, b.id);
  if (fmsRow > -1) {
     fms.getRange(fmsRow, 19).setValue(b.staff); // S: Assignee
     fms.getRange(fmsRow, 20).setValue(b.assigner); // T: Assigner
  }

  return jsonResponse("success", "Task Assigned & Synced");
}

function handlePaperDone(b) {
  const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Shipments");
  const row = findRow(ss, b.id);
  if (row === -1) return jsonResponse("error", "AWB Not Found");

  ss.getRange(row, 17).setValue("Completed");

  const fms = SpreadsheetApp.openById(TASK_SHEET_ID).getSheetByName("FMS");
  const fmsRow = findFMSRow(fms, b.id);
  if (fmsRow > -1) {
     fms.getRange(fmsRow, 17).setValue("COMPLETED");
  }

  return jsonResponse("success", "Completed & Synced");
}

function handleManifestBatch(b) {
  const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Shipments");
  // b.ids is array of AWB IDs, b.batchNo is string, b.date is string
  if(!b.ids || !b.batchNo) return jsonResponse("error", "Invalid Data");

  const allIds = ss.getRange(2, 1, ss.getLastRow()-1, 1).getValues().flat();
  // Optimize: Create map of AWB -> Row Index
  const awbMap = {};
  allIds.forEach((id, i) => { awbMap[String(id).replace(/'/g,"").trim().toLowerCase()] = i + 2; });

  b.ids.forEach(id => {
      const key = String(id).replace(/'/g,"").trim().toLowerCase();
      if(awbMap[key]) {
          // Set Col U (21) and V (22)
          ss.getRange(awbMap[key], 21, 1, 2).setValues([[b.batchNo, b.date]]);
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

  // Appending 22 columns (A-T filled, U-V empty for now)
  sh.appendRow(["'"+body.awb, body.date, body.type, body.network, body.client, body.destination, body.totalBoxes, body.extraCharges, body.username, new Date(), tA.toFixed(2), tV.toFixed(2), tC.toFixed(2), body.extraRemarks, "Pending", "", "", "", "", "", "", ""]);
  if(br.length) bx.getRange(bx.getLastRow()+1,1,br.length,8).setValues(br);
  return jsonResponse("success","Saved");
}

function findRow(sheet, id) {
  const ids = sheet.getRange(2, 1, sheet.getLastRow()-1, 1).getValues().flat();
  const idx = ids.findIndex(x => String(x).replace(/'/g,"").trim().toLowerCase() === String(id).replace(/'/g,"").trim().toLowerCase());
  return idx > -1 ? idx + 2 : -1;
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

  const fms = SpreadsheetApp.openById(TASK_SHEET_ID).getSheetByName("FMS");
  const fmsRow = findFMSRow(fms, b.taskId);

  if(b.type==="Automation") {
     sh.getRange(row, 16).setValue(b.to);
     if(fmsRow > -1) fms.getRange(fmsRow, 14).setValue(b.to);
  } else {
     sh.getRange(row, 18).setValue(b.to);
     if(fmsRow > -1) fms.getRange(fmsRow, 19).setValue(b.to);
  }

  req.getRange(r,6).setValue("Approved");
  return jsonResponse("success","Transferred & Synced");
}

function handleTransferRequest(b) { SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Requests").appendRow([new Date().getTime().toString().slice(-6), b.taskId, b.type, b.by, b.to, "Pending", new Date()]); return jsonResponse("success", "Request Sent"); }
function handleLogin(u,p){ const d=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users").getDataRange().getValues(); for(let i=1;i<d.length;i++) if(String(d[i][0]).toLowerCase()==String(u).toLowerCase() && String(d[i][1])==String(p)) return jsonResponse("success","OK",{username:d[i][0],name:d[i][2],role:d[i][3]}); return jsonResponse("error","Invalid Credentials"); }
function handleDropdowns(b){ const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet2"); const col = {network:1, client:2, destination:3, extra:4}[b.category]; if(b.subAction==="add"){ let r=2; while(s.getRange(r,col).getValue()!=="") r++; s.getRange(r,col).setValue(b.value); } else { const v=s.getRange(2,col,s.getLastRow()).getValues().flat(); const i=v.indexOf(b.value); if(i>-1) s.getRange(i+2,col).deleteCells(SpreadsheetApp.Dimension.ROWS); } return jsonResponse("success","Updated"); }
function getUsersJson() { return jsonResponse("success", "OK", { users: SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users").getDataRange().getValues().slice(1) }); }
function getAdminRequests() { const d = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Requests").getDataRange().getValues(); const p = []; for(let i=1;i<d.length;i++) if(d[i][5]==="Pending") p.push({reqId:d[i][0], taskId:d[i][1], type:d[i][2], by:d[i][3], to:d[i][4], date:d[i][6]}); return jsonResponse("success", "OK", { requests: p }); }
function handleAddUser(b){SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users").appendRow([b.u,b.p,b.n,b.r]);return jsonResponse("success","Added");}
function handleDeleteUser(u){const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users"),d=s.getDataRange().getValues();for(let i=1;i<d.length;i++)if(String(d[i][0]).toLowerCase()==String(u).toLowerCase()){s.deleteRow(i+1);return jsonResponse("success","Deleted");}return jsonResponse("error","Not Found");}
function jsonResponse(s,m,d){return ContentService.createTextOutput(JSON.stringify({result:s,message:m,...d})).setMimeType(ContentService.MimeType.JSON);}

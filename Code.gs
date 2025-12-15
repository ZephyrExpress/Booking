/* =========================================
   ZEPHYR PRO API (v4.0 - Auto-Sync + Payment + Colourful UI)
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

  // 3. READ SHIPMENTS (Cols A-Z -> 26 cols)
  // A:AWB, B:Date, ... O:AutoStatus, P:AutoBy, Q:PaperStatus, R:Assignee, S:Assigner, T:Logs
  // U:NetNo, V:PayTotal, W:PayPaid, X:PayPend, Y:ManBatch, Z:ManDate
  const lastRow = sh.getLastRow();
  const data = lastRow>1 ? sh.getRange(2, 1, lastRow-1, 26).getDisplayValues() : [];

  // 4. SYNC AUTOMATION (Check Booking_Report)
  let updates = [];
  try {
      const remoteSS = SpreadsheetApp.openById(TASK_SHEET_ID);
      const brSheet = remoteSS.getSheetByName("Booking_Report");
      if(brSheet) {
          // Read Booking Report: A (AWB), U (NetNo), AO (User)
          // AO is col index 40. U is 20. A is 0.
          // We need up to Col AO (41 cols).
          const brLast = brSheet.getLastRow();
          if(brLast > 1) {
              const brData = brSheet.getRange(2, 1, brLast-1, 41).getValues();
              const brMap = {};
              brData.forEach(r => {
                 const k = String(r[0]).replace(/'/g,"").trim().toLowerCase();
                 if(k) brMap[k] = { netNo: r[20], user: r[40] };
              });

              // Check Pending items
              data.forEach((r, i) => {
                  const awb = String(r[0]).replace(/'/g,"").trim().toLowerCase();
                  const autoStatus = r[14]; // O

                  if((autoStatus === "Pending" || autoStatus === "") && brMap[awb]) {
                      // FOUND MATCH!
                      const match = brMap[awb];
                      const user = match.user || "System";
                      const netNo = match.netNo || "";

                      // Update Memory
                      r[14] = "Done";
                      r[15] = user;
                      r[20] = netNo; // U

                      // Queue Sheet Update: Row, AutoStat(O), AutoBy(P), NetNo(U)
                      // O=15, P=16, U=21 (1-based)
                      updates.push({ row: i+2, vals: [["Done", user]] }); // O, P
                      updates.push({ row: i+2, col: 21, val: [[netNo]] }); // U
                  }
              });
          }
      }
  } catch(e) { console.error("Booking Report Sync Error", e); }

  // Apply Updates to Sheet
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

  // Date check for stats
  const todayStr = new Date().toLocaleDateString('en-US'); // Format matches typical sheet format?
  // Better: compare date objects or standardized strings.
  // Sheet dates are strings in display values.
  // We'll trust new Date().toLocaleDateString() vs row date string match, or simpler:
  // Just count inbound today.

  let inboundTodayCount = 0;
  const getNormDate = (d) => new Date(d).setHours(0,0,0,0);
  const todayTime = getNormDate(new Date());

  data.forEach(r => {
    // 0:AWB, 1:Date, 3:Net, 4:Client, 12:ChgWgt, 14:AutoStat, 15:AutoBy, 16:PapStat, 17:Assignee, 18:Assigner
    // 20:NetNo, 21:PayTot, 22:PayPaid, 23:PayPend, 24:ManBatch, 25:ManDate

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

    if (paperStatus === "Completed") {
      completedManifest.push(item);
    }
    else if (autoStatus === "Pending" || autoStatus === "") {
      pendingAuto.push(item);
    }
    else {
      // Auto Done -> Pending Paperwork
      pendingPaper.push(item);
      // Admin Pool: Items needing assignment (or just all pending paperwork)
      // Task Hub Logic:
      if (assignee === "") toAssign.push(item); // Unassigned
      if (assignee === targetUser) myToDo.push({...item, subtitle: `Assigned by ${r[18]}`});
    }
  });

  // 6. Admin Requests
  const rs = ss.getSheetByName("Requests");
  const reqs = rs.getLastRow()>1 ? rs.getRange(2, 1, rs.getLastRow()-1, 7).getValues().filter(r => r[5]==="Pending") : [];
  const reqList = reqs.map(r => ({ reqId:r[0], taskId:r[1], type:r[2], by:r[3], to:r[4], date:r[6] }));

  return jsonResponse("success", "OK", {
    role: role,
    static: JSON.parse(staticData),
    stats: { inbound: inboundTodayCount, auto: pendingAuto.length, paper: pendingPaper.length, requests: reqList.length },
    overview: { auto: pendingAuto, paper: pendingPaper },
    workflow: { toAssign: toAssign, toDo: myToDo },
    manifest: completedManifest,
    adminPool: pendingPaper.filter(x => !x.assignee) // Pool is unassigned items
  });
}

// --- ACTIONS ---

function handleAssignTask(b) {
  const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Shipments");
  const row = findRow(ss, b.id);
  if (row === -1) return jsonResponse("error", "AWB Not Found");

  ss.getRange(row, 17, 1, 3).setValues([["Assigned", b.staff, b.assigner]]);
  // Sync FMS? (User didn't explicitly ask to change FMS logic, but kept "Booking Report" sync.
  // Previous code had FMS sync. I'll keep it safe.)
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
      if(awbMap[key]) {
          // Set Cols Y (25) and Z (26)
          ss.getRange(awbMap[key], 25, 1, 2).setValues([[b.batchNo, b.date]]);
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

  // Append 26 columns
  // A-T (20) + U(NetNo) + V-X(Pay) + Y-Z(Man)
  sh.appendRow([
      "'"+body.awb, body.date, body.type, body.network, body.client, body.destination,
      body.totalBoxes, body.extraCharges, body.username, new Date(),
      tA.toFixed(2), tV.toFixed(2), tC.toFixed(2), body.extraRemarks,
      "Pending", "", "", "", "", "", // O-T
      "", // U (NetNo - empty initially)
      body.payTotal, body.payPaid, body.payPending, // V-X
      "", "" // Y-Z
  ]);

  if(br.length) bx.getRange(bx.getLastRow()+1,1,br.length,8).setValues(br);
  return jsonResponse("success","Saved");
}

// --- UTILS ---
function findRow(sheet, id) {
  const ids = sheet.getRange(2, 1, sheet.getLastRow()-1, 1).getValues().flat();
  const idx = ids.findIndex(x => String(x).replace(/'/g,"").trim().toLowerCase() === String(id).replace(/'/g,"").trim().toLowerCase());
  return idx > -1 ? idx + 2 : -1;
}

function syncFMS(id, data) {
    // Keep legacy sync if needed, or remove if user implies Booking_Report is the new master.
    // User said "Automation ... marked done when on Booking_Report".
    // FMS sheet might still be used for other things. I'll leave it in purely to avoid regression if FMS is distinct.
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

  if(b.type==="Automation") {
     sh.getRange(row, 16).setValue(b.to); // Auto By
  } else {
     sh.getRange(row, 18).setValue(b.to); // Assigned To
     syncFMS(b.taskId, { assignee: b.to });
  }

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

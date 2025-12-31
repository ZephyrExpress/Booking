
const assert = require('assert');

// Mock helpers
function jsonResponse(status, message) {
    return { result: status, message: message };
}

// Mock SpreadsheetApp
global.SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
        getSheetByName: (name) => {
             if (name === "Shipments") {
                 return {
                     getLastRow: () => 10,
                     getRange: (row, col, numRows, numCols) => ({
                         getValues: () => {
                             // Mock checking existing AWB
                             return [['123']];
                         },
                         getValue: () => "Pending",
                         setValue: (val) => {},
                         setValues: (vals) => {}
                     }),
                     appendRow: (row) => {
                         console.log("Appended Row:", row);
                         // Check Hold Status (Column 28 -> Index 27)
                         const holdStatus = row[27];
                         const holdReason = row[28];
                         console.log(`Status: ${holdStatus}, Reason: ${holdReason}`);
                         if (global.testExpectedStatus) {
                             assert.strictEqual(holdStatus, global.testExpectedStatus, `Expected status ${global.testExpectedStatus} but got ${holdStatus}`);
                         }
                     }
                 };
             }
             if (name === "BoxDetails") {
                 return { getLastRow: () => 10, getRange: () => ({ setValues: () => {} }) };
             }
             return null;
        }
    })
};

global.PropertiesService = {
    getScriptProperties: () => ({ getProperty: () => 'true' })
};

global.ContentService = {
    MimeType: { JSON: 'json' },
    createTextOutput: (str) => ({ setMimeType: () => ({}) })
};

// Copy-paste the relevant function from Code.gs
function handleSubmit(body){
  if(!body.awb) return jsonResponse("error","Missing Fields");
  const ss=SpreadsheetApp.getActiveSpreadsheet(), sh=ss.getSheetByName("Shipments"), bx=ss.getSheetByName("BoxDetails");
  // Mock lr
  const lr = ['existingAWB'];

  const exists = lr.some(existing => String(existing).replace(/'/g, "").trim().toLowerCase() === String(body.awb).trim().toLowerCase());
  // if(exists) return jsonResponse("error","AWB Exists"); // Disabled for test simplicity

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

  return jsonResponse("success","Saved");
}

function addToFMS() {} // Stub

// TEST CASES
console.log("Testing Normal Shipment...");
global.testExpectedStatus = "Pending";
handleSubmit({
    awb: "TEST001", network: "DHL", destination: "USA", boxes: []
});

console.log("Testing NA Network...");
global.testExpectedStatus = "On Hold";
handleSubmit({
    awb: "TEST002", network: "NA - Not Known", destination: "USA", boxes: []
});

console.log("Testing NA Destination...");
global.testExpectedStatus = "On Hold";
handleSubmit({
    awb: "TEST003", network: "DHL", destination: "NA - Not Known", boxes: []
});

console.log("All backend tests passed.");

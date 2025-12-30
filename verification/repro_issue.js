const fs = require('fs');

// Mock GAS classes
class MockSheet {
    constructor(name, data) { this.name = name; this.data = data; }
    getLastRow() { return this.data.length; }
    getDataRange() { return { getValues: () => this.data }; }
    getSheetByName(n) { return null; }
    getRange(r, c, nr, nc) {
        return {
            getValues: () => {
                const res = [];
                for(let i=0; i<(nr||1); i++) {
                    const row = [];
                    for(let j=0; j<(nc||1); j++) {
                        const ri = r-1+i;
                        const ci = c-1+j;
                        row.push(this.data[ri] ? this.data[ri][ci] : "");
                    }
                    res.push(row);
                }
                return res;
            },
            getDisplayValues: () => {
                const vals = this.getRange(r,c,nr,nc).getValues();
                return vals.map(row => row.map(cell => String(cell)));
            },
            setValues: (vals) => {
                for(let i=0; i<vals.length; i++) {
                    for(let j=0; j<vals[i].length; j++) {
                        const ri = r-1+i;
                        const ci = c-1+j;
                        if(this.data[ri]) this.data[ri][ci] = vals[i][j];
                    }
                }
            },
            setValue: (val) => {
                if(this.data[r-1]) this.data[r-1][c-1] = val;
            }
        };
    }
}

class MockSpreadsheet {
    constructor(sheets) { this.sheets = sheets; }
    getSheetByName(n) { return this.sheets[n] || null; }
}

class MockSpreadsheetApp {
    constructor(activeSheets, remoteSheets) {
        this.active = new MockSpreadsheet(activeSheets);
        this.remote = new MockSpreadsheet(remoteSheets);
    }
    getActiveSpreadsheet() { return this.active; }
    openById(id) { return this.remote; }
}

// SETUP MOCKS
global.CacheService = { getScriptCache: () => ({ get: ()=>null, put: ()=>{} }) };
global.LockService = { getScriptLock: () => ({ tryLock: ()=>true, releaseLock: ()=>{} }) };
global.PropertiesService = { getScriptProperties: () => ({ getProperty: ()=> 'true' }) };
global.ContentService = {
    createTextOutput: (c) => ({ setMimeType: () => {}, content: c }),
    MimeType: { JSON: 'json' } // Correctly mocked here
};
global.console = console;

// DATA
const shipmentRow = new Array(30).fill("");
shipmentRow[0] = "'990990990-FRT";
shipmentRow[14] = "Pending";
shipmentRow[27] = "";

const shipmentsData = [
    Array(30).fill("Header"),
    shipmentRow
];

const brRow = new Array(41).fill("");
brRow[0] = "990990990-FRT";
brRow[20] = "NET-123";
brRow[40] = "BotUser";

const brData = [
    Array(41).fill("Header"),
    brRow
];

const fmsData = [
    Array(50).fill("Header"), Array(50).fill("Header"), Array(50).fill("Header"),
    Array(50).fill("Header"), Array(50).fill("Header"), Array(50).fill("Header"),
    Array(50).fill("Header"), new Array(50).fill("")
];
fmsData[7][1] = "'990990990-FRT";

global.SpreadsheetApp = new MockSpreadsheetApp(
    {
        "Shipments": new MockSheet("Shipments", shipmentsData),
        "Users": new MockSheet("Users", [["User"],["BotUser", "", "", "Staff", ""]]),
        "Sheet2": new MockSheet("Sheet2", [["Net"],["Cli"],["Dest"],["Ex"]])
    },
    {
        "Booking_Report": new MockSheet("Booking_Report", brData),
        "FMS": new MockSheet("FMS", fmsData)
    }
);

global.TASK_SHEET_ID = "TASK_ID";

// Load Code.gs
const code = fs.readFileSync('Code.gs', 'utf8');
eval(code);

// EXECUTE
console.log("Running getAllData...");
const res = getAllData("Admin");
const json = JSON.parse(res.content);

// CHECK RESULTS
const updatedShipment = shipmentsData[1];
console.log("Auto Status (Col O):", updatedShipment[14]);
console.log("Auto Doer (Col P):", updatedShipment[15]);
console.log("Net No (Col U):", updatedShipment[20]);

if (updatedShipment[14] === "Done" && updatedShipment[15] === "BotUser") {
    console.log("SUCCESS: Matched correctly.");
} else {
    console.log("FAILURE: Did not update.");
}

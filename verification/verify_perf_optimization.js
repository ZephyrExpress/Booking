
// Mock Classes for Google Apps Script
class MockRange {
    constructor(values, displayValues) {
        this.values = values;
        this.displayValues = displayValues;
    }
    getValues() { return this.values; }
    getDisplayValues() { return this.displayValues; }
    setValues(vals) { this.values = vals; }
}

class MockSheet {
    constructor(name, data) {
        this.name = name;
        this.data = data; // Array of rows
        this.dataDisplay = data.map(r => r.map(c => {
            if(c instanceof Date) return c.toLocaleDateString();
            if(typeof c === 'number') return c.toFixed(2);
            return String(c);
        }));
    }
    getLastRow() { return this.data.length; }
    getMaxColumns() { return this.data[0] ? this.data[0].length : 0; }
    getRange(row, col, numRows, numCols) {
        // 1-based index
        const subset = [];
        const subsetDisplay = [];
        for(let i=0; i<numRows; i++) {
            const rIndex = row - 1 + i;
            if (rIndex < this.data.length) {
                subset.push(this.data[rIndex].slice(col-1, col-1+numCols));
                subsetDisplay.push(this.dataDisplay[rIndex].slice(col-1, col-1+numCols));
            }
        }
        return new MockRange(subset, subsetDisplay);
    }
    insertColumnsAfter() {}
}

class MockSS {
    constructor() {
        this.sheets = {};
    }
    getSheetByName(name) { return this.sheets[name]; }
    insertSheet(name) {
        this.sheets[name] = new MockSheet(name, [[]]);
        return this.sheets[name];
    }
}

const SpreadsheetApp = {
    getActiveSpreadsheet: () => global.mockSS,
    openById: () => global.mockSS
};

const CacheService = {
    getScriptCache: () => ({
        get: () => null,
        put: () => {},
        remove: () => {}
    })
};

const PropertiesService = {
    getScriptProperties: () => ({
        getProperty: () => 'true'
    })
};

const ContentService = {
    createTextOutput: (str) => ({ setMimeType: () => str }),
    MimeType: { JSON: 'JSON' }
};

// Global Setup
global.SpreadsheetApp = SpreadsheetApp;
global.CacheService = CacheService;
global.PropertiesService = PropertiesService;
global.ContentService = ContentService;
global.mockSS = new MockSS();

// Populate Mock Data
const now = new Date("2026-01-11T00:00:00.000Z"); // Fixed date for consistency
const shipData = [
    // Header
    Array(33).fill("Header"),
    // Row 1 (Index 2 in GAS)
    ["'300100001", now, "Type", "Network", "Client", "Dest", 10, "Extra", "User", "Date2", 10.5, 10.5, 10.5, "Rem", "Pending", "AutoDoer", "Paper", "Assignee", "Assigner", "NetNo", 20.0, 10.0, 10.0, "Batch", "MDate", "Paperwork", "Hold", "Reason", "Rem", "HeldBy", "AE", "Normal"]
];

// Fill up to 33 columns
for(let i=0; i<shipData.length; i++) {
    while(shipData[i].length < 33) shipData[i].push("");
}

global.mockSS.sheets["Shipments"] = new MockSheet("Shipments", shipData);
global.mockSS.sheets["Advance_Records"] = new MockSheet("Advance_Records", [Array(33).fill("")]);
global.mockSS.sheets["Sheet2"] = new MockSheet("Sheet2", [["Net1","Cli1","Dest1","Ext1","Hold1","Desc1"]]);
global.mockSS.sheets["Users"] = new MockSheet("Users", [["u","p","n","Staff","perm"]]);

// --- Implementation of optimized getAllData logic to test ---

function getAllDataOptimized(username) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName("Shipments");
    const lastRow = sh.getLastRow();

    // OPTIMIZATION: Use getValues instead of getDisplayValues
    let range = null;
    let data = [];
    if(lastRow > 1) {
        range = sh.getRange(2, 1, lastRow-1, 33);
        data = range.getValues();
    }

    // Simulate Sync Logic modifying data
    if(data.length > 0) {
        data[0][14] = "Done"; // Modify status
    }

    // Process Data
    const results = data.map(r => {
        return {
            id: r[0], // Should be string "'300100001" or number depending on logic
            date: r[1], // Should be Date object
            chgWgt: r[12], // Should be Number 10.5
            // ⚡ Bolt Fix applied here
            details: `${r[6]} Boxes | ${typeof r[12] === 'number' ? r[12].toFixed(2) : r[12]} Kg`
        };
    });

    return results;
}

function getAllDataOriginal(username) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName("Shipments");
    const lastRow = sh.getLastRow();

    const data = lastRow>1 ? sh.getRange(2, 1, lastRow-1, 33).getDisplayValues() : [];

    // Original logic reads again for sync
    if(lastRow > 1) {
        const sData = sh.getRange(2, 1, lastRow-1, 33).getValues();
        sData[0][14] = "Done"; // Sync modifies sData
        // But 'data' (display values) is NOT updated in original code!
    }

    const results = data.map(r => {
        return {
            id: r[0],
            date: r[1],
            chgWgt: r[12],
            details: `${r[6]} Boxes | ${r[12]} Kg`
        };
    });

    return results;
}

// Run Test
console.log("--- Running Original ---");
const resOrig = getAllDataOriginal("test");
console.log("Original Details:", resOrig[0].details);

console.log("\n--- Running Optimized ---");
const resOpt = getAllDataOptimized("test");
console.log("Optimized Details:", resOpt[0].details);

// Verification Logic
const detailsMatch = resOrig[0].details === resOpt[0].details;
console.log("\nDetails Match:", detailsMatch);

// Ensure we didn't break functionality
if (detailsMatch) {
    console.log("SUCCESS: Optimization preserves visual contract.");
} else {
    console.log("FAILURE: Visual contract broken.");
}

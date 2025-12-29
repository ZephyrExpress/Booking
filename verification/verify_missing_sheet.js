const fs = require('fs');

// Mock GAS classes
class MockCache {
    constructor() { this.store = {}; }
    get(k) { return this.store[k] || null; }
    put(k, v) { this.store[k] = v; }
    remove(k) { delete this.store[k]; }
}
class MockCacheService {
    getScriptCache() { return new MockCache(); }
}
class MockLock {
    tryLock() { return true; }
    releaseLock() {}
}
class MockLockService {
    getScriptLock() { return new MockLock(); }
}
class MockSheet {
    constructor(name, data) { this.name = name; this.data = data; }
    getLastRow() { return this.data.length; }
    getDataRange() {
        return { getValues: () => this.data };
    }
    getSheetByName(n) { return null; } // For nested calls
    getRange(r, c, nr, nc) {
        const selfData = this.data;
        const getVals = () => {
            const res = [];
            const rowCount = nr || 1;
            const colCount = nc || 1;
            for(let i=0; i<rowCount; i++) {
                const row = [];
                for(let j=0; j<colCount; j++) {
                    const ri = r-1+i;
                    const ci = c-1+j;
                    if (selfData[ri] && selfData[ri][ci] !== undefined) {
                        row.push(selfData[ri][ci]);
                    } else {
                        row.push("");
                    }
                }
                res.push(row);
            }
            return res;
        };
        return {
            getValues: getVals,
            getDisplayValues: getVals,
            setValue: () => {},
            setValues: () => {}
        };
    }
}
class MockSpreadsheet {
    constructor(sheets) { this.sheets = sheets; }
    getSheetByName(n) { return this.sheets[n] || null; }
}
class MockSpreadsheetApp {
    constructor(sheets) { this.active = new MockSpreadsheet(sheets); }
    getActiveSpreadsheet() { return this.active; }
    openById(id) {
        if (id === "1_8VSzZdn8rKrzvXpzIfY_oz3XT9gi30jgzdxzQP4Bac") {
            throw new Error("You do not have permission to access the requested document.");
        }
        return null;
    }
}
class MockPropertiesService {
    getScriptProperties() { return { getProperty: () => 'true' }; }
}
class MockContentService {
    createTextOutput(c) { return { setMimeType: () => {}, content: c }; } // Corrected mock
    MimeType = { JSON: 'json' };
}

// Global Mocks
global.CacheService = new MockCacheService();
global.LockService = new MockLockService();
global.PropertiesService = new MockPropertiesService();
global.ContentService = new MockContentService();
global.Utilities = {
    computeDigest: () => [1,2,3],
    DigestAlgorithm: { SHA_256: 1 }
};
global.console = console;

// Data Setup
const usersData = [
    ["Username", "PassHash", "Name", "Role", "Perms"],
    ["Manoj Kumar", "hash123", "Manoj Kumar", "Owner", ""]
];
// 30 Columns needed for Shipments
const row1 = ["AWB1", "2025-01-01", "Regular", "DHL", "Client1", "DEL", "1", "", "Manoj", "", "1.0", "1.0", "1.0", "", "Pending", "User1", "Pending", "", "", "", "", "100", "0", "100", "", "", "", "", "", ""];
const shipmentsData = [
    Array(30).fill("Header"),
    row1
];

// OMITTING "Requests" SHEET TO TEST ROBUSTNESS
global.SpreadsheetApp = new MockSpreadsheetApp({
    "Users": new MockSheet("Users", usersData),
    "Shipments": new MockSheet("Shipments", shipmentsData),
    "Sheet2": new MockSheet("Sheet2", [["DHL"],["Client1"],["DEL"],["Extra"]])
    // No Requests sheet
});

global.TASK_SHEET_ID = "1_8VSzZdn8rKrzvXpzIfY_oz3XT9gi30jgzdxzQP4Bac";

// Load Code.gs
const code = fs.readFileSync('Code.gs', 'utf8');
eval(code);

console.log("TEST 1: Missing Requests Sheet -> Should not crash");
const res = getAllData("Manoj Kumar");
const json = JSON.parse(res.content);

if (json.result === "success") {
    console.log("PASS: Result is success");
    if (json.stats.requests === 0) {
        console.log("PASS: Requests count is 0 (handled gracefully)");
    } else {
        console.log("FAIL: Requests count is " + json.stats.requests);
    }
} else {
    console.log("FAIL: getAllData failed: " + json.message);
}

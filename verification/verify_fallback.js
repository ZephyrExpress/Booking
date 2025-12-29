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
    createTextOutput(c) { return { setMimeType: () => {} }; }
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

global.SpreadsheetApp = new MockSpreadsheetApp({
    "Users": new MockSheet("Users", usersData),
    "Shipments": new MockSheet("Shipments", shipmentsData),
    "Sheet2": new MockSheet("Sheet2", [["DHL"],["Client1"],["DEL"],["Extra"]]),
    "Requests": new MockSheet("Requests", [["ReqID", "TaskID", "Type", "By", "To", "Status", "Date"]])
});

global.TASK_SHEET_ID = "1_8VSzZdn8rKrzvXpzIfY_oz3XT9gi30jgzdxzQP4Bac";

// Load Code.gs
const code = fs.readFileSync('Code.gs', 'utf8');
eval(code);

// TEST 1: Verify getUserMap finds the user
console.log("TEST 1: getUserMap");
const map = getUserMap();
if (map["manoj kumar"] && map["manoj kumar"].role === "Owner") {
    console.log("PASS: Map built correctly");
} else {
    console.log("FAIL: Map missing user or role incorrect");
    console.log(map);
}

// TEST 2: Verify getAllData with FMS Access Error
console.log("\nTEST 2: getAllData with FMS Error");
global.ContentService = {
    createTextOutput: (c) => ({ setMimeType: () => {}, content: c }),
    MimeType: { JSON: 'json' }
};

const res2 = getAllData("Manoj Kumar");
const json = JSON.parse(res2.content);

if (json.result === "success") {
    console.log("PASS: getAllData returned success despite FMS error");
    if (json.role === "Owner") {
        console.log("PASS: Role identified as Owner");
    } else {
        console.log("FAIL: Role is " + json.role);
    }
} else {
    console.log("FAIL: getAllData returned error: " + json.message);
}

// TEST 3: Force getUserMap failure (by mocking empty return) and test Fallback
console.log("\nTEST 3: Fallback Logic");
// Overwrite getUserMap to fail
global.getUserMap = () => ({});

const res3 = getAllData("Manoj Kumar"); // Should hit fallback loop
const json3 = JSON.parse(res3.content);

if (json3.role === "Owner") {
    console.log("PASS: Fallback logic found Owner role");
} else {
    console.log("FAIL: Fallback logic returned " + json3.role);
}

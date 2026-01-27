
const fs = require('fs');

// Mock Environment
global.SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
        getSheetByName: (name) => {
            if (name === 'Shipments') return mockShipmentsSheet;
            if (name === 'Users') return mockUsersSheet;
            if (name === 'Sheet2') return mockDropdownSheet;
            if (name === 'Advance_Records') return mockAdvanceSheet;
            if (name === 'Subordinate Staff') return mockStaffSheet; // Local Staff Sheet
            return null;
        },
        insertSheet: () => ({ getLastRow: () => 0, getMaxColumns: () => 35, insertColumnsAfter: () => {} }),
        openById: () => null
    }),
    openById: () => null
};

global.CacheService = {
    getScriptCache: () => ({ get: () => null, put: () => {}, remove: () => {} })
};
global.PropertiesService = {
    getScriptProperties: () => ({ getProperty: () => 'true' })
};
global.ContentService = {
    createTextOutput: (str) => ({ setMimeType: () => JSON.parse(str) }), // Return parsed for inspection
    MimeType: { JSON: 'JSON' }
};

// Mock Data
const mockStaffSheet = {
    getRange: () => ({
        getValues: () => [["Staff1"], ["Staff2"], [""]]
    })
};

const mockShipmentsSheet = {
    getLastRow: () => 5,
    getMaxColumns: () => 40,
    insertColumnsAfter: () => {},
    getRange: () => ({
        getValues: () => {
            // Col P (15) = AutoDoer, Col R (17) = Assignee
            // Staff1 in allowed -> Count
            // ClientX NOT in allowed -> Ignore
            const now = new Date();
            // Set time to be within shift (e.g. 10 AM today)
            const d = new Date(); d.setHours(10,0,0,0);

            return [
                ["ID1", d, "", "", "", "", "", "", "", d, "", "", "", "", "", "Staff1", "", "Staff2", "", "", ""],
                ["ID2", d, "", "", "", "", "", "", "", d, "", "", "", "", "", "ClientX", "", "Staff1", "", "", ""],
                ["ID3", d, "", "", "", "", "", "", "", d, "", "", "", "", "", "Staff2", "", "ClientY", "", "", ""]
            ].map(r => { while(r.length<36) r.push(""); return r; });
        }
    })
};

const mockUsersSheet = { getLastRow: () => 2, getDataRange: () => ({ getValues: () => [["H"], ["u", "p", "n", "r", "p", "b"]] }) };
const mockDropdownSheet = { getLastRow: () => 1, getRange: () => ({ getValues: () => [] }) };
const mockAdvanceSheet = {
    getLastRow: () => 1,
    getMaxColumns: () => 35,
    insertColumnsAfter: () => {},
    getRange: () => ({ getDisplayValues: () => [], getValue: () => "" })
};

// Load Code
const code = fs.readFileSync('Code.gs', 'utf8');
eval(code);

// Test
const res = getAllData("test");
const stats = res.analytics.staffPerf;

console.log("Staff Stats:", JSON.stringify(stats));

// Expectation:
// Staff1: 2 (1 Auto, 1 Assign)
// Staff2: 2 (1 Auto, 1 Assign)
// ClientX: 0
// ClientY: 0

const s1 = stats.find(x => x.name === 'Staff1');
const s2 = stats.find(x => x.name === 'Staff2');
const cx = stats.find(x => x.name === 'ClientX');

if (s1 && s1.count === 2 && s2 && s2.count === 2 && !cx) {
    console.log("PASS: Whitelist Logic Correct");
} else {
    console.log("FAIL: Logic incorrect");
}

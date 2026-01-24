
const fs = require('fs');

// Mock services
global.SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
        getSheetByName: (name) => {
            if (name === 'Shipments') return mockShipmentsSheet;
            if (name === 'Users') return mockUsersSheet;
            return {
                getLastRow: () => 1,
                getMaxColumns: () => 36,
                insertColumnsAfter: () => {},
                getRange: () => ({ getValues: () => [], getDisplayValues: () => [], getValue: () => "" })
            };
        },
        insertSheet: () => ({ getLastRow: () => 0, getMaxColumns: () => 36, insertColumnsAfter: () => {} }),
    }),
    openById: () => null
};
global.CacheService = { getScriptCache: () => ({ get: () => null, put: () => {}, remove: () => {} }) };
global.PropertiesService = { getScriptProperties: () => ({ getProperty: () => 'true' }) };
global.ContentService = { createTextOutput: (str) => ({ setMimeType: () => str }), MimeType: { JSON: 'JSON' } };
global.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };


// Mock user data
const mockUsersSheet = {
    getLastRow: () => 4,
    getDataRange: () => ({
        getValues: () => [
            ["User", "Pass", "Name", "Role", "Perms", "Branch"],
            ["AdminUser", "hash", "Admin", "Admin", "", "Naraina Vihar"],
            ["Staff1", "hash", "Staff One", "Staff", "", "Mahipalpur"],
            ["Staff2", "hash", "Staff Two", "Staff", "", ""] // Test fallback
        ]
    })
};

// --- Test Data ---
const now = new Date();
now.setHours(14, 0, 0, 0); // Simulate 2 PM

const today10AM = new Date(now); today10AM.setHours(10, 0, 0, 0);
const today8AM = new Date(now); today8AM.setHours(8, 0, 0, 0);
const yesterday10AM = new Date(now); yesterday10AM.setDate(now.getDate() - 1); yesterday10AM.setHours(10, 0, 0, 0);

const mockShipmentsData = [
    // AWB, Date, ..., chgWgt (idx 12), user (idx 8), branch (idx 35)
    ["A", today10AM, "", "", "", "", "", "", "Staff1", "", "", "", 10, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Mahipalpur"],
    ["B", today10AM, "", "", "", "", "", "", "Staff2", "", "", "", 20, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Naraina Vihar"],
    ["C", today10AM, "", "", "", "", "", "", "Staff1", "", "", "", 15, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""], // Test branch fallback
    ["D", yesterday10AM, "", "", "", "", "", "", "Staff1", "", "", "", 50, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Mahipalpur"], // Yesterday, should be ignored by analytics
    ["E", today8AM, "", "", "", "", "", "", "Staff2", "", "", "", 100, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Santnagar"] // Before shift, should be ignored
];

global.mockShipmentsSheet = {
    getLastRow: () => mockShipmentsData.length + 1,
    getMaxColumns: () => 36,
    insertColumnsAfter: () => {},
    getRange: (r, c, numR, numC) => ({
        getValues: () => mockShipmentsData
    })
};


// Load Code.gs and run test
try {
    const code = fs.readFileSync('Code.gs', 'utf8');
    eval(code);

    // Temporarily replace Date to control 'now'
    const OriginalDate = Date;
    global.Date = class extends OriginalDate { constructor(d) { if (d) super(d); else super(now); } static now() { return now.getTime(); } };

    const resultStr = getAllData("AdminUser");
    const result = JSON.parse(resultStr);
    const analytics = result.analytics;

    global.Date = OriginalDate; // Restore Date

    console.log("--- Verifying Backend Analytics ---");
    let passed = true;

    // 1. Verify Branch Stats
    const branchStats = analytics.branch;
    console.log("\nBranch Stats:", JSON.stringify(branchStats, null, 2));
    if (!branchStats["Mahipalpur"] || branchStats["Mahipalpur"].count !== 1 || branchStats["Mahipalpur"].weight !== 10) {
        console.log("FAIL: Mahipalpur stats are incorrect.");
        passed = false;
    }
    if (!branchStats["Naraina Vihar"] || branchStats["Naraina Vihar"].count !== 2 || branchStats["Naraina Vihar"].weight !== 35) {
        console.log("FAIL: Naraina Vihar stats (including fallback) are incorrect.");
        passed = false;
    }
    if (branchStats["Santnagar"]) {
        console.log("FAIL: Santnagar should not have stats as its entry was before the shift.");
        passed = false;
    }


    // 2. Verify Staff Stats
    const staffStats = analytics.staff;
    console.log("\nStaff Stats:", JSON.stringify(staffStats, null, 2));
    if (staffStats.length !== 2) {
        console.log("FAIL: Staff stats should have 2 entries.");
        passed = false;
    }
    if (staffStats[0].name !== "Staff1" || staffStats[0].count !== 2) {
        console.log("FAIL: Top staff member is incorrect.");
        passed = false;
    }
    if (staffStats[1].name !== "Staff2" || staffStats[1].count !== 1) {
        console.log("FAIL: Second staff member is incorrect.");
        passed = false;
    }

    console.log(`\nBackend verification ${passed ? 'successful' : 'failed'}.`);
    if (!passed) process.exit(1);

} catch (e) {
    console.error("Execution Error:", e);
    process.exit(1);
}

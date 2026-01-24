
const fs = require('fs');

// Mock services
global.SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
        getSheetByName: (name) => {
            if (name === 'Shipments') return mockShipmentsSheet;
            if (name === 'Users') return mockUsersSheet;
            return {
                getLastRow: () => 1,
                getMaxColumns: () => 35,
                insertColumnsAfter: () => {},
                getRange: () => ({ getValues: () => [], getDisplayValues: () => [], getValue: () => "" })
            };
        },
        insertSheet: () => ({ getLastRow: () => 0, getMaxColumns: () => 35, insertColumnsAfter: () => {} }),
    }),
    openById: () => null
};
global.CacheService = { getScriptCache: () => ({ get: () => null, put: () => {}, remove: () => {} }) };
global.PropertiesService = { getScriptProperties: () => ({ getProperty: () => 'true' }) };
global.ContentService = { createTextOutput: (str) => ({ setMimeType: () => str }), MimeType: { JSON: 'JSON' } };
global.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };


// Mock user data
const mockUsersSheet = {
    getLastRow: () => 2,
    getDataRange: () => ({
        getValues: () => [["Header"], ["TestUser", "Pass", "Test User Name", "Admin", ""]]
    })
};


function runTest(testName, now, mockData) {
    console.log(`\n--- Running Test: ${testName} (Current Time: ${now.toLocaleString()}) ---`);

    // Use a mock object for the sheet to inject data for this specific test run
    global.mockShipmentsSheet = {
        getLastRow: () => mockData.length + 1,
        getMaxColumns: () => 35,
        insertColumnsAfter: () => {},
        getRange: () => ({
            getValues: () => mockData.map(row => {
                while(row.length < 35) row.push("");
                return row;
            })
        })
    };

    // Temporarily replace Date constructor to control 'now'
    const OriginalDate = Date;
    global.Date = class extends OriginalDate {
        constructor(dateString) {
            if (dateString) {
                super(dateString); // Allow creating specific dates
            } else {
                super(now); // Override 'new Date()'
            }
        }
        static now() {
            return now.getTime();
        }
    };

    try {
        const resultStr = getAllData("TestUser");
        const result = JSON.parse(resultStr);
        const inboundCount = result.stats.inbound;

        // Restore Date
        global.Date = OriginalDate;
        return inboundCount;

    } catch (e) {
        console.error("Execution Error:", e);
        global.Date = OriginalDate; // Ensure restoration on error
        return -1;
    }
}


// --- Test Scenarios ---

// Load Code.gs once
const code = fs.readFileSync('Code.gs', 'utf8');
eval(code);

let passed = true;

// --- SCENARIO 1: Current time is AFTER 9 AM ---
const nowAfter9AM = new Date(); // e.g., today at 1:00 PM
nowAfter9AM.setHours(13, 0, 0, 0);

const todayAt10AM = new Date(nowAfter9AM); todayAt10AM.setHours(10, 0, 0, 0);
const todayAt8AM = new Date(nowAfter9AM); todayAt8AM.setHours(8, 0, 0, 0);
const yesterdayAt10AM = new Date(nowAfter9AM); yesterdayAt10AM.setDate(yesterdayAt10AM.getDate() - 1); yesterdayAt10AM.setHours(10, 0, 0, 0);

const mockDataAfter9AM = [
    // AWB, Date, ... other columns
    ["A", todayAt10AM],   // Should be counted (today after 9am)
    ["B", todayAt8AM],     // Should NOT be counted (today before 9am)
    ["C", yesterdayAt10AM] // Should NOT be counted (yesterday)
];

const countAfter9AM = runTest("After 9 AM", nowAfter9AM, mockDataAfter9AM);
console.log(`Expected inbound count: 1, Got: ${countAfter9AM}`);
if (countAfter9AM !== 1) {
    console.log("FAIL");
    passed = false;
} else {
    console.log("PASS");
}


// --- SCENARIO 2: Current time is BEFORE 9 AM ---
const nowBefore9AM = new Date(); // e.g., today at 7:00 AM
nowBefore9AM.setHours(7, 0, 0, 0);

// Dates need to be relative to the new 'now'
const yesterdayAt10AM_b = new Date(nowBefore9AM); yesterdayAt10AM_b.setDate(yesterdayAt10AM_b.getDate() - 1); yesterdayAt10AM_b.setHours(10, 0, 0, 0);
const yesterdayAt8AM_b = new Date(nowBefore9AM); yesterdayAt8AM_b.setDate(yesterdayAt8AM_b.getDate() - 1); yesterdayAt8AM_b.setHours(8, 0, 0, 0);
const dayBeforeYesterday_b = new Date(nowBefore9AM); dayBeforeYesterday_b.setDate(dayBeforeYesterday_b.getDate() - 2); dayBeforeYesterday_b.setHours(10, 0, 0, 0);

const mockDataBefore9AM = [
    // AWB, Date, ... other columns
    ["A", yesterdayAt10AM_b], // Should be counted (yesterday after 9am is the current shift)
    ["B", yesterdayAt8AM_b],   // Should NOT be counted (yesterday before 9am)
    ["C", dayBeforeYesterday_b] // Should NOT be counted (too old)
];

const countBefore9AM = runTest("Before 9 AM", nowBefore9AM, mockDataBefore9AM);
console.log(`Expected inbound count: 1, Got: ${countBefore9AM}`);
if (countBefore9AM !== 1) {
    console.log("FAIL");
    passed = false;
} else {
    console.log("PASS");
}

console.log(`\nBackend verification ${passed ? 'successful' : 'failed'}.`);
if (!passed) {
    process.exit(1); // Exit with error code if tests fail
}

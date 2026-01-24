
const fs = require('fs');

// Mock services
global.SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
        getSheetByName: (name) => {
            if (name === 'Shipments') return mockShipmentsSheet;
            return null;
        }
    }),
    openById: (id) => ({
        getSheetByName: (name) => {
            if (name === 'FMS') return mockFmsSheet;
            return null;
        }
    })
};
global.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };
global.ContentService = { createTextOutput: (str) => ({ setMimeType: () => str }), MimeType: { JSON: 'JSON' } };

// Mock Data
let mockShipmentsData = [
    ["AWB1", "Date", "Type", "Net", "Client", "Dest", "Box", "Extra", "User", "Time", "Act", "Vol", "Chg", "Rem", "Done", "UserAuto", "Pending", "", ""],
    ["AWB2", "Date", "Type", "Net", "Client", "Dest", "Box", "Extra", "User", "Time", "Act", "Vol", "Chg", "Rem", "Done", "UserAuto", "Pending", "", ""],
    ["AWB3", "Date", "Type", "Net", "Client", "Dest", "Box", "Extra", "User", "Time", "Act", "Vol", "Chg", "Rem", "Done", "UserAuto", "Pending", "", ""],
];

let mockFmsData = [
    // 6 header rows
    [], [], [], [], [], [],
    // Data starts at row 7
    ["", "AWB1", "Date", "Type", "Net", "Client", "Dest", "Box", "", "", "Wgt", "Wgt", "Wgt", "Done", "", "UserAuto", "", "", "Pending", "", "", ""],
    ["", "AWB2", "Date", "Type", "Net", "Client", "Dest", "Box", "", "", "Wgt", "Wgt", "Wgt", "Done", "", "UserAuto", "", "", "Pending", "", "", ""],
    ["", "AWB3", "Date", "Type", "Net", "Client", "Dest", "Box", "", "", "Wgt", "Wgt", "Wgt", "Done", "", "UserAuto", "", "", "Pending", "", "", ""],
];

const mockShipmentsSheet = {
    getLastRow: () => mockShipmentsData.length + 1,
    getRange: (r, c, numR, numC) => {
        // We only care about A:A (IDs) and Q:S (Assignments)
        if (c === 1) { // A:A
            return { getValues: () => mockShipmentsData.map(row => [row[0]]) };
        }
        if (c === 17) { // Q:S
            return {
                getValues: () => mockShipmentsData.map(row => [row[16], row[17], row[18]]),
                setValues: (values) => {
                    values.forEach((valRow, i) => {
                        mockShipmentsData[i][16] = valRow[0];
                        mockShipmentsData[i][17] = valRow[1];
                        mockShipmentsData[i][18] = valRow[2];
                    });
                }
            };
        }
        return { getValues: () => [[]], setValues: () => {} };
    }
};

const mockFmsSheet = {
    getLastRow: () => mockFmsData.length,
    getRange: (r, c, numR, numC) => {
        if (r === 7 && c === 2) { // B:B (IDs)
            return { getValues: () => mockFmsData.slice(6).map(row => [row[1]]) };
        }
        if (r === 7 && c === 21) { // U:V
            return {
                getValues: () => mockFmsData.slice(6).map(row => [row[20], row[21]]),
                setValues: (values) => {
                    values.forEach((valRow, i) => {
                        mockFmsData[i + 6][20] = valRow[0]; // Col U
                        mockFmsData[i + 6][21] = valRow[1]; // Col V
                    });
                }
            };
        }
        return { getValues: () => [[]], setValues: () => {} };
    }
};

// Load Code.gs
const code = fs.readFileSync('Code.gs', 'utf8');
eval(code);

// Test Payload
const testPayload = {
    assigner: "AdminUser",
    assignments: [
        { id: "AWB1", staff: "StaffA" },
        { id: "AWB3", staff: "StaffB" }
    ]
};

// Run Test
try {
    handleBulkAssign(testPayload);

    let passed = true;
    // Check Shipments Sheet
    if (mockShipmentsData[0][16] !== "Assigned" || mockShipmentsData[0][17] !== "StaffA" || mockShipmentsData[0][18] !== "AdminUser") {
        console.log("FAIL: Shipments Sheet AWB1 not updated correctly.");
        passed = false;
    }
    if (mockShipmentsData[1][16] !== "Pending") { // Should be unchanged
        console.log("FAIL: Shipments Sheet AWB2 was changed incorrectly.");
        passed = false;
    }
    if (mockShipmentsData[2][16] !== "Assigned" || mockShipmentsData[2][17] !== "StaffB" || mockShipmentsData[2][18] !== "AdminUser") {
        console.log("FAIL: Shipments Sheet AWB3 not updated correctly.");
        passed = false;
    }

    // Check FMS Sheet
    // Indices are offset by 6 for header
    if (mockFmsData[6][20] !== "StaffA" || mockFmsData[6][21] !== "AdminUser") {
        console.log("FAIL: FMS Sheet AWB1 not updated correctly.");
        passed = false;
    }
    if (mockFmsData[7][20] !== "" || mockFmsData[7][21] !== "") { // Should be unchanged
        console.log("FAIL: FMS Sheet AWB2 was changed incorrectly.");
        passed = false;
    }
    if (mockFmsData[8][20] !== "StaffB" || mockFmsData[8][21] !== "AdminUser") {
        console.log("FAIL: FMS Sheet AWB3 not updated correctly.");
        passed = false;
    }


    if (passed) {
        console.log("PASS: handleBulkAssign verification successful.");
    } else {
        console.log("Verification failed.");
        console.log("Final Shipments Data:", mockShipmentsData);
        console.log("Final FMS Data:", mockFmsData);
    }

} catch(e) {
    console.error("Execution Error:", e);
}


const fs = require('fs');

// Mock SpreadsheetApp and related classes
global.SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
        getSheetByName: (name) => {
            if (name === 'Shipments') return mockShipmentsSheet;
            if (name === 'Users') return mockUsersSheet;
            if (name === 'Sheet2') return mockDropdownSheet;
            if (name === 'Advance_Records') return mockAdvanceSheet;
            return null;
        },
        insertSheet: () => ({ getLastRow: () => 0, getMaxColumns: () => 35, insertColumnsAfter: () => {} }),
        openById: () => null // Mock remote SS as null/error
    }),
    openById: (id) => ({
        getSheetByName: (name) => {
            if (name === 'FMS') return mockFmsSheet;
            return null;
        }
    })
};

global.CacheService = {
    getScriptCache: () => ({
        get: () => null,
        put: () => {},
        remove: () => {}
    })
};

global.PropertiesService = {
    getScriptProperties: () => ({
        getProperty: () => 'true'
    })
};

global.ContentService = {
    createTextOutput: (str) => ({
        setMimeType: () => str // Return the raw JSON string directly as getAllData returns this
    }),
    MimeType: { JSON: 'JSON' }
};

// Mock Data
const mockShipmentsSheet = {
    getLastRow: () => 6,
    getMaxColumns: () => 40,
    insertColumnsAfter: () => {},
    getRange: (r, c, numR, numC) => ({
        getValues: () => {
            // Return raw rows (simulating sheet data)
            // Indices: 0=A, 8=I(Entry), 14=O(AutoStat), 15=P(AutoBy), 16=Q(PaperStat), 17=R(Assignee)
            return [
                // 1. Pending Paper, Unassigned (Q Empty), My Auto -> Should be in toAssign & adminPool
                ["AWB1", "Date", "Type", "Net", "Client", "Dest", "Box", "Extra", "UserEntry", "Time", "Act", "Vol", "Chg", "Rem", "Done", "UserAuto", "", "", "", "", "NetNo"],
                // 2. Pending Paper, Assigned (Q Assigned), My Auto -> Should NOT be in toAssign, NOT in adminPool
                ["AWB2", "Date", "Type", "Net", "Client", "Dest", "Box", "Extra", "UserEntry", "Time", "Act", "Vol", "Chg", "Rem", "Done", "UserAuto", "Assigned", "OtherUser", "", "", "NetNo"],
                 // 3. Pending Paper, Unassigned (Q Pending), My Auto -> Should be in toAssign & adminPool
                ["AWB3", "Date", "Type", "Net", "Client", "Dest", "Box", "Extra", "UserEntry", "Time", "Act", "Vol", "Chg", "Rem", "Done", "UserAuto", "Pending", "", "", "", "NetNo"],
                 // 4. Pending Paper, Unassigned, NOT My Auto -> Should NOT be in toAssign, Should be in adminPool
                ["AWB4", "Date", "Type", "Net", "Client", "Dest", "Box", "Extra", "UserEntry", "Time", "Act", "Vol", "Chg", "Rem", "Done", "OtherUser", "", "", "", "", "NetNo"],
                 // 5. Completed -> Should NOT be in either
                ["AWB5", "Date", "Type", "Net", "Client", "Dest", "Box", "Extra", "UserEntry", "Time", "Act", "Vol", "Chg", "Rem", "Done", "UserAuto", "Completed", "", "", "", "NetNo"],
            ].map(row => {
                // Pad to 35 columns
                while(row.length < 35) row.push("");
                return row;
            });
        },
        getDisplayValues: () => [] // Not used in this logic path hopefully
    })
};

const mockUsersSheet = {
    getLastRow: () => 2,
    getDataRange: () => ({
        getValues: () => [
            ["Header"],
            ["UserAuto", "Pass", "Name", "Staff", ""]
        ]
    })
};
const mockDropdownSheet = { getLastRow: () => 1, getRange: () => ({ getValues: () => [] }) };
const mockAdvanceSheet = {
    getLastRow: () => 1,
    getMaxColumns: () => 35,
    insertColumnsAfter: () => {},
    getRange: () => ({ getValues: () => [], getDisplayValues: () => [], getValue: () => "" })
};
const mockFmsSheet = null;

// Load Code.gs
const code = fs.readFileSync('Code.gs', 'utf8');
eval(code); // Load functions into global scope

// Run Test
try {
    const resultStr = getAllData("UserAuto");
    const result = JSON.parse(resultStr);

    // Result is {result:"success", message:"OK", ...data}
    const payload = result;

    console.log("Admin Pool IDs:", payload.adminPool.map(x => x.id));
    console.log("To Assign IDs:", payload.workflow.toAssign.map(x => x.id));

    // Assertions
    const adminIds = payload.adminPool.map(x => x.id);
    const staffIds = payload.workflow.toAssign.map(x => x.id);

    // Admin should see: AWB1 (Empty Q), AWB3 (Pending Q), AWB4 (Empty Q, Other Auto)
    // Should NOT see: AWB2 (Assigned Q), AWB5 (Completed)
    const expectedAdmin = ["AWB1", "AWB3", "AWB4"];

    // Staff (UserAuto) should see: AWB1, AWB3
    // Should NOT see: AWB2, AWB4 (Other Auto), AWB5
    const expectedStaff = ["AWB1", "AWB3"];

    const eq = (a, b) => JSON.stringify(a.sort()) === JSON.stringify(b.sort());

    if(eq(adminIds, expectedAdmin) && eq(staffIds, expectedStaff)) {
        console.log("PASS: Logic Verification Successful");
    } else {
        console.log("FAIL");
        console.log("Expected Admin:", expectedAdmin);
        console.log("Expected Staff:", expectedStaff);
    }

} catch(e) {
    console.error("Execution Error:", e);
}

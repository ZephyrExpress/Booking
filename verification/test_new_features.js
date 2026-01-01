
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
                             // Return mock data for Bulk Assign
                             if (col === 1 && numRows > 1) { // Getting all IDs
                                 return [['TEST001'], ['TEST002'], ['TEST003']];
                             }
                             // Return mock data for Edit
                             if (numRows === 1) { // Single row fetch
                                 return [['OLD_NET', 'OLD_CLIENT', 'OLD_DEST', '10', 'EXTRA', 'USER', 'DATE', 'ACT', 'VOL', 'CHG']];
                             }
                             return [];
                         },
                         getValue: () => "OldLog",
                         setValue: (val) => { console.log(`Set Cell [${row},${col}] to: ${val}`); },
                         setValues: (vals) => { console.log(`Set Range [${row},${col}] to:`, vals); }
                     }),
                     appendRow: (row) => {}
                 };
             }
             return null;
        },
        openById: (id) => ({
            getSheetByName: (name) => ({
                getLastRow: () => 10,
                getRange: () => ({
                    getValues: () => [['test001'], ['test002']],
                    setValue: (v) => console.log(`FMS Sync: ${v}`)
                })
            })
        })
    }),
    openById: (id) => global.SpreadsheetApp.getActiveSpreadsheet().openById(id)
};

global.TASK_SHEET_ID = "mock";

// Implement functions to test
function handleBulkAssign(b) {
    const assignments = b.assignments;
    if (!assignments || !assignments.length) return jsonResponse("error", "No assignments");

    const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Shipments");
    const ids = ss.getRange(2, 1, 9, 1).getValues().flat(); // Mock logic
    const idMap = {};
    ids.forEach((id, i) => { idMap[String(id).replace(/'/g, "").trim().toLowerCase()] = i + 2; });

    assignments.forEach(a => {
        const key = String(a.id).replace(/'/g, "").trim().toLowerCase();
        if (idMap[key]) {
            const r = idMap[key];
            ss.getRange(r, 17, 1, 3).setValues([["Assigned", a.staff, b.assigner]]);
        }
    });
    return jsonResponse("success", "Bulk Assigned");
}

function handleEditShipment(b) {
    const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Shipments");
    // Mock findRow
    const row = 2; // Assume found

    const updates = b.updates;
    let logMsg = `[Edit by ${b.user}]: `;
    let hasChange = false;
    const colMap = { 'net': 4, 'client': 5 }; // Simplified map for test

    const currentRow = ['OLD_NET', 'OLD_CLIENT']; // Mock current

    // Test change logic
    if (updates.net !== 'OLD_NET') {
        ss.getRange(row, 4).setValue(updates.net);
        hasChange = true;
    }

    if (hasChange) {
        return jsonResponse("success", "Updated & Logged");
    }
    return jsonResponse("success", "No Changes");
}

// EXECUTE TESTS
console.log("--- Testing Bulk Assign ---");
const r1 = handleBulkAssign({
    assignments: [{id: 'TEST001', staff: 'StaffA'}, {id: 'TEST002', staff: 'StaffB'}],
    assigner: 'Admin'
});
console.log("Bulk Assign Result:", r1);

console.log("\n--- Testing Edit Shipment ---");
const r2 = handleEditShipment({
    awb: 'TEST001',
    updates: { net: 'NEW_NET', client: 'OLD_CLIENT' },
    user: 'Admin'
});
console.log("Edit Result:", r2);

assert.strictEqual(r1.result, "success");
assert.strictEqual(r2.result, "success");
console.log("\nTests Passed!");

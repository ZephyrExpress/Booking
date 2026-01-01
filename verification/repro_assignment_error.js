
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
                             if (col === 1 && numRows > 1) { // Getting all IDs
                                 return [['TEST001'], ['TEST002'], ['TEST003']];
                             }
                             return [];
                         },
                         setValues: (vals) => { console.log(`Set Range [${row},${col}] to:`, vals); }
                     })
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

// Copy-paste the relevant function from Code.gs
function handleBulkAssign(b) {
    // ⚡ Bolt Fix: Parse stringified assignments
    if (typeof b.assignments === 'string') {
        try { b.assignments = JSON.parse(b.assignments); } catch(e){}
    }

    const assignments = b.assignments; // [{id, staff}, ...]
    if (!assignments || !Array.isArray(assignments) || !assignments.length) return jsonResponse("error", "No assignments");

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

// TEST CASE 1: Normal Array
console.log("--- Testing Array Input ---");
const r1 = handleBulkAssign({
    assignments: [{id: 'TEST001', staff: 'StaffA'}],
    assigner: 'Admin'
});
console.log("Array Result:", r1);
assert.strictEqual(r1.result, "success");

// TEST CASE 2: Stringified Array (The Bug Fix)
console.log("\n--- Testing Stringified Input ---");
const r2 = handleBulkAssign({
    assignments: JSON.stringify([{id: 'TEST002', staff: 'StaffB'}]),
    assigner: 'Admin'
});
console.log("String Result:", r2);
assert.strictEqual(r2.result, "success");

console.log("\nAll tests passed!");

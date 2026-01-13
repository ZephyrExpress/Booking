
const assert = require('assert');

// Mock SpreadsheetApp
const mockSheetData = [
    // Header Row (Standard Report Format - Simplified)
    ["AWB", "Date", "C2", "Dest", "C4", "Client", "C6", "C7", "C8", "C9", "C10", "C11", "C12", "C13", "C14", "C15", "C16", "C17", "C18", "Network", "NetNoTarget", "C21", "Type", "Boxes", "C24", "Vol", "ChgWgt"],
    // Data Row
    ["123", "2023-01-01", "", "USA", "", "ClientA", "", "", "", "", "", "", "", "", "", "", "", "", "", "DHL", "6666497445", "", "Ndox", "10", "", "", "5.5"]
];

function searchBulkData(netNo, data) {
    const headers = data[0].map(h => String(h).trim().toLowerCase());

    // Find Net No Column
    let cNetNo = headers.findIndex(h => h.includes("net no") || h.includes("network no"));
    let useStandardMap = false;

    // Fallback to Column U (Index 20) if not found by name
    if (cNetNo === -1) {
        // Check if we can fallback to Col 20
        if (headers.length > 20) {
             cNetNo = 20;
             useStandardMap = true;
        } else {
             return null;
        }
    }

    const target = String(netNo).trim().toLowerCase();

    for(let i=1; i<data.length; i++) {
        if(String(data[i][cNetNo]).trim().toLowerCase() === target) {
            const row = data[i];

            if (useStandardMap) {
                // Standard Map
                return {
                    awb: row[0],
                    date: row[1],
                    dest: row[3],
                    net: row[19],
                    netNo: row[20],
                    boxes: row[23],
                    wgt: row[26],
                    client: row[5]
                };
            } else {
                // Dynamic Map
                const getVal = (k) => {
                    const idx = headers.findIndex(h => h.includes(k));
                    return idx > -1 ? row[idx] : "";
                };

                return {
                    awb: getVal("awb"),
                    netNo: row[cNetNo]
                };
            }
        }
    }
    return null;
}

// Test 1: Fallback to U (header doesn't match "net no")
// Modify header to break "net no" match
mockSheetData[0][20] = "Carrier Ref";
const res = searchBulkData("6666497445", mockSheetData);
console.log("Test 1 Result:", res);
assert.ok(res, "Should find result via fallback");
assert.strictEqual(res.netNo, "6666497445");
assert.strictEqual(res.client, "ClientA");

console.log("Passed");

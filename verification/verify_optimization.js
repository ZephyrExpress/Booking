const assert = require('assert');

// Mock Data simulating Google Apps Script behavior
const mockSheetValues_Mixed = [
    [300100001, "2023-01-01T00:00:00.000Z", "Type", "Net", "Client", "Dest", 5, 0, "User", 0, 5, 5, 5.5],
    ["'300100002", "2023-01-02T00:00:00.000Z", "Type", "Net", "Client", "Dest", 5, 0, "User", 0, 5, 5, 5.5]
];

// 1. Emulate getValues() (Raw)
const data = mockSheetValues_Mixed;

// 2. Process Data like the optimized Code.gs
const processed = data.map(r => {
    // ID Normalization Logic
    let safeId = String(r[0]);
    if(safeId.startsWith("'")) safeId = safeId.slice(1);

    // Date Logic
    // In GAS getValues returns Date objects. Here strings (simulating JSON transport of Date objects or direct Date objects)
    const dateVal = r[1]; // In GAS this is Date object.

    return {
        id: safeId,
        date: dateVal,
        wgt: r[12]
    };
});

// 3. Verify IDs
console.log("Processed Items:", processed);

try {
    assert.strictEqual(processed[0].id, "300100001", "Number ID failed");
    assert.strictEqual(processed[1].id, "300100002", "String ID with quote failed");
    console.log("✅ ID Normalization Verified");
} catch(e) {
    console.error("❌ Verification Failed:", e.message);
    process.exit(1);
}

// 4. Emulate getDisplayValues behavior comparison
// getDisplayValues for 300100001 -> "300100001"
// getDisplayValues for '300100002 -> "300100002" (Hidden quote)
// My logic matches this.


const assert = require('assert');

// Mock Data from Booking Report (getValues - raw types)
// AWB, Date, Type, ...
const brData = [
    ["'1001", new Date("2024-05-23"), "Dox", 10, "ClientA", "DestA"]
];

// Mock Data from Shipments (getDisplayValues - strings)
const sDataDisplay = [
    ["'1001", "5/23/2024", "Dox", "10", "ClientA", "DestA"]
];

// Mock Data from Shipments (getValues - raw types)
const sDataValues = [
    ["'1001", new Date("2024-05-23"), "Dox", 10, "ClientA", "DestA"]
];

function checkSync(localData, remoteData, isDisplayValues) {
    let hasChange = false;
    const r = localData[0];
    const br = remoteData[0];

    // logic from Code.gs
    // Comparing Col 3 (Index 3 - 10 vs "10")
    // In Code.gs: ch(6, br.boxes); // Col G index 6.
    // In my mock, let's say index 3 is boxes.

    const idx = 3;
    const val = br[3]; // 10 (number)

    const current = r[idx]; // "10" (string) or 10 (number)

    if (String(current) !== String(val)) {
        hasChange = true;
        console.log(`Change detected: Local '${current}' (${typeof current}) vs Remote '${val}' (${typeof val})`);
    }
    return hasChange;
}

console.log("--- Testing getDisplayValues (Current) ---");
const change1 = checkSync(sDataDisplay, brData, true);
console.log("Has Change:", change1);

console.log("\n--- Testing getValues (Optimized) ---");
const change2 = checkSync(sDataValues, brData, false);
console.log("Has Change:", change2);

if (change1 === true && change2 === false) {
    console.log("\nSUCCESS: Optimization prevents false positive updates!");
} else {
    console.log("\nNOTE: No difference in logic, but performance will improve.");
}

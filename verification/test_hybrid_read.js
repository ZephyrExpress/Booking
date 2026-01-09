
// Mock Data
const mockDisplayValuesIds = [
    ["'00123"],
    ["300456"],
    ["'00789"]
];

const mockValuesRest = [
    [new Date("2023-01-01"), "TypeA", "Net1", "Client1", "Dest1"],
    [new Date("2023-01-02"), "TypeB", "Net2", "Client2", "Dest2"],
    [new Date("2023-01-03"), "TypeC", "Net3", "Client3", "Dest3"]
];

console.log("Mock Display IDs:", mockDisplayValuesIds);
console.log("Mock Values Rest:", mockValuesRest);

// Implementation Logic
const combinedData = mockValuesRest.map((r, i) => {
    // We want the ID from DisplayValues (col 0)
    // And the rest from Values (col 0... which corresponds to col 1 in sheet)
    // Wait, getValues(2, 2, rows, 32) returns columns B, C, D...
    // So row array index 0 is Col B.

    // Original data expected structure: [ColA, ColB, ColC...]
    // combinedData[i] should be [ ID_from_Display, ColB_from_Values, ColC_from_Values ... ]

    return [mockDisplayValuesIds[i][0], ...r];
});

console.log("\nCombined Data:");
combinedData.forEach(r => console.log(JSON.stringify(r)));

// Verification
const expectedId0 = "'00123";
const actualId0 = combinedData[0][0];

if (actualId0 !== expectedId0) {
    console.error(`FAIL: ID mismatch. Expected ${expectedId0}, got ${actualId0}`);
    process.exit(1);
}

if (!(combinedData[0][1] instanceof Date)) {
    console.error("FAIL: Date lost type");
    process.exit(1);
}

console.log("\nSUCCESS: Hybrid Read Logic Verified");

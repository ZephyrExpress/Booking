
// Simulate GAS behavior and Data Transformation

// Mock Data Row (Simulating getValues vs getDisplayValues)
const rawRow = [
    "12345", // 0: ID
    new Date("2023-10-25T00:00:00.000Z"), // 1: Date (Object)
    "Type", // 2
    "Net", // 3
    "Client", // 4
    "Dest", // 5
    5, // 6: Boxes (Number)
    "", // 7
    "User", // 8
    "", // 9
    10.5, // 10: Act (Number)
    11.2, // 11: Vol (Number)
    12.0, // 12: Chg (Number)
    "Rem", // 13
    // ...
    "", "", "", "", "", "", // 14-19
    "NetNo", // 20
    100.0, // 21: PayTotal
    50.0, // 22: PayPaid
    50.0, // 23: PayPending
    // ... rest
];

// Extend row to 35
while(rawRow.length < 35) rawRow.push("");
// Set hold date (col 34 / index 34)
rawRow[34] = new Date("2023-10-26T00:00:00.000Z");

const displayRow = [
    "12345",
    "25/10/2023", // String
    "Type",
    "Net",
    "Client",
    "Dest",
    "5",
    "",
    "User",
    "",
    "10.50",
    "11.20",
    "12.00",
    "Rem",
    // ...
    "","","","","","","",
    "NetNo",
    "100.00",
    "50.00",
    "50.00",
    // ...
];
while(displayRow.length < 35) displayRow.push("");
displayRow[34] = "26/10/2023";

const num = (v) => { const n = parseFloat(v); return isNaN(n) ? v : n.toFixed(2); };

// Logic 1: Current (DisplayValues)
const currentItem = {
    id: displayRow[0],
    date: displayRow[1], // String
    actWgt: displayRow[10], // String "10.50"
    chgWgt: displayRow[12], // String "12.00"
    payTotal: displayRow[21], // String "100.00"
    holdDate: displayRow[34]
};

// Logic 2: Proposed (Values + num())
const proposedItem = {
    id: String(rawRow[0]), // Ensure string
    date: rawRow[1], // Date Object -> JSON stringify will make it ISO string
    actWgt: num(rawRow[10]), // "10.50"
    chgWgt: num(rawRow[12]), // "12.00"
    payTotal: num(rawRow[21]), // "100.00"
    holdDate: rawRow[34]
};

console.log("Current:", JSON.stringify(currentItem));
console.log("Proposed:", JSON.stringify(proposedItem));

// Frontend Date Parsing Verification
const fmt = (d) => d ? new Date(d).toLocaleDateString() : '';

console.log("Fmt Current:", fmt(currentItem.date)); // "25/10/2023" -> Date -> "Invalid Date" in Node?
// Note: new Date("25/10/2023") is Invalid in V8 usually, but Chrome might handle it.
// GAS getDisplayValues depends on Locale.
// ISO string is safer.

console.log("Fmt Proposed:", fmt(proposedItem.date)); // ISO String -> Valid Date

// Weights
console.log("Wgt Current:", currentItem.chgWgt);
console.log("Wgt Proposed:", proposedItem.chgWgt);

if(currentItem.chgWgt === proposedItem.chgWgt) console.log("Weight Match: YES");
else console.log("Weight Match: NO");

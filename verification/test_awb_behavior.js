
const assert = require('assert');

// Case 1: Cell has value `'00123` (Quote prefix)
// getDisplayValues -> "00123" (The quote is hidden)
// getValues -> "00123" (The quote is hidden, returns string)
const cell1_display = "00123";
const cell1_value = "00123";

// Case 2: Cell has value `123` formatted as "00123"
// getDisplayValues -> "00123"
// getValues -> 123 (Number)
const cell2_display = "00123";
const cell2_value = 123;

// Normalization Logic
const norm = (v) => String(v).replace(/'/g, "").trim().toLowerCase();

console.log("Case 1 (Quote Prefix):");
console.log("Display Key:", norm(cell1_display));
console.log("Value Key:", norm(cell1_value));
console.log("Match?", norm(cell1_display) === norm(cell1_value));

console.log("\nCase 2 (Number Formatted):");
console.log("Display Key:", norm(cell2_display)); // "00123"
console.log("Value Key:", norm(cell2_value));     // "123"
console.log("Match?", norm(cell2_display) === norm(cell2_value));

if (norm(cell2_display) !== norm(cell2_value)) {
    console.log("\nCONCLUSION: getValues() breaks ID matching for numeric-formatted IDs!");
    console.log("ACTION: Must use getDisplayValues() for ID column.");
}

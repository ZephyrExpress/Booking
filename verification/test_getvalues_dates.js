
const assert = require('assert');

// Case 1: getDisplayValues returns String
const displayVal = "12/25/2023";
const jsonDisplay = JSON.stringify({ date: displayVal });
console.log("JSON from DisplayValue:", jsonDisplay);
// Frontend parse
const feDisplay = new Date(JSON.parse(jsonDisplay).date);
console.log("Frontend Date from DisplayValue:", feDisplay.toString());


// Case 2: getValues returns Date Object
// Note: Google Apps Script returns Date objects in Script Timezone.
// If Script is UTC, it returns UTC Date object.
// JSON.stringify converts Date to ISO String (UTC).
const dateObj = new Date("2023-12-25T00:00:00.000Z"); // Assume this is what GAS returns
const jsonValue = JSON.stringify({ date: dateObj });
console.log("JSON from Value (ISO):", jsonValue);
// Frontend parse
const feValue = new Date(JSON.parse(jsonValue).date);
console.log("Frontend Date from Value:", feValue.toString());

// Logic Check: comparison
const d1 = feDisplay.getTime();
const d2 = feValue.getTime();

// "12/25/2023" depends on local timezone of the machine running the code.
// ISO string is unambiguous.

// If `getValues` is used, we get precision.
console.log("Dates equal?", d1 === d2);

// Check logic used in getAllData
const getNormDate = (d) => new Date(d).setHours(0,0,0,0);

const normDisplay = getNormDate(displayVal);
const normValue = getNormDate(dateObj);

console.log("Norm Display:", normDisplay);
console.log("Norm Value:", normValue);

if (normDisplay === normValue) {
    console.log("SUCCESS: Date normalization logic works for both types.");
} else {
    console.log("WARNING: Date normalization might differ due to timezone interpretation.");
}

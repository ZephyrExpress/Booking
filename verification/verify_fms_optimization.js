
const assert = require('assert');

// Mock classes for Google Apps Script
class MockRange {
    constructor(row, col, numRows, numCols, sheet) {
        this.row = row;
        this.col = col;
        this.numRows = numRows;
        this.numCols = numCols;
        this.sheet = sheet;
        this.values = [];

        // Initialize values based on sheet data if available
        if (sheet.data) {
            for (let i = 0; i < numRows; i++) {
                const rowData = [];
                for (let j = 0; j < numCols; j++) {
                    const r = row + i - 1; // 0-based
                    const c = col + j - 1; // 0-based
                    if (sheet.data[r] && sheet.data[r][c] !== undefined) {
                        rowData.push(sheet.data[r][c]);
                    } else {
                        rowData.push("");
                    }
                }
                this.values.push(rowData);
            }
        }
    }

    getValues() {
        // Return deep copy
        return JSON.parse(JSON.stringify(this.values));
    }

    setValues(newValues) {
        this.sheet.setValuesCalls++;
        // Update mock data
        for (let i = 0; i < this.numRows; i++) {
            for (let j = 0; j < this.numCols; j++) {
                const r = this.row + i - 1;
                const c = this.col + j - 1;
                if (!this.sheet.data[r]) this.sheet.data[r] = [];
                this.sheet.data[r][c] = newValues[i][j];
            }
        }
    }

    setValue(val) {
        this.sheet.setValueCalls++;
        const r = this.row - 1;
        const c = this.col - 1;
        if (!this.sheet.data[r]) this.sheet.data[r] = [];
        this.sheet.data[r][c] = val;
    }
}

class MockSheet {
    constructor(name) {
        this.name = name;
        this.data = []; // 2D array
        this.setValueCalls = 0;
        this.setValuesCalls = 0;
        this.getRangeCalls = 0;
    }

    getLastRow() {
        return this.data.length;
    }

    getRange(row, col, numRows, numCols) {
        this.getRangeCalls++;
        return new MockRange(row, col, numRows, numCols, this);
    }
}

// Setup Data
const fms = new MockSheet("FMS");
// Fill mock data (Row 1-6 header, 7+ data)
// Col 2 (Index 1) is AWB
// Col 14 (Index 13) is Auto Doer
for (let i = 0; i < 20; i++) {
    const row = [];
    row[1] = `AWB${i}`; // AWB
    row[13] = `OldUser`; // AutoDoer
    fms.data[i+6] = row; // offset 6 (row 7)
}
// Ensure data length matches
fms.data.length = 26;

const fmsUpdates = [
    { awb: "awb0", autoDoer: "NewUser" },
    { awb: "awb5", autoDoer: "NewUser" },
    { awb: "awb10", autoDoer: "NewUser" }
];

// Original Logic Simulation
console.log("--- Testing Original Logic ---");
if(fms.getLastRow() >= 7) {
    const ids = fms.getRange(7, 2, fms.getLastRow()-6, 1).getValues().flat().map(x=>String(x).replace(/'/g,"").trim().toLowerCase());
    fmsUpdates.forEach(u => {
        const idx = ids.indexOf(u.awb.toLowerCase());
        if(idx > -1) {
            fms.getRange(idx+7, 14, 1, 1).setValue(u.autoDoer);
        }
    });
}
console.log(`Original: setValue calls: ${fms.setValueCalls}`);
console.log(`Original: setValues calls: ${fms.setValuesCalls}`);

assert.strictEqual(fms.setValueCalls, 3, "Original logic should call setValue 3 times");


// Reset Counters
fms.setValueCalls = 0;
fms.setValuesCalls = 0;
fms.getRangeCalls = 0;

// Reset Data
for (let i = 0; i < 20; i++) {
    fms.data[i+6][13] = `OldUser`;
}

// Optimized Logic Simulation
console.log("\n--- Testing Optimized Logic ---");

if(fms.getLastRow() >= 7) {
    const rangeHeight = fms.getLastRow() - 6;
    const ids = fms.getRange(7, 2, rangeHeight, 1).getValues().flat().map(x=>String(x).replace(/'/g,"").trim().toLowerCase());

    // Read current values of Col 14
    const col14Range = fms.getRange(7, 14, rangeHeight, 1);
    const col14Values = col14Range.getValues();
    let isModified = false;

    fmsUpdates.forEach(u => {
        const idx = ids.indexOf(u.awb.toLowerCase());
        if(idx > -1) {
            // Check if value actually changed
            if (col14Values[idx][0] !== u.autoDoer) {
                col14Values[idx][0] = u.autoDoer;
                isModified = true;
            }
        }
    });

    if (isModified) {
        col14Range.setValues(col14Values);
    }
}

console.log(`Optimized: setValue calls: ${fms.setValueCalls}`);
console.log(`Optimized: setValues calls: ${fms.setValuesCalls}`);

// Verifications
assert.strictEqual(fms.setValueCalls, 0, "Optimized logic should NOT call setValue");
assert.strictEqual(fms.setValuesCalls, 1, "Optimized logic should call setValues exactly ONCE");

// Verify Data Integrity
assert.strictEqual(fms.data[6][13], "NewUser", "Row 7 (Index 0) should be updated");
assert.strictEqual(fms.data[11][13], "NewUser", "Row 12 (Index 5) should be updated");
assert.strictEqual(fms.data[7][13], "OldUser", "Row 8 (Index 1) should NOT be updated");

console.log("\n✅ Verification Passed!");

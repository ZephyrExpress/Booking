
const fs = require('fs');

class MockRange {
    constructor(data, startRow, startCol, numRows, numCols) {
        this.data = data;
        this.startRow = startRow;
        this.startCol = startCol;
        this.numRows = numRows;
        this.numCols = numCols;
    }
    getValues() {
        // Return a slice of the data
        const res = [];
        for (let i = 0; i < this.numRows; i++) {
            const row = [];
            for (let j = 0; j < this.numCols; j++) {
                row.push(this.data[this.startRow + i][this.startCol + j]);
            }
            res.push(row);
        }
        return res;
    }
    setValues(values) {
        // Update the mock data
        for (let i = 0; i < values.length; i++) {
            for (let j = 0; j < values[i].length; j++) {
                this.data[this.startRow + i][this.startCol + j] = values[i][j];
            }
        }
    }
    getDisplayValues() {
        // Mock display values as strings
        const vals = this.getValues();
        return vals.map(row => row.map(cell => String(cell)));
    }
}

class MockSheet {
    constructor(name, data) {
        this.name = name;
        this.data = data || []; // Array of arrays
        this.readCount = 0;
    }
    getName() { return this.name; }
    getLastRow() { return this.data.length; }
    getRange(row, col, numRows, numCols) {
        // Google Apps Script is 1-indexed for getRange, but we use 0-indexed mock data
        this.readCount++;
        return new MockRange(this.data, row - 1, col - 1, numRows, numCols);
    }
    getDataRange() {
        this.readCount++;
        return new MockRange(this.data, 0, 0, this.data.length, this.data[0].length);
    }
}

class MockSS {
    constructor() {
        this.sheets = {};
    }
    getSheetByName(name) { return this.sheets[name]; }
    addSheet(name, data) { this.sheets[name] = new MockSheet(name, data); }
}

const mockSS = new MockSS();
const SpreadsheetApp = {
    getActiveSpreadsheet: () => mockSS,
    openById: (id) => mockSS
};
const CacheService = {
    getScriptCache: () => ({
        get: () => null,
        put: () => {},
        remove: () => {}
    })
};
const PropertiesService = {
    getScriptProperties: () => ({
        getProperty: () => 'true'
    })
};
const ContentService = {
    createTextOutput: (str) => ({ setMimeType: () => {} }),
    MimeType: { JSON: 'JSON' }
};

// --- DATA SETUP ---
// Create dummy data
// 300 rows, 31 columns
const shipData = [['Header', 'Header', ...Array(29).fill('Header')]];
for (let i = 0; i < 300; i++) {
    shipData.push([
        `AWB${i}`, new Date(), 'Regular', 'DHL', 'ClientX', 'USA',
        5, 'Extra', 'User1', '', 10, 10, 10, 'Rem',
        'Pending', 'AutoUser', 'Pending', 'Assignee', 'By', 'NetNo', '300100',
        100, 0, 100, '', '', '', 'On Hold', '', '', ''
    ]);
}
mockSS.addSheet("Shipments", shipData);
mockSS.addSheet("Sheet2", [['Net1', 'Client1', 'Dest1', 'Charge1', 'Reason1', 'Desc1']]);
mockSS.addSheet("Users", [['User', 'Pass', 'Name', 'Role', 'Perms'], ['user1', 'hash', 'User One', 'Staff', '']]);

// --- MOCK FUNCTION TO TEST ---
// We will paste the optimized logic here later manually or via test
// But for now let's just assert that our mock works.
console.log("Mock setup complete.");
const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Shipments");
console.log("Rows:", s.getLastRow());
const r = s.getRange(2, 1, 10, 31);
const v = r.getValues();
console.log("Read 10 rows:", v.length);
console.log("Read count:", s.readCount);

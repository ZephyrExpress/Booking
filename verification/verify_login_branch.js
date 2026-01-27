
const fs = require('fs');

global.SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
        getSheetByName: (name) => {
            if (name === 'Users') return mockUsersSheet;
            return null;
        }
    })
};

global.Utilities = {
    computeDigest: () => [1,2,3], // Mock hash
    DigestAlgorithm: { SHA_256: 'SHA_256' }
};

global.ContentService = {
    createTextOutput: (str) => ({
        setMimeType: () => JSON.parse(str) // Return parsed JSON for verification
    }),
    MimeType: { JSON: 'JSON' }
};

const mockUsersSheet = {
    getDataRange: () => ({
        getValues: () => [
            ["User", "PassHash", "Name", "Role", "Perms", "Branch"],
            ["testuser", "010203", "Test User", "Staff", "", "Mahipalpur"]
        ]
    }),
    getRange: () => ({ setValue: () => {} })
};

// Mock Helper functions (Code.gs defines its own, but we mock dependencies)
// Code.gs uses jsonResponse which uses ContentService.

// Load Code
const code = fs.readFileSync('Code.gs', 'utf8');
eval(code);

// Test
const res = handleLogin("testuser", "password");
console.log("Result:", JSON.stringify(res));

if (res.branch === "Mahipalpur") {
    console.log("PASS: Branch returned correctly");
} else {
    console.log("FAIL: Branch missing or incorrect");
}

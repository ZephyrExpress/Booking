
const assert = require('assert');
const fs = require('fs');

// Mock SpreadsheetApp
global.SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
        getSheetByName: (name) => {
            if (name === 'Users') {
                return {
                    getDataRange: () => ({
                        getValues: () => [
                            ['Username', 'Password', 'Name', 'Role', 'Permissions'],
                            ['manoj ', 'hash123', 'Manoj Kumar', 'Owner', ''] // Note the space in username
                        ]
                    }),
                    getLastRow: () => 2
                };
            }
            if (name === 'Shipments') return { getLastRow: () => 1 };
            if (name === 'Sheet2') return { getLastRow: () => 1 };
            if (name === 'Requests') return { getLastRow: () => 1 };
            return null;
        }
    }),
    openById: () => ({ getSheetByName: () => null }) // Mock Task SS
};

global.CacheService = {
    getScriptCache: () => ({
        get: () => null,
        put: () => {},
        remove: () => {}
    })
};

global.PropertiesService = {
    getScriptProperties: () => ({
        getProperty: () => 'true'
    })
};

global.ContentService = {
    createTextOutput: (str) => ({ setMimeType: () => str }),
    MimeType: { JSON: 'JSON' }
};

global.Utilities = {
    computeDigest: () => [],
    DigestAlgorithm: { SHA_256: 'SHA_256' }
};

// Load Code.gs
const code = fs.readFileSync('Code.gs', 'utf8');
eval(code);

// Test 1: User Map Caching and Trim
console.log("Testing getAllData with spaced username 'Manoj '...");

// Mock handleLogin to show it works
// const loginRes = JSON.parse(handleLogin('Manoj ', 'any')); // Pass/hash mocking skipped, assume match logic in loop
// We can't easily mock the hash check without implementing hashString fully in mock,
// but we care about getAllData which uses getUserMap

// Test getAllData
const res = JSON.parse(getAllData('Manoj'));
console.log("Result:", res);

assert.strictEqual(res.result, "success");
assert.strictEqual(res.role, "Owner");
console.log("SUCCESS: User matched despite casing/trim issues via getUserMap");

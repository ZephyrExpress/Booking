
// Create a fake event object
const e = {
    parameter: {
        action: 'login',
        username: 'testuser',
        password: 'password'
    }
};

// Mock Services
const LockService = {
    getScriptLock: () => ({
        tryLock: () => true,
        releaseLock: () => {}
    })
};

const HtmlService = {
    createTemplateFromFile: () => ({
        evaluate: () => ({
            setTitle: () => ({
                setXFrameOptionsMode: () => ({
                    addMetaTag: () => {}
                })
            })
        }),
        XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }
    })
};

const ContentService = {
    createTextOutput: (str) => ({
        setMimeType: () => str
    }),
    MimeType: { JSON: 'JSON' }
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
        getProperty: () => 'true',
        setProperty: () => {}
    })
};

const Utilities = {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    computeDigest: (algo, str) => [1, 2, 3] // Mock hash
};

const SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
        getSheetByName: () => ({
            getDataRange: () => ({ getValues: () => [] }),
            getLastRow: () => 0,
            getRange: () => ({ getValues: () => [], setValue: () => {}, setValues: () => {} }),
            appendRow: () => {}
        })
    }),
    openById: () => ({
        getSheetByName: () => ({
            getLastRow: () => 0,
            getRange: () => ({ getValues: () => [], setValue: () => {} })
        })
    }),
    Dimension: { ROWS: 'ROWS' }
};

// Load code
const fs = require('fs');
const code = fs.readFileSync('Code.gs', 'utf8');

// Wrap in IIFE to run
try {
    eval(code);
    console.log("Code.gs syntax is valid.");
} catch (e) {
    console.error("Syntax Error in Code.gs:", e);
    process.exit(1);
}

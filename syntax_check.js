
const fs = require('fs');
const code = fs.readFileSync('Code.gs', 'utf8');

// Mock GAS globals to prevent reference errors during basic execution/syntax check
const LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };
const SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: () => ({ getDataRange: () => ({ getValues: () => [] }) }) }) };
const PropertiesService = { getScriptProperties: () => ({ getProperty: () => '' }) };
const CacheService = { getScriptCache: () => ({ get: () => null, put: () => {}, remove: () => {} }) };
const ContentService = { createTextOutput: () => ({ setMimeType: () => {} }), MimeType: { JSON: 'json' } };
const Utilities = { computeDigest: () => [], DigestAlgorithm: { SHA_256: 'SHA_256' } };
const HtmlService = { createTemplateFromFile: () => ({ evaluate: () => ({ setTitle: () => ({ setXFrameOptionsMode: () => ({ addMetaTag: () => {} }) }) }) }), XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' } };

// Evaluate code to check for syntax errors
try {
    eval(code);
    console.log("Syntax OK");
} catch (e) {
    console.error("Syntax Error:", e);
    process.exit(1);
}

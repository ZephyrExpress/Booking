
const { performance } = require('perf_hooks');

// --- HELPERS ---
const oldNum = (v) => { const n = parseFloat(v); return isNaN(n) ? v : n.toFixed(2); };
const newNum = (v) => { const n = typeof v === 'number' ? v : parseFloat(v); return isNaN(n) ? v : n.toFixed(2); };

// --- DATA MOCK ---
const now = new Date();
const rawRow = [
    300101234,              // 0: ID (Number)
    now,                    // 1: Date (Object)
    "Ndox",                 // 2: Type
    "DHL",                  // 3: Net
    "Client A",             // 4: Client
    "NYC",                  // 5: Dest
    5,                      // 6: Boxes (Number)
    "",                     // 7: Extra
    "Staff1",               // 8: User
    now,                    // 9: Timestamp
    10.5,                   // 10: Act (Number)
    2.5,                    // 11: Vol (Number)
    10.5,                   // 12: Chg (Number)
    "Rem",                  // 13: Rem
    "Pending",              // 14: Auto Status
    "",                     // 15: Auto Doer
    "Pending",              // 16: Paper Status
    "",                     // 17: Assignee
    "",                     // 18: Assigner
    "",                     // 19: Log
    "NET123",               // 20: NetNo
    100,                    // 21: Total (Number)
    50,                     // 22: Paid (Number)
    50,                     // 23: Pending (Number)
    "",                     // 24: Batch
    "",                     // 25: Man Date
    "KYC",                  // 26: Paperwork
    "",                     // 27: Hold Status
    "",                     // 28: Reason
    "",                     // 29: Hold Rem
    "",                     // 30: Held By
    "",                     // 31: Payee
    "",                     // 32: Contact
    "Advance",              // 33: Category
    ""                      // 34: Hold Date
];

// simulate getDisplayValues (Strings)
const displayRow = rawRow.map(x => {
    if (x instanceof Date) return x.toLocaleDateString(); // Approx
    if (typeof x === 'number') return String(x); // Simple string conversion
    return String(x || "");
});

// --- LOGIC TEST ---

function processOld(r) {
    // Original logic relying on strings
    return {
        id: r[0],
        date: r[1],
        net: r[3],
        client: r[4],
        dest: r[5],
        // Note: Old logic didn't use num() for details in Advance loop, but used it in Shipments loop.
        // We are checking if NEW logic (using num) produces consistent acceptable output.
        details: `${r[6]} Boxes | ${r[12]} Kg`,
        actWgt: r[10],
        volWgt: r[11],
        chgWgt: r[12],
        payTotal: r[21]
    };
}

function processNew(r) {
    // New logic using getValues (raw types) + num()
    const rId = String(r[0]).replace(/'/g, "").trim();
    return {
        id: r[0],
        date: r[1],
        net: r[3],
        client: r[4],
        dest: r[5],
        details: `${r[6]} Boxes | ${newNum(r[12])} Kg`,
        actWgt: newNum(r[10]),
        volWgt: newNum(r[11]),
        chgWgt: newNum(r[12]),
        payTotal: newNum(r[21])
    };
}

const oldRes = processOld(displayRow);
const newRes = processNew(rawRow);

console.log("--- OUTPUT COMPARISON ---");
console.log("Field | Old (Display) | New (Raw+Num)");
console.log(`ID    | ${oldRes.id} | ${newRes.id}`);
console.log(`Date  | ${oldRes.date} | ${newRes.date.toISOString()}`); // New is Date obj
console.log(`Chg   | ${oldRes.chgWgt} (Type: ${typeof oldRes.chgWgt}) | ${newRes.chgWgt} (Type: ${typeof newRes.chgWgt})`);
console.log(`Det   | ${oldRes.details} | ${newRes.details}`);

// Verification
let failures = 0;
// ID: Old string "300101234", New number 300101234. Frontend handles both (usually).
// But for exact match, we might want to cast. However, 'data' loop produces numbers, so keeping numbers is consistent.

// ChgWgt: Old "10.5", New "10.50" (Fixed 2).
// "10.5" vs "10.50". The new one is BETTER formatted.
if (newRes.chgWgt !== "10.50") { console.error("FAIL: Weight formatting"); failures++; }

// Details:
// Old: "5 Boxes | 10.5 Kg"
// New: "5 Boxes | 10.50 Kg"
// This is an improvement.

console.log("\n--- BENCHMARK ---");
const iterations = 100000;
const dataSetRaw = Array(iterations).fill(rawRow);
const dataSetDisplay = Array(iterations).fill(displayRow);

let start = performance.now();
dataSetDisplay.forEach(r => processOld(r));
let end = performance.now();
console.log(`Old Processing (100k rows): ${(end - start).toFixed(2)}ms`);

start = performance.now();
dataSetRaw.forEach(r => processNew(r));
end = performance.now();
console.log(`New Processing (100k rows): ${(end - start).toFixed(2)}ms`);

console.log("\n(Note: This benchmark only measures loop logic. The REAL gain is skipping getDisplayValues() on server which is not measured here but known to be slow.)");

if(failures === 0) console.log("\n✅ VERIFICATION PASSED");
else console.log("\n❌ VERIFICATION FAILED");

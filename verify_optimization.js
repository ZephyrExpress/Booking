const { performance } = require('perf_hooks');

// Mock Data
const staticData = {
    staff: Array.from({length: 50}, (_, i) => `Staff Member ${i}`)
};

const data = Array.from({length: 10000}, (_, i) => ({
    15: `Staff Member ${Math.floor(Math.random() * 60)}`, // AutoDoer (some valid, some not)
    17: `Staff Member ${Math.floor(Math.random() * 60)}`, // Assignee
    35: 'Naraina Vihar'
}));

const shiftStartTime = 0; // Simulate all passing

// OLD WAY
function runOld() {
    const start = performance.now();
    const staffMap = {};
    data.forEach(r => {
        // Only relevant part
        const allowedStaff = (staticData.staff || []).map(s => String(s).trim().toLowerCase());

        const autoDoer = String(r[15]).trim();
        if (autoDoer && allowedStaff.includes(autoDoer.toLowerCase())) {
            staffMap[autoDoer] = (staffMap[autoDoer] || 0) + 1;
        }

        const assignee = String(r[17]).trim();
        if (assignee && allowedStaff.includes(assignee.toLowerCase())) {
            staffMap[assignee] = (staffMap[assignee] || 0) + 1;
        }
    });
    return performance.now() - start;
}

// NEW WAY
function runNew() {
    const start = performance.now();
    const staffMap = {};

    // Optimization
    const allowedStaffSet = new Set((staticData.staff || []).map(s => String(s).trim().toLowerCase()));

    data.forEach(r => {
        const autoDoer = String(r[15]).trim();
        if (autoDoer && allowedStaffSet.has(autoDoer.toLowerCase())) {
            staffMap[autoDoer] = (staffMap[autoDoer] || 0) + 1;
        }

        const assignee = String(r[17]).trim();
        if (assignee && allowedStaffSet.has(assignee.toLowerCase())) {
            staffMap[assignee] = (staffMap[assignee] || 0) + 1;
        }
    });
    return performance.now() - start;
}

console.log("Running Benchmark (10,000 iterations)...");
const oldTime = runOld();
const newTime = runNew();

console.log(`Old Way: ${oldTime.toFixed(2)}ms`);
console.log(`New Way: ${newTime.toFixed(2)}ms`);
console.log(`Speedup: ${(oldTime / newTime).toFixed(2)}x`);

if (newTime < oldTime) {
    console.log("SUCCESS: Optimization verified.");
} else {
    console.error("FAILURE: Optimization failed.");
    process.exit(1);
}

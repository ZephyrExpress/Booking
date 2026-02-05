
const { performance } = require('perf_hooks');

const iterations = 1000000;
const testValues = [10.5, 0, 100.234, "12.5", "", "abc", 5];

function originalNum(v) {
  const n = parseFloat(v);
  return isNaN(n) ? v : n.toFixed(2);
}

function optimizedNum(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isNaN(n) ? v : n.toFixed(2);
}

// Test correctness first
console.log("Correctness Check:");
testValues.forEach(v => {
    const o1 = originalNum(v);
    const o2 = optimizedNum(v);
    if (o1 !== o2) console.error(`Mismatch for ${v}: ${o1} vs ${o2}`);
});

console.log("\nPerformance Test:");

let start = performance.now();
for (let i = 0; i < iterations; i++) {
    for (let v of testValues) {
        originalNum(v);
    }
}
let end = performance.now();
console.log(`Original: ${(end - start).toFixed(2)}ms`);

start = performance.now();
for (let i = 0; i < iterations; i++) {
    for (let v of testValues) {
        optimizedNum(v);
    }
}
end = performance.now();
console.log(`Optimized: ${(end - start).toFixed(2)}ms`);

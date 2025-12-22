
const performance = {
  now: () => Date.now()
};

// Mock Data
const createMockData = (count) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `AWB${i}`,
    netNo: `NET${i}`,
    client: `Client ${i}`,
    net: `Network ${i}`,
    dest: `Dest ${i}`,
    chgWgt: 10,
    holdStatus: i % 10 === 0 ? "On Hold" : "Active"
  }));
};

const APP_DATA = {
  overview: {
    auto: createMockData(100),
    paper: createMockData(100)
  },
  holdings: createMockData(500),
  manifest: createMockData(100000) // 100k items
};

const awb = "NON_EXISTENT"; // Worst case
const netSearch = "";

console.log("Starting Benchmark (Worst Case - 100k items)...");

// Method 1: Current Implementation (Spread)
const start1 = performance.now();
for (let i = 0; i < 100; i++) {
    const all = [...APP_DATA.overview.auto, ...APP_DATA.overview.paper, ...APP_DATA.holdings, ...APP_DATA.manifest];
    const match = all.find(x => (awb && x.id.toLowerCase().includes(awb.toLowerCase())) || (netSearch && x.netNo && x.netNo.toLowerCase().includes(netSearch)));
}
const end1 = performance.now();
console.log(`Method 1 (Spread): ${(end1 - start1).toFixed(2)}ms`);

// Method 2: Optimized (Loop)
const start2 = performance.now();
for (let i = 0; i < 100; i++) {
    let match = null;
    const sources = [APP_DATA.overview.auto, APP_DATA.overview.paper, APP_DATA.holdings, APP_DATA.manifest];
    for (const source of sources) {
        match = source.find(x => (awb && x.id.toLowerCase().includes(awb.toLowerCase())) || (netSearch && x.netNo && x.netNo.toLowerCase().includes(netSearch)));
        if (match) break;
    }
}
const end2 = performance.now();
console.log(`Method 2 (Loop): ${(end2 - start2).toFixed(2)}ms`);

console.log(`Speedup: ${(end1 - start1) / (end2 - start2)}x`);

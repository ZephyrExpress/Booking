
// Simulation of the backend optimization logic
const assert = require('assert');

function testOptimization() {
    console.log("Testing Backend Optimization Logic...");

    // Mock Data (Display Values from Sheet)
    // Cols: 0=AWB, 14=Status, 15=User, 20=NetNo
    let data = [
        ['101', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Pending', 'OldUser', '', '', '', '', 'OldNet'],
        ['102', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Completed', 'User2', '', '', '', '', 'Net2'],
        ['103', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''], // Empty/Pending
    ];

    const brMap = {
        '101': { user: 'NewUser', netNo: 'NewNet' },
        '103': { user: 'System', netNo: 'AutoNet' }
    };

    let updates = [];

    // ORIGINAL LOOP LOGIC
    data.forEach((r, i) => {
        const awb = String(r[0]).trim();
        const autoStatus = r[14];
        if((autoStatus === "Pending" || autoStatus === "") && brMap[awb]) {
             const match = brMap[awb];
             // Modify IN PLACE
             r[14] = "Done";
             r[15] = match.user;
             r[20] = match.netNo;

             updates.push({ row: i+2 }); // Tracking that update happened
        }
    });

    // Check In-Place Modifications
    assert.strictEqual(data[0][14], "Done");
    assert.strictEqual(data[0][15], "NewUser");
    assert.strictEqual(data[0][20], "NewNet");

    assert.strictEqual(data[1][14], "Completed"); // Should not change
    assert.strictEqual(data[1][15], "User2");

    assert.strictEqual(data[2][14], "Done");
    assert.strictEqual(data[2][15], "System");
    assert.strictEqual(data[2][20], "AutoNet");

    console.log("In-place modification verified.");

    // OPTIMIZATION LOGIC (Extract Columns)
    if(updates.length > 0) {
        const col15_16 = data.map(r => [r[14], r[15]]);
        const col21 = data.map(r => [r[20]]);

        // Verify Output for Bulk Write
        assert.strictEqual(col15_16[0][0], "Done");
        assert.strictEqual(col15_16[0][1], "NewUser");
        assert.strictEqual(col15_16[1][0], "Completed"); // Preserves existing
        assert.strictEqual(col15_16[2][0], "Done");

        assert.strictEqual(col21[0][0], "NewNet");
        assert.strictEqual(col21[1][0], "Net2"); // Preserves existing
        assert.strictEqual(col21[2][0], "AutoNet");

        console.log("Bulk write arrays generated correctly.");
    }

    console.log("Backend Logic Verified successfully.");
}

testOptimization();

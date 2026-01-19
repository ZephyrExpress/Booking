// Simulate GAS environment behavior
function simulate() {
    // Mock getValues() output (Raw data)
    // ID (with '), Date (Obj), Type, Net, Client, Dest, Boxes, Extra, User, Time, Act, Vol, Chg, Rem, ..., NetNo (Num), Pay...
    const rawRow = [
        "'30010001", new Date("2024-05-23"), "Ndox", "DHL", "ClientA", "DEL",
        2, "", "User1", new Date(),
        5.1, 5.2, 5.5, "Rem",
        "Pending", "Doer", "", "", "", "",
        12345, // NetNo as Number
        100, 50, 50 // Payments as Numbers
    ];

    // Helper from Code.gs (Copied here for verification)
    const num = (v) => { const n = parseFloat(v); return isNaN(n) ? v : n.toFixed(2); };

    // Proposed Transformation (Matching Code.gs patch)
    const rId = String(rawRow[0]).replace(/'/g, "").trim();

    // Simulate loop scope
    const r = rawRow;

    const item = {
        id: rId,
        date: r[1],
        net: r[3],
        details: `${r[6]} Boxes | ${num(r[12])} Kg`,
        chgWgt: num(r[12]),
        netNo: String(r[20] || ""),
        payTotal: num(r[21]),
    };

    console.log("ID:", item.id, typeof item.id);
    console.log("NetNo:", item.netNo, typeof item.netNo);
    console.log("ChgWgt:", item.chgWgt, typeof item.chgWgt);
    console.log("Details:", item.details);
    console.log("Date:", item.date);

    // Assertions
    if (item.id !== "30010001") throw new Error("ID Failed");
    if (item.netNo !== "12345") throw new Error("NetNo Failed");
    if (typeof item.netNo !== "string") throw new Error("NetNo Type Failed");
    if (item.chgWgt !== "5.50") throw new Error("ChgWgt Failed");
    if (item.details !== "2 Boxes | 5.50 Kg") throw new Error("Details Failed");

    console.log("✅ Logic Verified");
}

simulate();

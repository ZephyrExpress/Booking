import re

# Read the broken file
with open('index.html', 'r') as f:
    content = f.read()

# Split the content to find the start of the main script block
# We know the main script starts around line 497 with "const API_URL"
# But we want to preserve everything up to window.printManifest
split_marker = "window.printManifest = function() {"
parts = content.split(split_marker)

if len(parts) < 2:
    print("Could not find window.printManifest marker")
    exit(1)

pre_manifest = parts[0]

# Define the missing/broken functions
fixed_functions = """
window.printManifest = function() {
    const net = document.getElementById('man_net').value || "ALL";
    const items = [];
    document.querySelectorAll('.batch-check:checked').forEach(c => {
        const item = window.APP_DATA.manifest.find(x => x.id === c.value);
        if(item) items.push(item);
    });

    if(items.length === 0) return alert("Select items to print");

    const rows = items.map((x, i) => `
        <tr>
            <td>${i+1}</td>
            <td>${x.id}</td>
            <td>${new Date(x.date).toLocaleDateString()}</td>
            <td>${x.dest}</td>
            <td>${x.net}</td>
            <td>${x.netNo||'-'}</td>
            <td>${x.boxes}</td>
            <td>${x.chgWgt}</td>
            <td>${(x.client||'').slice(-4)}</td>
        </tr>
    `).join('');

    const w = window.open('', '_blank');
    w.document.write(`
        <html><head><title>Manifest Print</title>
        <style>
            body { font-family: sans-serif; padding: 20px; font-size: 12px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .header-left { text-align: left; }
            .header-right { text-align: right; }
            .logo { max-height: 40px; margin-bottom: 5px; }
            h2 { margin: 0; font-size: 1.5rem; text-decoration: underline; }
            .meta { margin-bottom: 20px; font-size: 0.9rem; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ccc; padding: 5px; text-align: left; }
            th { background: #eee; font-weight: bold; text-transform: uppercase; }
            .footer { margin-top: 40px; display: flex; justify-content: space-between; padding-top: 20px; border-top: 1px solid #000; }
            @media print { .no-print { display: none; } }
        </style>
        </head><body>
        <div class="header">
            <div class="header-left">
                <h2>MANIFEST</h2>
                <div class="meta">Network: <strong>${net}</strong><br>Date: ${new Date().toLocaleDateString()}</div>
            </div>
            <div class="header-right">
                <div style="font-size:1.2rem; font-weight:bold;">ZEPHYR EXPRESS</div>
            </div>
        </div>
        <table>
            <thead><tr><th>#</th><th>AWB</th><th>Date</th><th>Dest</th><th>Network</th><th>Net No</th><th>Pcs</th><th>Wgt</th><th>Client</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
        <div class="footer">
            <div>Authorized Signatory</div>
            <div>Handover By</div>
        </div>
        <script>window.print();</script>
        </body></html>
    `);
    w.document.close();
};

window.downloadManifestPdf = function(items, network) {
    if(!items || !items.length) return;
    const doc = new jspdf.jsPDF({orientation: 'p', unit: 'mm', format: 'a4'});
    const pageWidth = doc.internal.pageSize.getWidth();
    const dateStr = new Date().toLocaleDateString();

    if(typeof LOGO_BASE64 !== 'undefined' && LOGO_BASE64) {
        doc.addImage(LOGO_BASE64, 'PNG', (pageWidth/2) - 20, 10, 40, 15);
    }

    doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text("MANIFEST", 10, 35);
    doc.setFontSize(10); doc.text(`Network: ${network}`, 10, 42);
    doc.setFont("helvetica", "normal"); doc.text(`Date: ${dateStr}`, pageWidth - 40, 42);

    const tableBody = items.map((x, i) => [
        i + 1, x.id, new Date(x.date).toLocaleDateString(), x.dest, x.boxes, x.chgWgt, (x.client || '').slice(-4)
    ]);

    doc.autoTable({
        startY: 48,
        head: [['#', 'AWB', 'Date', 'Dest', 'Pcs', 'Wgt', 'Client']],
        body: tableBody,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 10 }, 4: { cellWidth: 15 }, 5: { cellWidth: 20 } }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    const totalPcs = items.reduce((sum, x) => sum + (parseFloat(x.boxes) || 0), 0);
    const totalWgt = items.reduce((sum, x) => sum + (parseFloat(x.chgWgt) || 0), 0).toFixed(2);

    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("SUMMARY", 10, finalY);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Total Shipments: ${items.length}`, 10, finalY + 6);
    doc.text(`Total Boxes: ${totalPcs}`, 60, finalY + 6);
    doc.text(`Total Weight: ${totalWgt} KG`, 110, finalY + 6);

    doc.line(10, finalY + 25, 60, finalY + 25); doc.text("Authorized Signatory", 10, finalY + 30);
    doc.line(pageWidth - 60, finalY + 25, pageWidth - 10, finalY + 25); doc.text("Handover By", pageWidth - 60, finalY + 30);
    doc.save(`Manifest_${network}_${dateStr.replace(/\//g,'-')}.pdf`);
};

window.createBatch = async function() {
    const net = document.getElementById('man_net').value;
    if(!net) return alert("Select Network");
    const chks = document.querySelectorAll('.batch-check:checked');
    if(chks.length === 0) return alert("Select at least one item");
    const ids = Array.from(chks).map(c => c.value);
    const batchId = `${net}-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*1000)}`;
    const manifestDate = new Date().toLocaleDateString();
    if(!confirm(`Create Manifest "${batchId}" for ${ids.length} items?`)) return;

    const selectedItems = [];
    window.APP_DATA.manifest.forEach(x => {
        if(ids.includes(x.id)) { x.batchNo = batchId; x.manifestDate = manifestDate; selectedItems.push(x); }
    });

    window.downloadManifestPdf(selectedItems, net);
    if (typeof exportBatch === "function") exportBatch(batchId);
    renderManifest();
    await callApi({ action: 'updateManifestBatch', batchNo: batchId, ids: ids, date: manifestDate, network: net, user: curUser });
    toast("Manifest Created & PDF Generated");
};

window.downloadReceiverPdf = function(id) {
    const data = window.lastPrintData;
    if(!data || data.shipment.id !== id) return alert("Error: Data mismatch. Please close and re-open.");
    const s = data.shipment;
    const doc = new jspdf.jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const halfHeight = doc.internal.pageSize.getHeight() / 2;

    const drawCopy = (offsetY, title) => {
        // Logo if available
        // if(typeof LOGO_BASE64 !== 'undefined' && LOGO_BASE64) doc.addImage(LOGO_BASE64, 'PNG', pageWidth - 50, offsetY + 10, 40, 15);
        doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text("ZEPHYR EXPRESS", 10, offsetY + 15);
        doc.setFontSize(9); doc.setFont("helvetica", "normal");
        doc.text("CB-385B, Ring Road Nariana, New Delhi-110028", 10, offsetY + 20);
        doc.text("Ph: 9873127666 | www.zephyrexpress.in", 10, offsetY + 24);

        doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text(title, 10, offsetY + 32);
        doc.setLineWidth(0.5); doc.line(10, offsetY + 34, pageWidth - 10, offsetY + 34);

        try {
            const canvas = document.createElement("canvas");
            JsBarcode(canvas, s.id, { format: "CODE128", displayValue: false });
            doc.addImage(canvas.toDataURL("image/png"), 'PNG', pageWidth - 50, offsetY + 26, 40, 8);
        } catch(e) {}

        const startY = offsetY + 40;
        const col1 = 12; const col2 = 105;
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold"); doc.text("AWB NO:", col1, startY); doc.setFont("helvetica", "normal"); doc.text(s.id, col1 + 25, startY);
        doc.setFont("helvetica", "bold"); doc.text("DATE:", col1, startY + 5); doc.setFont("helvetica", "normal"); doc.text(new Date(s.date).toLocaleDateString(), col1 + 25, startY + 5);
        doc.setFont("helvetica", "bold"); doc.text("DEST:", col1, startY + 15); doc.setFont("helvetica", "normal"); doc.text(s.dest, col1 + 25, startY + 15);
        doc.setFont("helvetica", "bold"); doc.text("RECEIVER:", col2, startY); doc.setFont("helvetica", "normal"); doc.text(s.user, col2 + 25, startY);
        doc.setFont("helvetica", "bold"); doc.text("NETWORK:", col2, startY + 5); doc.setFont("helvetica", "normal"); doc.text(s.net, col2 + 25, startY + 5);
        doc.setFont("helvetica", "bold"); doc.text("CLIENT:", col2, startY + 10); doc.setFont("helvetica", "normal"); doc.text(s.client, col2 + 25, startY + 10);
        doc.setFont("helvetica", "bold"); doc.text("CONTENT:", col2, startY + 15); doc.setFont("helvetica", "normal"); doc.text(s.type, col2 + 25, startY + 15);

        const summaryY = startY + 25;
        doc.setLineWidth(0.2); doc.rect(10, summaryY, pageWidth - 20, 25); doc.line(10, summaryY + 8, pageWidth - 20, summaryY + 8);
        doc.setFont("helvetica", "bold");
        doc.text("TOTAL BOXES", 15, summaryY + 6); doc.text("ACTUAL WGT", 65, summaryY + 6);
        doc.text("VOLUME WGT", 115, summaryY + 6); doc.text("CHARGEABLE WGT", 165, summaryY + 6);
        doc.setFontSize(11); doc.setFont("helvetica", "normal");
        doc.text(String(s.boxes), 15, summaryY + 18); doc.text(String(s.actWgt) + " KG", 65, summaryY + 18); doc.text(String(s.volWgt) + " KG", 115, summaryY + 18);
        doc.setFont("helvetica", "bold"); doc.text(String(s.chgWgt) + " KG", 165, summaryY + 18);

        const finalY = summaryY + 35;
        doc.setFontSize(9); doc.setFont("helvetica", "normal");
        doc.text(`Payment: Total: ${s.payTotal} | Paid: ${s.payPaid}`, 10, finalY);
        doc.setFont("helvetica", "bold"); doc.setTextColor(200, 0, 0); doc.text(`Pending: ${s.payPending}`, 110, finalY); doc.setTextColor(0);

        doc.setFont("helvetica", "normal"); doc.setFontSize(7);
        doc.text(doc.splitTextToSize("TERMS & CONDITIONS: By accepting this shipment, the sender/receiver agrees to the standard terms. Zephyr Express assumes no liability for delay/loss beyond control. Claims within 24 hours.", pageWidth - 20), 10, finalY + 6);

        doc.setFontSize(9);
        doc.line(10, finalY + 20, 60, finalY + 20); doc.text("Sender Signature", 10, finalY + 24);
        doc.line(pageWidth - 60, finalY + 20, pageWidth - 10, finalY + 20); doc.text("Receiver Signature", pageWidth - 60, finalY + 24);
    };

    drawCopy(0, "RECEIVERS SLIP (CONSIGNEE)");
    doc.setLineDash([2, 2], 0); doc.line(0, halfHeight, pageWidth, halfHeight); doc.setLineDash([], 0);
    drawCopy(halfHeight, "ACCOUNTS COPY (POD)");
    doc.save(`Slip_${s.id}.pdf`);
};

</script>
</body>
</html>
"""

# Write the reconstructed file
with open('index.html', 'w') as f:
    f.write(pre_manifest + fixed_functions)

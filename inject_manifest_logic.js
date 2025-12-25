
window.downloadManifestPdf = function(items, network) {
    if(!items || !items.length) return;

    const doc = new jspdf.jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();

    // -- HEADER --
    const dateStr = new Date().toLocaleDateString();

    // Logo (Centered)
    if(LOGO_BASE64) {
        doc.addImage(LOGO_BASE64, 'PNG', (pageWidth/2) - 20, 10, 40, 15);
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("MANIFEST", 10, 35);

    doc.setFontSize(10);
    doc.text(`Network: ${network}`, 10, 42);

    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${dateStr}`, pageWidth - 40, 42);

    // -- TABLE --
    // Columns: S.No, AWB, Date, Dest, Pcs, Wgt, Client
    // Data Preparation
    const tableBody = items.map((x, i) => [
        i + 1,
        x.id,
        new Date(x.date).toLocaleDateString(),
        x.dest,
        x.boxes,
        x.chgWgt,
        (x.client || '').slice(-4)
    ]);

    doc.autoTable({
        startY: 48,
        head: [['#', 'AWB', 'Date', 'Dest', 'Pcs', 'Wgt', 'Client']],
        body: tableBody,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
        columnStyles: {
            0: { cellWidth: 10 }, // #
            4: { cellWidth: 15 }, // Pcs
            5: { cellWidth: 20 }, // Wgt
        }
    });

    // -- FOOTER / TOTALS --
    const finalY = doc.lastAutoTable.finalY + 10;

    // Calculate Totals
    const totalPcs = items.reduce((sum, x) => sum + (parseFloat(x.boxes) || 0), 0);
    const totalWgt = items.reduce((sum, x) => sum + (parseFloat(x.chgWgt) || 0), 0).toFixed(2);
    const totalCount = items.length;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("SUMMARY", 10, finalY);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Shipments: ${totalCount}`, 10, finalY + 6);
    doc.text(`Total Boxes: ${totalPcs}`, 60, finalY + 6);
    doc.text(`Total Weight: ${totalWgt} KG`, 110, finalY + 6);

    // Signatures
    doc.line(10, finalY + 25, 60, finalY + 25);
    doc.text("Authorized Signatory", 10, finalY + 30);

    doc.line(pageWidth - 60, finalY + 25, pageWidth - 10, finalY + 25);
    doc.text("Handover By", pageWidth - 60, finalY + 30);

    doc.save(`Manifest_${network}_${dateStr.replace(/\//g,'-')}.pdf`);
}

window.createBatch = async function() {
    const net = document.getElementById('man_net').value;
    if(!net) return alert("Select Network");

    const chks = document.querySelectorAll('.batch-check:checked');
    if(chks.length === 0) return alert("Select at least one item");

    const ids = Array.from(chks).map(c => c.value);
    const batchId = `${net}-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*1000)}`;
    const manifestDate = new Date().toLocaleDateString();

    if(!confirm(`Create Manifest "${batchId}" for ${ids.length} items?`)) return;

    // Collect items for PDF before clearing local state or logic
    const selectedItems = [];
    window.APP_DATA.manifest.forEach(x => {
        if(ids.includes(x.id)) {
            x.batchNo = batchId;
            x.manifestDate = manifestDate;
            selectedItems.push(x);
        }
    });

    // Auto Generate PDF
    downloadManifestPdf(selectedItems, net);

    // Update Backend
    exportBatch(batchId); // Keep Excel export? User didn't say remove it, but "Create manifest button will auto generate PDF". I will keep Excel as backup unless it conflicts. User said "Create manifest button will auto generate PDF", didn't explicitly say "Stop Excel". I'll keep it.
    renderManifest();
    await callApi({ action: 'updateManifestBatch', batchNo: batchId, ids: ids, date: manifestDate, network: net, user: curUser });
    toast("Manifest Created & PDF Generated");
};


import re

# The correct function definitions we want to ensure are in the file
js_logic = r"""
// --- PDF & API LOGIC ---

// Use URLSearchParams for application/x-www-form-urlencoded
async function callApi(d){
    try {
        console.log("Calling API:", d.action);
        const params = new URLSearchParams();
        for (const key in d) {
            if (typeof d[key] === 'object' && d[key] !== null) {
                params.append(key, JSON.stringify(d[key]));
            } else {
                params.append(key, d[key]);
            }
        }
        const r = await fetch(API_URL, {
            method: "POST",
            body: params,
        });
        const json = await r.json();
        console.log("API Response:", json);
        return json;
    } catch(e) {
        console.error("API Error:", e);
        if (d.action === "login") {
             alert("Login Failed: Network Error.\n\nIf you are running this locally, ensure:\n1. You have deployed the Google Apps Script as a Web App.\n2. You updated the API_URL in index.html to YOUR deployment URL.\n3. The deployment allows 'Anyone' or 'Anyone with Account' access.");
        }
        return { result: "error", message: e.toString() };
    }
}

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
    if(typeof LOGO_BASE64 !== 'undefined' && LOGO_BASE64) {
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
            0: { cellWidth: 10 },
            4: { cellWidth: 15 },
            5: { cellWidth: 20 },
        }
    });

    // -- FOOTER / TOTALS --
    const finalY = doc.lastAutoTable.finalY + 10;

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

    const selectedItems = [];
    window.APP_DATA.manifest.forEach(x => {
        if(ids.includes(x.id)) {
            x.batchNo = batchId;
            x.manifestDate = manifestDate;
            selectedItems.push(x);
        }
    });

    downloadManifestPdf(selectedItems, net);

    exportBatch(batchId);
    renderManifest();
    await callApi({ action: 'updateManifestBatch', batchNo: batchId, ids: ids, date: manifestDate, network: net, user: curUser });
    toast("Manifest Created & PDF Generated");
};

window.downloadReceiverPdf = function(id) {
    const data = window.lastPrintData;
    if(!data || data.shipment.id !== id) return alert("Error: Data mismatch. Please close and re-open.");

    const s = data.shipment;
    const doc = new jspdf.jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const halfHeight = pageHeight / 2;

    const drawCopy = (offsetY, title) => {
        if(typeof LOGO_BASE64 !== 'undefined' && LOGO_BASE64) {
            doc.addImage(LOGO_BASE64, 'PNG', pageWidth - 50, offsetY + 10, 40, 15);
        }

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("ZEPHYR EXPRESS", 10, offsetY + 15);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("CB-385B, Ring Road Nariana, New Delhi-110028", 10, offsetY + 20);
        doc.text("Ph: 9873127666 | www.zephyrexpress.in", 10, offsetY + 24);

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(title, 10, offsetY + 32);
        doc.setLineWidth(0.5);
        doc.line(10, offsetY + 34, pageWidth - 10, offsetY + 34);

        try {
            const canvas = document.createElement("canvas");
            JsBarcode(canvas, s.id, { format: "CODE128", displayValue: false });
            const barcodeData = canvas.toDataURL("image/png");
            doc.addImage(barcodeData, 'PNG', pageWidth - 50, offsetY + 26, 40, 8);
        } catch(e) { console.error("Barcode Error", e); }

        const startY = offsetY + 40;
        const col1 = 12;
        const col2 = 105;

        doc.setFontSize(9);

        doc.setFont("helvetica", "bold"); doc.text("AWB NO:", col1, startY);
        doc.setFont("helvetica", "normal"); doc.text(s.id, col1 + 25, startY);

        doc.setFont("helvetica", "bold"); doc.text("DATE:", col1, startY + 5);
        doc.setFont("helvetica", "normal"); doc.text(new Date(s.date).toLocaleDateString(), col1 + 25, startY + 5);

        doc.setFont("helvetica", "bold"); doc.text("ORIGIN:", col1, startY + 10);
        doc.setFont("helvetica", "normal"); doc.text("DEL (Delhi)", col1 + 25, startY + 10);

        doc.setFont("helvetica", "bold"); doc.text("DEST:", col1, startY + 15);
        doc.setFont("helvetica", "normal"); doc.text(s.dest, col1 + 25, startY + 15);

        doc.setFont("helvetica", "bold"); doc.text("RECEIVER:", col2, startY);
        doc.setFont("helvetica", "normal"); doc.text(s.user, col2 + 25, startY);

        doc.setFont("helvetica", "bold"); doc.text("NETWORK:", col2, startY + 5);
        doc.setFont("helvetica", "normal"); doc.text(s.net, col2 + 25, startY + 5);

        doc.setFont("helvetica", "bold"); doc.text("CLIENT:", col2, startY + 10);
        doc.setFont("helvetica", "normal"); doc.text(s.client, col2 + 25, startY + 10);

        doc.setFont("helvetica", "bold"); doc.text("CONTENT:", col2, startY + 15);
        doc.setFont("helvetica", "normal"); doc.text(s.type, col2 + 25, startY + 15);

        const summaryY = startY + 25;
        doc.setLineWidth(0.2);
        doc.rect(10, summaryY, pageWidth - 20, 25);
        doc.line(10, summaryY + 8, pageWidth - 20, summaryY + 8);

        doc.setFont("helvetica", "bold");
        doc.text("TOTAL BOXES", 15, summaryY + 6);
        doc.text("ACTUAL WGT", 65, summaryY + 6);
        doc.text("VOLUME WGT", 115, summaryY + 6);
        doc.text("CHARGEABLE WGT", 165, summaryY + 6);

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text(String(s.boxes), 15, summaryY + 18);
        doc.text(String(s.actWgt) + " KG", 65, summaryY + 18);
        doc.text(String(s.volWgt) + " KG", 115, summaryY + 18);

        doc.setFont("helvetica", "bold");
        doc.text(String(s.chgWgt) + " KG", 165, summaryY + 18);

        const finalY = summaryY + 35;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Payment: Total: ${s.payTotal} | Paid: ${s.payPaid}`, 10, finalY);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(200, 0, 0);
        doc.text(`Pending: ${s.payPending}`, 110, finalY);
        doc.setTextColor(0);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        const disclaimer = "TERMS & CONDITIONS (DISCLAIMER): By accepting this shipment, the sender/receiver agrees to the standard terms and conditions of carriage. Zephyr Express assumes no liability for delay, loss, or damage caused by circumstances beyond control. Claims must be notified within 24 hours.";
        const splitText = doc.splitTextToSize(disclaimer, pageWidth - 20);
        doc.text(splitText, 10, finalY + 6);

        doc.setFontSize(9);
        doc.line(10, finalY + 20, 60, finalY + 20);
        doc.text("Sender Signature", 10, finalY + 24);

        doc.line(pageWidth - 60, finalY + 20, pageWidth - 10, finalY + 20);
        doc.text("Receiver Signature", pageWidth - 60, finalY + 24);
    };

    drawCopy(0, "RECEIVERS SLIP (CONSIGNEE)");

    doc.setLineDash([2, 2], 0);
    doc.line(0, halfHeight, pageWidth, halfHeight);
    doc.setLineDash([], 0);

    drawCopy(halfHeight, "ACCOUNTS COPY (POD)");

    doc.save(`Slip_${s.id}.pdf`);
}
"""

with open('index.html', 'r') as f:
    content = f.read()

# 1. Clean up <script src="...">...</script> garbage
# We replace <script src="X">blah</script> with <script src="X"></script>
# Using regex.
# Pattern: <script src="([^"]+)"[^>]*?>([\s\S]*?)</script>
# If group 2 is not empty/whitespace, replace.
# Note: attributes like defer might be there.
content = re.sub(r'(<script\s+src="[^"]+"[^>]*>)([\s\S]*?)(</script>)', r'\1\3', content)

# 2. Remove any PREVIOUS duplicate definitions of our functions from the main script block
# to ensure we don't have old versions lingering.
# We'll just remove them if found.
for func in ['async function callApi', 'window.downloadManifestPdf', 'window.createBatch', 'window.downloadReceiverPdf']:
    # This is a bit risky if using simple replace, but the main block is at the end.
    # Actually, simpler: finding the main <script> tag (which has no src) and replacing the end of it.
    pass

# 3. Inject the logic into the main script block
# Find the last <script> tag that does NOT have src
# The main script block starts with <script> and ends with </script> at the bottom of the file.
# It contains `const API_URL`.
match = re.search(r'(<script>\s*const API_URL[\s\S]*?)(</script>)', content)
if match:
    main_script_content = match.group(1)

    # Strip out old versions of functions we are about to inject to avoid duplicates/syntax errors
    # Regex to remove entire function blocks is hard.
    # Instead, let's just append the new logic at the end of the script block.
    # JS allows redefining functions (last one wins).
    # BUT, syntax errors happen if the previous injection was malformed (e.g. inside strings or weird places).
    # Since we cleaned the src tags in step 1, the syntax errors from those (e.g. `window.download...` inside `<script src=...` which is invalid HTML/JS context) should be gone.
    # The syntax errors reported by user (Booking/:1 ...) were likely due to the browser parsing the src script tag weirdly.

    # We will just append the new logic.
    new_script_content = main_script_content + "\n" + js_logic

    content = content.replace(match.group(0), new_script_content + "\n</script>")

with open('index.html', 'w') as f:
    f.write(content)

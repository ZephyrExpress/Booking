
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

    // Function to draw one copy (Receiver or Accounts)
    const drawCopy = (offsetY, title) => {
        // -- HEADER --
        // Logo
        if(LOGO_BASE64) {
            doc.addImage(LOGO_BASE64, 'PNG', pageWidth - 50, offsetY + 10, 40, 15); // Right aligned logo
        }

        // Company Details (Left)
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("ZEPHYR EXPRESS", 10, offsetY + 15);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("CB-385B, Ring Road Nariana, New Delhi-110028", 10, offsetY + 20);
        doc.text("Ph: 9873127666 | www.zephyrexpress.in", 10, offsetY + 24);

        // Title (Centered-ish or Below)
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(title, 10, offsetY + 32);
        doc.setLineWidth(0.5);
        doc.line(10, offsetY + 34, pageWidth - 10, offsetY + 34);

        // -- BARCODE (Generated via Canvas then Image) --
        try {
            const canvas = document.createElement("canvas");
            JsBarcode(canvas, s.id, { format: "CODE128", displayValue: false });
            const barcodeData = canvas.toDataURL("image/png");
            doc.addImage(barcodeData, 'PNG', pageWidth - 50, offsetY + 26, 40, 8);
        } catch(e) { console.error("Barcode Error", e); }

        // -- GRID DATA --
        // 2 Columns
        const startY = offsetY + 40;
        const col1 = 12;
        const col2 = 105;

        doc.setFontSize(9);

        // Col 1
        doc.setFont("helvetica", "bold"); doc.text("AWB NO:", col1, startY);
        doc.setFont("helvetica", "normal"); doc.text(s.id, col1 + 25, startY);

        doc.setFont("helvetica", "bold"); doc.text("DATE:", col1, startY + 5);
        doc.setFont("helvetica", "normal"); doc.text(new Date(s.date).toLocaleDateString(), col1 + 25, startY + 5);

        doc.setFont("helvetica", "bold"); doc.text("ORIGIN:", col1, startY + 10);
        doc.setFont("helvetica", "normal"); doc.text("DEL (Delhi)", col1 + 25, startY + 10);

        doc.setFont("helvetica", "bold"); doc.text("DEST:", col1, startY + 15);
        doc.setFont("helvetica", "normal"); doc.text(s.dest, col1 + 25, startY + 15);

        // Col 2
        doc.setFont("helvetica", "bold"); doc.text("RECEIVER:", col2, startY);
        doc.setFont("helvetica", "normal"); doc.text(s.user, col2 + 25, startY);

        doc.setFont("helvetica", "bold"); doc.text("NETWORK:", col2, startY + 5);
        doc.setFont("helvetica", "normal"); doc.text(s.net, col2 + 25, startY + 5);

        doc.setFont("helvetica", "bold"); doc.text("CLIENT:", col2, startY + 10);
        doc.setFont("helvetica", "normal"); doc.text(s.client, col2 + 25, startY + 10);

        doc.setFont("helvetica", "bold"); doc.text("CONTENT:", col2, startY + 15);
        doc.setFont("helvetica", "normal"); doc.text(s.type, col2 + 25, startY + 15);

        // -- SUMMARY TABLE REPLACEMENT --
        // No detail table. Just Totals.
        const summaryY = startY + 25;

        doc.setLineWidth(0.2);
        doc.rect(10, summaryY, pageWidth - 20, 25);
        doc.line(10, summaryY + 8, pageWidth - 20, summaryY + 8); // Header line

        // Headers
        doc.setFont("helvetica", "bold");
        doc.text("TOTAL BOXES", 15, summaryY + 6);
        doc.text("ACTUAL WGT", 65, summaryY + 6);
        doc.text("VOLUME WGT", 115, summaryY + 6);
        doc.text("CHARGEABLE WGT", 165, summaryY + 6);

        // Values
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text(String(s.boxes), 15, summaryY + 18);
        doc.text(String(s.actWgt) + " KG", 65, summaryY + 18);
        doc.text(String(s.volWgt) + " KG", 115, summaryY + 18);

        doc.setFont("helvetica", "bold");
        doc.text(String(s.chgWgt) + " KG", 165, summaryY + 18);

        const finalY = summaryY + 35;

        // Payment Info
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Payment: Total: ${s.payTotal} | Paid: ${s.payPaid}`, 10, finalY);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(200, 0, 0); // Red
        doc.text(`Pending: ${s.payPending}`, 110, finalY);
        doc.setTextColor(0); // Reset

        // Disclaimer & Footer
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        const disclaimer = "TERMS & CONDITIONS (DISCLAIMER): By accepting this shipment, the sender/receiver agrees to the standard terms and conditions of carriage. Zephyr Express assumes no liability for delay, loss, or damage caused by circumstances beyond control. Claims must be notified within 24 hours.";
        const splitText = doc.splitTextToSize(disclaimer, pageWidth - 20);
        doc.text(splitText, 10, finalY + 6);

        // Signatures
        doc.setFontSize(9);
        doc.line(10, finalY + 20, 60, finalY + 20); // Sender Line
        doc.text("Sender Signature", 10, finalY + 24);

        doc.line(pageWidth - 60, finalY + 20, pageWidth - 10, finalY + 20); // Receiver Line
        doc.text("Receiver Signature", pageWidth - 60, finalY + 24);
    };

    // Draw Top Half
    drawCopy(0, "RECEIVERS SLIP (CONSIGNEE)");

    // Draw Separator Line (Dashed)
    doc.setLineDash([2, 2], 0);
    doc.line(0, halfHeight, pageWidth, halfHeight);
    doc.setLineDash([], 0); // Reset

    // Draw Bottom Half
    drawCopy(halfHeight, "ACCOUNTS COPY (POD)");

    doc.save(`Slip_${s.id}.pdf`);
}

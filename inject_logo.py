
import base64
import os

# 1. Read Logo and Convert to Base64
with open('logo.png', 'rb') as f:
    logo_data = f.read()
    logo_b64 = base64.b64encode(logo_data).decode('utf-8')
    logo_uri = f"data:image/png;base64,{logo_b64}"

# 2. Read index.html
with open('index.html', 'r') as f:
    html = f.read()

# 3. Libraries to Add
libraries = """
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js"></script>
"""

# Insert libraries before </head>
html = html.replace('</head>', f'{libraries}\n</head>')

# 4. Remove Password Reveal Logic
# Find: <td style="cursor:pointer; font-family:monospace;" onclick="togglePass(this)" data-pass="${u.pass||''}">****</td>
# Replace with: <td style="font-family:monospace;">****</td>
html = html.replace(
    '<td style="cursor:pointer; font-family:monospace;" onclick="togglePass(this)" data-pass="${u.pass||\'\'}">****</td>',
    '<td style="font-family:monospace;">****</td>'
)

# Remove togglePass function
html = html.replace(
    """window.togglePass=function(el){
    const pass = el.getAttribute('data-pass');
    if(!pass) return toast("Password not available", "warning");
    el.textContent = el.textContent === '****' ? pass : '****';
}""",
    ""
)

# 5. Replace "Print Slip" button
html = html.replace(
    '<button class="btn btn-dark" onclick="openPrintReceipt(\'${d.id}\')"><i class="bi bi-printer-fill me-2"></i>Print Slip</button>',
    '<button class="btn btn-danger" onclick="downloadReceiverPdf(\'${d.id}\')"><i class="bi bi-file-pdf-fill me-2"></i>Download PDF</button>'
)

# 6. Add Logo Constant and PDF Logic
# We will append this to the script block.
# We need to find where to insert. Let's replace 'window.openPrintReceipt = ...' with the new logic.

new_js_logic = f"""
const LOGO_BASE64 = "{logo_uri}";

window.downloadReceiverPdf = function(id) {{
    const data = window.lastPrintData;
    if(!data || data.shipment.id !== id) return alert("Error: Data mismatch. Please close and re-open.");

    const s = data.shipment;
    const doc = new jspdf.jsPDF({{
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    }});

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const halfHeight = pageHeight / 2;

    // Function to draw one copy (Receiver or Accounts)
    const drawCopy = (offsetY, title) => {{
        // -- HEADER --
        // Logo
        if(LOGO_BASE64) {{
            doc.addImage(LOGO_BASE64, 'PNG', pageWidth - 50, offsetY + 10, 40, 15); // Right aligned logo
        }}

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
        try {{
            const canvas = document.createElement("canvas");
            JsBarcode(canvas, s.id, {{ format: "CODE128", displayValue: false }});
            const barcodeData = canvas.toDataURL("image/png");
            doc.addImage(barcodeData, 'PNG', pageWidth - 50, offsetY + 26, 40, 8);
        }} catch(e) {{ console.error("Barcode Error", e); }}

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

        // -- TABLE --
        // Use autoTable
        const tableBody = data.boxes.map(x => [
            x.no,
            x.l + 'x' + x.b + 'x' + x.h,
            x.vol,
            x.wgt,
            x.chg
        ]);

        // Footer Row for Table
        const footRow = [['', '', 'TOTAL:', s.actWgt, s.chgWgt]];

        doc.autoTable({{
            startY: startY + 22,
            head: [['Box #', 'Dim (LxBxH)', 'Vol Wgt', 'Act Wgt', 'Chg Wgt']],
            body: tableBody,
            foot: footRow,
            theme: 'grid',
            styles: {{ fontSize: 8, cellPadding: 1 }},
            headStyles: {{ fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' }},
            footStyles: {{ fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold' }},
            margin: {{ left: 10, right: 10 }}
        }});

        const finalY = doc.lastAutoTable.finalY + 5;

        // Payment Info
        doc.setFontSize(9);
        doc.text(`Payment: Total: ${{s.payTotal}} | Paid: ${{s.payPaid}}`, 10, finalY);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(200, 0, 0); // Red
        doc.text(`Pending: ${{s.payPending}}`, 110, finalY);
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
    }};

    // Draw Top Half
    drawCopy(0, "RECEIVERS SLIP (CONSIGNEE)");

    // Draw Separator Line (Dashed)
    doc.setLineDash([2, 2], 0);
    doc.line(0, halfHeight, pageWidth, halfHeight);
    doc.setLineDash([], 0); // Reset

    // Draw Bottom Half
    drawCopy(halfHeight, "ACCOUNTS COPY (POD)");

    doc.save(`Slip_${{s.id}}.pdf`);
}}
"""

# Replace the old print function with new logic
# We use a regex or string find/replace carefully.
# The old function starts with "window.openPrintReceipt = function(id) {" and ends before "window.toggleAllMan"? No.
# Let's verify the content structure.
# I will use a placeholder replacement for safety or just append it and delete the old one.
# To be clean, let's remove the old function block completely.

import re

# Regex to remove window.openPrintReceipt = function(id) { ... }
# This is risky with regex on multiline code.
# Instead, I will append the new function at the end of the script block and comment out/remove the old call site.
# Wait, I already replaced the button onclick. So the old function is dead code.
# But I should remove it to clean up and avoid confusion.
# I'll replace the block.

pattern = r"window\.openPrintReceipt\s*=\s*function\s*\(id\)\s*\{[\s\S]*?^\}"
# This regex is tricky because of nested braces.
# Simplest approach: overwrite the file with the new function appended, and I'll accept having the old dead function there
# OR I can just replace the definition line "window.openPrintReceipt = function(id) {" with "window.openPrintReceipt_OLD = ..."
# and append the new one.
# Better: Replace the entire old function string if I can match it exactly.

# Actually, I'll just append the new function at the end of the <script> block.
# And I already updated the button to call `downloadReceiverPdf`.

html = html.replace('</script>\n</body>', f'{new_js_logic}\n</script>\n</body>')

with open('index.html', 'w') as f:
    f.write(html)

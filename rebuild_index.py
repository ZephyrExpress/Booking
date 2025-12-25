
import re

# Read the corrupted index.html
with open('index.html', 'r') as f:
    content = f.read()

# 1. Extract the main parts

# Extract CSS links
css_links = re.findall(r'<link rel="stylesheet"[^>]*>|<link href="[^"]+" rel="stylesheet">', content)
# Ensure we have unique links and specific order if possible (Bootstrap first)
unique_css = []
seen_css = set()
for link in css_links:
    if link not in seen_css:
        unique_css.append(link)
        seen_css.add(link)

# Extract JS Libraries (CDN links)
# We want to keep: sheetjs, html5-qrcode, jsbarcode, jspdf, jspdf-autotable, bootstrap-js, tom-select-js
# And ensure they are CLEAN (no inner content)
js_srcs = re.findall(r'<script src="([^"]+)"', content)
unique_js_srcs = []
seen_js = set()
# Filter relevant libraries
allowed_libs = ['sheetjs', 'html5-qrcode', 'jsbarcode', 'jspdf', 'bootstrap', 'tom-select']
for src in js_srcs:
    if any(lib in src.lower() for lib in allowed_libs) and src not in seen_js:
        unique_js_srcs.append(src)
        seen_js.add(src)

# Extract the Body Content (HTML)
# We need to grab everything between <body> and the start of the final script tag
# BUT, the file is messy.
# Strategy: Find the start of <body>. Find the start of the main script logic.
# The main script logic usually starts with `const API_URL`.
body_start_match = re.search(r'<body[^>]*>', content)
body_start_idx = body_start_match.end() if body_start_match else 0

# Find where the actual JS logic starts.
# Looking at the file, there is a large script block at the end starting with `const API_URL`.
# However, due to corruption, there might be multiple copies.
# We will regenerate the JS logic from our known source of truth (the previous injection scripts + base logic).
# So we just need to extract the HTML structure: Navbar, Sidebar, Containers, Modals.
# These seem to be intact between <body> and the first <script> that is NOT a library import?
# Or just finding the <script> that contains API_URL.

script_start_match = re.search(r'<script>\s*const API_URL', content)
if script_start_match:
    html_content = content[body_start_idx:script_start_match.start()]
else:
    # Fallback: finding the last </script> and taking everything before it? No.
    # The file has <script src=..>GARBAGE</script> scattered.
    # We need to regex replace all <script> tags from the body area.
    # Ideally, the HTML part is static.
    # Let's extract everything from <body> to </body>, then remove all <script> tags from it.
    body_match = re.search(r'<body[^>]*>(.*?)</body>', content, re.DOTALL)
    if body_match:
        html_raw = body_match.group(1)
        # Remove all script tags and their content from HTML area
        html_content = re.sub(r'<script[\s\S]*?</script>', '', html_raw)
        # Also remove the spinner overlay if it was duplicate (it's not).
    else:
        html_content = "<!-- Error extracting body -->"

# 2. Reconstruct the file

# Define the Javascript Logic (Clean Copy)
# I will combine the base logic + the PDF/Manifest functions I wrote.
# I need to ensure I don't lose `doLogin`, `syncData`, etc.
# I will extract the logic from the file but clean it up.
# Extract the block containing `const API_URL` until the end of that specific script tag.
js_block = ""
if script_start_match:
    # Find the closing tag for this specific script block
    rest_of_file = content[script_start_match.start():]
    # This might be messy if there are nested scripts (invalidly).
    # But usually the main block is distinct.
    # Let's blindly grab everything from `const API_URL` down to `window.createBatch` etc.
    # Actually, I have the code from previous turns. I should just inject the known good code + extract the existing UI handlers.

    # Let's try to extract the specific functions:
    # doLogin, logout, refreshApp, syncData, updateNavVisibility, renderUI, renderTaskHub,
    # renderHoldings, searchHoldings, clearHoldSearch, openHoldModal, submitHoldFromModal,
    # startScanner, onScanSuccess, stopScanner, actClearHold, actRTO, submitActionFromModal,
    # changeRole, updatePerms, savePerms, renderAdminPanel, actAssign, actDirectTransfer, actComplete,
    # switchTab, initForms, updDd, fillSel, toggleAllPaperwork, exportOverview,
    # submit (shipForm), resetForm, chkDox, genBoxes, cBox, cPay, manDd, delDd, addUser, delUser, changePass, decideTr, reloadFrame, exportPool,
    # switchManifestView, renderManifest, openAddHistoryModal, ahmAdd, printManifest, toggleAllMan, createBatch,
    # renderManifestHistory, exportBatch, generateAwb, submitCorrection, renderReceivers, toggleRc, exportReceiverExcel, chkStype, toggleAutoAwb, openHoldAction, hamClear, hamSubmit, hamRTO, viewRc, openPrintReceipt(replaced?), downloadReceiverPdf, downloadManifestPdf.

    # That is A LOT. It is safer to take the existing block and "clean" it of HTML tags if any.
    # The corruption was: <script src="..."> JS CODE </script>
    # The main <script> block at the end seemed "mostly" okay in the `read_file` output, EXCEPT it had `window.downloadManifestPdf` appended multiple times or weirdly.

    # Strategy:
    # 1. Take the text from `const API_URL` to the last `</script>`.
    # 2. Remove any `<script...>` or `</script>` tags appearing *inside* it (if any).
    # 3. Dedup functions if possible? Or just trust JS to overwrite.

    start_idx = script_start_match.start()
    end_match = re.search(r'</script>\s*</body>', content)
    end_idx = end_match.start() if end_match else len(content)

    raw_js = content[start_idx:end_idx]

    # Remove script tags from within JS (if they were pasted in)
    raw_js = re.sub(r'<script[^>]*>', '', raw_js)
    raw_js = re.sub(r'</script>', '', raw_js)

    # Identify key variables to ensure we don't duplicate `const API_URL` which causes syntax error if declared twice.
    # Actually `const` redeclaration is a SyntaxError.
    # So we must ensure we only have one instance of the base logic.
    # The `read_file` showed multiple `window.downloadManifestPdf` blocks appended.
    # I will extract the "Base" JS (from API_URL to the end of the original file before my injections) and then append my clean injections.

    # Splitting by "window.downloadManifestPdf =" might help separate the base from appended junk.
    parts = raw_js.split("window.downloadManifestPdf =")
    base_js = parts[0] # This should contain the original app logic

    # My clean PDF logic (from previous plan)
    pdf_logic = r"""
// --- PDF & LOGIC ---

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
        if(ids.includes(x.id)) { x.batchNo = batchId; x.manifestDate = manifestDate; selectedItems.push(x); }
    });

    downloadManifestPdf(selectedItems, net);
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
        if(typeof LOGO_BASE64 !== 'undefined' && LOGO_BASE64) doc.addImage(LOGO_BASE64, 'PNG', pageWidth - 50, offsetY + 10, 40, 15);
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
}
    """

    final_js = base_js + "\n" + pdf_logic

    # 3. Assemble
    new_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Zephyr Express Portal</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  {"\n  ".join(unique_css)}
  <link rel="icon" href="https://raw.githubusercontent.com/zephyrexpress/Booking/main/Icon.png">

  {"\n  ".join([f'<script src="{s}" defer></script>' for s in unique_js_srcs])}

  <style>
    :root {{
      --sidebar-width: 260px;
      --header-height: 64px;
      --brand-blue: #003399;
      --brand-red: #d40511;
      --brand-yellow: #ffcc00;
      --primary-color: var(--brand-blue);
      --secondary-color: #334155;
      --bg-color: #f8fafc;
      --border-color: #e2e8f0;
      --font-main: 'Inter', sans-serif;
    }}
    body {{ background-color: var(--bg-color); font-family: var(--font-main); color: var(--secondary-color); margin: 0; padding: 0; width: 100%; position: relative; overflow-x: hidden; }}
    .login-wrapper {{ min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #003399 0%, #001a4d 100%); position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 2000; overflow: hidden; }}
    .login-wrapper::before {{ content: ""; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px); background-size: 30px 30px; transform: rotate(15deg); pointer-events: none; }}
    .login-overlay {{ display: none; }}
    img {{ max-width: 100%; height: auto; }}
    .login-card {{ width: 90%; max-width: 420px; padding: 3rem 2rem; background: #ffffff; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.3); z-index: 2; position: relative; text-align: center; }}
    .login-card img {{ max-width: 80%; height: auto; display: inline-block; }}
    @media (max-width: 768px) {{
        body, html {{ overflow-x: auto; width: 100%; }}
        .main-container {{ padding: 0.5rem !important; width: 100%; box-sizing: border-box; }}
        .panel-card, .stat-card {{ width: 100%; margin-bottom: 1rem; border-radius: 8px; }}
        .panel-header {{ flex-direction: column; align-items: flex-start; gap: 0.5rem; padding: 0.75rem; }}
        .panel-header button, .panel-header select {{ width: 100%; margin-top: 0.5rem; }}
        .topbar {{ height: auto; padding: 0.75rem; flex-direction: column; gap: 0.5rem; align-items: flex-start; }}
        .topbar .d-flex {{ width: 100%; justify-content: space-between; }}
        h4, h5 {{ font-size: 1rem !important; }}
        .stat-value {{ font-size: 1.25rem; }}
        .stat-label {{ font-size: 0.65rem; }}
        th, td {{ font-size: 0.75rem !important; padding: 0.4rem !important; }}
        .fun-input, .form-select, .form-control, .input-group {{ width: 100% !important; max-width: 100% !important; }}
        .row {{ margin: 0; width: 100%; }}
        .col-md-3, .col-lg-6, .col-md-4, .col-md-5, .col-md-2, .col-12 {{ padding-left: 0; padding-right: 0; }}
        .login-wrapper {{ position: fixed; top: 0; left: 0; width: 100%; height: 100%; overflow-y: auto; padding: 1rem; align-items: flex-start; padding-top: 10vh; z-index: 2000; }}
        .login-card {{ width: 100%; padding: 1.5rem; margin-bottom: 2rem; }}
        .table-responsive {{ display: block; width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 1rem; border: 1px solid #eee; }}
        .d-none-mobile {{ display: none !important; }}
    }}
    .sidebar {{ width: var(--sidebar-width); background-color: var(--brand-blue); position: fixed; top: 0; bottom: 0; left: 0; z-index: 1000; transition: transform 0.3s; transform: translateX(-100%); color: white; display:flex; flex-direction:column; box-shadow: 4px 0 24px rgba(0,0,0,0.1); }}
    @media (min-width: 992px) {{ .sidebar {{ transform: translateX(-100%); }} .sidebar.show {{ transform: translateX(0); }} }}
    .sidebar.show {{ transform: translateX(0); }}
    .sidebar-brand {{ height: var(--header-height); padding: 0 1.5rem; display: flex; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 800; color: white; letter-spacing: 1px; font-size: 1.2rem; }}
    .sidebar-nav {{ flex: 1; padding: 1.5rem 1rem; overflow-y: auto; }}
    .content-area {{ flex: 1; transition: margin 0.3s; min-height: 100vh; display:flex; flex-direction: column; }}
    .topbar {{ height: var(--header-height); background: white; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; padding: 0 2rem; position: sticky; top: 0; z-index: 990; }}
    .nav-item-custom {{ display: flex; align-items: center; padding: 0.75rem 1rem; border-radius: 8px; color: rgba(255,255,255,0.7); text-decoration: none; margin-bottom: 4px; cursor:pointer; font-weight: 500; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.5px; transition: all 0.2s; }}
    .nav-item-custom:hover {{ background: rgba(255,255,255,0.1); color: white; }}
    .nav-item-custom.active {{ background: var(--brand-red); color: white; box-shadow: 0 4px 12px rgba(212, 5, 17, 0.3); }}
    .nav-label {{ font-size: 0.7rem; font-weight: 800; text-transform: uppercase; margin: 1.5rem 0 0.5rem 0.75rem; color: var(--brand-yellow); letter-spacing: 1px; opacity: 0.8; }}
    .panel-card {{ background: white; border-radius: 12px; border: 1px solid var(--border-color); box-shadow: 0 1px 2px rgba(0,0,0,0.05); height: 100%; overflow: hidden; }}
    h1, h2, h3, h4, h5, h6, .panel-header, .modal-title, .fun-header, .stat-label, .nav-label, th {{ text-transform: uppercase !important; letter-spacing: 0.5px; }}
    .panel-header {{ padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color); font-weight: 700; background: #fdfdfd; display:flex; justify-content:space-between; align-items:center; }}
    .stat-card {{ background: white; border-radius: 12px; padding: 1.5rem; border: 1px solid var(--border-color); display: flex; justify-content: space-between; }}
    .stat-value {{ font-size: 1.8rem; font-weight: 800; color: var(--primary-color); }}
    .toast-container {{ position: fixed; top: 20px; right: 20px; z-index: 1060; }}
    .spinner-overlay {{ position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(255,255,255,0.8); z-index:9999; display:none; justify-content:center; align-items:center; }}
    .mobile-toggle {{ display: block !important; background:none; border:none; font-size:1.5rem; color:var(--primary-color); }}
    .sidebar-backdrop {{ position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 999; display: none; }}
    .sidebar-backdrop.show {{ display: block; }}
    .fun-input {{ border: 2px solid #e2e8f0; transition: all 0.2s; }}
    .fun-input:focus {{ border-color: var(--brand-blue); box-shadow: 0 0 0 4px rgba(0, 51, 153, 0.1); }}
    .fun-header {{ background: linear-gradient(135deg, var(--brand-blue) 0%, #002266 100%); color: white; padding: 1.5rem; border-radius: 12px 12px 0 0; }}
    .fun-header h5, .modal-title {{ text-transform: uppercase; letter-spacing: 1px; }}
    .fun-label {{ color: #475569; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.5px; }}
    .fun-section {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; }}
    .fun-section-green {{ background: #f0fdf4; border-color: #bbf7d0; }}
    .form-check-input {{ border-color: #64748b; border-width: 2px; }}
    .form-check-input:checked {{ background-color: var(--brand-blue); border-color: var(--brand-blue); }}
    .overview-table th, .excel-table th {{ background-color: #f1f5f9; font-size: 0.75rem; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; border: 1px solid #e2e8f0; padding: 0.75rem; }}
    .overview-table td, .excel-table td {{ border: 1px solid #e2e8f0; font-size: 0.85rem; padding: 0.75rem; vertical-align: middle; }}
    .sticky-top {{ z-index: 10; }}
    .clickable-cell {{ cursor: pointer; color: var(--brand-blue); font-weight: 600; text-decoration: underline; }}
    .clickable-cell:hover {{ color: var(--brand-red); }}
    .ts-dropdown, .ts-wrapper.single.input-active .ts-control {{ z-index: 10000 !important; }}
    .btn-primary {{ background-color: var(--brand-blue) !important; border-color: var(--brand-blue) !important; color: white !important; }}
    .btn-danger {{ background-color: var(--brand-red) !important; border-color: var(--brand-red) !important; color: white !important; }}
    .btn-warning {{ background-color: var(--brand-yellow) !important; border-color: var(--brand-yellow) !important; color: black !important; }}
    .btn-success {{ background-color: #198754 !important; border-color: #198754 !important; color: white !important; }}
    .list-item-stacked {{ border-bottom: 1px solid #e2e8f0; padding: 1rem; transition: background 0.2s; }}
    .list-item-stacked:hover {{ background: #f8fafc; }}
    .list-item-stacked:last-child {{ border-bottom: none; }}
    .list-row {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem; }}
    .list-row.last {{ margin-bottom: 0; }}
    .list-label {{ font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; margin-right: 0.5rem; }}
    .list-val {{ font-size: 0.9rem; font-weight: 500; color: #1e293b; }}
    .list-val-bold {{ font-weight: 700; color: var(--brand-blue); font-family: monospace; font-size: 1rem; }}
  </style>
</head>
<body style="width:100%; overflow-x:hidden;">

{html_content}

<script>
{final_js}
</script>

</body>
</html>"""

    with open('index.html', 'w') as f:
        f.write(new_html)
else:
    print("Could not find main script block to reconstruct file.")

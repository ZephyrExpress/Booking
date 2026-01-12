import os

with open('index.html', 'r') as f:
    content = f.read()

# 1. Inbound Options
old_opt = '<option value="Direct_Skip">Direct (Client ➔ Network)</option>\n                            <option value="Direct_Paperwork">Direct (Client ➔ Us ➔ Network)</option>'
new_opt = '<option value="Connected by Client">Connected by Client</option>\n                            <option value="Automation by Client">Automation by Client</option>'
content = content.replace(old_opt, new_opt)

# 2. Inbound Toggle & Div
old_sel = '<select id="f_category" class="form-select fw-bold text-primary" style="max-width:300px;">'
new_sel = '<select id="f_category" class="form-select fw-bold text-primary" style="max-width:300px;" onchange="toggleNetNo()">'
content = content.replace(old_sel, new_sel)

old_div = '                    </div>\n                 </div>\n                 <div class="col-md-4">'
new_div = '                    </div>\n                 </div>\n                 <div class="col-md-12" id="div_net_no" style="display:none;">\n                    <label class="fun-label text-danger">Network Number (Client Provided) *</label>\n                    <input id="f_net_no" class="form-control fun-input border-danger text-danger fw-bold" placeholder="Enter Network AWB...">\n                 </div>\n                 <div class="col-md-4">'
content = content.replace(old_div, new_div)

# 3. Manifest Upload
old_man = '<button class="btn btn-sm btn-outline-dark" onclick="openAddHistoryModal()"><i class="bi bi-clock-history me-1"></i> Add from History</button>'
new_man = '<button class="btn btn-sm btn-outline-dark" onclick="openAddHistoryModal()"><i class="bi bi-clock-history me-1"></i> Add from History</button>\n                   <input type="file" id="man_excel_upload" accept=".xlsx" style="display:none" onchange="importManifestExcel(this)">\n                   <button class="btn btn-sm btn-success text-white shadow-sm" onclick="document.getElementById(\'man_excel_upload\').click()"><i class="bi bi-file-earmark-excel me-1"></i> Import Excel</button>'
content = content.replace(old_man, new_man)

# 4. Holdings Date
old_th = '<th>AWB</th><th>Network No</th><th>Client</th><th>Reason</th><th>Remarks</th><th>Held By</th><th>Entry By</th>'
new_th = '<th>AWB</th><th>Network No</th><th>Client</th><th>Reason</th><th>Remarks</th><th>Held By</th><th>Date</th><th>Entry By</th>'
content = content.replace(old_th, new_th)

# 5. JS Replacements
# renderHoldings
old_rh = '<td><span class="badge bg-light text-dark border">${x.heldBy||\'-\'}</span></td>\n                <td><small>${x.user}</small></td>'
new_rh = '<td><span class="badge bg-light text-dark border">${x.heldBy||\'-\'}</span></td>\n                <td><small>${x.holdDate ? new Date(x.holdDate).toLocaleDateString() : \'-\'}</small></td>\n                <td><small>${x.user}</small></td>'
content = content.replace(old_rh, new_rh)

# submit - Using broader match
old_sub_start = 'const cat = document.getElementById(\'f_category\').value || "Normal";'
old_sub_end = 'category: cat });'
# Construct regex or just robust split/join?
# Since the submit line is long and specific, replace will work if exact.
# I'll rely on the specific string from read_file output.
old_sub = 'const cat = document.getElementById(\'f_category\').value || "Normal";\n\n   const r = await callApi({ action: \'submit\', username: curUser, awb: document.getElementById(\'f_awb\').value, date: document.getElementById(\'f_date\').value, type: document.getElementById(\'f_type\').value, network: document.getElementById(\'f_net\').value, client: document.getElementById(\'f_client\').value, destination: document.getElementById(\'f_dest\').value, totalBoxes: document.getElementById(\'f_boxes\').value, extraCharges: extra.join(\', \'), extraRemarks: document.getElementById(\'f_remarks\').value, boxes: boxes, payTotal: document.getElementById(\'f_payTotal\').value || 0, payPaid: document.getElementById(\'f_payPaid\').value || 0, payPending: document.getElementById(\'f_payPending\').value || 0, payeeName: payeeName, payeeContact: payeeContact, paperwork: pw.join(\', \'), category: cat });'
new_sub = 'const cat = document.getElementById(\'f_category\').value || "Normal";\n   const netNo = document.getElementById(\'f_net_no\').value || "";\n\n   const r = await callApi({ action: \'submit\', username: curUser, awb: document.getElementById(\'f_awb\').value, date: document.getElementById(\'f_date\').value, type: document.getElementById(\'f_type\').value, network: document.getElementById(\'f_net\').value, client: document.getElementById(\'f_client\').value, destination: document.getElementById(\'f_dest\').value, totalBoxes: document.getElementById(\'f_boxes\').value, extraCharges: extra.join(\', \'), extraRemarks: document.getElementById(\'f_remarks\').value, boxes: boxes, payTotal: document.getElementById(\'f_payTotal\').value || 0, payPaid: document.getElementById(\'f_payPaid\').value || 0, payPending: document.getElementById(\'f_payPending\').value || 0, payeeName: payeeName, payeeContact: payeeContact, paperwork: pw.join(\', \'), category: cat, netNo: netNo });'
content = content.replace(old_sub, new_sub)

# resetForm
old_rf = "document.getElementById('st_reg').checked = true; // Default\n    chkStype({value:'Regular'}); // Reset -FRT\n}"
new_rf = "document.getElementById('st_reg').checked = true; // Default\n    chkStype({value:'Regular'}); // Reset -FRT\n    toggleNetNo();\n}"
content = content.replace(old_rf, new_rf)

# Append new functions
new_funcs = """
window.toggleNetNo = function() {
    const cat = document.getElementById('f_category').value;
    const div = document.getElementById('div_net_no');
    if (cat === "Connected by Client" || cat === "Automation by Client") {
        div.style.display = 'block';
        document.getElementById('f_net_no').required = true;
    } else {
        div.style.display = 'none';
        document.getElementById('f_net_no').required = false;
        document.getElementById('f_net_no').value = "";
    }
}

window.importManifestExcel = function(input) {
    if(!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = async function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, {defval:""});

        if(!jsonData.length) { alert("Empty Excel"); return; }

        const mapped = jsonData.map(row => {
            const getVal = (keys) => {
                for(let k of keys) {
                    const found = Object.keys(row).find(rk => rk.toLowerCase().includes(k.toLowerCase()));
                    if(found) return row[found];
                }
                return "";
            };

            return {
                awb: getVal(['awb', 'bill', 'consign']),
                date: getVal(['date']),
                dest: getVal(['dest', 'country']),
                net: getVal(['network', 'service']),
                client: getVal(['client', 'sender']),
                boxes: getVal(['boxes', 'pcs', 'nop']),
                wgt: getVal(['weight', 'wgt']),
                type: getVal(['type', 'content']) || "Ndox"
            };
        }).filter(x => x.awb);

        if(!mapped.length) { alert("No valid AWB columns found"); return; }
        if(!confirm(`Import ${mapped.length} items to Manifest?`)) return;

        showSpin(true);
        const r = await callApi({action: 'bulkImport', items: mapped, user: curUser});
        showSpin(false);
        if(r.result === 'success') {
            toast(r.message);
            syncData(false);
        } else {
            alert(r.message);
        }
        input.value = "";
    };
    reader.readAsArrayBuffer(file);
}
"""
content = content.replace('</script></body>', new_funcs + '</script></body>')

with open('index.html', 'w') as f:
    f.write(content)

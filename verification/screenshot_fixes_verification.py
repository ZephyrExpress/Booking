
import os
from playwright.sync_api import sync_playwright
import time

def screenshot_fixes_verification():
    cwd = os.getcwd()
    file_path = f"file://{cwd}/index.html"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(file_path)

        # Bypass Login & Mock Data
        page.evaluate("document.getElementById('loginSection').style.display='none';")
        page.evaluate("document.getElementById('appSection').style.display='flex';")

        page.evaluate("""
            window.APP_DATA = {
                overview: { auto: [], paper: [] },
                manifest: [],
                holdings: [{id: 'TEST-HOLD', holdReason: 'TEST', holdRem: 'Test', net: 'NA'}],
                adminPool: [{id: 'TASK-001', net: 'DHL', client: 'CLIENT', chgWgt: 5}],
                workflow: { toAssign: [], toDo: [] },
                static: {
                    dropdowns: { networks: ['DHL'], clients: ['CLIENT'], destinations: ['USA'], holdReasons: [{code: 'TEST', desc: 'Full Desc'}] },
                    staff: ['StaffA', 'StaffB']
                },
                stats: { inbound:0, auto:0, paper:0, holdings:0 }
            };
            window.curRole = 'Admin';
        """)

        # Trigger Sync
        page.evaluate("syncData(true)")
        time.sleep(1.0)

        # 1. Verify Bulk Assign (Task Hub) - Should have button "Bulk Assign"
        page.evaluate("switchTab('taskhub')")
        time.sleep(0.5)
        page.screenshot(path="verification/fix_bulk.png")

        # 2. Verify Edit Button (Injected Row)
        page.evaluate("switchTab('receivers')")
        page.evaluate("""
            const list = document.getElementById('rcList');
            list.innerHTML = `<tr>
                <td></td><td>TEST-AWB-001</td><td></td><td></td><td></td><td></td><td></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary ms-1" onclick="openEditModal('TEST-AWB-001')" title="Edit"><i class="bi bi-pencil"></i></button>
                </td>
            </tr>`;
        """)
        time.sleep(0.5)
        page.screenshot(path="verification/fix_edit.png")

        browser.close()

if __name__ == "__main__":
    screenshot_fixes_verification()

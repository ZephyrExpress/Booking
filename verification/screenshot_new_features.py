
import os
from playwright.sync_api import sync_playwright
import time

def screenshot_new_features():
    cwd = os.getcwd()
    file_path = f"file://{cwd}/index.html"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(file_path)

        # Bypass Login UI
        page.evaluate("document.getElementById('loginSection').style.display='none';")
        page.evaluate("document.getElementById('appSection').style.display='flex';")

        # MOCK callApi to drive the application state
        page.evaluate("""
            window.callApi = async function(data) {
                if (!data) return { result: 'error', message: 'No data' };
                if(data.action === 'getAllData') {
                    return {
                        result: 'success',
                        role: 'Admin',
                        perms: [],
                        stats: { inbound: 10, auto: 0, paper: 5, holdings: 0 },
                        overview: { auto: [], paper: [] },
                        workflow: { toAssign: [], toDo: [] },
                        manifest: [],
                        holdings: [],
                        adminPool: [
                            {id: 'TASK-001', net: 'DHL', client: 'CLIENT', chgWgt: 5, details: 'Test Task 1', assignee: ''},
                            {id: 'TASK-002', net: 'DHL', client: 'CLIENT', chgWgt: 6, details: 'Test Task 2', assignee: ''}
                        ],
                        static: {
                            dropdowns: { networks: ['DHL'], clients: ['CLIENT'], destinations: ['USA'] },
                            staff: ['StaffA', 'StaffB'],
                            config: { autoAwb: true }
                        }
                    };
                }
                return { result: 'success' };
            };
        """)

        # Trigger Sync
        page.evaluate("syncData(true)")
        time.sleep(1.0)

        # 1. Screenshot Bulk Assign
        page.evaluate("switchTab('taskhub')")
        time.sleep(0.5)
        page.screenshot(path="verification/bulk_assign.png")
        print("Screenshot saved: bulk_assign.png")

        browser.close()

if __name__ == "__main__":
    screenshot_new_features()

import os
import sys
from playwright.sync_api import sync_playwright

def verify_admin_tabs():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        # Load index.html
        page.goto(f"file://{os.getcwd()}/index.html")

        # Mock window.APP_DATA with admin role
        page.evaluate("""
            window.APP_DATA = {
                role: 'Admin',
                perms: [],
                static: {
                    dropdowns: {
                        networks: ['DHL', 'FedEx'],
                        clients: ['C1'],
                        destinations: ['USA'],
                        extraCharges: ['Fuel'],
                        holdReasons: [{code: 'H1', desc: 'Hold 1'}]
                    },
                    staff: ['Staff1'],
                    config: { autoAwb: true }
                },
                stats: { requests: 1 },
                overview: { auto: [], paper: [] },
                workflow: { toAssign: [], toDo: [] },
                manifest: [],
                holdings: [],
                adminPool: []
            };
            window.curRole = 'Admin';
            window.curUser = 'admin';

            // Force App Visible
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('appSection').style.display = 'flex';

            // Mock fetchGet
            window.fetchGet = async (action) => {
                if (action === 'getAdminRequests') {
                    return {
                        result: 'success',
                        requests: [
                            {reqId: '101', taskId: 'TASK-1', type: 'Paperwork', by: 'Staff1', to: 'Staff2', date: new Date().toISOString()}
                        ]
                    };
                }
                if (action === 'getUsers') {
                    return { result: 'success', users: [{user:'u1', name:'n1', role:'Staff'}] };
                }
                return { result: 'success' };
            };
        """)

        # Switch to Admin Tab
        page.evaluate("switchTab('admin')")

        # Verify Tabs exist
        assert page.is_visible("#adminTabs"), "Admin Tabs navigation not visible"

        # 1. Verify User Tab (Default)
        print("Checking User Tab...")
        assert page.is_visible("#content-users"), "User content not visible by default"
        assert not page.is_visible("#content-reqs"), "Requests content should be hidden"

        # 2. Click Requests Tab
        print("Switching to Requests Tab...")
        page.click("#tab-reqs")
        # Bootstrap tabs use 'active' class and CSS to show/hide.
        # Wait for transition/class update.
        page.wait_for_selector("#content-reqs", state="visible")

        assert page.is_visible("#content-reqs"), "Requests content not visible after click"
        assert not page.is_visible("#content-users"), "User content should be hidden"

        # Check if request list populated (requires async renderAdminPanel to have finished)
        # renderAdminPanel is called in switchTab.
        # We might need to wait for the DOM to update from the mock fetch.
        page.wait_for_selector("#reqList .card", timeout=5000)
        print("Request card found.")

        # 3. Click Dropdown Tab
        print("Switching to Dropdown Tab...")
        page.click("#tab-dd")
        page.wait_for_selector("#content-dd", state="visible")

        assert page.is_visible("#content-dd"), "Dropdown content not visible after click"
        assert not page.is_visible("#content-reqs"), "Requests content should be hidden"

        print("Admin Tabs Verification Passed.")
        browser.close()

if __name__ == "__main__":
    verify_admin_tabs()

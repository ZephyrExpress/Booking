import os
from playwright.sync_api import sync_playwright

def verify_admin_updates():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Mock APP_DATA injection script
        # We need to simulate callApi behavior for getAdminRequests too
        mock_data_script = """
        window.APP_DATA = {
            staff: ['Admin', 'Staff1'],
            dropdowns: {
                networks: ['DHL', 'FedEx'],
                clients: ['Client A', 'Client B']
            },
            overview: { auto: [], paper: [] },
            workflow: { toAssign: [], toDo: [] },
            adminPool: [],
            static: { staff: ['Admin', 'Staff1'], dropdowns: { networks: [], clients: [], destinations: [] } },
            manifest: [],
            holdings: [],
            stats: { inbound: 0, auto: 0, paper: 0, holdings: 0, requests: 0 }
        };

        // Mock fetchGet to return admin requests
        window.fetchGet = async function(action) {
            if (action === 'getAdminRequests') {
                return {
                    result: 'success',
                    requests: [
                        {
                            reqId: 101,
                            taskId: '300199999',
                            type: 'Paperwork',
                            by: 'Staff1',
                            to: 'Staff2',
                            date: new Date().toISOString()
                        }
                    ]
                };
            }
            if (action === 'getUsers') {
                return { result: 'success', users: [] };
            }
            return window.APP_DATA;
        };
        """

        # Load the file
        page.goto(f"file://{os.getcwd()}/index.html")

        # Inject mock data & override
        page.evaluate(mock_data_script)

        # Hide login, show app
        page.evaluate("document.getElementById('loginSection').style.display='none'")
        page.evaluate("document.getElementById('appSection').style.display='flex'")

        # Initialize as Admin
        page.evaluate("curRole = 'Admin'")
        page.evaluate("updateNavVisibility()")

        # Render Admin Panel
        page.evaluate("switchTab('admin')")

        # Wait for requests to load
        page.wait_for_selector("#reqList .card", state="visible")

        # Check content
        assert "REQ #101" in page.inner_text("#reqList")
        assert "Staff1" in page.inner_text("#reqList")
        assert "Staff2" in page.inner_text("#reqList")
        print("Admin requests rendered correctly with new UI.")

        # Take screenshot
        page.screenshot(path="verification/admin_panel.png", full_page=True)
        print("Verification screenshot saved.")

        browser.close()

if __name__ == "__main__":
    verify_admin_updates()

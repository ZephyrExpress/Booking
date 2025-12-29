import os
from playwright.sync_api import sync_playwright

def verify_daily_manifest():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Mock APP_DATA injection script
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
            static: { dropdowns: { networks: [], clients: [], destinations: [] } },
            manifest: [
                {
                    id: '300100001',
                    date: new Date().toISOString(),
                    net: 'DHL',
                    dest: 'USA',
                    boxes: 5,
                    chgWgt: 10.5,
                    client: 'Test Client',
                    batchNo: 'BATCH-TODAY',
                    manifestDate: new Date().toLocaleDateString() // Today
                },
                {
                    id: '300100002',
                    date: '2023-01-01',
                    net: 'FedEx',
                    dest: 'UK',
                    boxes: 2,
                    chgWgt: 5.0,
                    client: 'Old Client',
                    batchNo: 'BATCH-OLD',
                    manifestDate: '1/1/2023' // Old date
                }
            ],
            holdings: [],
            stats: { inbound: 0, auto: 0, paper: 0, holdings: 0, requests: 0 }
        };
        """

        # Load the file
        page.goto(f"file://{os.getcwd()}/index.html")

        # Inject mock data
        page.evaluate(mock_data_script)

        # Hide login, show app
        page.evaluate("document.getElementById('loginSection').style.display='none'")
        page.evaluate("document.getElementById('appSection').style.display='flex'")

        # Initialize global variables and UPDATE NAV
        page.evaluate("curRole = 'Admin'")
        page.evaluate("updateNavVisibility()") # Ensure nav items are shown

        # Trigger syncData logic manually (skip fetch, just render)
        page.evaluate("renderUI()")

        # --- VERIFY SIDEBAR ---
        sidebar = page.locator("#sidebar")
        assert "show" not in sidebar.get_attribute("class")
        print("Sidebar is hidden by default.")

        # --- OPEN SIDEBAR ---
        # Click toggle to open sidebar
        page.click(".mobile-toggle")
        # Wait for sidebar to have class 'show'
        page.wait_for_selector("#sidebar.show")
        print("Sidebar opened.")

        # --- VERIFY MANIFEST ---
        # Click Manifest Tab
        page.click("#nav-manifest")
        print("Clicked Manifest Tab")

        # Wait for tab to switch
        page.wait_for_selector("#manifest-tab")

        # Click Daily Manifest Button
        page.click("button:has-text('Daily Manifest')")

        # Verify Daily Manifest View is visible
        page.wait_for_selector("#man-daily-view", state="visible")

        # Verify the item with today's date is present
        # ID 300100001 should be visible
        assert page.is_visible("text=300100001")
        print("Daily item found.")

        # Verify the old item is NOT present
        content = page.inner_text("#dailyManifestList")
        assert "300100001" in content
        assert "300100002" not in content
        print("Old item correctly excluded.")

        # Take screenshot
        page.screenshot(path="verification/daily_manifest.png", full_page=True)
        print("Verification screenshot saved.")

        browser.close()

if __name__ == "__main__":
    verify_daily_manifest()

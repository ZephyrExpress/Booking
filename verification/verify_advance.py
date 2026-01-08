
import os
from playwright.sync_api import sync_playwright

def verify_advance_features():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the local index.html
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Inject Mock Data for Advanced Features
        page.evaluate("""
            window.APP_DATA = {
                allAwbs: [],
                static: {
                    dropdowns: {
                        networks: ['DHL'],
                        clients: ['Client A'],
                        destinations: ['USA'],
                        extraCharges: []
                    },
                    staff: []
                },
                stats: { inbound: 0, auto: 0, paper: 0, requests: 0, holdings: 0 },
                workflow: { toAssign: [], toDo: [] },
                overview: {
                    auto: [],
                    paper: [],
                    directPaper: [{id:'D-100', client:'C1', net:'N1'}]
                },
                manifest: [],
                holdings: [],
                advance: [
                    {id: 'ADV-001', fmtDate: '01/01/2026', client: 'Test Client', net: 'DHL', boxes: 5, chgWgt: 10, dest: 'USA'}
                ]
            };
            window.initForms();
        """)

        # Bypass Login
        page.evaluate("document.getElementById('loginSection').style.display='none';")
        page.evaluate("document.getElementById('appSection').style.display='flex';")
        page.evaluate("renderUI();")

        # 1. Check Overview Cards (Direct Shipments & Advance Badge)
        page.evaluate("switchTab('overview')")
        print("Checking Overview Cards...")
        if page.is_visible("text=Direct Shipments (Processing)"):
            print("PASS: Direct Shipments card visible")
        else:
            print("FAIL: Direct Shipments card missing")

        if page.is_visible("text=D-100"):
            print("PASS: Direct Shipment item visible")
        else:
            print("FAIL: Direct Shipment item missing")

        if page.is_visible("#badgeAdv:has-text('1')"):
            print("PASS: Advance Badge count correct")
        else:
            print("FAIL: Advance Badge count incorrect")

        # 2. Check Inbound Dropdown
        page.evaluate("switchTab('inbound')")
        print("Checking Inbound Form...")
        if page.is_visible("#f_category"):
            print("PASS: Entry Mode Dropdown visible")
            # Select Advance option
            page.select_option("#f_category", "Advance")
        else:
            print("FAIL: Entry Mode Dropdown missing")

        # 3. Check Advance Tab
        print("Checking Advance Tab...")
        # Simulate click on nav item
        # Since nav item is hidden by default in mock (perm check), we force show it
        page.evaluate("document.getElementById('nav-advance').style.display='flex'")

        # Ensure sidebar is visible (it might be hidden on small screens or just off-canvas)
        # But in standard view it should be clickable if visible.
        # Just use eval switchTab to be safe if click fails
        page.evaluate("switchTab('advance')")

        page.wait_for_selector("#advanceList")
        if page.is_visible("text=ADV-001"):
            print("PASS: Advance shipment listed")
        else:
            print("FAIL: Advance shipment not listed")

        if page.is_visible("button:has-text('Receive')"):
            print("PASS: Receive button visible")
        else:
            print("FAIL: Receive button missing")

        # 4. Check Manifest Date Range
        print("Checking Manifest History...")
        page.evaluate("switchTab('manifest')")
        page.click("button:has-text('Manifest History')")

        if page.is_visible("#hist_from") and page.is_visible("#hist_to"):
            print("PASS: Date Range inputs visible")
        else:
            print("FAIL: Date Range inputs missing")

        # Take Screenshot
        page.screenshot(path="verification/advance_feature.png")
        print("Screenshot saved to verification/advance_feature.png")

        browser.close()

if __name__ == "__main__":
    verify_advance_features()

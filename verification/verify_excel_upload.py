import os
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    cwd = os.getcwd()
    page.goto(f"file://{cwd}/index.html")

    # Mock Data
    page.evaluate('''() => {
        window.APP_DATA = {
            static: { dropdowns: { networks: ['DHL', 'FedEx'], clients: ['ClientA'], destinations: ['USA'] } },
            overview: { auto: [], paper: [] },
            manifest: [],
            holdings: [],
            advance: [],
            stats: { inbound: 0, auto: 0, paper: 0, requests: 0, holdings: 0 }
        };

        // Mock File Reader & XLSX if needed?
        // We rely on the browser's FileReader.
        // We rely on SheetJS being loaded from CDN.

        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('appSection').style.display = 'block';
    }''')

    # Open Manifest Tab
    page.evaluate("switchTab('manifest')")

    # Open External Modal
    page.click("button:has-text('Manual Entry')")
    page.wait_for_selector("#externalModal", state="visible")

    print("SUCCESS: Modal Opened")

    # Verify Elements
    if page.is_visible("#ext_net_select"):
        print("SUCCESS: Network Dropdown Found")
    else:
        print("FAILED: Network Dropdown Missing")

    if page.is_visible("#ext_file"):
        print("SUCCESS: File Input Found")
    else:
        print("FAILED: File Input Missing")

    page.screenshot(path="verification/excel_upload_modal.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)

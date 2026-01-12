import os
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Load local file
    cwd = os.getcwd()
    page.goto(f"file://{cwd}/index.html")

    # Mock window.APP_DATA to bypass login
    page.evaluate('''() => {
        window.APP_DATA = {
            static: {
                dropdowns: {
                    networks: ['DHL', 'FedEx'],
                    clients: ['ClientA', 'ClientB'],
                    destinations: ['USA', 'UK']
                }
            },
            overview: { auto: [], paper: [] },
            manifest: [],
            holdings: [
                { id: 'HOLD123', holdDate: new Date().toISOString(), holdReason: 'KYC', holdRem: 'Missing Docs', heldBy: 'Admin', user: 'Staff1' }
            ],
            advance: [],
            stats: { inbound: 0, auto: 0, paper: 0, requests: 0, holdings: 1 }
        };
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('appSection').style.display = 'block';
        switchTab('inbound');
    }''')

    # 1. Verify Inbound Renaming & Network No Toggle
    print("Verifying Inbound Tab...")

    # Check "Connected by Client" option existence
    cat_select = page.locator("#f_category")
    # Verify option text
    # Direct_Skip -> Connected by Client
    # Direct_Paperwork -> Automation by Client

    opts = cat_select.inner_text()
    if "Connected by Client" not in opts:
        print("FAILED: 'Connected by Client' not found")
    else:
        print("SUCCESS: 'Connected by Client' found")

    if "Automation by Client" not in opts:
        print("FAILED: 'Automation by Client' not found")
    else:
        print("SUCCESS: 'Automation by Client' found")

    # Select 'Connected by Client' and check Net No visibility
    cat_select.select_option("Direct_Skip")
    if not page.is_visible("#div_net_no"):
        print("FAILED: Net No not visible")
    else:
        print("SUCCESS: Net No visible")

    page.screenshot(path="verification/1_inbound.png")

    # 2. Verify Task Manager Button
    print("Verifying Task Manager...")
    page.evaluate("switchTab('taskhub')")
    # In Admin View (mocking Admin role)
    page.evaluate("document.getElementById('adminTaskView').style.display='block'")

    btn = page.get_by_text("Automation Data")
    if btn.is_visible():
        print("SUCCESS: 'Automation Data' button found")
    else:
        print("FAILED: 'Automation Data' button NOT found")
    page.screenshot(path="verification/2_taskhub.png")

    # 3. Verify Manifest External Button
    print("Verifying Manifest...")
    page.evaluate("switchTab('manifest')")
    man_btn = page.locator("button", has_text="Manual Entry")
    if man_btn.is_visible():
        print("SUCCESS: 'Manual Entry' button found")
        man_btn.click()
        page.wait_for_selector("#externalModal", state="visible")
        page.screenshot(path="verification/3_manifest_modal.png")
    else:
        print("FAILED: 'Manual Entry' button NOT found")

    # 4. Verify Holdings Date Column
    print("Verifying Holdings...")
    page.evaluate("switchTab('holdings')")
    page.evaluate("renderHoldings()") # Trigger render with mock data

    headers = page.locator("#holdings-tab thead").inner_text()
    if "Date Held" in headers:
        print("SUCCESS: 'Date Held' column found")
    else:
        print("FAILED: 'Date Held' column NOT found")

    page.screenshot(path="verification/4_holdings.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)

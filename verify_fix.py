
from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Load the local HTML file
    cwd = os.getcwd()
    page.goto(f"file://{cwd}/index.html")

    # Mock window.APP_DATA and FORCE UI STATE to bypass Login
    page.evaluate("""
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('appSection').style.display = 'flex';

        window.APP_DATA = {
            overview: { auto: [], paper: [] },
            holdings: [
                {id: 'AWB123', netNo: 'NET001', client: 'CLIENT A', holdReason: 'KYC', holdRem: 'Missing Docs', user: 'Admin', net: 'DHL', chgWgt: '5.00', holdStatus: 'On Hold'}
            ],
            manifest: [],
            static: { dropdowns: { networks: ['DHL', 'FedEx'], holdReasons: [{code:'KYC', desc:'Know Your Customer'}] } },
            stats: { inbound:0, auto:0, paper:0, holdings:1, requests:0 },
            workflow: { toAssign:[], toDo:[] },
            adminPool: []
        };

        // Mock global variables expected by renderUI
        window.curRole = 'Admin';
        window.curPerms = [];

        // Render UI
        window.renderUI();
        window.updDd(); // Check dropdown population

        // Force switch to holdings tab
        window.switchTab('holdings');
    """)

    # 1. Verify Login Layout (by inspecting classes)
    try:
        content = page.content()
        if "login-left" in content and "login-right" in content:
             print("SUCCESS: Login Split Layout classes found.")
        else:
             print("FAIL: Login Layout classes missing.")
    except Exception as e:
        print(f"FAIL: Layout Check: {e}")

    # 2. Verify Sidebar Text Removal
    try:
        brand = page.query_selector('.sidebar-brand')
        text = brand.inner_text().strip()
        if "ZEPHYR PRO" not in text:
             print(f"SUCCESS: Sidebar text verified. Found: '{text}' (Expected empty or just logo)")
        else:
             print(f"FAIL: Sidebar text 'ZEPHYR PRO' still present.")
    except Exception as e:
        print(f"FAIL: Sidebar Check: {e}")

    # 3. Verify Dropdowns
    try:
        opts = page.eval_on_selector("#man_net", "e => e.options.length")
        # 1 default + 2 mocked = 3
        if opts >= 2:
             print("SUCCESS: Dropdowns populated.")
        else:
             print(f"FAIL: Dropdowns empty. Count: {opts}")
    except Exception as e:
        print(f"FAIL: Dropdown Check: {e}")

    # 4. Verify Action Modal for Clear Hold
    try:
        # Click Clear Hold on the first item
        page.evaluate("actClearHold('AWB123')")
        page.wait_for_selector("#actionModal", state="visible", timeout=2000)

        title = page.inner_text("#actionModalTitle")
        if "Clear Hold - AWB123" in title:
             print("SUCCESS: Action Modal opened with correct title.")
        else:
             print(f"FAIL: Action Modal title mismatch: {title}")

        # Check mandatory remarks logic
        # Mock alert
        page.on("dialog", lambda dialog: dialog.accept())
        page.click("text=Confirm Action")
        # If alert triggered, it means validation passed (it blocked empty submit).
        # We can't easily assert alert happened in this sync block without event listener setup before click.
        # But if the modal is still open, validation worked.
        if page.is_visible("#actionModal"):
             print("SUCCESS: Validation blocked empty submission.")
        else:
             print("FAIL: Modal closed without remarks.")

    except Exception as e:
        print(f"FAIL: Modal Logic: {e}")

    # Take Screenshot
    page.screenshot(path="/home/jules/verification/fix_verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)


from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    cwd = os.getcwd()
    page.goto(f"file://{cwd}/index.html")

    # Mock Data with 'Owner' role
    page.evaluate("""
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('appSection').style.display = 'flex';

        window.APP_DATA = {
            overview: { auto: [], paper: [] },
            holdings: [],
            manifest: [],
            static: { dropdowns: { networks: ['TestNet'] } },
            stats: { inbound:0, auto:0, paper:0, holdings:0, requests:0 },
            workflow: { toAssign:[], toDo:[] },
            adminPool: [],
            role: 'Owner'
        };

        // Simulate Login Success logic
        window.curRole = 'Owner';
        window.curPerms = [];

        // 1. Run updateNavVisibility
        window.updateNavVisibility();

        // 2. Init Forms (Dropdowns)
        window.initForms();

        // 3. Render UI
        window.renderUI();
    """)

    # Check for Crash Alert

    # 1. Verify Admin Panel Nav Visibility
    try:
        admin_disp = page.eval_on_selector('#adminNavGroup', 'e => e.style.display')
        if admin_disp != 'none':
            print("SUCCESS: Admin Panel Navigation is Visible for Owner.")
        else:
            print(f"FAIL: Admin Panel Hidden. Display: {admin_disp}")
    except Exception as e:
        print(f"FAIL: Admin Nav Check: {e}")

    # 2. Verify Dropdowns in Inbound
    try:
        page.evaluate("switchTab('inbound')")
        opts = page.eval_on_selector("#f_net", "e => e.options.length")
        # 1 default + 1 mocked = 2
        if opts >= 2:
             print("SUCCESS: Inbound Dropdowns populated.")
        else:
             print(f"FAIL: Inbound Dropdowns empty. Count: {opts}")
    except Exception as e:
        print(f"FAIL: Inbound Dropdown Check: {e}")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)

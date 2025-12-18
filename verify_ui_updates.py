
from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    cwd = os.getcwd()
    page.goto(f"file://{cwd}/index.html")

    # Mock Data
    page.evaluate("""
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('appSection').style.display = 'flex';

        window.APP_DATA = {
            overview: { auto: [], paper: [] },
            holdings: [],
            manifest: [],
            static: { dropdowns: { networks: ['NetA'], holdReasons: [{code:'XXX', desc:'Test Reason'}] } },
            stats: { inbound:0, auto:0, paper:0, holdings:0, requests:0 },
            workflow: { toAssign:[], toDo:[] },
            adminPool: [],
            role: 'Admin'
        };
        window.curRole = 'Admin';
        window.initForms();
        window.renderUI();
    """)

    # 1. Verify Scanner Button Exists in Inbound
    try:
        # Switch to Inbound tab to make visible
        page.evaluate("switchTab('inbound')")
        btn = page.query_selector("#f_awb + button") # Button next to input
        if btn:
            print("SUCCESS: Inbound Scanner Button found.")
        else:
            print("FAIL: Inbound Scanner Button missing.")
    except Exception as e:
        print(f"FAIL: Scanner Check: {e}")

    # 2. Verify Hold Reason Dropdown Population
    try:
        page.evaluate("switchTab('holdings')")
        # Trigger modal
        page.evaluate("openHoldModal('TEST-AWB', 'NET-001')")
        page.wait_for_selector("#holdModal", state="visible")

        # Check select options (TomSelect modifies DOM, but options should be in the hidden select or the TS wrapper)
        # We check the innerHTML of the select logic we injected
        opts_count = page.eval_on_selector("#modalHoldReason", "e => e.options.length")
        if opts_count >= 2: # Default + Test Reason
             print("SUCCESS: Hold Reason Dropdown populated.")
        else:
             print(f"FAIL: Hold Reason Dropdown empty. Count: {opts_count}")

    except Exception as e:
        print(f"FAIL: Hold Dropdown Check: {e}")

    # 3. Verify Paperwork Formatting
    try:
        # Check if f_paperwork labels have 'small' class
        cls = page.eval_on_selector("#f_paperwork label", "e => e.className")
        if "small" in cls:
             print("SUCCESS: Paperwork formatting updated.")
        else:
             print(f"FAIL: Paperwork formatting mismatch. Class: {cls}")
    except Exception as e:
        print(f"FAIL: Formatting Check: {e}")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)

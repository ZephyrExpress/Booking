
from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    # iPhone 13 Emulation
    iphone_13 = playwright.devices['iPhone 13']
    context = browser.new_context(**iphone_13)
    page = context.new_page()

    cwd = os.getcwd()
    page.goto(f"file://{cwd}/index.html")

    # 1. Verify Body Overflow Removed
    overflow = page.eval_on_selector('body', 'e => getComputedStyle(e).overflowX')
    if overflow != 'hidden':
        print(f"SUCCESS: Body overflow is '{overflow}' (Not hidden).")
    else:
        print(f"FAIL: Body overflow is still hidden.")

    # 2. Verify Table Wrapper
    # Mock render
    page.evaluate("""
        document.getElementById('appSection').style.display = 'block';
        window.APP_DATA = { overview: { auto: [{id:'1'}], paper: [] }, stats: {inbound:0,auto:0,paper:0,holdings:0} };
        window.renderUI();
    """)

    # Check if table is inside .table-responsive
    is_wrapped = page.evaluate("""
        const table = document.querySelector('#listAuto').closest('table');
        const wrapper = table.parentElement;
        wrapper.classList.contains('table-responsive');
    """)

    if is_wrapped:
        print("SUCCESS: Table is wrapped in .table-responsive div.")
    else:
        print("FAIL: Table is NOT wrapped correctly.")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)

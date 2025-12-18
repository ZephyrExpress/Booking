
from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    # Emulate Mobile Device (iPhone 12 Pro)
    iphone_12 = playwright.devices['iPhone 12 Pro']
    context = browser.new_context(**iphone_12)
    page = context.new_page()

    # Load the local HTML file
    cwd = os.getcwd()
    page.goto(f"file://{cwd}/index.html")

    # 1. Verify Login Layout on Mobile
    try:
        # Check if card is visible and centered
        # The split layout (login-left) should be hidden by media query
        left_display = page.eval_on_selector('.login-left', 'e => getComputedStyle(e).display')
        if left_display == 'none':
            print("SUCCESS: Login Split Left Panel hidden on mobile.")
        else:
            print(f"FAIL: Login Left Panel visible on mobile. Display: {left_display}")

        # Check card width
        card_width = page.eval_on_selector('.login-card', 'e => e.offsetWidth')
        viewport_width = page.viewport_size['width']
        if card_width < viewport_width:
             print(f"SUCCESS: Login Card fits viewport ({card_width}px < {viewport_width}px)")
        else:
             print(f"FAIL: Login Card too wide. {card_width}px")

    except Exception as e:
        print(f"FAIL: Mobile Layout Check: {e}")

    # 2. Mock Data and Check Overview
    page.evaluate("""
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('appSection').style.display = 'flex';

        window.APP_DATA = {
            overview: { auto: [{id:'1', net:'DHL'}], paper: [] },
            holdings: [],
            manifest: [],
            static: { dropdowns: { networks: ['DHL'], holdReasons: [] } },
            stats: { inbound:10, auto:1, paper:0, holdings:0, requests:0 },
            workflow: { toAssign:[], toDo:[] },
            adminPool: [],
            role: 'Admin'
        };
        window.curRole = 'Admin';
        window.renderUI();
    """)

    # 3. Check for Overflow
    # We can check scrollWidth vs clientWidth
    try:
        scroll_width = page.eval_on_selector('body', 'e => e.scrollWidth')
        client_width = page.eval_on_selector('body', 'e => e.clientWidth')

        # Allow small buffer for scrollbars
        if scroll_width <= client_width + 1:
             print("SUCCESS: No Horizontal Scroll on Body.")
        else:
             print(f"FAIL: Horizontal Scroll detected. Scroll: {scroll_width}, Client: {client_width}")

    except Exception as e:
        print(f"FAIL: Scroll Check: {e}")

    # Take Screenshot
    page.screenshot(path="/home/jules/verification/mobile_fix.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)

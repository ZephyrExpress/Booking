
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

    # 1. Check Mobile Horizontal Scroll
    # We check if scrollWidth > clientWidth
    try:
        scroll_width = page.eval_on_selector('body', 'e => e.scrollWidth')
        client_width = page.eval_on_selector('body', 'e => e.clientWidth')

        # Buffer of 1px for rounding errors
        if scroll_width <= client_width + 1:
             print("SUCCESS: No Horizontal Scroll on Body (Mobile).")
        else:
             print(f"FAIL: Horizontal Scroll detected. Scroll: {scroll_width}, Client: {client_width}")
    except Exception as e:
        print(f"FAIL: Scroll Check: {e}")

    # 2. Check Password Reveal Logic (Static Check)
    # We can't verify functionality fully without backend data, but we check if attribute exists
    page.evaluate("""
        // Mock Admin Panel Render
        const u = {user:'test', pass:'secret123', name:'Test User', role:'Admin', perms:''};
        const row = `<tr><td>${u.user}</td><td id="testPass" onclick="togglePass(this)" data-pass="${u.pass}">****</td></tr>`;
        document.body.insertAdjacentHTML('beforeend', '<table>' + row + '</table>');
    """)

    try:
        # Click to reveal
        page.click('#testPass')
        text = page.inner_text('#testPass')
        if text == 'secret123':
            print("SUCCESS: Password Reveal worked.")
        else:
            print(f"FAIL: Password Reveal failed. Got: '{text}'")

        # Click to hide
        page.click('#testPass')
        text = page.inner_text('#testPass')
        if text == '****':
            print("SUCCESS: Password Hide worked.")
        else:
            print(f"FAIL: Password Hide failed. Got: '{text}'")

    except Exception as e:
        print(f"FAIL: Password Logic: {e}")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)


from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto('file://' + os.getcwd() + '/index.html')

        # Bypass login screen
        page.evaluate("""
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('appSection').style.display = 'block';
            // Also need to trigger tab show if bootstrap is involved, but usually display block is enough for visibility
            // Ensure the inbound tab is active
            const triggerEl = document.querySelector('#nav-inbound button')
            if(triggerEl) {
                const tab = new bootstrap.Tab(triggerEl)
                tab.show()
            }
        """)

        # Wait for form to be visible
        page.wait_for_selector('#shipForm', state='visible')

        # Test genBoxes (this uses my optimized code)
        page.fill('#f_boxes', '5')
        page.click('button[onclick="genBoxes()"]')

        # Wait for 5 rows
        page.wait_for_selector('#boxTable tr:nth-child(5)')

        page.screenshot(path='verification/screenshot.png')
        browser.close()

if __name__ == '__main__':
    run()

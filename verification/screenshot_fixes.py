
import os
from playwright.sync_api import sync_playwright
import time

def screenshot_frontend_fixes():
    cwd = os.getcwd()
    file_path = f"file://{cwd}/index.html"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(file_path)

        # Bypass Login
        page.evaluate("document.getElementById('loginSection').style.display='none';")
        page.evaluate("document.getElementById('appSection').style.display='flex';")

        # Mock Data for Receiver Search
        page.evaluate("""
            window.APP_DATA = {
                overview: { auto: [], paper: [] },
                manifest: [{id: 'TEST-AWB-001', date: '2023-01-01', dest: 'USA', net: 'DHL', boxes: 1, chgWgt: 10, client: 'CLIENT', netNo: 'NET-123'}],
                holdings: [],
                stats: { inbound:0, auto:0, paper:0, holdings:0 }
            };
        """)

        # Switch to Receivers Tab
        page.evaluate("switchTab('receivers')")
        time.sleep(1)

        # Test Search Filter
        page.fill("#rc_search", "TEST-AWB-001")
        time.sleep(1) # Wait for debounce

        # Take Screenshot of Receivers Search Result
        page.screenshot(path="verification/receivers_fix.png")
        print("Screenshot saved to verification/receivers_fix.png")

        browser.close()

if __name__ == "__main__":
    screenshot_frontend_fixes()

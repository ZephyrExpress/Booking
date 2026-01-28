
import os
from playwright.sync_api import sync_playwright

def verify_awb_logic():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        file_path = os.path.abspath("index.html")
        page.goto(f"file://{file_path}")

        # Initialize mock data AND force show inbound tab, hide login
        page.evaluate("""() => {
            window.APP_DATA = { static: { dropdowns: {} } };
            window.tomInstances = {};
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('appSection').style.display = 'block';
            document.getElementById('inbound-tab').style.display = 'block';
        }""")

        # Set AWB
        page.fill("#f_awb", "1234567890")

        # 1. Test Regular
        page.check("#st_reg")
        val = page.input_value("#f_awb")
        print(f"Regular: {val}")
        if val != "1234567890": print("FAIL: Regular should be clean")

        # 2. Test Commercial
        page.check("#st_com")
        val = page.input_value("#f_awb")
        print(f"Commercial: {val}")
        if val != "1234567890-FRT": print("FAIL: Commercial should have -FRT")

        # 3. Test CSB 5
        page.check("#st_csb")
        val = page.input_value("#f_awb")
        print(f"CSB 5: {val}")
        if val != "1234567890 CSBV": print("FAIL: CSB 5 should have  CSBV")

        # 4. Switch back to Regular (Cleanup check)
        page.check("#st_reg")
        val = page.input_value("#f_awb")
        print(f"Back to Regular: {val}")
        if val != "1234567890": print("FAIL: Cleanup failed")

        page.screenshot(path="verification/awb_logic_final.png")
        browser.close()

if __name__ == "__main__":
    verify_awb_logic()

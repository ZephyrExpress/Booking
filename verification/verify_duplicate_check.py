
import os
from playwright.sync_api import sync_playwright

def verify_duplicate_alert():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the local index.html
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Inject Mock Data for window.APP_DATA (Simulate 'getAllData' response)
        page.evaluate("""
            window.APP_DATA = {
                allAwbs: ['123456789', '987654321', 'DUPLICATE001'],
                static: {
                    dropdowns: {
                        networks: ['DHL', 'FedEx'],
                        clients: ['Client A', 'Client B'],
                        destinations: ['USA', 'UK'],
                        extraCharges: ['Fuel', 'Handling']
                    },
                    staff: ['Staff1', 'Staff2']
                },
                overview: { auto: [], paper: [] },
                manifest: [],
                holdings: []
            };
            window.initForms(); // Ensure dropdowns are populated
        """)

        # Bypass Login
        page.evaluate("document.getElementById('loginSection').style.display='none';")
        page.evaluate("document.getElementById('appSection').style.display='flex';")
        page.evaluate("switchTab('inbound');")

        # Scenario 1: Enter a unique AWB (Should NOT alert)
        print("Testing Unique AWB...")
        page.fill("#f_awb", "UNIQUE001")
        page.evaluate("document.getElementById('f_awb').blur()")
        page.wait_for_timeout(500)

        # Check value remains
        val = page.input_value("#f_awb")
        if val != "UNIQUE001":
            print(f"FAIL: Unique AWB cleared unexpectedly. Value: {val}")
        else:
            print("PASS: Unique AWB accepted.")

        # Scenario 2: Enter Duplicate AWB (Should Alert and Clear)
        print("Testing Duplicate AWB 'DUPLICATE001'...")

        # Setup dialog handler to accept alert
        dialog_message = []
        def handle_dialog(dialog):
            dialog_message.append(dialog.message)
            print(f"Alert triggered: {dialog.message}")
            dialog.accept()

        page.on("dialog", handle_dialog)

        page.fill("#f_awb", "DUPLICATE001")
        page.evaluate("document.getElementById('f_awb').blur()")

        # Wait for potential alert processing
        page.wait_for_timeout(1000)

        if not dialog_message:
            print("FAIL: No alert triggered for duplicate AWB.")
        else:
            print(f"PASS: Alert triggered with message: {dialog_message[0]}")

        # Check value is cleared
        val_after = page.input_value("#f_awb")
        if val_after == "":
            print("PASS: Input cleared after duplicate detection.")
        else:
            print(f"FAIL: Input NOT cleared. Value: {val_after}")

        # Take Screenshot
        page.screenshot(path="verification/duplicate_check.png")
        print("Screenshot saved to verification/duplicate_check.png")

        browser.close()

if __name__ == "__main__":
    verify_duplicate_alert()


import os
from playwright.sync_api import sync_playwright

def verify_reassign_optimization():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the local HTML file
        page.goto(f"file://{os.getcwd()}/index.html")

        # Hide login, show app
        page.evaluate("document.getElementById('loginSection').style.display='none';")
        page.evaluate("document.getElementById('appSection').style.display='block';")

        # Mock APP_DATA
        page.evaluate("""
            window.APP_DATA = {
                static: {
                    staff: ['Alice', 'Bob', 'Charlie']
                }
            };
        """)

        # Trigger openReassign
        page.evaluate("window.openReassign('123', 'Paperwork')")

        # Wait for modal
        page.wait_for_selector("#reassignModal", state="visible")

        # Check if options are present
        content = page.content()
        if "Alice" in content and "Bob" in content:
            print("Options rendered successfully")
        else:
            print("Options missing")

        page.screenshot(path="verification/verify_opt.png")
        browser.close()

if __name__ == "__main__":
    verify_reassign_optimization()

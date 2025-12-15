
from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto('file://' + os.getcwd() + '/index.html')

        # Bypass login screen and switch to inbound tab using the app's internal logic
        page.evaluate("""
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('appSection').style.display = 'flex'; // appSection uses flex

            // Mock window.switchTab if it isn't available yet (though it should be)
            if (typeof window.switchTab === 'function') {
                window.switchTab('inbound');
            } else {
                console.error('switchTab not found');
                // Fallback manual switch
                document.getElementById('inbound-tab').style.display = 'block';
            }
        """)

        # Wait for form to be visible
        try:
            page.wait_for_selector('#shipForm', state='visible', timeout=5000)
            print("Form found visible")
        except Exception as e:
            print(f"Error waiting for shipForm: {e}")
            # print page content for debugging
            # print(page.content())
            raise e

        # Test genBoxes
        page.fill('#f_boxes', '5')
        page.click('button[onclick="genBoxes()"]')

        # Wait for 5 rows
        page.wait_for_selector('#boxTable tr:nth-child(5)', timeout=5000)
        print("Rows generated successfully")

        page.screenshot(path='verification/screenshot.png')
        browser.close()

if __name__ == '__main__':
    run()

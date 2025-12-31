
import os
from playwright.sync_api import sync_playwright
import time

def verify_frontend_issues():
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
                manifest: [{id: 'TEST-AWB-001', date: '2023-01-01', dest: 'USA', net: 'DHL', boxes: 1, chgWgt: 10, client: 'CLIENT'}],
                holdings: [],
                stats: { inbound:0, auto:0, paper:0, holdings:0 }
            };
        """)

        # Switch to Receivers Tab
        page.evaluate("switchTab('receivers')")
        time.sleep(1)

        # Test Search
        print("Testing Receiver Search...")
        page.fill("#rc_search", "TEST-AWB-001")
        time.sleep(1) # Wait for debounce (300ms) + render

        # Check if item is visible
        visible_row = page.query_selector("td:has-text('TEST-AWB-001')")
        if visible_row:
            print("Frontend Search: SUCCESS - Item found.")
        else:
            print("Frontend Search: FAILURE - Item not found after search.")

        # Test Manifest PDF Column (Static Check via Code Injection/Inspection)
        # Since we can't easily check the PDF content in headless, we check the JS function string for "Net No"
        print("Checking Manifest PDF Logic...")
        js_code = page.evaluate("window.downloadManifestPdf.toString()")
        if "Net No" in js_code or "Net No." in js_code or "Network No" in js_code:
             print("Manifest PDF: SUCCESS - 'Net No' column found in code.")
        else:
             print("Manifest PDF: FAILURE - 'Net No' column NOT found in code.")
             # Also check if the table header definition includes it
             if "['#', 'AWB', 'Date', 'Dest', 'Pcs', 'Wgt', 'Client']" in js_code:
                 print("Manifest PDF: CONFIRMED FAILURE - Header missing Net No.")

        browser.close()

if __name__ == "__main__":
    verify_frontend_issues()

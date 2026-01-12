import os
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    cwd = os.getcwd()
    page.goto(f"file://{cwd}/index.html")

    page.evaluate('''() => {
        window.APP_DATA = {
            static: { dropdowns: { networks: [], clients: [], destinations: [] } },
            overview: { auto: [], paper: [] },
            manifest: [],
            holdings: [
                { id: 'H1', holdDate: new Date().toISOString(), holdReason: 'R', holdRem: 'Rem', heldBy: 'Me', user: 'U1', netNo: 'N1', client: 'C1' }
            ],
            advance: [],
            stats: { inbound: 0, auto: 0, paper: 0, requests: 0, holdings: 1 }
        };
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('appSection').style.display = 'block';
    }''')

    # Verify Manifest
    print("Verifying Manifest...")
    page.evaluate("switchTab('manifest')")
    man_btn = page.locator("button", has_text="Manual Entry")
    if man_btn.is_visible():
        print("SUCCESS: Manual Entry button found")
        man_btn.click()
        page.wait_for_selector("#externalModal", state="visible")
        page.screenshot(path="verification/3_manifest_modal_retry.png")
    else:
        print("FAILED: Manual Entry button not found")

    # Verify Holdings
    print("Verifying Holdings...")
    # Close modal
    page.keyboard.press("Escape")
    page.wait_for_selector("#externalModal", state="hidden")

    page.evaluate("switchTab('holdings')")
    page.evaluate("renderHoldings()")
    page.screenshot(path="verification/4_holdings_retry.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)

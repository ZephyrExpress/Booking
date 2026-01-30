
from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Inject Mock Data
        page.evaluate("""
            window.APP_DATA = {
                static: {
                    dropdowns: {
                        networks: ['NetA', 'NetB'],
                        clients: ['Client1', 'Client2'],
                        destinations: ['Dest1', 'Dest2']
                    },
                    config: { autoAwb: true, allowTransfer: true }
                },
                overview: { auto: [], paper: [] },
                stats: { inbound: 0, holdings: 0 },
                holdings: [],
                manifest: []
            };
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('appSection').style.display = 'flex';
            switchTab('inbound');
        """)

        page.wait_for_timeout(500)

        # Switch to Multi Inbound
        page.evaluate("switchInboundMode('Multi')")
        page.wait_for_timeout(500)

        # Take screenshot of table
        page.screenshot(path="verification/screenshot_multi_inbound.png")
        print("Screenshot 2 taken: verification/screenshot_multi_inbound.png")

        browser.close()

if __name__ == "__main__":
    run()

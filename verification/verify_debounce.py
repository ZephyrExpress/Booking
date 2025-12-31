import os
from playwright.sync_api import sync_playwright
import time

def verify_debounce():
    cwd = os.getcwd()
    file_path = f"file://{cwd}/index.html"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(file_path)

        # Bypass Login
        page.evaluate("document.getElementById('loginSection').style.display='none';")
        page.evaluate("document.getElementById('appSection').style.display='flex';")

        # Mock Data
        page.evaluate("""
            window.APP_DATA = {
                manifest: Array.from({length: 500}, (_, i) => ({
                    id: 'AWB' + i,
                    date: '2023-01-01',
                    dest: 'DEL',
                    net: 'DHL',
                    netNo: 'NET' + i,
                    boxes: 1,
                    chgWgt: 10,
                    client: 'CLIENT',
                    batchNo: ''
                })),
                static: { dropdowns: { networks: ['DHL'] } },
                overview: { auto: [], paper: [] },
                stats: { inbound:0, auto:0, paper:0, holdings:0 }
            };
        """)

        # Switch to Manifest Tab
        page.evaluate("switchTab('manifest')")

        # Spy on renderManifest
        # We wrap renderManifest to increment a counter
        page.evaluate("""
            window.renderCount = 0;
            const originalRender = window.renderManifest;
            window.renderManifest = function() {
                window.renderCount++;
                originalRender();
            }
        """)

        # Type '12345' rapidly
        # We use type with small delay to simulate typing
        page.type("#man_search", "12345", delay=50)

        # Wait a bit for any timeouts
        time.sleep(1.0)

        # Get count
        count = page.evaluate("window.renderCount")

        print(f"Render count: {count}")

        browser.close()

        # We typed 5 chars.
        # Without debounce, render is called on every input event.
        if count >= 5:
            print("Performance Issue Detected: Render called too many times.")
            exit(1)
        else:
            print("Performance Optimized: Render called minimal times.")
            exit(0)

if __name__ == "__main__":
    verify_debounce()

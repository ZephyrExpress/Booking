from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("file:///app/index.html")

    page.evaluate("""
        window.APP_DATA = {
            static: {
                dropdowns: {
                    clients: ['Client A', 'Client B'],
                    networks: ['Net A', 'Net B'],
                    destinations: ['Dest A', 'Dest B']
                }
            }
        };
    """)

    # Show app section
    page.evaluate("document.getElementById('loginSection').style.display = 'none';")
    page.evaluate("document.getElementById('appSection').style.display = 'flex';")

    # Call switch functions directly in global context
    page.evaluate("switchTab('inbound');")
    page.evaluate("switchInboundMode('Temporary');")

    page.wait_for_timeout(500)

    page.screenshot(path="temp_entry_view.png")

    spinner_display = page.evaluate("document.getElementById('spinner').style.display")
    print(f"Spinner display style: '{spinner_display}'")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)

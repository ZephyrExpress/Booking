
import os
from playwright.sync_api import sync_playwright

def verify_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        file_path = os.path.abspath("index.html")
        page.goto(f"file://{file_path}")

        # Inject Mocks
        page.evaluate("""() => {
            window.APP_DATA = {
                static: {
                    staff: ['Staff1', 'Staff2'],
                    dropdowns: {
                        networks: ['DHL', 'FedEx'],
                        clients: ['Client A', 'Client B'],
                        destinations: ['USA', 'UK'],
                        extraCharges: ['Fuel', 'Handling'],
                        holdReasons: [{code:'KYC', desc:'KYC Missing'}]
                    },
                    config: { autoAwb: true, allowTransfer: true }
                },
                overview: { auto: [], paper: [] },
                workflow: { toAssign: [], toDo: [] },
                manifest: [],
                holdings: [],
                stats: { inbound: 10, auto: 2, paper: 3, holdings: 5 },
                analytics: { branchPerf: [], staffPerf: [] }
            };

            window.callApi = async () => ({ result: 'success' });

            window.doLogin = async () => {
                document.getElementById('loginSection').style.display = 'none';
                document.getElementById('appSection').style.display = 'flex';
                window.curUser = 'TestUser';
                window.curRole = 'Admin';
                if(window.initForms) window.initForms();
                if(window.renderUI) window.renderUI();
                if(window.switchTab) window.switchTab('inbound');
            };

            window.google = { script: { run: {} } };
        }""")

        page.evaluate("window.doLogin()")
        page.wait_for_timeout(1000)

        # Check Branch Field
        branch_select = page.locator("#f_branch")
        if branch_select.is_visible():
            print("PASS: Branch field is visible")
        else:
            print("FAIL: Branch field is NOT visible")

        options = branch_select.locator("option").all_inner_texts()
        print(f"Branch Options: {options}")
        if "Mahipalpur" in options:
             print("PASS: Branch options populated")

        # Check TomSelect Visibility
        # The .ts-wrapper is usually the sibling of the hidden select or replaces it visually.
        # In TomSelect 2.x, the original input is hidden, and .ts-wrapper is inserted.
        # locator("#f_client + .ts-wrapper") works if it's adjacent.
        # Or locate by class inside the column.

        # Wait for TomSelect to initialize
        page.wait_for_timeout(500)

        # Check if .ts-wrapper exists and has width
        ts_wrappers = page.locator(".ts-wrapper")
        count = ts_wrappers.count()
        print(f"TomSelect Wrappers found: {count}")

        if count > 0:
            first_ts = ts_wrappers.first
            if first_ts.is_visible():
                 width = first_ts.evaluate("el => window.getComputedStyle(el).width")
                 print(f"TomSelect Width: {width}")
                 # width might be "100px" or similar. As long as not "0px".
                 if width != "0px" and width != "auto":
                      print("PASS: TomSelect has width")
                 else:
                      print(f"FAIL: TomSelect width is {width}")
            else:
                 print("FAIL: TomSelect not visible")
        else:
            print("FAIL: No TomSelect wrappers found")

        page.screenshot(path="verification/ui_final.png")
        browser.close()

if __name__ == "__main__":
    verify_ui()

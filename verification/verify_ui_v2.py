
from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # 1. Verify Login Inputs
        u_in = page.locator("#uIn")
        p_in = page.locator("#pIn")

        u_attr = u_in.get_attribute("autocomplete")
        p_attr = p_in.get_attribute("autocomplete")

        if u_attr == "off" and p_attr == "new-password":
            print("PASS: Login attributes correct")
        else:
            print(f"FAIL: Login attributes incorrect. u={u_attr}, p={p_attr}")

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
            // Switch to Multi Inbound
            switchTab('inbound');
            switchInboundMode('Multi');
        """)

        page.wait_for_timeout(500)

        # 2. Verify Copy Button Logic
        # Row 1 (Index 0) should NOT have copy button
        # Row 2 (Index 1) SHOULD have copy button

        r0_copy = page.locator('tr[data-idx="0"] button:has-text("Copy")')
        r1_copy = page.locator('tr[data-idx="1"] button:has-text("Copy")')

        if r0_copy.count() == 0:
            print("PASS: Row 1 has no copy button")
        else:
            print("FAIL: Row 1 HAS copy button")

        if r1_copy.count() > 0:
            print("PASS: Row 2 has copy button")
        else:
            print("FAIL: Row 2 MISSING copy button")

        # 3. Test Copy Logic
        # Fill Row 1
        page.evaluate("""
            const r0 = document.querySelector('tr[data-idx="0"]');
            r0.querySelector('.multi-dest').value = 'Dest1';
            r0.querySelector('.multi-net').value = 'NetA';
            r0.querySelector('.multi-wgt').value = '10';
        """)

        # Click Copy on Row 2
        # Need to handle confirm dialog
        page.on("dialog", lambda dialog: dialog.accept())

        r1_copy.click()
        page.wait_for_timeout(200)

        # Verify Row 2 values
        dest_val = page.locator('tr[data-idx="1"] .multi-dest').input_value()
        wgt_val = page.locator('tr[data-idx="1"] .multi-wgt').input_value()

        if dest_val == 'Dest1' and wgt_val == '10':
            print("PASS: Data copied from Row 1 to Row 2")
        else:
            print(f"FAIL: Data not copied. Dest={dest_val}, Wgt={wgt_val}")

        # Verify Recursive Constraint (Row 3 should be empty)
        dest_val_3 = page.locator('tr[data-idx="2"] .multi-dest').input_value()
        if dest_val_3 == '':
            print("PASS: Recursive copy prevented (Row 3 empty)")
        else:
            print(f"FAIL: Row 3 modified! Value={dest_val_3}")

        # Screenshot
        page.screenshot(path="verification/screenshot_ui_v2.png")
        print("Screenshot taken: verification/screenshot_ui_v2.png")

        browser.close()

if __name__ == "__main__":
    run()

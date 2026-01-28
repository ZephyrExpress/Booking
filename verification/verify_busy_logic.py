
import os
from playwright.sync_api import sync_playwright

def verify_user_busy():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        file_path = os.path.abspath("index.html")
        page.goto(f"file://{file_path}")

        # Inject Mocks
        page.evaluate("""() => {
            window.APP_DATA = {
                overview: { auto: [], paper: [] },
                workflow: { toAssign: [], toDo: [] },
                stats: { inbound: 0, auto: 0, paper: 0, holdings: 0 },
                static: { staff: ['Staff1'] },
                adminPool: [{id: 'A1', client: 'C1', net: 'N1', chgWgt: 10}]
            };
            window.curUser = 'admin';
            window.curRole = 'Admin';
            window.syncData = (force) => { console.log('SYNC_CALLED'); };

            // Render Admin Task View to show dropdowns
            document.getElementById('appSection').style.display = 'block';
            document.getElementById('adminTaskView').style.display = 'block';
            // Render manually
            const pt=document.getElementById('poolBody');
            pt.innerHTML = `<tr><td>A1</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td><select id="adm_as_A1"><option value="">Sel</option><option value="S1">S1</option></select></td></tr>`;
        }""")

        # 1. Test Input Focus
        page.evaluate("() => { document.body.innerHTML += '<input id=\"testInput\">'; document.getElementById('testInput').focus(); }")
        is_busy = page.evaluate("isUserBusy()")
        print(f"Busy (Input Focus): {is_busy}")
        if not is_busy: print("FAIL: Input focus check failed")

        page.evaluate("document.activeElement.blur()")

        # 2. Test Admin Dropdown Selection
        # Force select value via JS as playwright interaction on raw file might be flaky with visibility
        page.evaluate("document.getElementById('adm_as_A1').value = 'S1'")
        is_busy_dd = page.evaluate("isUserBusy()")
        print(f"Busy (Dropdown Selected): {is_busy_dd}")
        if not is_busy_dd: print("FAIL: Dropdown check failed")

        # 3. Test Checkbox
        page.evaluate("() => { document.body.innerHTML += '<input type=\"checkbox\" id=\"chkTest\">'; document.getElementById('chkTest').checked = true; }")
        is_busy_chk = page.evaluate("isUserBusy()")
        print(f"Busy (Checkbox): {is_busy_chk}")
        if not is_busy_chk: print("FAIL: Checkbox check failed")

        browser.close()

if __name__ == "__main__":
    verify_user_busy()

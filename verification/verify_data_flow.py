import os
import json
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    cwd = os.getcwd()
    page.goto(f"file://{cwd}/index.html")

    # Mock API and App Data
    page.evaluate('''() => {
        window.APP_DATA = {
            static: { dropdowns: { networks: ['DHL'], clients: ['ClientA'], destinations: ['USA'] } },
            overview: { auto: [], paper: [] },
            manifest: [],
            holdings: [],
            advance: [],
            stats: { inbound: 0, auto: 0, paper: 0, requests: 0, holdings: 0 }
        };

        // Force populate dropdowns immediately since we bypassed syncData
        const sel = document.getElementById('f_net');
        sel.innerHTML = '<option value="">Select...</option><option value="DHL">DHL</option>';

        // Mock callApi to capture requests
        window.apiCalls = [];
        window.callApi = async function(data) {
            window.apiCalls.push(data);
            console.log("API Call:", data);
            return { result: "success", message: "Mocked Success" };
        };

        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('appSection').style.display = 'block';
    }''')

    # --- TEST 1: Inbound "Connected by Client" with Network No ---
    print("Test 1: Inbound Submit...")
    page.evaluate("switchTab('inbound')")

    # Select Mode
    page.select_option("#f_category", "Direct_Skip") # Connected by Client

    # Fill Form
    page.fill("#f_awb", "123456789")
    page.fill("#f_net_no", "NET-NO-123")
    page.select_option("#f_type", "Dox")
    page.select_option("#f_net", "DHL")
    page.evaluate("window.tomInstances.client.setValue('ClientA')")
    page.evaluate("window.tomInstances.dest.setValue('USA')")
    page.fill("#f_boxes", "1")
    page.evaluate("genBoxes()")
    # Check "KYC" paperwork
    page.check("input[value='KYC']")

    # Submit
    page.click("button:has-text('Submit Entry')")

    # Verify API Call
    calls = page.evaluate("window.apiCalls")
    if not calls:
        print("FAILED: No API calls made")
        return

    last_call = calls[-1]

    if last_call['action'] == 'submit':
        if last_call.get('netNo') == "NET-NO-123":
            print("SUCCESS: netNo 'NET-NO-123' captured.")
        else:
            print(f"FAILED: netNo mismatch. Got: {last_call.get('netNo')}")

        if last_call.get('category') == "Direct_Skip":
            print("SUCCESS: category 'Direct_Skip' captured.")
        else:
            print(f"FAILED: category mismatch. Got: {last_call.get('category')}")
    else:
        print(f"FAILED: Wrong action. Got: {last_call['action']}")

    # --- TEST 2: External Manifest Submit ---
    print("\nTest 2: External Manifest...")
    page.evaluate("window.apiCalls = []") # Reset
    page.evaluate("openExternalModal()")

    # Paste Data: AWB | Date | Dest | Net | NetNo | Pcs | Wgt | Client
    data_str = "EXT-001 | 1/1/2026 | USA | DHL | NN-999 | 5 | 10.5 | ClientA"
    page.fill("#ext_input", data_str)

    # Handle Confirm Dialog
    page.on("dialog", lambda dialog: dialog.accept())

    page.click("button:has-text('Process & Add')")

    calls = page.evaluate("window.apiCalls")
    if not calls:
        print("FAILED: No API calls made for external")
        return

    last_call = calls[-1]

    if last_call['action'] == 'submitExternalManifest':
        items = last_call.get('items', [])
        if len(items) == 1:
            item = items[0]
            if item['awb'] == "EXT-001" and item['netNo'] == "NN-999":
                print("SUCCESS: External item parsed and sent correctly.")
            else:
                print(f"FAILED: Item data mismatch. {item}")
        else:
            print(f"FAILED: Expected 1 item, got {len(items)}")
    else:
        print(f"FAILED: Wrong action. Got: {last_call['action']}")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)

from playwright.sync_api import sync_playwright
import json

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("file:///app/index.html")

        # Mock Data
        mock_data = {
            "result": "success",
            "username": "admin",
            "role": "admin",
            "name": "Admin User",
            "static": {"dropdowns": {"networks": ["DHL"], "clients": ["C1"]}, "staff": ["Alice"]},
            "overview": {
                "auto": [{"id":"AWB1", "net":"DHL", "client":"C1", "user":"U1", "boxes":"5", "chgWgt":"10"}],
                "paper": []
            },
            "workflow": { "toAssign": [], "toDo": [] },
            "stats": {"inbound":0, "auto":1, "paper":0, "requests":0},
            "manifest": [],
            "adminPool": [{"id":"P1", "net":"N1", "netNo":"NET123", "chgWgt":"5", "client":"Client1234", "details":"D1"}]
        }

        page.evaluate(f"""
            window.fetch = async (url, options) => {{
                if(options && options.body && options.body.includes('"action":"login"')) {{
                    return {{ json: async () => ({json.dumps(mock_data)}) }};
                }}
                if(url && url.toString().includes('getAllData')) {{
                    return {{ json: async () => ({json.dumps(mock_data)}) }};
                }}
                return {{ json: async () => ({{ result: "success" }}) }};
            }};
        """)

        page.fill("#uIn", "admin")
        page.fill("#pIn", "admin")
        page.evaluate("doLogin()")
        page.wait_for_timeout(1000)

        # 1. Check Overview Table
        page.evaluate("renderUI()")
        table_html = page.inner_html("#listAuto")
        if "AWB1" in table_html and "U1" in table_html:
            print("Overview Table OK.")
        else:
            print(f"Overview Table FAILED: {table_html}")

        # 2. Check Admin Pool Table Headers & Content
        page.evaluate("switchTab('taskhub')")
        headers = page.inner_text("#adminTaskView thead").upper()
        if "NET NO" in headers and "WEIGHT" in headers:
            print("Admin Table Headers OK.")
        else:
            print(f"Admin Table Headers FAILED: {headers}")

        row_text = page.inner_text("#poolBody tr")
        if "NET123" in row_text and "1234" in row_text:
            print("Admin Table Row Content OK (NetNo, Client Slice).")
        else:
            print(f"Admin Table Row Content FAILED: {row_text}")

        # 3. Check Inbound Select All
        page.evaluate("switchTab('inbound')")
        # Click Select All Checkbox directly (label has no 'for')
        page.locator("label:has-text('Select All')").locator("..").locator("input").click()
        # Check if checkboxes checked
        chk_count = page.locator(".pw-chk:checked").count()
        if chk_count == 4:
            print("Select All Paperwork OK.")
        else:
            print(f"Select All Paperwork FAILED (Count: {chk_count})")

        # 4. Check Direct Transfer Button (Staff Mode)
        page.evaluate("curRole = 'staff'; renderUI();")
        # Mock workflow data for staff
        mock_data["workflow"]["toAssign"] = [{"id":"A1", "client":"C1", "net":"N1"}]
        # Re-inject mock data into APP_DATA because renderUI uses global APP_DATA
        page.evaluate(f"window.APP_DATA = {json.dumps(mock_data)}; renderUI();")

        page.evaluate("switchTab('taskhub')")
        btn_txt = page.inner_text("#contAssign")
        if "Transfer" in btn_txt and "onclick=\"actDirectTransfer" in page.inner_html("#contAssign"):
             print("Direct Transfer Button OK.")
        else:
             print(f"Direct Transfer Button FAILED: {btn_txt}")

        page.screenshot(path="verification_v8.png")
        browser.close()

run()


from playwright.sync_api import sync_playwright
import os
import json

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1280, 'height': 800})

        # Mock API
        def handle_route(route):
            req = route.request
            post_data = req.post_data or ""

            if "script.google.com" in req.url:
                if "login" in post_data:
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=json.dumps({"result": "success", "username": "staff", "role": "Staff", "name": "Staff User"})
                    )
                elif "getAllData" in req.url:
                     route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=json.dumps({
                            "result": "success",
                            "overview": {"auto":[], "paper":[]},
                            "stats": {"inbound":0, "holdings":1},
                            "static": {"dropdowns": {"networks": ["TestNet"], "clients": ["TestClient"], "destinations": ["TestDest"], "extraCharges": ["Fuel"]}},
                            "workflow": {"toAssign": [], "toDo": []},
                            "manifest": [],
                            "holdings": [{"id":"AWB-NA", "holdStatus":"On Hold", "net":"NA", "dest":"NA", "client":"C", "chgWgt":"10"}],
                            "role": "Staff"
                        })
                    )
                elif "generateAwb" in post_data:
                    route.fulfill(status=200, content_type="application/json", body=json.dumps({"result":"success", "awb":"300000001"}))
                elif "getRecent" in req.url:
                    route.fulfill(status=200, content_type="application/json", body=json.dumps({"result":"success", "shipments":[{"id":"300000001", "date": "2023-10-27", "dest":"DXB", "net":"DHL", "boxes":2, "wgt":5}]}))
                else:
                    route.fulfill(status=200, content_type="application/json", body=json.dumps({"result": "success"}))
            else:
                route.continue_()

        page.route("**/*", handle_route)

        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Login
        page.fill("#uIn", "staff")
        page.fill("#pIn", "pass")
        page.click("button.btn-primary")

        page.wait_for_selector("#appSection", state="visible")

        # 1. Verify Redirect
        is_inbound = page.is_visible("#inbound-tab")
        print(f"Redirected to Inbound: {is_inbound}")

        # 2. Auto AWB
        page.click("button[title='Auto Generate']")
        page.wait_for_function("document.getElementById('f_awb').value === '300000001'")
        print("Auto AWB Generated: True")

        # 3. Verify Receivers Copy Panel
        page.evaluate("switchTab('receivers')")
        page.wait_for_selector("#receivers-tab", state="visible")
        # Wait for table load
        page.wait_for_selector("#rcList tr td")
        text = page.inner_text("#rcList")
        print(f"Receivers Table Content: {text}")

        # 4. Verify NA Hold Logic
        page.evaluate("switchTab('holdings')")
        page.wait_for_selector("#holdings-tab", state="visible")

        # Search
        page.fill("#holdSearchAwb", "AWB-NA")
        page.dispatch_event("#holdSearchAwb", "input")

        page.wait_for_selector("#holdResultPanel")

        has_update_btn = page.is_visible("button:has-text('Update & Save')")
        print(f"Has Correction UI: {has_update_btn}")

        os.makedirs("verification", exist_ok=True)
        page.screenshot(path="verification/receivers_na.png")

        browser.close()

if __name__ == "__main__":
    run()

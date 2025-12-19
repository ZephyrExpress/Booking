
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
                if "action=login" in post_data or "login" in post_data:
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=json.dumps({"result": "success", "username": "admin", "role": "Admin", "name": "Administrator"})
                    )
                elif "getAllData" in req.url or "getAllData" in post_data:
                     route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=json.dumps({
                            "result": "success",
                            "overview": {
                                "auto": [{"id":"AWB-AUTO-1", "chgWgt":"10.5", "net":"DHL", "boxes":"5", "client":"LONGCLIENTNAME1234", "user":"UserA"}],
                                "paper": [{"id":"AWB-PAPER-1", "chgWgt":"20.0", "net":"FedEx", "netNo":"NET-999", "boxes":"2", "client":"TESTCLIENT5678", "assignee":"Alice", "autoDoer":"Bob"}]
                            },
                            "stats": {"inbound":0, "holdings":0},
                            "static": {"dropdowns": {"networks": ["TestNet"], "clients": ["TestClient"], "destinations": ["TestDest"], "extraCharges": ["Fuel"]}},
                            "workflow": {"toAssign": [], "toDo": []},
                            "adminPool": [],
                            "manifest": [],
                            "holdings": []
                        })
                    )
                else:
                    route.fulfill(status=200, content_type="application/json", body=json.dumps({"result": "success"}))
            else:
                route.continue_()

        page.route("**/*", handle_route)

        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Login
        page.fill("#uIn", "admin")
        page.fill("#pIn", "admin")
        page.click("button.btn-primary")

        page.wait_for_selector("#appSection", state="visible")

        # Wait for renderUI
        page.wait_for_selector("#listPaper .list-item-stacked")

        # Check Paperwork Item
        paper_text = page.inner_text("#listPaper")
        print("Paperwork Text:\n", paper_text)

        # Check Automation Item
        auto_text = page.inner_text("#listAuto")
        print("Automation Text:\n", auto_text)

        # Verify specific labels
        assert "NETWORK NUMBER" in paper_text or "Network Number" in paper_text
        assert "5678" in paper_text # Client sliced
        assert "NET-999" in paper_text
        assert "Alice" in paper_text

        # Verify Auto
        assert "1234" in auto_text
        assert "UserA" in auto_text

        # Verify Buttons Color
        btn_color = page.eval_on_selector(".btn-primary", "el => getComputedStyle(el).backgroundColor")
        print(f"Button Color: {btn_color}")

        os.makedirs("verification", exist_ok=True)
        page.screenshot(path="verification/overview_stacked.png")

        browser.close()

if __name__ == "__main__":
    run()

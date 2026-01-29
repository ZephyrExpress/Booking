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
                if "action=login" in post_data:
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
                            "overview": {"auto": [], "paper": []},
                            "stats": {"inbound":0, "holdings":0},
                            "static": {"dropdowns": {"networks": ["TestNet"], "clients": ["TestClient"], "destinations": ["TestDest"], "extraCharges": ["Fuel"]}},
                        })
                    )
                elif "handleAutomationScan" in post_data:
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=json.dumps({
                            "result": "success",
                            "data": {
                                "awb": "AUTO-123", "net": "TestNet", "client": "TestClient", "dest": "TestDest",
                                "type": "Ndox", "boxes": 5
                            }
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

        # Toggle Sidebar to make it visible
        # The mobile-toggle seems to be always visible based on CSS
        page.click(".mobile-toggle")

        # Now click nav item
        page.click("#nav-inbound")
        page.wait_for_selector("#inbound-tab", state="visible")

        # Verify Tabs
        tabs = page.inner_text("#inboundModeTabs")
        print("Tabs:", tabs)
        assert "Normal" in tabs
        assert "Advance" in tabs
        assert "Auto Inbound" in tabs
        assert "Connected by Client" not in tabs

        # Switch to Auto Inbound
        page.click("text=Auto Inbound")

        # Verify View
        assert page.is_visible("#view_auto_inbound")
        assert not page.is_visible("#view_connected")
        assert not page.is_visible("#view_automation_search")

        # Check Inputs and Buttons
        assert page.is_visible("#auto_inbound_input")
        assert page.is_visible("text=Process as Connected")
        assert page.is_visible("text=Process as Automation")

        # Test Interaction (Process as Automation)
        page.fill("#auto_inbound_input", "TEST-NET-123")
        page.click("text=Process as Automation")

        # Verify Form Unhide (Logic check)
        # The mock returns success for automation scan, so form should appear
        page.wait_for_selector("#form_main_fields", state="visible")

        # Verify data population
        val = page.input_value("#f_awb")
        print("AWB populated:", val)
        assert val == "AUTO-123"

        os.makedirs("verification", exist_ok=True)
        page.screenshot(path="verification/auto_inbound.png")

        browser.close()

if __name__ == "__main__":
    run()

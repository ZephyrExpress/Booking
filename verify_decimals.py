
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
                            "overview": {"auto":[], "paper":[]},
                            "stats": {"inbound":0, "holdings":0},
                            "static": {"dropdowns": {"networks": ["TestNet"], "clients": ["TestClient"], "destinations": ["TestDest"], "extraCharges": ["Fuel"]}},
                            "workflow": {"toAssign": [], "toDo": []},
                            "adminPool": [],
                            "manifest": [],
                            "holdings": []
                        })
                    )
                else:
                    route.fulfill(
                        status=200,
                         content_type="application/json",
                        body=json.dumps({"result": "success"})
                    )
            else:
                route.continue_()

        # Intercept
        page.route("**/*", handle_route)

        # Load the local file
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Login
        page.fill("#uIn", "admin")
        page.fill("#pIn", "admin")
        page.click("button.btn-primary")

        # Wait for app section
        page.wait_for_selector("#appSection", state="visible")

        # Switch to Inbound Programmatically to avoid sidebar UI flakiness
        page.evaluate("switchTab('inbound')")
        page.wait_for_selector("#inbound-tab", state="visible")

        # Enter Boxes
        page.fill("#f_boxes", "1")
        page.click("button[onclick='genBoxes()']")

        # Wait for table row
        page.wait_for_selector("#boxTable tr")

        # Find inputs
        inputs = page.query_selector_all("#boxTable input")

        # Type decimal values
        inputs[0].fill("12.345") # Weight
        inputs[1].fill("10.5")   # Length
        inputs[2].fill("5.25")   # Width
        inputs[3].fill("2.1")    # Height

        # Trigger input event to calc
        inputs[3].dispatch_event("input")

        # Check if values are retained
        print(f"Weight Value: {inputs[0].input_value()}")
        print(f"Length Value: {inputs[1].input_value()}")

        # Check validity
        is_valid = page.evaluate("document.querySelectorAll('#boxTable input')[0].checkValidity()")
        print(f"Is Valid: {is_valid}")

        # Take screenshot
        os.makedirs("verification", exist_ok=True)
        page.screenshot(path="verification/decimals.png")

        browser.close()

if __name__ == "__main__":
    run()

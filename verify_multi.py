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
                elif "action=submit" in post_data:
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=json.dumps({"result": "success"})
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
        page.click(".mobile-toggle")

        # Now click nav item
        page.click("#nav-inbound")
        page.wait_for_selector("#inbound-tab", state="visible")

        # Switch to Multi Inbound
        page.click("text=Multiple Inbound")

        # Verify View
        assert page.is_visible("#view_multi_inbound")

        # Check Master Controls
        assert page.is_visible("#multi_date")
        assert page.is_visible("#multi_client")
        assert page.is_visible("#multi_net_common")

        # Check Table Rows (initially 10)
        rows = page.locator("#multiBody tr")
        print("Initial Rows:", rows.count())
        assert rows.count() == 10

        # Test Common Network Logic
        page.select_option("#multi_net_common", "TestNet")
        # Verify first row net is set
        first_net = page.input_value(".multi-net >> nth=0")
        assert first_net == "TestNet"

        # Fill a Row
        page.fill(".multi-awb >> nth=0", "MULTI-AWB-1")
        page.select_option(".multi-dest >> nth=0", "TestDest")
        page.fill(".multi-netno >> nth=0", "NET-001")

        # Test Box Modal
        page.click("button:has-text('1 Box') >> nth=0")
        page.wait_for_selector("#multiBoxModal", state="visible")
        page.fill("#mb_count", "2")
        # Trigger change to render rows
        page.evaluate("document.getElementById('mb_count').dispatchEvent(new Event('change'))")

        # Fill box details
        page.fill(".mb-w >> nth=0", "10")
        page.fill(".mb-l >> nth=0", "10")
        page.fill(".mb-br >> nth=0", "10")
        page.fill(".mb-h >> nth=0", "10")

        # Trigger change to ensure value is registered in DOM
        page.evaluate("document.querySelector('.mb-w').dispatchEvent(new Event('input'))")

        # Click Save
        page.click("text=Save Details")
        page.wait_for_selector("#multiBoxModal", state="hidden")

        # Wait a bit for JS logic to update
        page.wait_for_timeout(1000)

        # Check Weight updated
        wgt = page.input_value(".multi-wgt >> nth=0")
        print("Calculated Weight:", wgt)

        # Submit Batch (Need to select master client first)
        page.evaluate("window.tomInstances.multiClient.setValue('TestClient')")

        # Click Submit
        page.on("dialog", lambda dialog: dialog.accept()) # Accept confirmation
        page.click("text=Submit Batch")

        # Wait for status "Done"
        page.wait_for_selector("#multiStatus:has-text('Success')")

        # Verify row success class
        assert "table-success" in page.get_attribute("#multiBody tr >> nth=0", "class")

        os.makedirs("verification", exist_ok=True)
        page.screenshot(path="verification/multi_inbound.png")

        browser.close()

if __name__ == "__main__":
    run()

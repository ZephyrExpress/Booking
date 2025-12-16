from playwright.sync_api import sync_playwright
import json

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("file:///app/index.html")

        # 1. Initial State (0 requests)
        mock_data_0 = {
            "result": "success",
            "username": "admin",
            "role": "admin",
            "name": "Admin",
            "static": {"dropdowns": {}, "staff": ["A"]},
            "overview": { "auto": [], "paper": [] },
            "workflow": { "toAssign": [], "toDo": [] },
            "stats": {"inbound":0, "auto":0, "paper":0, "requests":0},
            "manifest": [],
            "adminPool": []
        }

        # 2. State with New Request
        mock_data_1 = mock_data_0.copy()
        mock_data_1["stats"] = {"inbound":0, "auto":0, "paper":0, "requests":1}

        # Setup Mock Fetch to return 0 initially
        page.evaluate(f"window._mockData = {json.dumps(mock_data_0)};")
        page.evaluate("""
            window.fetch = async (url) => {
                return { json: async () => window._mockData };
            };
        """)

        # Login (Init)
        page.fill("#uIn", "admin")
        page.fill("#pIn", "admin")
        page.evaluate("doLogin()")
        page.wait_for_timeout(500)

        # Check NO toast
        if page.locator(".toast").count() > 0:
            print("FAILURE: Toast appeared on init.")
        else:
            print("Success: No toast on init.")

        # Update Mock to have 1 request
        page.evaluate(f"window._mockData = {json.dumps(mock_data_1)};")

        # Trigger Sync (Polling)
        page.evaluate("syncData(false)")
        page.wait_for_timeout(500)

        # Check Toast
        toast_txt = page.inner_text(".toast-body")
        if "New Transfer Request" in toast_txt:
            print(f"Success: Notification appeared: '{toast_txt}'")
        else:
            print("FAILURE: Notification missing.")

        browser.close()

run()

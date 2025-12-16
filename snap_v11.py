from playwright.sync_api import sync_playwright
import json

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("file:///app/index.html")

        mock_data = {
            "result": "success", "username": "admin", "role": "admin", "name": "Admin",
            "static": {"dropdowns":{}, "staff":[]}, "overview": {"auto":[],"paper":[]},
            "workflow": {"toAssign":[],"toDo":[]}, "stats": {"requests":1}, "manifest": [], "adminPool": []
        }

        page.evaluate(f"window.fetch = async () => ({{ json: async () => ({json.dumps(mock_data)}) }});")
        page.fill("#uIn", "admin"); page.fill("#pIn", "admin"); page.evaluate("doLogin()");
        page.evaluate("syncData(false)") # Trigger toast manually logic
        # Force toast because lastReqCount starts at 0, syncData(false) sees 1 -> Toast.

        page.wait_for_timeout(500)
        page.screenshot(path="verification_v11.png")
        browser.close()
run()

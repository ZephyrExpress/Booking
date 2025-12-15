from playwright.sync_api import sync_playwright
import json

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the page
        page.goto("file:///app/index.html")

        # 1. Check Login Version
        login_text = page.locator("#loginSection").inner_text()
        if "v4.1" in login_text:
            print("Version v4.1 found.")
        else:
            print("Version v4.1 MISSING.")

        # Mock API response (Robustness Test: Missing dropdowns)
        mock_data = {
            "result": "success",
            "username": "testuser",
            "role": "staff",
            "name": "Test User",
            "static": None, # Simulate failure/null static data
            "overview": { "auto": [], "paper": [] },
            "workflow": { "toAssign": [], "toDo": [] },
            "stats": {"inbound":0, "auto":0, "paper":0, "requests":0},
            "manifest": [],
            "adminPool": []
        }

        # Mock fetch
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

        # Login
        page.fill("#uIn", "test")
        page.fill("#pIn", "test")
        page.evaluate("doLogin()")
        page.wait_for_timeout(1000)

        # Check if App Loaded (despite missing static data)
        if page.is_visible("#appSection"):
            print("App loaded gracefully with missing static data.")
        else:
            print("App CRASHED on missing static data.")

        # Reload with valid data for UI checks
        mock_data["static"] = {
            "dropdowns": {"networks": ["DHL"], "extraCharges": ["Charge1"]},
            "staff": ["Alice"]
        }
        page.reload()
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
        page.fill("#uIn", "test")
        page.fill("#pIn", "test")
        page.evaluate("doLogin()")
        page.wait_for_timeout(1000)
        page.evaluate("switchTab('inbound')")

        # 2. Check Input Step
        step_val = page.get_attribute("#f_payTotal", "step")
        if step_val == "0.01":
            print("Payment Input has step=0.01.")
        else:
            print(f"Payment Input step mismatch: {step_val}")

        # Check Generated Row Input Step
        page.fill("#f_boxes", "1")
        page.click("button[onclick='genBoxes()']")
        # First input in table
        row_inp = page.locator("#boxTable input").first
        row_step = row_inp.get_attribute("step")
        if row_step == "0.01":
            print("Generated Row Input has step=0.01.")
        else:
            print(f"Generated Row Input step mismatch: {row_step}")

        # 3. Check Rupee Icon
        rupee = page.locator(".bi-currency-rupee")
        if rupee.count() > 0:
            print("Rupee icon found.")
        else:
            print("Rupee icon MISSING.")

        # Screenshot
        page.screenshot(path="verification_v6.png")

        browser.close()

run()

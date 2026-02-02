from playwright.sync_api import sync_playwright
import os
import json

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        # Handle Alerts/Confirms automatically
        page.on("dialog", lambda dialog: dialog.accept())

        # Load local HTML file
        page.goto(f"file://{os.path.abspath('index.html')}")

        # Mock API
        page.evaluate("""
            window.callApi = async function(data) {
                if (!data) return { result: "error" };
                console.log("Mock API Call:", data.action);

                if (data.action === 'login') {
                    return { result: "success", username: "test", name: "Test User", role: "Staff", branch: "Naraina Vihar" };
                }
                if (data.action === 'getAllData') {
                    return {
                        result: "success",
                        role: "Staff",
                        perms: ["inbound"],
                        static: {
                            dropdowns: { clients: ["Client A", "Client B"] },
                            config: { autoAwb: true, allowTransfer: true }
                        },
                        overview: { auto: [], paper: [] },
                        stats: { inbound: 0, auto: 0, paper: 0, holdings: 0 },
                        manifest: [],
                        holdings: [],
                        advance: []
                    };
                }
                if (data.action === 'getTempEntries') {
                    return {
                        result: "success",
                        data: [
                            {
                                awb: "TEMP-BULK-001",
                                date: "2023-10-27",
                                client: "Client A",
                                weight: "20.5",
                                boxes: [
                                    {weight:5, length:10, breath:10, height:10},
                                    {weight:5.5, length:20, breath:20, height:20}
                                ],
                                branch: "Mahipalpur"
                            }
                        ]
                    };
                }
                return { result: "success", awb: "TEST-AWB" };
            };
        """)

        # Login
        page.fill("#uIn", "test")
        page.fill("#pIn", "test")
        page.click("button.login-btn")

        # Wait for app section
        page.wait_for_selector("#appSection", state="visible")

        # Open Sidebar if mobile
        if page.is_visible("button.mobile-toggle"):
             page.click("button.mobile-toggle")
             page.wait_for_selector("#sidebar.show", state="visible")

        # Click Inbound
        page.click("#nav-inbound")
        page.wait_for_selector("#inbound-tab", state="visible")

        # Click Temp Entry
        page.click("button[onclick=\"switchInboundMode('Temp')\"]")
        page.wait_for_selector("#view_temp_inbound", state="visible")

        # 1. Verify Bulk Checkbox Exists
        if not page.is_visible("#temp_is_bulk"):
            print("Error: Bulk Checkbox not visible")

        # 2. Verify List Headers (Branch)
        headers = page.locator("#view_temp_inbound thead th").all_inner_texts()
        if "Branch" not in headers:
             print("Error: Branch header missing in list")

        # 3. Test Convert Logic
        print("Clicking Convert...")
        # Ensure button is interactive
        page.wait_for_selector("button[onclick^='convertToRegular']", state="visible")
        page.click("button[onclick^='convertToRegular']")

        # Wait for switch to Normal (and Form visibility)
        page.wait_for_selector("#form_main_fields", state="visible")

        # Check Pre-filled Data
        # Branch
        branch_val = page.input_value("#f_branch")
        if branch_val != "Mahipalpur":
             print(f"Error: Branch not populated. Expected Mahipalpur, got '{branch_val}'")
        else:
             print("Success: Branch Populated Correctly")

        # Boxes Count
        boxes_val = page.input_value("#f_boxes")
        if boxes_val != "2":
             print(f"Error: Boxes count wrong. Expected 2, got '{boxes_val}'")
        else:
             print("Success: Box Count Populated")

        # Check Row 1 Dimensions
        # Inputs: 0=Weight, 1=L, 2=W, 3=H
        row1 = page.locator("#boxTable tr").nth(0)
        r1_w = row1.locator("input").nth(0).input_value()
        r1_l = row1.locator("input").nth(1).input_value()
        r1_b = row1.locator("input").nth(2).input_value()
        r1_h = row1.locator("input").nth(3).input_value()

        if r1_w != "5" or r1_l != "10" or r1_b != "10" or r1_h != "10":
            print(f"Error: Row 1 Data Mismatch. Got W:{r1_w} L:{r1_l} B:{r1_b} H:{r1_h}")
        else:
            print("Success: Row 1 Data Mapped Correctly")

        # Check Row 2 Dimensions
        row2 = page.locator("#boxTable tr").nth(1)
        r2_w = row2.locator("input").nth(0).input_value()

        if r2_w != "5.5":
            print(f"Error: Row 2 Weight Mismatch. Got {r2_w}")
        else:
            print("Success: Row 2 Data Mapped Correctly")

        # Take screenshot of Final State
        page.screenshot(path="verification/final_conversion_check.png")

        browser.close()

if __name__ == "__main__":
    run()

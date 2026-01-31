from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})

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
                            { awb: "TEMP-FINAL", date: "2023-10-27", client: "Client A", weight: "10.5", boxes: [{weight:5}, {weight:5.5}], branch: "Naraina Vihar" }
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

        # Add Box Row
        page.click("button[onclick='addTempBoxRow()']")

        # Fill Box Data to Test Calculation
        # Row 1 L, W, H, Weight
        inputs = page.locator("#tempBoxTable tr").first.locator("input")
        inputs.nth(0).fill("10") # L
        inputs.nth(1).fill("10") # W
        inputs.nth(2).fill("10") # H
        inputs.nth(3).fill("5")  # Act Wgt

        # Wait a bit for calculation
        page.wait_for_timeout(500)

        # Take screenshot of Temp Entry with Calculation
        page.screenshot(path="verification/temp_entry_final.png")

        browser.close()

if __name__ == "__main__":
    run()

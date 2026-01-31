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
                            { awb: "TEMP-20231027-CLIA-123", date: "2023-10-27", client: "Client A", weight: "10.5", boxes: [] }
                        ]
                    };
                }
                return { result: "success" };
            };
        """)

        # Login
        page.fill("#uIn", "test")
        page.fill("#pIn", "test")
        page.click("button.login-btn")

        # Wait for app section
        page.wait_for_selector("#appSection", state="visible")

        # Open Sidebar
        page.click("button.mobile-toggle")
        page.wait_for_selector("#sidebar.show", state="visible")

        # Click Inbound
        page.click("#nav-inbound")
        page.wait_for_selector("#inbound-tab", state="visible")

        # Click Temp Entry
        page.click("button[onclick=\"switchInboundMode('Temp')\"]")

        # Wait for view
        page.wait_for_selector("#view_temp_inbound", state="visible")

        # Wait a bit for render
        page.wait_for_timeout(1000)

        # Take screenshot
        page.screenshot(path="verification/temp_entry.png")

        browser.close()

if __name__ == "__main__":
    run()

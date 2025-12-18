
import time
from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Load the local index.html with the APPLIED CHANGES
        # Use absolute path to index.html
        import os
        repo_root = os.getcwd()
        page.goto(f"file://{repo_root}/index.html")

        # Inject mock data with fmtDate
        page.evaluate("""
            window.APP_DATA = {
                manifest: [
                    {
                        id: 'AWB-1001',
                        date: '2023-10-25',
                        fmtDate: '10/25/2023',
                        dest: 'USA',
                        net: 'DHL',
                        netNo: 'DHL-12345',
                        boxes: 1,
                        chgWgt: 10.5,
                        client: 'CLIENT A',
                        batchNo: null
                    },
                    {
                        id: 'AWB-1002',
                        date: '2023-10-26',
                        fmtDate: '10/26/2023',
                        dest: 'UK',
                        net: 'DHL',
                        netNo: 'DHL-67890',
                        boxes: 2,
                        chgWgt: 5.5,
                        client: 'CLIENT B',
                        batchNo: null
                    }
                ]
            };
            // Mock DOM element value for filtering
            // renderManifest uses document.getElementById('man_net')
            // It might not exist yet if the page loads and syncData hasn't run fully or if we bypassed it.
            // But page.goto loads the HTML, so elements exist.

            // We need to simulate the UI state where 'Manifest' tab is active and 'man_net' has value.

            // 1. Force the dropdown to have 'DHL'
            const mn = document.getElementById('man_net');
            if(mn) {
                mn.innerHTML = '<option value="DHL">DHL</option>';
                mn.value = 'DHL';
            }

            // 2. Call renderManifest
            window.renderManifest();
        """)

        # Verify rows are rendered
        list_el = page.locator('#manifestList')
        expect(list_el).not_to_be_empty()

        # Verify the date is displayed
        first_row = list_el.locator('tr').first
        expect(first_row).to_contain_text("10/25/2023") # Should use fmtDate

        # Take screenshot
        page.screenshot(path="verification/manifest_verified.png")
        print("Screenshot saved to verification/manifest_verified.png")

        browser.close()

if __name__ == "__main__":
    run()

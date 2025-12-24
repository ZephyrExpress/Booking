import os
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        # Load the local index.html
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Mock APP_DATA
        page.evaluate("""
            window.APP_DATA = {
                staff: [],
                dropdowns: {},
                overview: {auto:[], paper:[]},
                workflow: {toAssign:[], toDo:[]},
                manifest: [
                    {
                        id: "300100001",
                        date: "2023-10-27",
                        net: "DHL",
                        client: "Test Client",
                        dest: "US",
                        boxes: 5,
                        chgWgt: 10.5,
                        netNo: "NET123"
                    },
                    {
                        id: "300100002",
                        date: "2023-12-25",
                        net: "FedEx",
                        client: "Holiday Inc",
                        dest: "UK",
                        boxes: 2,
                        chgWgt: 5.0,
                        netNo: "NET456"
                    }
                ],
                holdings: []
            };
            window.curRole = "Admin";
            window.curPerms = [];

            // SIMULATE THE OPTIMIZATION LOGIC (which runs in syncData)
            if(window.APP_DATA.manifest) window.APP_DATA.manifest.forEach(x => x.fmtDate = new Date(x.date).toLocaleDateString());
        """)

        # Trigger rendering of Manifest tab
        page.evaluate("switchTab('manifest')")

        # Check if table rows exist
        rows = page.locator("#manifestList tr")
        print(f"Rows found: {rows.count()}")

        # Check Date Cell (Column 3)
        date1 = rows.nth(0).locator("td").nth(2).inner_text()
        print(f"Row 1 Date: {date1}")

        # Screenshot
        page.screenshot(path="verification/manifest_date.png")
        print("Screenshot saved to verification/manifest_date.png")

        browser.close()

if __name__ == "__main__":
    run()

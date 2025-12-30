import os
import sys
from playwright.sync_api import sync_playwright

def verify_sidebar_order():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Set viewport to mobile size to ensure toggle is visible
        context = browser.new_context(viewport={"width": 375, "height": 667})
        page = context.new_page()

        # Load local index.html
        page.goto(f"file://{os.getcwd()}/index.html")

        # Inject mock data to ensure sidebar renders
        page.evaluate("""
            window.APP_DATA = {
                role: 'Admin',
                perms: [],
                static: {},
                overview: {auto:[], paper:[]},
                workflow: {toAssign:[], toDo:[]},
                manifest: [],
                holdings: [],
                adminPool: []
            };
            window.curRole = 'Admin';
            window.curPerms = [];
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('appSection').style.display = 'flex';
            updateNavVisibility();
        """)

        # Open sidebar
        page.wait_for_selector('.mobile-toggle', state="visible")
        page.click('.mobile-toggle')
        page.wait_for_selector('.sidebar.show')

        # Get nav items
        items = page.query_selector_all('.nav-item-custom')
        print(f"Found {len(items)} nav items.")

        expected_order = [
            "OVERVIEW",
            "INBOUND",
            "TASK MANAGER",
            "MANIFEST",
            "RECEIVERS SLIP",
            "HOLDINGS",
            "ADMIN PANEL"
        ]

        for i, item in enumerate(items):
            # Check visibility before asserting text, as hidden items shouldn't count if we filter by visible.
            # But the selector gets all.
            # updateNavVisibility sets display:none on items based on role. We are Admin, so all should be flex/block.

            text = item.inner_text().strip().upper()
            print(f"Item {i}: {text}")
            if i < len(expected_order):
                expected = expected_order[i]
                if "TASK" in expected and "TASK" in text:
                    continue

                assert text == expected, f"Mismatch at index {i}. Expected {expected}, got {text}"

        page.screenshot(path="verification/sidebar_order.png")
        browser.close()

if __name__ == "__main__":
    verify_sidebar_order()

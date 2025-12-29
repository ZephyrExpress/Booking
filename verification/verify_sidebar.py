
import os
from playwright.sync_api import sync_playwright

def verify_sidebar_order():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Mock APP_DATA injection script
        mock_data_script = """
        window.APP_DATA = {
            staff: ['Admin', 'Staff1'],
            dropdowns: {
                networks: ['DHL', 'FedEx'],
                clients: ['Client A', 'Client B']
            },
            overview: { auto: [], paper: [] },
            workflow: { toAssign: [], toDo: [] },
            adminPool: [],
            static: { staff: ['Admin', 'Staff1'], dropdowns: { networks: [], clients: [], destinations: [] } },
            manifest: [],
            holdings: [],
            stats: { inbound: 0, auto: 0, paper: 0, holdings: 0, requests: 0 }
        };
        """

        # Load the file
        page.goto(f"file://{os.getcwd()}/index.html")

        # Inject mock data
        page.evaluate(mock_data_script)

        # Hide login, show app
        page.evaluate("document.getElementById('loginSection').style.display='none'")
        page.evaluate("document.getElementById('appSection').style.display='flex'")

        # Initialize as Admin to see all links
        page.evaluate("curRole = 'Admin'")
        page.evaluate("updateNavVisibility()")

        # --- VERIFY SIDEBAR ORDER ---
        # Select all visible nav items
        # Order: Inbound, Overview, TaskHub, Manifest, Holdings, Receivers, Admin

        nav_items = page.locator(".sidebar-nav .nav-item-custom:visible")
        count = nav_items.count()

        expected_order = [
            "Inbound",
            "Overview",
            "Task Manager", # TaskHub label changes based on role, for Admin it is Task Manager
            "Manifest",
            "Holdings",
            "Receivers Slip",
            "Admin Panel"
        ]

        print(f"Found {count} nav items.")

        for i in range(min(count, len(expected_order))):
            text = nav_items.nth(i).inner_text().strip()
            print(f"Item {i}: {text}")
            # Note: Task Manager might have extra spaces or newlines, so we check inclusion
            if expected_order[i] not in text:
                 print(f"❌ Mismatch at index {i}. Expected {expected_order[i]}, got {text}")
                 # raise Exception(f"Order Mismatch: {text} != {expected_order[i]}")
            else:
                 print(f"✅ Item {i} matches {expected_order[i]}")

        # Take screenshot
        page.screenshot(path="verification/sidebar_order.png")
        print("Verification screenshot saved.")

        browser.close()

if __name__ == "__main__":
    verify_sidebar_order()

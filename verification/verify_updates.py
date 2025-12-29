import os
from playwright.sync_api import sync_playwright

def verify_updates():
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
            workflow: { toAssign: [], toDo: [
                {id: '3001TEST', subtitle: 'Assigned', details: 'Test Task'}
            ] },
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

        # Initialize as Staff with permissions
        page.evaluate("curRole = 'Staff'")
        page.evaluate("curPerms = ['taskhub']")
        page.evaluate("updateNavVisibility()")
        page.evaluate("renderUI()")

        # --- OPEN SIDEBAR ---
        page.click(".mobile-toggle")
        page.wait_for_selector("#sidebar.show")

        # --- VERIFY QUICK ENTRY BUTTON ---
        page.click("#nav-taskhub")
        page.wait_for_selector("#staffTaskView", state="visible")

        # Check for Quick Entry button
        btn = page.locator("#staffTaskView a:has-text('Quick Entry')")
        assert btn.is_visible()
        print("Quick Entry button found in Staff View.")

        # --- VERIFY REASSIGN MODAL ---
        # Click the reassign button on the ToDo item
        reassign_btn = page.locator("#contTodo button .bi-arrow-left-right").first.locator("..")
        reassign_btn.click()

        # Wait for modal
        page.wait_for_selector("#reassignModal", state="visible")
        print("Reassign modal opened.")

        # Verify rId text
        assert page.inner_text("#rId") == "3001TEST"
        print("Reassign ID correct.")

        # Take screenshot
        page.screenshot(path="verification/staff_task_view.png", full_page=True)
        print("Verification screenshot saved.")

        browser.close()

if __name__ == "__main__":
    verify_updates()

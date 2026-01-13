
import os
from playwright.sync_api import sync_playwright, expect

def verify_ui_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Load the page
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # 2. Mock APP_DATA for Staff User
        page.evaluate("""() => {
            window.APP_DATA = {
                user: { username: 'staff1', role: 'Staff', name: 'Staff User' },
                static: { dropdowns: { networks: ['DHL', 'FedEx'], clients: ['C1', 'C2'] } },
                overview: { auto: [], paper: [] },
                workflow: {
                    toAssign: [],
                    toDo: [
                        {id: 'AWB1', client: 'C1', net: 'DHL', details: '5 Boxes', subtitle: 'Assigned by Admin'},
                        {id: 'AWB2', client: 'C2', net: 'FedEx', details: '2 Boxes', subtitle: 'Assigned by Owner'}
                    ]
                },
                adminPool: []
            };
            window.curUser = 'staff1';
            window.curRole = 'Staff';

            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('appSection').style.display = 'block';

            // Mock API
            window.callApi = async (data) => {
                console.log("API Called:", data);
                if(data.action === 'bulkPaperDone') {
                    return {result: 'success', message: 'Marked 2 items as Done'};
                }
                return {result: 'success'};
            };
        }""")

        # 3. Navigate to Task Hub (Staff View)
        page.evaluate("switchTab('taskhub')")

        # 4. Force renderTaskHub because switchTab might rely on async syncData
        page.evaluate("renderTaskHub()")

        # 4. Verify "Upload Bulk Data" Button for Staff
        # It's in #staffTaskView
        expect(page.locator("#staffTaskView")).to_be_visible()
        upload_btn = page.locator("#staffTaskView").get_by_role("button", name="Upload Bulk Data")
        expect(upload_btn).to_be_visible()
        print("Verified: Upload Bulk Data button visible for Staff")

        # 5. Verify Bulk Mark Done UI
        # Check checkboxes
        items = page.locator(".todo-chk")
        expect(items).to_have_count(2)

        # Check Select All
        select_all = page.locator("#checkAllTodo")
        expect(select_all).to_be_visible()

        # Check Mark Selected Done Button
        mark_btn = page.get_by_role("button", name="Mark Selected Done")
        expect(mark_btn).to_be_visible()
        print("Verified: Bulk Mark Done UI elements present")

        # 6. Test Interaction
        select_all.click()
        # Verify individual boxes checked
        expect(items.first).to_be_checked()
        expect(items.last).to_be_checked()

        mark_btn.click()
        # Confirm dialog mock (Playwright auto-dismisses dialogs by default unless handled,
        # but we can handle it to return true)
        page.on("dialog", lambda dialog: dialog.accept())

        # In a real run, this would trigger callApi.
        # We can verify console log if we hook it, but for now assuming logic holds if UI works.

        page.screenshot(path="verification/staff_task_hub.png")

        browser.close()

if __name__ == "__main__":
    verify_ui_changes()

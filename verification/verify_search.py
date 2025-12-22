
import os
from playwright.sync_api import sync_playwright, expect

def verify_search(page):
    # Load the page
    cwd = os.getcwd()
    page.goto(f"file://{cwd}/index.html")

    # Inject mock data
    mock_data = """
    window.APP_DATA = {
        staff: ['User1', 'User2'],
        static: { dropdowns: { networks: ['NetA', 'NetB'], destinations: ['DestA', 'DestB'], holdReasons: [{code:'BAD_ADDR', desc:'Bad Address'}] } },
        overview: {
            auto: [{id:'AWB001', netNo:'NET001', client:'Client A', net:'NetA', dest:'DestA', chgWgt:1.5}],
            paper: [{id:'AWB002', netNo:'NET002', client:'Client B', net:'NetB', dest:'DestB', chgWgt:2.5, assignee:'User1'}]
        },
        holdings: [{id:'AWB003', netNo:'NET003', client:'Client C', net:'NetA', dest:'DestA', chgWgt:3.5, holdStatus:'On Hold', holdReason:'BAD_ADDR'}],
        manifest: [{id:'AWB004', netNo:'NET004', client:'Client D', net:'NetB', dest:'DestB', chgWgt:4.5}]
    };
    window.curRole = 'Admin';
    window.curUser = 'TestAdmin';
    window.curPerms = [];

    // Simulate Login UI Switch
    document.getElementById('loginSection').style.display='none';
    document.getElementById('appSection').style.display='flex';

    window.updateNavVisibility();
    window.switchTab('holdings');
    """
    page.evaluate(mock_data)

    # Verify Holdings Tab is visible
    expect(page.locator("#holdings-tab")).to_be_visible()

    # Test 1: Search for item in Overview Auto (AWB001)
    page.fill("#holdSearchAwb", "AWB001")
    page.dispatch_event("#holdSearchAwb", "input") # Trigger oninput

    # Check result
    result_panel = page.locator("#holdResultPanel")
    expect(result_panel).to_be_visible()
    expect(result_panel).to_contain_text("AWB001")
    expect(result_panel).to_contain_text("ACTIVE STATUS")

    # Test 2: Search for item in Holdings (AWB003)
    page.fill("#holdSearchAwb", "AWB003")
    page.dispatch_event("#holdSearchAwb", "input")

    expect(result_panel).to_contain_text("AWB003")
    expect(result_panel).to_contain_text("CURRENTLY ON HOLD")

    # Test 3: Search for item in Manifest (AWB004)
    page.fill("#holdSearchAwb", "AWB004")
    page.dispatch_event("#holdSearchAwb", "input")

    expect(result_panel).to_contain_text("AWB004")
    expect(result_panel).to_contain_text("ACTIVE STATUS")

    # Take screenshot
    page.screenshot(path="verification/verify_search.png")
    print("Verification successful. Screenshot saved to verification/verify_search.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_search(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/verify_error.png")
            raise e
        finally:
            browser.close()

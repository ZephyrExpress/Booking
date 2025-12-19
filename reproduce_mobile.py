
from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Emulate iPhone SE
        context = browser.new_context(
            viewport={'width': 375, 'height': 667},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
        )
        page = context.new_page()

        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Wait a bit for any rendering
        page.wait_for_timeout(1000)

        # Check visibility of login card
        is_visible = page.is_visible(".login-card")
        print(f"Login Card Visible: {is_visible}")

        # Get wrapper style
        wrapper_display = page.eval_on_selector(".login-wrapper", "el => getComputedStyle(el).display")
        wrapper_pos = page.eval_on_selector(".login-wrapper", "el => getComputedStyle(el).position")
        wrapper_z = page.eval_on_selector(".login-wrapper", "el => getComputedStyle(el).zIndex")
        print(f"Wrapper Display: {wrapper_display}")
        print(f"Wrapper Position: {wrapper_pos}")
        print(f"Wrapper Z-Index: {wrapper_z}")

        os.makedirs("verification", exist_ok=True)
        page.screenshot(path="verification/mobile_login_fixed.png")

        browser.close()

if __name__ == "__main__":
    run()

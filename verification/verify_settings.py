
from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Load local file
    cwd = os.getcwd()
    file_path = f"file://{cwd}/index.html"
    page.goto(file_path)

    # 1. Verify Settings Button exists
    btn = page.locator("button[onclick='openConfig()']")
    if btn.is_visible():
        print("Settings button visible")
    else:
        print("Error: Settings button not found")

    # Take screenshot of login screen
    page.screenshot(path="verification/login_screen.png")

    # 2. Test Interaction
    # Handle the prompt dialog
    def handle_dialog(dialog):
        print(f"Dialog message: {dialog.message}")
        dialog.accept("https://new.api.url/exec")

    page.on("dialog", handle_dialog)

    # Click the button
    btn.click()

    # Wait for reload (which happens after prompt accept)
    page.wait_for_load_state('networkidle')

    # Verify localStorage
    val = page.evaluate("localStorage.getItem('ZEPHYR_API_URL')")
    print(f"LocalStorage Value: {val}")

    if val == "https://new.api.url/exec":
        print("SUCCESS: API URL updated in localStorage")
    else:
        print("FAILURE: LocalStorage not updated")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)

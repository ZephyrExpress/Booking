
from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Load local file
    cwd = os.getcwd()
    file_path = f"file://{cwd}/index.html"
    page.goto(file_path)

    # Verify Settings Button DOES NOT exist
    btn = page.locator("button[onclick='openConfig()']")
    if not btn.is_visible():
        print("SUCCESS: Settings button is NOT visible")
    else:
        print("FAILURE: Settings button IS visible")

    page.screenshot(path="verification/login_screen_revert.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)

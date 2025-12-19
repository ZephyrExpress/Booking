
from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    cwd = os.getcwd()
    page.goto(f"file://{cwd}/index.html")

    # 1. Verify CSS Z-Index
    z_index = page.evaluate("getComputedStyle(document.createElement('div')).getPropertyValue('--missing-var') || 'checked'")
    # We can't check CSS rule existence easily without parsing stylesheets, but we can check if the style tag contains the rule.
    content = page.content()
    if ".ts-dropdown" in content and "z-index: 10000" in content:
        print("SUCCESS: TomSelect Z-Index fix applied.")
    else:
        print("FAIL: TomSelect Z-Index fix missing.")

    # 2. Verify Login Card Style
    if ".login-card img { max-width: 80%" in content:
        print("SUCCESS: Login Logo constraint applied.")
    else:
        print("FAIL: Login Logo constraint missing.")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)

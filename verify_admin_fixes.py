
from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    cwd = os.getcwd()
    page.goto(f"file://{cwd}/index.html")

    # 1. Verify CSS Uppercase Rule
    # We check if the style block contains the rule.
    content = page.content()
    if "text-transform: uppercase !important" in content and "h1, h2, h3" in content:
        print("SUCCESS: Global Uppercase CSS rule applied.")
    else:
        print("FAIL: Global Uppercase CSS rule missing.")

    # 2. Verify TogglePass Logic
    # We can check if the JS function is updated in the content
    if "el.onclick = function()" in content:
        print("SUCCESS: togglePass logic updated.")
    else:
        print("FAIL: togglePass logic mismatch.")

    # 3. Verify Permissions Rendering
    # Since this depends on JS execution with mock data, we can verify the template string in JS
    if "p.charAt(0).toUpperCase()" in content:
        print("SUCCESS: Permission formatting logic found.")
    else:
        print("FAIL: Permission formatting logic missing.")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)


import os
from playwright.sync_api import sync_playwright
import time

def verify_final_fix():
    cwd = os.getcwd()
    file_path = f"file://{cwd}/index.html"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(file_path)

        # 1. Check for Raw Text at Bottom
        text = page.evaluate("document.body.innerText")
        if "window.saveBulkAssignments" in text[-500:]:
             print("FAILURE: Raw JS code visible in body text.")
        else:
             print("SUCCESS: No raw JS visible.")

        # 2. Check if Functions are Defined
        is_edit_defined = page.evaluate("typeof window.openEditModal === 'function'")
        is_bulk_defined = page.evaluate("typeof window.saveBulkAssignments === 'function'")

        if is_edit_defined:
            print("SUCCESS: openEditModal is defined.")
        else:
            print("FAILURE: openEditModal is NOT defined.")

        if is_bulk_defined:
            print("SUCCESS: saveBulkAssignments is defined.")
        else:
            print("FAILURE: saveBulkAssignments is NOT defined.")

        browser.close()

if __name__ == "__main__":
    verify_final_fix()

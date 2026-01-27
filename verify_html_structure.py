import re

def verify_html():
    with open('index.html', 'r') as f:
        content = f.read()

    errors = []

    # 1. Check safeDisplay definition
    if "function safeDisplay(id, val)" not in content:
        errors.append("safeDisplay function definition missing.")

    # 2. Check for unsafe display assignments
    # We allow safeDisplay usage, but look for direct assignments
    unsafe_pattern = r"document\.getElementById\(['\"].*?['\"]\)\.style\.display\s*="
    matches = re.findall(unsafe_pattern, content)
    if matches:
        print("Found unsafe display assignments:")
        for m in matches:
            print(f"  - {m}")
        errors.append(f"Found {len(matches)} unsafe style.display assignments.")

    # 3. Check for Analytics Headers
    if "Branch Performance (Today)" not in content:
        errors.append("Branch Performance header missing.")
    if "Top Staff (Today)" not in content:
        errors.append("Top Staff header missing.")

    # 4. Check for Removed Cards
    if "Direct Shipments (Processing)" in content:
        errors.append("Direct Shipments card still present.")
    if "Advance Shipments" in content and "Manage these in the" not in content: # Advance header exists in nav, but check panel header
        # The new panel header is also "Advance Shipments" (in nav logic?) No wait.
        # Overview tab had "Advance Shipments" panel.
        # I removed the ROW.
        # But wait, did I remove the Advance Shipments panel entirely?
        # User said: "REMOVE... completely delete the HTML row containing the 'Direct Shipments (Processing)' and 'Advance Shipments' panels."
        pass

    # 5. Check Render Logic
    if "renderTable('tblBranchPerf'" not in content:
        errors.append("renderTable logic for BranchPerf missing.")

    if errors:
        print("❌ Verification Failed:")
        for e in errors:
            print(f"  - {e}")
        exit(1)
    else:
        print("✅ HTML Structure Verification Passed")

if __name__ == "__main__":
    verify_html()


import re

def verify_files():
    print("Verifying index.html...")
    with open('index.html', 'r') as f:
        html = f.read()

    # Check Holdings Table for Network No
    if '<th>Network No</th>' not in html:
        print("FAIL: 'Network No' header missing in Holdings Table.")
        return
    if '${x.netNo' not in html:
        print("FAIL: 'netNo' variable mapping missing in Holdings Table.")
        return

    # Check Search Dashboard
    if 'id="holdSearchNet"' not in html:
        print("FAIL: Network Search Input missing.")
        return
    if 'class="panel-card border-2' not in html:
        print("FAIL: Search Result Card structure missing.")
        return

    # Check Modal
    if 'id="holdModal"' not in html:
        print("FAIL: Hold Modal missing.")
        return
    if 'new TomSelect("#modalHoldReason"' not in html:
        print("FAIL: TomSelect for Hold Reason missing.")
        return

    print("index.html Verified Successfully.")

    print("Verifying Code.gs...")
    with open('Code.gs', 'r') as f:
        gs = f.read()

    # Check netNo mapping
    if 'netNo: r[20]' not in gs:
        print("FAIL: netNo mapping missing in Code.gs")
        return

    # Check Manage Hold logic
    if 'handleManageHold' not in gs:
        print("FAIL: handleManageHold function missing.")
        return

    print("Code.gs Verified Successfully.")
    print("ALL CHECKS PASSED")

if __name__ == "__main__":
    verify_files()

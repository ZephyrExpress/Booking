
def simulate_logic_v2(items, target_user):
    pending_auto = []
    pending_paper = []
    to_assign = []

    target_user = target_user.strip().lower()

    for item in items:
        # Columns
        # 8: Entry User (I)
        # 14: Auto Status (O)
        # 15: Auto Doer (P)
        # 16: Paper Status (Q)
        # 17: Assignee (R)

        r8 = item.get("user", "")
        r15 = item.get("auto_doer_raw", "")
        r14 = item.get("auto_status", "")
        r16 = item.get("paper_status", "")
        r17 = item.get("assignee", "")

        # PROPOSED CHANGE: Fallback logic
        effective_doer = r15 if r15 else r8

        # Derived values for logic
        auto_by_norm = effective_doer.strip().lower()
        paper_status_norm = r16.strip().lower()
        assignee_norm = r17.strip().lower()

        # Gatekeeper
        if r16 == "Completed":
            pass
        # Logic: If Status is Pending AND Doer is Empty -> Pending Auto
        # With fallback, Doer is rarely empty (only if both P and I are empty)
        elif (r14 == "Pending" or r14 == "") and not auto_by_norm:
            pending_auto.append(item)
        else:
            pending_paper.append(item)

            # Staff Logic
            is_my_auto = (auto_by_norm == target_user)
            is_unassigned = (paper_status_norm != "assigned") or (assignee_norm == "")

            if is_my_auto and is_unassigned:
                to_assign.append(item)

    return {
        "pending_auto": len(pending_auto),
        "pending_paper": len(pending_paper),
        "to_assign": len(to_assign),
        "items_in_paper": pending_paper
    }

# Test Cases
items = [
    # Case 1: Status Pending, P Empty, I Present (Standard new entry)
    # BEFORE: Went to Pending Auto (Empty Task Manager)
    # AFTER: Should go to Pending Paper (Visible)
    {"id": "1", "user": "Staff1", "auto_doer_raw": "", "auto_status": "Pending", "paper_status": "Pending"},

    # Case 2: Status Pending, P Present (Explicit Auto)
    # Should go to Pending Paper
    {"id": "2", "user": "Staff1", "auto_doer_raw": "Staff2", "auto_status": "Pending", "paper_status": "Pending"},

    # Case 3: Both Empty (Rare)
    # Should stay in Pending Auto
    {"id": "3", "user": "", "auto_doer_raw": "", "auto_status": "Pending", "paper_status": "Pending"},
]

print("Testing with target_user='staff1'")
result = simulate_logic_v2(items, "staff1")
print(result)

# Verification
# ID 1: effective_doer="Staff1". !auto_by_norm is False. -> Pending Paper. is_my_auto=True. -> To Assign.
# ID 2: effective_doer="Staff2". !auto_by_norm is False. -> Pending Paper. is_my_auto=False.
# ID 3: effective_doer="". !auto_by_norm is True. -> Pending Auto.

if len(result["items_in_paper"]) == 2:
    print("SUCCESS: Items 1 and 2 moved to Pending Paper.")
else:
    print("FAILURE: Count mismatch")


def simulate_logic(items, target_user, target_name):
    pending_auto = []
    pending_paper = []
    to_assign = []

    target_user = target_user.strip().lower()
    target_name = target_name.strip().lower()

    for item in items:
        # Extract fields (simulating the row array indices)
        # 14=AutoStatus, 15=AutoDoer, 16=PaperStatus, 17=Assignee
        auto_status = item.get("auto_status", "")
        auto_doer = item.get("auto_doer", "")
        paper_status = item.get("paper_status", "")
        assignee = item.get("assignee", "")

        # Normalization
        assignee_norm = assignee.strip().lower()
        auto_by_norm = auto_doer.strip().lower()
        paper_status_norm = paper_status.strip().lower()

        # The Loop Logic
        if paper_status == "Completed":
            pass # skipping completed manifest for this test

        # --- THE PROPOSED CHANGE ---
        # Old: elif auto_status == "Pending" or auto_status == "":
        # New: elif (auto_status == "Pending" or auto_status == "") and not auto_by_norm:
        elif (auto_status == "Pending" or auto_status == "") and not auto_by_norm:
            pending_auto.append(item)
        else:
            pending_paper.append(item)

            # Staff Logic
            is_my_auto = (auto_by_norm == target_user) or (target_name and auto_by_norm == target_name)

            # Unassigned Logic
            # "Assigned" means paperStatus is "Assigned" AND assignee is present?
            # Code says: isUnassigned = (paperStatusNorm !== "assigned") || (assignee === "")
            is_unassigned = (paper_status_norm != "assigned") or (assignee_norm == "")

            if is_my_auto and is_unassigned:
                to_assign.append(item)

    return {
        "pending_auto": len(pending_auto),
        "pending_paper": len(pending_paper),
        "to_assign": len(to_assign),
        "items_in_to_assign": to_assign
    }

# Test Cases
items = [
    # Case 1: Standard Pending - Should go to Pending Auto
    {"id": "1", "auto_status": "Pending", "auto_doer": "", "paper_status": "Pending", "assignee": ""},

    # Case 2: Auto Done, Paper Pending - Should go to Paper/Assign
    {"id": "2", "auto_status": "Done", "auto_doer": "staff1", "paper_status": "Pending", "assignee": ""},

    # Case 3: THE FIX - Auto Pending but Doer Present - Should go to Paper/Assign
    {"id": "3", "auto_status": "Pending", "auto_doer": "staff1", "paper_status": "Pending", "assignee": ""},

    # Case 4: Empty Status but Doer Present - Should go to Paper/Assign
    {"id": "4", "auto_status": "", "auto_doer": "staff1", "paper_status": "Pending", "assignee": ""},
]

print("Testing with target_user='staff1'")
result = simulate_logic(items, "staff1", "Staff Name")
print(result)

# Verification
# ID 1 -> Pending Auto
# ID 2 -> Pending Paper -> To Assign (Match)
# ID 3 -> Pending Paper -> To Assign (Match) - This is the fix verification
# ID 4 -> Pending Paper -> To Assign (Match) - This is the fix verification

expected_to_assign = 3
if result["to_assign"] == expected_to_assign:
    print("SUCCESS: Logic correctly prioritizes AutoDoer presence.")
else:
    print(f"FAILURE: Expected {expected_to_assign} in to_assign, got {result['to_assign']}")

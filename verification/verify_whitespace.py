
class MockRow:
    def __init__(self, awb, auto_status, auto_by, paper_status, assignee, entry_user):
        self.r = [""] * 40
        self.r[0] = awb
        self.r[14] = auto_status   # Col O
        self.r[15] = auto_by       # Col P
        self.r[16] = paper_status  # Col Q
        self.r[17] = assignee      # Col R
        self.r[8] = entry_user     # Col I

def test_logic():
    target_user = "john"

    # Mock Data
    rows = [
        # 1. My Auto, Q="Assigned" -> Should NOT Show
        MockRow("AWB1", "Done", "john", "Assigned", "jane", "other"),
        # 2. My Auto, Q=" Assigned " (Whitespace) -> Should NOT Show (Bug? Currently shows if not trimmed)
        MockRow("AWB2", "Done", "john", " Assigned ", "jane", "other"),
        # 3. My Auto, Q="assigned" (Lowercase) -> Should NOT Show
        MockRow("AWB3", "Done", "john", "assigned", "jane", "other"),
        # 4. My Auto, Q="Pending" -> Should Show
        MockRow("AWB4", "Done", "john", "Pending", "", "other"),
        # 5. My Auto, Q="" -> Should Show
        MockRow("AWB5", "Done", "john", "", "", "other"),
        # 6. My Auto, Q="Completed" -> Should NOT Show (Filtered by loop logic)
        MockRow("AWB6", "Done", "john", "Completed", "jane", "other"),
    ]

    to_assign = []

    for row_obj in rows:
        r = row_obj.r

        paper_status_raw = r[16]

        # Simulate Code.gs Loop Logic
        if paper_status_raw == "Completed":
            continue # Goes to completedManifest

        # pendingPaper block
        assignee = str(r[17]).strip().lower()
        auto_by = str(r[15]).strip().lower()

        is_my_auto = (auto_by == target_user)

        # CURRENT LOGIC (Simulated)
        # const isUnassigned = (paperStatus !== "Assigned");
        # Note: In JS, " Assigned " !== "Assigned" is True. So it would show.

        # Fix: Trim and Lowercase
        paper_status_norm = str(paper_status_raw).strip().lower()
        is_unassigned = (paper_status_norm != "assigned")

        if is_my_auto and is_unassigned:
            to_assign.append(r[0])

    print("To Assign List:", to_assign)

    # Expected: AWB4, AWB5.
    # AWB1 is Assigned.
    # AWB2 is Assigned (whitespace).
    # AWB3 is Assigned (lowercase).
    # AWB6 is Completed.

    expected = ["AWB4", "AWB5"]
    if to_assign == expected:
        print("PASS: Logic handles whitespace and case correctly.")
    else:
        print(f"FAIL: Expected {expected}, got {to_assign}")

if __name__ == "__main__":
    test_logic()

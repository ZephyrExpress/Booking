
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
    target_name = "john doe"

    # Mock Data
    rows = [
        # 1. My Auto, Unassigned (Empty Q) -> Should Show
        MockRow("AWB1", "Done", "john", "", "", "other"),
        # 2. My Auto, Unassigned (Pending Q) -> Should Show
        MockRow("AWB2", "Done", "john", "Pending", "", "other"),
        # 3. My Auto, Assigned (Assigned Q) -> Should NOT Show
        MockRow("AWB3", "Done", "john", "Assigned", "jane", "other"),
        # 4. My Entry, Not My Auto, Unassigned -> Should NOT Show (New Req)
        MockRow("AWB4", "Done", "jane", "", "", "john"),
        # 5. Not My Auto/Entry -> Should NOT Show
        MockRow("AWB5", "Done", "jane", "", "", "jane"),
        # 6. Name Matching (My Auto by Name) -> Should Show
        MockRow("AWB6", "Done", "john doe", "", "", "other"),
    ]

    to_assign = []

    for row_obj in rows:
        r = row_obj.r

        # Extracted Logic from Code.gs
        auto_status = r[14]
        paper_status = r[16]

        is_pending = (auto_status == "Pending" or auto_status == "") or (paper_status != "Completed")

        if is_pending:
            if auto_status == "Pending" or auto_status == "":
                pass # pendingAuto
            else:
                # pendingPaper block

                # Logic
                assignee = str(r[17]).strip().lower()
                auto_by = str(r[15]).strip().lower()
                entry_user = str(r[8]).strip().lower()

                is_my_auto = (auto_by == target_user) or (target_name and auto_by == target_name)

                # The Fix Logic
                is_unassigned = (paper_status != "Assigned")

                if is_my_auto and is_unassigned:
                    to_assign.append(r[0])

    print("To Assign List:", to_assign)

    expected = ["AWB1", "AWB2", "AWB6"]
    assert to_assign == expected, f"Expected {expected}, got {to_assign}"
    print("Verification Passed!")

if __name__ == "__main__":
    test_logic()

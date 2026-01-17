
class MockItem:
    def __init__(self, id, paper_status, assignee):
        self.id = id
        self.paperStatus = paper_status
        self.assignee = assignee

def test_admin_filter_robust():
    pending_paper = [
        # 1. Standard Pending (Show)
        MockItem("1", "Pending", ""),
        # 2. Standard Assigned (Hide)
        MockItem("2", "Assigned", "User"),
        # 3. Inconsistent: Status Assigned but No User (Show) -> This is the fix case
        MockItem("3", "Assigned", ""),
        # 4. Inconsistent: Status Empty but User Assigned (Show) -> User might need to fix status, but it appears in list
        MockItem("4", "", "User"),
        # 5. Standard Unassigned Empty (Show)
        MockItem("5", "", ""),
    ]

    # Logic extracted from Code.gs
    # String(x.paperStatus||"").trim().toLowerCase() !== "assigned" || !x.assignee

    admin_pool = []
    for x in pending_paper:
        status_norm = str(x.paperStatus or "").strip().lower()
        if status_norm != "assigned" or not x.assignee:
            admin_pool.append(x)

    ids = [x.id for x in admin_pool]
    print("Admin Pool IDs:", ids)

    # Expected: 1, 3, 4, 5. Only 2 is hidden.
    expected = ["1", "3", "4", "5"]
    assert ids == expected, f"Expected {expected}, got {ids}"
    print("PASS: Admin Pool correctly handles inconsistent data.")

if __name__ == "__main__":
    test_admin_filter_robust()

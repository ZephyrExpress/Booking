
class MockItem:
    def __init__(self, id, paper_status):
        self.id = id
        self.paperStatus = paper_status

def test_admin_filter():
    pending_paper = [
        MockItem("1", "Pending"),
        MockItem("2", "Assigned"),
        MockItem("3", "assigned"),
        MockItem("4", ""),
        MockItem("5", " Assigned "),
    ]

    # Logic extracted from Code.gs
    admin_pool = [
        x for x in pending_paper
        if str(x.paperStatus or "").strip().lower() != "assigned"
    ]

    ids = [x.id for x in admin_pool]
    print("Admin Pool IDs:", ids)

    expected = ["1", "4"]
    assert ids == expected, f"Expected {expected}, got {ids}"
    print("PASS: Admin Pool correctly filters assigned tasks.")

if __name__ == "__main__":
    test_admin_filter()

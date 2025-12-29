
def check_login(stored_val, input_val):
    # Simulate JS: String(val)
    stored_str = str(stored_val)
    input_str = str(input_val)

    print(f"Stored: '{stored_str}' (Type: {type(stored_val)})")
    print(f"Input:  '{input_str}'")

    # 1. Hash Check (Skipped for plain text test)

    # 2. Plain Text Check
    if stored_str == input_str:
        return "Success (Exact Match)"

    if stored_str.strip() == input_str.strip():
        return "Success (Trimmed Match)"

    return "Fail"

# Scenario 1: Number in Sheet
print("--- Scenario 1: Number ---")
print(check_login(4758, "4758"))

# Scenario 2: String in Sheet
print("\n--- Scenario 2: String ---")
print(check_login("4758", "4758"))

# Scenario 3: Space in Sheet
print("\n--- Scenario 3: Space in Sheet ---")
print(check_login("4758 ", "4758"))

# Scenario 4: Space in Input
print("\n--- Scenario 4: Space in Input ---")
print(check_login("4758", "4758 "))

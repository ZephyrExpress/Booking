import hashlib

target = "5f4dcc3b5aa765d61d8327deb882cf990b99519e13a5e804f84c8d5d4480579e"
candidates = ["4758", "1234", "password", "admin", "123456", "1111", "0000", "test", "demo", "12345", "12345678", "123456789"]

print(f"Target: {target}")

for c in candidates:
    h = hashlib.sha256(c.encode()).hexdigest()
    print(f"'{c}' -> {h}")
    if h == target:
        print(f"MATCH FOUND: '{c}'")

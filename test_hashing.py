import hashlib

def hash_string_mock(s):
    # Simulate the GAS SHA-256 logic (signed byte array to hex)
    # GAS: Utilities.computeDigest(SHA_256, str) -> signed bytes
    # Then manual conversion to hex.
    # Python hashlib gives standard hex.
    # Let's just check if we can generate SHA256 in python and if the logic I wrote in GAS is standard SHA256 hex string.

    # GAS Logic from my code:
    # for (let i = 0; i < rawHash.length; i++) {
    #   let hashVal = rawHash[i];
    #   if (hashVal < 0) hashVal += 256;
    #   if (hashVal.toString(16).length == 1) txtHash += '0';
    #   txtHash += hashVal.toString(16);
    # }

    # This logic converts signed bytes (-128 to 127) to unsigned (0-255) and then to hex.
    # This IS the standard way to get a hex digest.

    m = hashlib.sha256()
    m.update(s.encode('utf-8'))
    return m.hexdigest()

print(f"Hash of 'password': {hash_string_mock('password')}")

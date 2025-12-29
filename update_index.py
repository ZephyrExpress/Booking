
with open('index.html', 'r') as f:
    content = f.read()

# Replacement 1: API URL
old_url_line = 'const API_URL="https://script.google.com/macros/s/AKfycbwBjoV46m3wTuitwgaTGunQd9KvltP27be_oKn_6ZeSAwK7qna1B99AxtEu44QR_98EGQ/exec";'
new_url_line = 'const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbwBjoV46m3wTuitwgaTGunQd9KvltP27be_oKn_6ZeSAwK7qna1B99AxtEu44QR_98EGQ/exec";\nlet API_URL = localStorage.getItem("ZEPHYR_API_URL") || DEFAULT_API_URL;'

if old_url_line not in content:
    print("Error: API URL line not found")
    # Try fuzzy match if needed, but let's see output first
    # Maybe spaces around '='?
    pass
content = content.replace(old_url_line, new_url_line)

# Replacement 2: Login Card
old_card = '<div class="login-card">'
new_card = '<div class="login-card position-relative">\n    <button class="btn btn-light btn-sm position-absolute top-0 end-0 m-3 rounded-circle shadow-sm text-muted" onclick="openConfig()" title="Settings"><i class="bi bi-gear-fill"></i></button>'
content = content.replace(old_card, new_card)

# Replacement 3: Config Function
old_func_header = '// FIXED callApi FUNCTION (Real API Only)'
new_func_header = """// CONFIG FUNCTION
window.openConfig = function() {
    const u = prompt("API Configuration\\n\\nEnter your Web App Deployment URL:", API_URL);
    if(u !== null) {
        localStorage.setItem("ZEPHYR_API_URL", u.trim());
        location.reload();
    }
}

// FIXED callApi FUNCTION (Real API Only)"""
content = content.replace(old_func_header, new_func_header)

# Replacement 4: Alert Message
old_alert = 'alert("Login Failed: Network Error.\\n\\nEnsure:\\n1. GAS Web App is deployed as \'Me\' with access \'Anyone\'/\'Anyone with Account\'.\\n2. API_URL matches deployment.\\n3. If local, ensure no CORS blockers.");'
new_alert = 'alert("Login Failed: Network Error.\\n\\nEnsure:\\n1. GAS Web App is deployed as \'Me\' with access \'Anyone\'.\\n2. API_URL is correct (Click Gear Icon to configure).\\n3. Check internet connection.");'

# The alert might have different spacing or newlines in the file vs string
# Let's try to find it more loosely or exact match if possible
if old_alert not in content:
    print("Warning: Old alert not found exactly. Trying partial match.")
    # Attempt to replace just the text part if possible, or skip if risks are high.
    # The file has:
    # alert("Login Failed: Network Error.\n\nEnsure:\n1. GAS Web App is deployed as 'Me' with access 'Anyone'/'Anyone with Account'.\n2. API_URL matches deployment.\n3. If local, ensure no CORS blockers.");
    # It seems to match exactly in the read_file output.
    pass

content = content.replace(old_alert, new_alert)

with open('index.html', 'w') as f:
    f.write(content)

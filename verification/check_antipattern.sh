#!/bin/bash
if grep -q "s.innerHTML += \`<option value=\"\${st}\">\${st}</option>\`;" index.html; then
  echo "Anti-pattern found in index.html (Failure)"
  exit 1
else
  echo "Anti-pattern NOT found in index.html (Success)"
  exit 0
fi

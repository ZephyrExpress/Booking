
// Use URLSearchParams for application/x-www-form-urlencoded
// This is often more reliable for Google Apps Script redirects across origins (file:// or localhost)
async function callApi(d){
    try {
        console.log("Calling API:", d.action);

        // Convert to Form Data
        const params = new URLSearchParams();
        for (const key in d) {
            // If the value is an object/array, stringify it
            if (typeof d[key] === 'object' && d[key] !== null) {
                params.append(key, JSON.stringify(d[key]));
            } else {
                params.append(key, d[key]);
            }
        }

        const r = await fetch(API_URL, {
            method: "POST",
            body: params, // sends application/x-www-form-urlencoded
            // No explicit headers needed, browser sets Content-Type automatically for URLSearchParams
        });

        const json = await r.json();
        console.log("API Response:", json);
        return json;
    } catch(e) {
        console.error("API Error:", e);
        // Alert the user if running locally/offline or if deployment ID is wrong
        if (d.action === "login") {
             alert("Login Failed: Network Error.\n\nIf you are running this locally, ensure:\n1. You have deployed the Google Apps Script as a Web App.\n2. You updated the API_URL in index.html to YOUR deployment URL.\n3. The deployment allows 'Anyone' or 'Anyone with Account' access.");
        }
        return { result: "error", message: e.toString() };
    }
}

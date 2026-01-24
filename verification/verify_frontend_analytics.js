
const path = require('path');
const { chromium } = require('playwright');

async function verifyFrontendAnalytics() {
    console.log("--- Verifying Frontend Analytics UI ---");

    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    const filePath = `file://${path.join(process.cwd(), 'index.html')}`;
    await page.goto(filePath);

    // Mock data to inject
    const mockData = {
        analytics: {
            branch: {
                "Naraina Vihar": { count: 5, weight: 50.5 },
                "Mahipalpur": { count: 3, weight: 25.0 }
            },
            staff: [
                { name: "Staff1", count: 4 },
                { name: "Staff2", count: 4 }
            ]
        },
        static: {
            dropdowns: {
                networks: ["DHL"],
                clients: ["Client A"],
                destinations: ["DEST A"],
            }
        },
        overview: { auto: [], paper: [] },
        stats: {}
    };

    // Inject data and render the UI
    await page.evaluate(data => {
        window.APP_DATA = data;
        window.curUser = "TestUser"; // Set a dummy user
        window.curRole = "Admin";
        // Simulate the necessary UI setup that syncData would do
        window.initForms();
        window.renderUI();
    }, mockData);

    let passed = true;

    // 1. Verify Branch Performance Table
    const narainaCount = await page.locator('#branchAnalytics tr:has-text("Naraina Vihar") td:nth-child(2) .badge').textContent();
    if (narainaCount.trim() !== '5') {
        console.log(`FAIL: Expected Naraina Vihar count to be 5, but got ${narainaCount}`);
        passed = false;
    } else {
        console.log("PASS: Naraina Vihar count is correct.");
    }

    // 2. Verify Top Staff List
    const staff1Count = await page.locator('#staffAnalytics li:has-text("Staff1") .badge').textContent();
    if (staff1Count.trim() !== '4 Shipments') {
        console.log(`FAIL: Expected Staff1 count to be '4 Shipments', but got ${staff1Count}`);
        passed = false;
    } else {
        console.log("PASS: Staff1 count is correct.");
    }

    // 3. Verify Branch Dropdown in Inbound Form
    await page.evaluate(() => window.switchTab('inbound'));
    const branchOptions = await page.locator('#f_branch option').count();
    if (branchOptions < 3) {
        console.log(`FAIL: Branch dropdown should have at least 3 options, but found ${branchOptions}`);
        passed = false;
    } else {
        console.log("PASS: Branch dropdown is populated.");
    }

    const screenshotPath = path.join('verification', 'frontend_analytics_verification.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\nScreenshot saved to: ${screenshotPath}`);

    await browser.close();

    console.log(`\nFrontend verification ${passed ? 'successful' : 'failed'}.`);
    if (!passed) {
        process.exit(1);
    }
}

verifyFrontendAnalytics();


const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

async function verifyFrontendShiftLogic() {
    console.log("--- Verifying Frontend Shift Logic ---");

    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    const filePath = `file://${path.join(process.cwd(), 'index.html')}`;
    await page.goto(filePath);

    // --- Helper to run a test scenario ---
    async function runScenario(testName, now, mockManifestData, expectedRedRows) {
        console.log(`\nRunning Scenario: ${testName}`);
        console.log(`Simulating current time: ${now.toLocaleString()}`);

        // Mock Date object inside Playwright's browser context
        await page.evaluate(isoString => {
            const mockNow = new Date(isoString);
            const OriginalDate = window.Date;
            window.Date = class extends OriginalDate {
                constructor(dateString) {
                    if (dateString) {
                        super(dateString);
                    } else {
                        super(mockNow);
                    }
                }
                static now() {
                    return mockNow.getTime();
                }
            };
        }, now.toISOString());


        // Inject mock data
        await page.evaluate(data => {
            window.APP_DATA = {
                manifest: data,
                static: { dropdowns: { networks: ["DHL"] } } // Needed for filter dropdown
            };
            // Call the render function directly
            window.renderManifest();
        }, mockManifestData);


        // Check for red rows (highlighted as overdue)
        const redRowCount = await page.locator('#manifestList tr.table-danger').count();

        console.log(`Expected overdue rows: ${expectedRedRows}, Found: ${redRowCount}`);

        const screenshotPath = path.join('verification', `${testName.replace(/\s+/g, '_')}.png`);
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to: ${screenshotPath}`);

        if (redRowCount !== expectedRedRows) {
            console.log("FAIL");
            return false;
        } else {
            console.log("PASS");
            return true;
        }
    }


    let allTestsPassed = true;

    // --- SCENARIO 1: Current time is AFTER 9 AM (1:00 PM) ---
    const nowAfter9AM = new Date();
    nowAfter9AM.setHours(13, 0, 0, 0);

    const todayAt10AM = new Date(nowAfter9AM); todayAt10AM.setHours(10, 0, 0, 0);
    const todayAt8AM = new Date(nowAfter9AM); todayAt8AM.setHours(8, 0, 0, 0); // This one should be red

    const mockDataAfter9AM = [
        { id: "A", date: todayAt10AM, net: "DHL", batchNo: null },
        { id: "B", date: todayAt8AM, net: "DHL", batchNo: null }
    ];

    if (!await runScenario("Frontend_After_9AM", nowAfter9AM, mockDataAfter9AM, 1)) {
        allTestsPassed = false;
    }


    // --- SCENARIO 2: Current time is BEFORE 9 AM (7:00 AM) ---
    const nowBefore9AM = new Date();
    nowBefore9AM.setHours(7, 0, 0, 0);

    const yesterdayAt10AM = new Date(nowBefore9AM); yesterdayAt10AM.setDate(yesterdayAt10AM.getDate() - 1); yesterdayAt10AM.setHours(10, 0, 0, 0);
    const yesterdayAt8AM = new Date(nowBefore9AM); yesterdayAt8AM.setDate(yesterdayAt8AM.getDate() - 1); yesterdayAt8AM.setHours(8, 0, 0, 0); // This one should be red

    const mockDataBefore9AM = [
        { id: "C", date: yesterdayAt10AM, net: "DHL", batchNo: null },
        { id: "D", date: yesterdayAt8AM, net: "DHL", batchNo: null }
    ];

    if (!await runScenario("Frontend_Before_9AM", nowBefore9AM, mockDataBefore9AM, 1)) {
        allTestsPassed = false;
    }

    await browser.close();

    console.log(`\nFrontend verification ${allTestsPassed ? 'successful' : 'failed'}.`);
    if (!allTestsPassed) {
        process.exit(1);
    }
}

verifyFrontendShiftLogic();

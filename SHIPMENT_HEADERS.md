# Shipments Tab Headers Configuration

To ensure the "Zephyr Express Portal" functions correctly with the latest update (v4.5), your Google Sheet "**Shipments**" tab must have the following headers in the exact order (Columns A to AA).

| Column | Header Name | Description |
| :--- | :--- | :--- |
| **A** | AWB | Airway Bill Number (Primary ID) |
| **B** | Date | Shipment Date |
| **C** | Type | Dox / Ndox |
| **D** | Network | Network Name (e.g., DHL) |
| **E** | Client | Client Name |
| **F** | Destination | Destination Country/City |
| **G** | Total Boxes | Number of pieces |
| **H** | Extra Charges | List of extra charges |
| **I** | Entry By | Username of entry staff |
| **J** | Timestamp | Entry Timestamp |
| **K** | Act Wgt | Actual Weight |
| **L** | Vol Wgt | Volumetric Weight |
| **M** | Chg Wgt | Chargeable Weight |
| **N** | Remarks | Extra Charges Remarks |
| **O** | Auto Status | Pending / Done |
| **P** | Auto By | Username (Automation) |
| **Q** | Paper Status | Pending / Assigned / Completed |
| **R** | Assigned To | Staff Name (Paperwork) |
| **S** | Assigned By | Admin Name |
| **T** | Transfer Logs | History of transfers |
| **U** | Network No. | (Synced from Booking Report) |
| **V** | Total Amount | Payment Total |
| **W** | Paid Amount | Payment Paid |
| **X** | Pending Amount | Payment Pending |
| **Y** | Manifest Batch | Batch ID (e.g., DHL-20231010-123) |
| **Z** | Manifest Date | Date of Manifest Generation |
| **AA** | Doc Details | Required Paperwork (KYC, Invoice, etc.) |

**Note:** The system reads/writes up to Column **AA** (Index 27). Please ensure these columns exist in your sheet.

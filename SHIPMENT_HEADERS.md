# Shipments Tab Headers Configuration

To ensure the "Zephyr Express Portal" functions correctly, your Google Sheet "**Shipments**" tab must have the following headers in the exact order (Columns A to AI).

| Column | Index (0-based) | Header Name | Description |
| :--- | :--- | :--- | :--- |
| **A** | 0 | AWB | Airway Bill Number (Primary ID) |
| **B** | 1 | Date | Shipment Date |
| **C** | 2 | Type | Dox / Ndox |
| **D** | 3 | Network | Network Name (e.g., DHL) |
| **E** | 4 | Client | Client Name |
| **F** | 5 | Destination | Destination Country/City |
| **G** | 6 | Total Boxes | Number of pieces |
| **H** | 7 | Extra Charges | List of extra charges |
| **I** | 8 | Entry By | Username of entry staff |
| **J** | 9 | Timestamp | Entry Timestamp |
| **K** | 10 | Act Wgt | Actual Weight |
| **L** | 11 | Vol Wgt | Volumetric Weight |
| **M** | 12 | Chg Wgt | Chargeable Weight |
| **N** | 13 | Remarks | Extra Charges Remarks |
| **O** | 14 | Auto Status | Pending / Done |
| **P** | 15 | Auto By | Username (Automation) |
| **Q** | 16 | Paper Status | Pending / Assigned / Completed |
| **R** | 17 | Assigned To | Staff Name (Paperwork) |
| **S** | 18 | Assigned By | Admin Name |
| **T** | 19 | Transfer Logs | History of transfers & status logs |
| **U** | 20 | Network No. | Carrier AWB (Synced) |
| **V** | 21 | Total Amount | Payment Total |
| **W** | 22 | Paid Amount | Payment Paid |
| **X** | 23 | Pending Amount | Payment Pending |
| **Y** | 24 | Manifest Batch | Batch ID |
| **Z** | 25 | Manifest Date | Date of Manifest Generation |
| **AA** | 26 | Doc Details | Required Paperwork (KYC, Invoice, etc.) |
| **AB** | 27 | Hold Status | On Hold / RTO |
| **AC** | 28 | Hold Reason | Reason Code |
| **AD** | 29 | Hold Remarks | Remarks for Hold/RTO |
| **AE** | 30 | Held By | User who placed hold |
| **AF** | 31 | Payee Name | Name of Payee |
| **AG** | 32 | Payee Contact | Contact of Payee |
| **AH** | 33 | Category | Normal / Advance / Direct |
| **AI** | 34 | Hold Date | Date Hold/RTO was set |

**Note:** The system reads/writes up to Column **AI** (Index 34). Please ensure these columns exist in your sheet.

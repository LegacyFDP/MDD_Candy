import os
import pandas as pd
import requests

# Read environment variables from GitHub Action
TOKEN = os.getenv("GITHUB_TOKEN")
REPO = os.getenv("REPO")
EXCEL_FILE = os.getenv("EXCEL_FILE")

ISSUES_URL = f"https://api.github.com/repos/{REPO}/issues"
HEADERS = {
    "Authorization": f"token {TOKEN}",
    "Accept": "application/vnd.github+json"
}

# Column mapping – EDIT THESE to match your spreadsheet
COLUMN_FAULT_ID = "Fault ID"
COLUMN_TITLE = "Short Description"
COLUMN_DESCRIPTION = "Description"
COLUMN_SEVERITY = "Severity"
COLUMN_OWNER = "Owner"
COLUMN_STATUS = "Status"

def build_issue_payload(row):
    title = f"Fault {row[COLUMN_FAULT_ID]}: {row[COLUMN_TITLE]}"

    body = f"""
### Fault Report

**Fault ID:** {row[COLUMN_FAULT_ID]}
**Title:** {row[COLUMN_TITLE]}
**Description:**  
{row[COLUMN_DESCRIPTION]}

**Severity:** {row[COLUMN_SEVERITY]}
**Status:** {row[COLUMN_STATUS]}
**Owner:** {row[COLUMN_OWNER]}

---

Imported automatically from Excel.
"""

    labels = []
    if pd.notna(row[COLUMN_SEVERITY]):
        labels.append(str(row[COLUMN_SEVERITY]))
    if pd.notna(row[COLUMN_STATUS]):
        labels.append(str(row[COLUMN_STATUS]))

    assignees = []
    if pd.notna(row[COLUMN_OWNER]):
        assignees.append(str(row[COLUMN_OWNER]))

    return {
        "title": title,
        "body": body,
        "labels": labels,
        "assignees": assignees
    }

def create_issue(payload):
    response = requests.post(ISSUES_URL, headers=HEADERS, json=payload)
    if response.status_code == 201:
        print(f"✓ Created issue: {payload['title']}")
    else:
        print(f"✗ Failed: {payload['title']}")
        print(response.text)

def main():
    print(f"Loading Excel file: {EXCEL_FILE}")
    df = pd.read_excel(EXCEL_FILE)

    print(f"Found {len(df)} rows. Creating issues…")

    for _, row in df.iterrows():
        payload = build_issue_payload(row)
        create_issue(payload)

    print("Done.")

if __name__ == "__main__":
    main()

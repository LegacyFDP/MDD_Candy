# Fete Store Manager — User Manual

## Overview

Fete Store Manager helps your charity track equipment stored for fete events. You can see what's in the store, check items out for events, return them when done, and keep a full history of all movements.

---

## Signing In

1. Open the app — you will see the sign-in screen.
2. Enter your **email address** and **PIN**.
3. Click **Sign In**.

Your name and role appear at the bottom of the sidebar. Click **Sign Out** when finished.

---

## Roles

| Feature | User | Admin |
|---|---|---|
| View Dashboard | ✓ | ✓ |
| View Store Assets | ✓ | ✓ |
| View Fete Events | ✓ | ✓ |
| Withdraw & Return items | ✓ | ✓ |
| Add / Edit / Delete assets | — | ✓ |
| Create / Edit fete events | — | ✓ |
| Manage store locations | — | ✓ |
| Manage users | — | ✓ |

---

## Dashboard

The dashboard gives an at-a-glance summary:

- **Asset Types** — total number of different items in the store.
- **Items Out** — how many withdrawal records are currently outstanding.
- **Active Fetes** — fete events with status set to *Active*.
- **Out of Stock** — items with zero units available.

The **Stock Alert** panel lists any item with fewer than 2 units available.

The **Items Currently Out** panel shows the most recent withdrawals that have not yet been returned.

---

## Store Assets

Shows all equipment held in the charity store, grouped by category.

### Browsing assets

- Use the **search box** to filter by name.
- Click a **category pill** to show only that category.
- Each card shows the item name, **available / total** quantity badge, storage location, and any notes.
  - Badge is **red** when stock is zero, **grey** when fewer than 3 available, **green** otherwise.

### Adding an asset *(admin only)*

1. Click **Add Asset**.
2. Fill in name, category, total quantity, storage location, and optional notes.
3. Click **Save**.

### Editing an asset *(admin only)*

Click **Edit** on any asset card, make your changes, and click **Save**.

> Note: editing an asset changes its *total* quantity. The *available* quantity is updated automatically as items are withdrawn and returned.

### Deleting an asset *(admin only)*

Click the **bin icon** on an asset card and confirm. This cannot be undone.

---

## Fete Events

Lists all charity fete events ordered by date.

### Reading the event cards

Each card shows the event name, status badge (*Planned / Active / Completed*), date, and description. If any items are currently out for that event, a **"X items out"** badge appears, along with a summary line showing how many withdrawals exist and whether all have been returned.

### Viewing withdrawn items for an event

Click the **chevron (▼)** on any event card to expand it. The **Withdrawn Items** table shows every asset that has been checked out for that fete, with quantity, who withdrew it, the date, and whether it is still **Out** or has been **Returned**.

### Creating a fete event *(admin only)*

1. Click **New Fete**.
2. Enter the event name, date, description, and status.
3. Click **Save**.

### Editing a fete event *(admin only)*

Click **Edit** on any event card to update the name, date, description, or status.

### Event statuses

| Status | Meaning |
|---|---|
| Planned | Event is upcoming, preparations in progress |
| Active | Event is currently happening |
| Completed | Event has finished |

---

## Withdrawals

Use this page to check items **out** of the store (e.g. for a fete) and back **in** when they are returned.

### Items currently out

The **Out** tab lists all withdrawals not yet returned. Each card shows:
- Asset name and quantity
- Who withdrew it and when
- Which fete it is for (if linked)
- A **Return to Store** button

### Returning an item

1. Find the item on the **Out** tab.
2. Click **Return to Store**.
3. Confirm the person returning it (defaults to you) and add an optional note.
4. Click **Return**.

The item's available quantity is immediately updated in Store Assets.

### Withdrawing an item

1. Click **Withdraw Item**.
2. Select the **asset** from the dropdown.
3. Optionally link it to a **fete event**.
4. Set the **quantity** (must not exceed what is available — an error will show if stock is insufficient).
5. Select **who is withdrawing** (defaults to you).
6. Add an optional note.
7. Click **Withdraw**.

### Full history

Click the **Full History** tab to see every withdrawal ever made, including returned items, with full dates and names.

---

## Locations *(admin only)*

Locations are the physical storage spots in your store (e.g. *Main Store Room*, *Garden Shed*, *Top Shelf A*). Assets are assigned to a location so volunteers can find them easily.

### Adding a location

1. Click **Add Location**.
2. Enter a name and optional description.
3. Click **Save**.

### Editing a location

Click the **pencil icon** on any location card.

---

## Users *(admin only)*

Manages who can sign in to the app.

### Adding a user

1. Click **Add User**.
2. Enter full name, email address, role (*Admin* or *User*), and a PIN of up to 6 digits.
3. Click **Save**.

### Editing a user

Click the **pencil icon** on any user card to update their name, email, role, or PIN.

### Deleting a user

Click the **bin icon** on a user card and confirm. You cannot delete your own account.

---

## Tips

- Items withdrawn without a fete linked will still appear on the Withdrawals page but not under any Fete Event.
- The Dashboard stock alert triggers when available quantity drops below 2 — useful for spotting items that need restocking before an event.
- Use the **Completed** status on a fete once all items have been returned so it is easy to distinguish past events from upcoming ones.

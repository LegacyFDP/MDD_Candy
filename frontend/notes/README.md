# Fete Store Manager

A charity asset-management web app for tracking physical store inventory, fete (charity sale) events, and the movement of assets in and out of storage.

---

## Overview

Fete Store Manager helps charity volunteers and administrators:

- Maintain a catalogue of physical assets stored across one or more locations
- Plan and run fete events, assign volunteers, and track which equipment has been taken to each event
- Record withdrawals when assets leave storage and mark them as returned when they come back
- Manage store locations and user accounts (admins only)

The app enforces a two-role access model — **Volunteer** and **Admin** — that is applied to both the UI and the backend.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite, React Router v7 |
| UI components | shadcn/ui (Radix UI + Tailwind CSS) |
| Icons | Lucide React |
| Backend functions | Retool serverless functions (TypeScript) |
| Database | PostgreSQL via `retoolDb` resource |
| Auth | Custom email + PIN login stored in the `users` table |

---

## Project Structure

```
/
├── frontend/
│   ├── App.tsx                  # Shell: sidebar nav + route definitions
│   ├── pages/
│   │   ├── Login.tsx            # Email + PIN login screen
│   │   ├── Dashboard.tsx        # Summary stats + stock alerts
│   │   ├── AssetsPage.tsx       # Asset catalogue (grouped by category or location)
│   │   ├── FetesPage.tsx        # Fete event list with equipment + volunteer tabs
│   │   ├── WithdrawalsPage.tsx  # Withdraw / return assets; full history table
│   │   ├── LocationsPage.tsx    # Storage location CRUD (admin only)
│   │   ├── UsersPage.tsx        # User management (admin only)
│   │   ├── HelpPage.tsx         # In-app user guide
│   │   └── ui/
│   │       └── FeteVolunteers.tsx  # Volunteer management sub-component
│   └── hooks/backend/
│       └── fete.ts              # Auto-generated hooks for all /backend/fete functions
│
└── backend/
    └── fete/
        ├── loginUser.ts
        ├── getAssets.ts / saveAsset.ts / deleteAsset.ts
        ├── getFetes.ts / saveFete.ts
        ├── getWithdrawals.ts / getFeteWithdrawals.ts
        ├── withdrawAsset.ts / returnAsset.ts
        ├── getLocations.ts / saveLocation.ts
        ├── getUsers.ts / getUsersWithFetes.ts / saveUser.ts / deleteUser.ts
        ├── getFeteVolunteers.ts / saveFeteVolunteer.ts / deleteFeteVolunteer.ts
        └── getFeteRequirements.ts / saveFeteRequirement.ts / deleteFeteRequirement.ts
```

---

## Pages & Features

### Login
- Email + PIN authentication against the `users` table.
- Session held in React state (`currentUser`); no persistent token.
- Demo credentials are shown on the login card for easy onboarding.

### Dashboard
- Live counts: total asset types, items currently out, active fetes, and out-of-stock assets.
- **Stock Alert** panel lists any asset with fewer than 2 units available.
- **Items Currently Out** panel shows the five most recent open withdrawals.

### Store Assets
- Displays every asset with its total / available quantity and home location.
- Switch between **group by category** and **group by location** views using tabs.
- Filter within a group using the pill-filter bar; search by name with the search box.
- Admins can **add**, **edit**, and **delete** assets via a dialog form.
- Availability badge colour: green = well-stocked, amber = low (< 3), red = out of stock.

### Fete Events
- Lists all fetes with status badges (`planned` / `active` / `completed`).
- Each fete card is expandable and shows two tabs:
  - **Equipment** — withdrawals linked to the fete (asset name, qty, status, dates).
  - **Volunteers** — people assigned to the fete with their role notes. Volunteers can be added or removed inline.
- Admins can create and edit fetes (name, date, description, location, status).

### Withdrawals
- **Out** tab: card grid of all currently checked-out items with a "Return to Store" action.
- **Full History** tab: paginated table of all withdrawals (both out and returned).
- New withdrawal dialog: select asset, quantity (validated against available stock), optional fete linkage, optional notes.
- Return dialog: record who returned the items and any notes.
- Available quantity on the asset record is updated automatically by the backend on both operations.

### Locations *(admin only)*
- Grid of named storage locations with optional descriptions.
- Admins can add or edit locations; they become available immediately in asset and fete dropdowns.

### Users *(admin only)*
- Separate sections for Admins and Volunteers.
- Each user card shows the user's name, email, role, and their fete history (events they have been assigned to as a volunteer).
- Admins can create, edit, or delete users; an admin cannot delete their own account.

### Help
- Fully in-app user guide with collapsible sections covering every page and workflow.
- Admin-only sections are clearly marked.

---

## Roles & Permissions

| Feature | Volunteer | Admin |
|---|:---:|:---:|
| View Dashboard | ✓ | ✓ |
| View & filter assets | ✓ | ✓ |
| Add / edit / delete assets | — | ✓ |
| View fetes | ✓ | ✓ |
| Create / edit fetes | — | ✓ |
| Add / remove volunteers | ✓ | ✓ |
| Withdraw & return assets | ✓ | ✓ |
| View withdrawal history | ✓ | ✓ |
| View locations | ✓ | ✓ |
| Add / edit locations | — | ✓ |
| User management | — | ✓ |

---

## Database Schema (key tables)

| Table | Purpose |
|---|---|
| `users` | App users with email, PIN, and role |
| `assets` | Asset catalogue with `quantity_total` and `quantity_available` |
| `store_locations` | Physical storage / event venues |
| `fetes` | Charity sale events |
| `withdrawals` | Asset movement log (out → returned) |
| `fete_volunteers` | Join table linking users to fetes with a role and notes |
| `fete_requirements` | Optional pre-planned equipment requirements per fete |

---

## Backend Functions

All serverless functions live under `/backend/fete/` and are consumed via auto-generated React hooks from `/frontend/hooks/backend/fete.ts`.

### Auth
- **`loginUser`** — validates email + PIN, returns the user record.

### Assets
- **`getAssets`** — returns all assets joined with their location name.
- **`saveAsset`** — upserts an asset (insert on no `id`, update otherwise).
- **`deleteAsset`** — deletes an asset by ID.

### Fetes
- **`getFetes`** — returns all fetes joined with location name and creator.
- **`saveFete`** — upserts a fete.

### Withdrawals
- **`getWithdrawals`** — returns withdrawals filtered by optional `status` param.
- **`getFeteWithdrawals`** — returns withdrawals for a specific fete.
- **`withdrawAsset`** — validates stock, deducts from `quantity_available`, inserts a withdrawal record.
- **`returnAsset`** — marks a withdrawal as returned and restores `quantity_available`.

### Locations
- **`getLocations`** — returns all store locations.
- **`saveLocation`** — upserts a location.

### Users
- **`getUsers`** — returns all users (without PINs).
- **`getUsersWithFetes`** — returns users with their full fete-volunteer history.
- **`saveUser`** — upserts a user.
- **`deleteUser`** — deletes a user by ID.

### Volunteers
- **`getFeteVolunteers`** — returns all volunteer assignments.
- **`saveFeteVolunteer`** — adds or updates a volunteer assignment.
- **`deleteFeteVolunteer`** — removes a volunteer from a fete.

### Requirements
- **`getFeteRequirements`** — returns planned equipment requirements for fetes.
- **`saveFeteRequirement`** / **`deleteFeteRequirement`** — manage requirements.

---

## Running Locally

The app runs inside the Retool R2 sandbox. The Vite dev server starts automatically with HMR enabled. No additional setup is required — the `retoolDb` PostgreSQL resource is connected via the Retool resource configuration.

To sign in, use the demo credentials shown on the login screen:

| Email | PIN | Role |
|---|---|---|
| alice@charity.org | 1234 | Admin |
| bob@charity.org | 2345 | Admin |
| carol@charity.org | 3456 | Volunteer |

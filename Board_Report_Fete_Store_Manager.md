# Fete Store Manager — Report to the Board

**Date:** 11 November 2026
**Prepared by:** Tim Mills
**Live address:** https://fete.oxongroup.co.uk

---

## 1. Summary

Fete Store Manager is a web application built for the charity. It keeps track of the equipment we hold in storage and the fete events where that equipment is used. It replaces an earlier version built on a paid low-code platform (Retool). The new version runs on our own server and does not depend on that platform.

Development ran from July to November 2026. The system is live and contains our current data. It is fit for use by a trusted internal team. Before it is used more widely, some security improvements are needed (see Section 6).

## 2. Purpose and users

The app answers four practical questions for the team:

- **What equipment do we have, and where is it kept?**
- **What is out at an event, booked for one, or back in store?**
- **What does each fete need, and who is helping?**
- **What happened to an item in the past?** The app keeps a full history of every time an item goes out or comes back.

It is used by charity staff and volunteers. Each person in the system has one or more roles:

| Role | Can log in? | Purpose |
|---|---|---|
| Admin | Yes | Full management of equipment, events, people and locations |
| Store Keeper | Yes | Books equipment out and receives it back |
| User | Yes | Views stock and records what goes out and comes back |
| Volunteer | No | Appears on event rotas (for example Lead Volunteer, Helper, Putting Up, Taking Down, Transport, Stall Holder) |
| Contact | No | Event contacts, kept for reference |

## 3. What the app can do

**Equipment (inventory)**
- A catalogue of all equipment, grouped by category or by storage location, with search and filters.
- Several stores can be recorded, each with an address and its own storage areas.
- Individual high-value or one-off items can be tracked one by one.
- Stock levels update automatically when items go out, are booked or come back.
- A dashboard shows stock at a glance, including warnings when an item is running low.

**Fete events**
- Each event is marked as planned, active or completed, and can be archived when finished.
- Each event has a list of the equipment it needs and the equipment issued to it.
- Each event has a pick list showing staff what to collect from which store.

**Volunteers and people**
- One list of everyone involved, with their roles and history. Duplicate records can be merged.
- A volunteer rota can be planned for each event, in hourly shifts across the event day and the days on either side.

**Printing and export**
- A Print Centre produces ready-to-print lists: events, locations, equipment, pick lists, volunteer lists and rotas.
- The volunteer rota can be saved as an Excel file or CSV.
- The equipment location report can be saved as CSV.

**Help**
- A built-in user guide is available on every screen.

## 4. Services and tools used to build and run it

### Running the live system

| Service | What it is used for | Cost |
|---|---|---|
| Virtual private server (Ubuntu Linux) | Hosts the app and its database | Monthly hosting fee |
| Domain `oxongroup.co.uk` | Web address of the app | Annual domain fee |
| Caddy web server | Serves the app securely, with free automatic HTTPS certificates | Free (open source) |
| SQLite database | Stores all data in a single file on the server | Free (open source) |
| Dropbox (planned) | Off-site copies of backups | Free or existing account |

### Building the software

| Tool or service | What it is used for |
|---|---|
| React, TypeScript, Node.js and Express | The software platform. These are widely used, well supported and free. |
| Tailwind and shadcn/ui | Visual design and screen components |
| GitHub | Stores the code, its full change history and earlier versions |
| Visual Studio Code | Editing the code |
| AI coding assistants (Claude Code, GitHub Copilot and others) | Help with writing, testing and restructuring the code, under the developer's direction |
| Automated tests and a test spreadsheet | Check that key rules work, for example roles, rota limits and merging people |

**Earlier options tried and dropped:**
- **Retool** was the original platform. We moved off it to remove the platform dependency and its ongoing cost.
- **IONOS Deploy Now** and **Microsoft Azure** were tried as hosting options. Both were dropped in favour of the simpler and cheaper approach of our own server.

## 5. Development history

| Period | Milestone |
|---|---|
| July 2026 | Moved off Retool; changed to a simpler database; app live at its own web address by 10 July; printing and the fault-reporting spreadsheet added |
| Late July – August 2026 | Store Keeper role; equipment booking; tracking of individual items; categories and storage areas; equipment reports |
| September 2026 | Volunteer management and rota; one combined People list; event contacts; new login page |
| October 2026 | Real data loaded; rota export to Excel; security updates to supporting software |
| Late October – November 2026 | The database was restructured to make it more reliable. The system was tidied up before deployment. |

There have been 145 recorded changes over about four months, all by one developer.

## 6. Risks and recommendations

The system works well for its current purpose. The board should be aware of these points:

| # | Issue | Risk | Recommendation | Priority |
|---|---|---|---|---|
| 1 | Login PINs are stored without encryption, and the server does not check who is making each request | Someone with access to the server or the code could read the PINs. A technically skilled person could get round the role checks. | Store PINs in encrypted form (hashing) and add proper login sessions on the server | **High**, especially if access is widened beyond the core team |
| 2 | A demonstration login and copies of the database are stored in the code repository | Personal data, such as names and contact details of volunteers, could be exposed if the repository is shared | Remove the data files from the repository, make sure it is private, and change any PINs that may have been exposed | **High** |
| 3 | Backups are run by hand and stored on the same server | Data could be lost if the server fails | Automate a daily backup and send copies off-site (for example to Dropbox, which is already planned) | **Medium** |
| 4 | Only one person knows how the system works | The system is hard to maintain if that person is unavailable | Keep the deployment and user guides up to date, and brief a second person | **Medium** |
| 5 | Personal data about volunteers and contacts is held | GDPR obligations apply | Record the system in the charity's data-protection register and agree how long data is kept | **Medium** |

## 7. Decisions requested from the board

1. **Note** that Fete Store Manager is live and in use.
2. **Approve** the security improvements in items 1 and 2 above before access is extended beyond the core team.
3. **Approve** the ongoing hosting and domain costs, and agree a backup arrangement.

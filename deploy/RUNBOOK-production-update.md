# Runbook: updating production safely

How to bring the live Fete Store Manager up to date with new code without
losing any live data.

**The rule:** the live database never travels back from a PC to the server.
You rehearse the upgrade on a *copy* on your PC; then the update script upgrades
the real database *in place* on the server. Nothing entered on the server while
you were testing is lost.

| | |
|---|---|
| Server | `timmi@217.154.60.212` |
| App folder on server | `/home/timmi/projects/MDD_Candy` |
| Live database (after first update) | `/home/timmi/fete-data/fete_store.db` |
| Database backups | `/home/timmi/fete-data/backups/` |
| Service | `mdd-candy` |
| Site | `fete.oxongroup.co.uk` |

PC commands are for **PowerShell**; server commands are for the server's
shell after `ssh timmi@217.154.60.212`.

---

## Stage 1 – Copy the server database to your PC

**On the server:**

```bash
grep DB_PATH ~/projects/MDD_Candy/server/.env    # where the live database is
sudo systemctl stop mdd-candy                     # a few seconds, for a clean copy
cp ~/projects/MDD_Candy/server/fete_store.db ~/fete_store-copy.db
sudo systemctl start mdd-candy
exit
```

After the first update the live database is in `~/fete-data/`, so copy
`~/fete-data/fete_store.db` instead.

**On your PC:**

```powershell
mkdir D:\Code\prod-copy
scp timmi@217.154.60.212:~/fete_store-copy.db D:\Code\prod-copy\fete_store.db
```

The copy is kept outside the repo so git never sees it.

---

## Stage 2 – Rehearse the update on your PC (copy only)

Stop your dev server first (**Ctrl+C**), as it uses the same port.

```powershell
cd D:\Code\MDD_Candy_staging
git checkout main
git pull
$env:DB_PATH = "D:\Code\prod-copy\fete_store.db"

npm run db:migrate --prefix server
npm run superuser:grant --prefix server -- tim.mills1947@gmail.com
npm run dev
```

Open **http://localhost:5556**, sign in and check:

- [ ] People page: everyone is there with the right roles
- [ ] Volunteer Rota: a shift such as 09:30–11:00 saves
- [ ] Locations: Active / Archived / All buttons show (you are Superuser)
- [ ] Anything else your users rely on

Read what `db:migrate` printed. Lines starting `Cleaned up …` mean old
withdrawals or requirements pointing at deleted assets were removed; the same
will happen on the server.

When finished: **Ctrl+C** and close that PowerShell window. `DB_PATH` only
applies to that window, so the next `npm run dev` uses your normal dev database.

**If anything looked wrong, stop here.** The server has not been touched.

---

## Stage 3 – Apply it on the server

```bash
ssh timmi@217.154.60.212
cd ~/projects/MDD_Candy
```

### 3a. Run the update

**First time only** (the server's old checkout does not have the script yet,
and a plain `git pull` is unsafe there because git tracks a development copy of
the database):

```bash
git fetch origin
git show origin/main:deploy/update-production.sh > /tmp/update-production.sh
sudo bash /tmp/update-production.sh
```

**Every time after that:**

```bash
sudo bash deploy/update-production.sh
```

The script:

1. Shows the maintenance page and stops the app.
2. First run only: moves the live database to `~/fete-data/fete_store.db` and
   points `server/.env` at it, so git can never overwrite it.
3. Backs up the live database to `~/fete-data/backups/`.
4. Puts back any changes `npm install` made to `package.json` /
   `package-lock.json` on the server (saved as a `.patch` in the backups
   folder), then pulls the code from `main`, installs and builds. Any *other*
   file edited on the server stops the update so nothing is lost.
5. Upgrades the database layout (`npm run db:migrate`), keeping existing records.
6. Starts the app, checks it answers, and takes the maintenance page down.

**Keep its output:** it prints the backup file and the command to restore it.
On the first run it also notes that Caddy is not set up yet – expected.

If it stops with an error, the app is left stopped and the maintenance page
stays up. See *If something goes wrong* below.

### 3b. Make yourself Superuser (first time only)

```bash
cd ~/projects/MDD_Candy/server && sudo -u timmi npm run superuser:grant -- tim.mills1947@gmail.com
```

Sign in to the live site and check it works. Use `--revoke` at the end of the
command to remove the role.

### 3c. Set up the maintenance page in Caddy (first time only)

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak
sudo nano /etc/caddy/Caddyfile
```

Add the `@maintenance` and `handle @maintenance` parts at the top of the site
block, so it reads:

```
fete.oxongroup.co.uk {
    @maintenance file {
        root /home/timmi/fete-data
        try_files maintenance.on
    }
    handle @maintenance {
        root * /home/timmi/projects/MDD_Candy
        rewrite * /503.html
        file_server {
            status 503
        }
    }

    handle /api* {
        reverse_proxy 127.0.0.1:8080
    }

    root * /home/timmi/projects/MDD_Candy/frontend/dist
    try_files {path} {path}/ /index.html
    file_server
}
```

Check and reload:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

If `validate` reports an error, put the old file back
(`sudo cp /etc/caddy/Caddyfile.bak /etc/caddy/Caddyfile`). An older Caddy
version may not accept `status 503`.

### 3d. Test the maintenance page

```bash
touch ~/fete-data/maintenance.on     # site shows "Maintenance underway"
rm ~/fete-data/maintenance.on        # app is back
```

You can use the same two commands any time you need to take the site down by
hand.

---

## If something goes wrong

**Update script stopped with an error:** read the message; it names the failed
step and the backup file. The app is stopped and the maintenance page is up.

**Put the database back** (use the backup path the script printed):

```bash
sudo systemctl stop mdd-candy
cp ~/fete-data/backups/fete_store-before-update-<date-time>.db ~/fete-data/fete_store.db
sudo systemctl start mdd-candy
rm ~/fete-data/maintenance.on
```

Restoring the database alone is not enough if the new code is the problem –
get help before rolling the code back, as the new code may have already
upgraded the database layout.

**Check the app's log:**

```bash
journalctl -u mdd-candy -n 50
```

**Check the app answers:**

```bash
curl http://127.0.0.1:8080/api/health
```

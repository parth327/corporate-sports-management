# Corporate Sports Events Console — setup for the client machine

This folder is the whole application. Nothing else needs to be installed
except Node.js (one-time, see below) — there is no separate server or
database to set up. The app currently runs against a realistic seeded demo
dataset, not a live database, so it is safe to click around and try
everything.

## What to do

1. Copy this whole folder onto the target computer (a plain copy/paste, a zip
   you extract, or a USB drive — any of those work). It does **not** need to
   go anywhere special; any folder is fine.
2. Make sure **Node.js** is installed on that computer (see below).
3. Double-click **`start.bat`**.

That's it. A console window opens, does a one-time setup on the very first
run, and then your browser opens automatically to the running app at
`http://localhost:5173`. Leave the console window open while you use the
app — closing it stops the app. To use it again later, just double-click
`start.bat` again; the one-time setup only happens once.

### If Node.js is not installed

`start.bat` will tell you if it's missing. Install it from
**https://nodejs.org/** — pick the button labelled **LTS** (not "Current"),
run the installer with the default options, restart the computer if it asks
you to, then double-click `start.bat` again. This is a normal, standard piece
of software (the same runtime countless websites and apps are built on) —
nothing about this project needs a special or modified version of it.

### The first run needs the internet, once

The very first time `start.bat` runs, it downloads the project's building
blocks (a few minutes, needs an internet connection). Every run after that
is instant and works completely offline — the app itself has no external
dependencies once it's installed; everything it needs is already inside this
folder or gets downloaded that one time.

## Signing in

The app opens on the public site. To reach the operator console, click
**Console sign in** (or go to `/login`), and use any of the demo accounts
below — they all use the password **`demo2026`**.

| Username     | Role                     | Scoped to |
|--------------|--------------------------|-----------|
| `admin`      | Main Admin               | Everything |
| `cricket`    | Management Team          | Cricket |
| `football`   | Management Team          | Football |
| `sarjana`    | Management Team          | Cultural-1 |
| `events`     | Event Management         | Cricket |
| `events-fb`  | Event Management         | Football |

Sign in as `admin` first — it's the only account that sees everything
(user management, role rights, the audit log, every sub-group's data). The
others show you what a Management Team or Event Management user sees:
narrower, scoped to only the sub-group they run.

## Two ways to run it

- **`start.bat`** — the normal way. Starts instantly, best for trying things
  out and for making any changes to how it looks or behaves.
- **`start-production.bat`** — builds an optimised copy first, then serves
  that instead (`http://localhost:4173`). Takes a little longer to start but
  is what an actual deployment would run like. Use this if the app needs to
  stay open and running for a long demo, or on an older/slower computer.

Both open in the browser automatically and both run entirely on this one
computer — nothing is sent anywhere else.

## About the data

Everything you'll see — participants, teams, fixtures, results — is realistic
seeded demo data, not a real live system. **It resets every time the app is
restarted** (closing and reopening `start.bat`), so it's completely safe to
create, edit, deactivate or delete anything while trying it out.

When this project is ready to run against the real backend systems instead, that
is a one-line change: copy `.env.example` to `.env`, set
`VITE_USE_MOCK_API=false`, and point `VITE_API_BASE_URL` at the real API.
Nothing else in the app needs to change for that switch — see the comments
inside `.env.example` for the full explanation.

## If something goes wrong

- **The console window flashes and closes immediately** — right-click
  `start.bat` and choose "Run as administrator", or open a Command Prompt
  window, type `cd` followed by a space, drag this folder into that window,
  press Enter, then type `start.bat` and press Enter — that way any error
  message stays on screen instead of disappearing with the window.
- **`npm install` fails** — this almost always means no internet connection,
  or a company firewall/proxy blocking `npmjs.com`. Try on a different
  network, or ask whoever manages the network to allow it.
- **The browser opens to a blank or broken page** — close the console
  window, delete the `node_modules` folder inside this project folder, and
  double-click `start.bat` again for a clean reinstall.
- **Port already in use** — something else on the computer is already using
  port 5173 (or 4173 for the production script). Close that other
  application, or ask for the port number in `vite.config.js` to be changed.

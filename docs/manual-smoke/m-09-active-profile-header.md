# M-09 active profile in the header manual smoke

M-09 names the active profile in the header when more than one profile
exists. Unit tests cover when it shows, the switch, the cross-tab sync
and the accessible name; an E2E test covers the switch in a data view
and the layout at 360px. What needs an eye: whether the name is
readable and reads as "this is the profile I am in", on a phone and on a
desktop, in light and dark mode.

## Setup

`develop` is not deployed, so check a local production build:

```bash
git checkout develop && git pull --ff-only
make build
make preview
```

Then open `http://localhost:6174/phylax/` (the address `make preview`
prints) in a private window, so no older service worker or vault is in
the way. For the phone check, open the same build from the phone or use
the browser's device toolbar at 360px width.

Create a vault and a first profile, for example "Nikolaos Raptis".

## Scenarios

1. **One profile: header unchanged**
   - **Steps** - With only the first profile, look at the header on
     Profil, Beobachtungen and Laborwerte.
   - **Expected** - "Befaro" on the left, no profile name next to it.
   - **Result** -

2. **Two profiles: the name appears**
   - **Steps** - "Alle Profile", "+ Neues Profil erstellen", create a
     second profile, for example "Eleni Raptis".
   - **Expected** - After the creation the header names the new
     profile. On a desktop the name stands on the same line as
     "Befaro", on a phone on a second line below it, with a small
     person icon in front.
   - **Result** -

3. **Every view**
   - **Steps** - Go through Profil, Beobachtungen, Laborwerte,
     Supplemente, Verlauf, Dokumente, Import, Einstellungen.
   - **Expected** - The name is there on each of them and readable in
     light and dark mode.
   - **Result** -

4. **Switch**
   - **Steps** - Click the name in the header. In the list choose
     "Aktivieren" on the other profile. Open Beobachtungen.
   - **Expected** - The click leads to "Alle Profile". After the
     switch the header names the other profile at once, also in
     Beobachtungen. The old name never shows for the new profile.
   - **Result** -

5. **Rename**
   - **Steps** - Profil, edit the base data, change the name, save.
   - **Expected** - The header shows the new name without leaving the
     page.
   - **Result** -

6. **Long name at 360px**
   - **Steps** - Give a profile a long name, for example
     "Maximiliane Konstantinopoulou-Schwarzenberger". Look at
     Beobachtungen at 360px width (that view also has the search
     control in the header).
   - **Expected** - The name ends in an ellipsis. The header stays one
     bar of the usual height; menu, search, theme and lock buttons are
     all there and as large as before.
   - **Result** -

7. **Two tabs**
   - **Steps** - Open the app in two tabs. Switch the profile in one.
   - **Expected** - The other tab shows the new name without a reload.
   - **Result** -

8. **Keyboard and screen reader**
   - **Steps** - Tab to the name in the header; press Enter. With a
     screen reader, read the element.
   - **Expected** - A visible focus ring like on the other header
     controls; Enter opens "Alle Profile". The screen reader says
     "Aktives Profil: <name>", link.
   - **Result** -

## Findings

## Sign-off

- [ ] Scenarios 1 to 8 walked
- [ ] Phone width and desktop width both checked
- [ ] Light mode and dark mode both checked
- [ ] Walker, date:

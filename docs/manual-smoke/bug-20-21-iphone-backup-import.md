# BUG-20 / BUG-21 iPhone backup import manual smoke

Release 1.2.1 fixes two defects of the backup import on an iPhone: a
`.phylax` file could not be chosen in the file picker (BUG-20), and the
control to choose the file was not recognisable as a button (BUG-21).
Neither can be asserted automatically: jsdom has no file picker and
renders no styles, and the Playwright WebKit build is not iOS Safari
with the Files app.

## Setup

- iPhone with iOS Safari 18 or later, the live site.
- One `.phylax` backup in the Files app, and its password.
- For scenario 4 a hardware keyboard, or a desktop browser.

## Scenarios

1. **Backup file can be chosen (BUG-20), welcome screen**
   - **Steps** - Open the site without a vault (private tab). Welcome
     screen, "Backup importieren". Tap "Datei auswählen", open the
     folder with the backup.
   - **Expected** - The `.phylax` file is not greyed out and can be
     chosen. Its name appears below the button, the metadata block
     appears, "Weiter" turns blue.
   - **Result** -

2. **Backup file can be chosen (BUG-20), Settings**
   - **Steps** - In an unlocked vault: Settings, "Backup
     wiederherstellen", tap "Backup-Datei auswählen", choose the
     backup.
   - **Expected** - The file can be chosen; the metadata appears.
   - **Result** -

3. **File button is recognisable (BUG-21)**
   - **Steps** - Welcome screen, "Backup importieren". Look at the
     screen in dark mode and in light mode.
   - **Expected** - "Datei auswählen" is a button with a border and a
     surface, comfortably tappable. Below it "Keine Datei ausgewählt."
     is readable. No second, unstyled file control is visible.
   - **Result** -

4. **Keyboard focus (BUG-21)**
   - **Steps** - On the same screen press Tab until the file button is
     reached, then Enter or Space.
   - **Expected** - The button shows a focus ring; the file picker
     opens.
   - **Result** -

5. **A file that is not a backup**
   - **Steps** - Choose a photo or another file.
   - **Expected** - Its name appears below the button together with an
     error message; "Weiter" stays disabled.
   - **Result** -

6. **Full restore**
   - **Steps** - After scenario 1 tap "Weiter", enter the password.
   - **Expected** - The backup is restored and the profile appears.
   - **Result** -

## Findings

## Sign-off

- [ ] Scenarios 1 to 6 walked on an iPhone
- [ ] Dark mode and light mode both checked for scenario 3
- [ ] Walker, date:

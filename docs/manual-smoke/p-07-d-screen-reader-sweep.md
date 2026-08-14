# P-07-d Screen-reader sweep manual smoke

Deferred from the 2026-04-29 manual sweep because no screen reader was
installed at the time. This walk validates core navigation, forms,
dialogs, import conflicts, and export flows across NVDA, VoiceOver,
Orca, and TalkBack.

## Setup

1. **Screen readers**: NVDA (Windows), VoiceOver (macOS or iOS), Orca
   (Linux), TalkBack (Android). Run all that are available.
2. **Browser**: use the platform default (NVDA + Firefox or Chrome,
   VoiceOver + Safari, Orca + Firefox, TalkBack + Chrome).
3. **Fixtures**: authenticated profile with observations, lab values,
   supplements, open points, and documents. Keep one IM-06 conflict
   fixture ready.

## Condensed checklist

- [ ] App name and current view are announced on route changes.
- [ ] Form fields have labels and required or error states are announced.
- [ ] Focus order is logical, no dead focus.
- [ ] Dialogs trap focus, close with Escape, and return focus to the
      trigger.
- [ ] Conflict dialog choices announce context and pick states.
- [ ] Export and download actions are perceivable and labeled.

## Coverage log

Completed:

- [ ]

Not covered yet:

- [ ]

## Scenarios

1. **App shell and navigation**
   - **Steps**: open `/profile`, use keyboard to open the nav drawer,
     move between routes.
   - **Expected**: route changes are announced, active nav item is clear.
   - **Result**: ☐ pass ☐ fail

2. **Forms and errors**
   - **Steps**: open `/profile/create` or `/setup`, focus each field,
     trigger one validation error.
   - **Expected**: field labels announced, error text announced, input
     described as invalid.
   - **Result**: ☐ pass ☐ fail

3. **Dialogs and focus management**
   - **Steps**: open Reset dialog or ConfirmDialog, tab through
     controls, close with Escape and cancel.
   - **Expected**: focus trapped inside dialog, close returns focus to
     the trigger.
   - **Result**: ☐ pass ☐ fail

4. **Import merge conflicts (IM-06)**
   - **Steps**: trigger the IM-06 conflict dialog, navigate between
     sections and radio choices.
   - **Expected**: each conflict announces the entity and field list,
     radio choices read with current state.
   - **Result**: ☐ pass ☐ fail

5. **Export flow**
   - **Steps**: open Export dialog, move through format buttons, start
     a download.
   - **Expected**: button labels announced, download action is
     perceivable, no unlabeled controls.
   - **Result**: ☐ pass ☐ fail

6. **AI chat (optional)**
   - **Steps**: open `/chat`, send a message, navigate between messages.
   - **Expected**: message bubbles and assistant labels are announced,
     input stays reachable.
   - **Result**: ☐ pass ☐ fail

## Findings

- (none yet)

## Sign-off

- [ ] NVDA sweep complete
- [ ] VoiceOver sweep complete
- [ ] Orca sweep complete
- [ ] TalkBack sweep complete
- [ ] Category A findings registered as P-07-d-a..n in ROADMAP

Walker: ********\_\_\_\_******** Date: 2026-**-**

# Lab Check

Double-click **Check Lab Performance** on the desktop while using your usual lab, call, and browser tabs. It observes the PC for 30 seconds, opens a readable report, and exits. Reports are kept in the `Reports` folder next to the script, with unique filenames for comparisons.

It measures CPU use, available RAM, committed memory, disk response, and app CPU/memory usage. It reads the existing EVE configuration and checks whether its VM process is running. If EVE is off and available memory is below its allocation plus a 2 GB planning reserve, the report flags the limited headroom.

The helper does not start EVE, close applications, alter power settings, change priorities, touch network/security settings, or stay running in the background. No administrator access or extra software is required. The existing **Start EVE-NG** shortcut starts the VM separately when you choose.

To compare changes, keep the same representative lab and apps open, run a baseline, change one thing (for example screen-share frame rate), and run again. A brief sample is not proof of sustained improvement. GPU load, temperatures, throttling and network-call quality require separate measurements.

Only performance numbers, process names and EVE allocation/state are saved. Browser URLs, Discord messages, command lines and credentials are not included. Reports stay on this PC.

For a different measurement duration, run `Lab-Check.ps1 -Seconds 60` in PowerShell. The supported range is 5–120 seconds. English Windows counter names are used; if a counter is unavailable, the script reports an error rather than inventing a result.

To remove it, delete the **Check Lab Performance** desktop shortcut and the `Lab-Check.ps1` file. Keep or delete your reports as desired. There is no service, scheduled task, or startup entry to undo.

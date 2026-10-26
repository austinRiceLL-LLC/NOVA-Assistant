# Atlas Desktop Companion

The Electron host turns the existing Atlas web application into a native Windows companion. It does not duplicate the Atlas backend or assistant state.

## Run locally

If Atlas is already running at `http://localhost:3000`:

```sh
npm run desktop
```

To start the Atlas development server when needed and then launch the companion:

```sh
npm run desktop:dev
```

To start the current Atlas installation automatically at Windows sign-in:

```powershell
powershell -ExecutionPolicy Bypass -File desktop\startup\install-startup.ps1
```

The installer removes the two legacy Nova startup launchers and creates one hidden `Atlas Companion.vbs` entry. It points to the current installation's `Atlas Runner.ps1`, launches `desktop:dev`, and records startup results in `.atlas-desktop-data/startup.log`. Electron's single-instance lock prevents duplicate companions.

Set `ATLAS_DESKTOP_URL` to use a deployed Atlas origin. Set `ATLAS_SHORTCUT` to an Electron accelerator string to replace the default `Ctrl+Alt+A` shortcut.

## Native behavior

- Edge: 86 × 178 px, transparent, frameless, always on top, hidden from the taskbar.
- Brief: 440 × 820 px, always on top, resizable, hidden from the taskbar.
- Workspace: normal 1280 × 840 px application window with taskbar presence.
- The tray menu opens any surface or quits Atlas.
- Edge and Brief positions are remembered per surface.
- The small grip at the top of Edge or Brief drags the native window.

The renderer uses `contextIsolation`, disables Node integration, enables Chromium sandboxing, and can only call the allow-listed surface bridge in `preload.cjs`. External origins open in the system browser.

On this Windows environment the launcher uses Chromium's in-process GPU compatibility mode because the isolated GPU subprocess exits with `STATUS_DLL_NOT_FOUND`. Hardware acceleration remains disabled. Remove `ATLAS_IN_PROCESS_GPU` on systems where the normal GPU subprocess is available.

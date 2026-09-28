/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, screen, shell, Tray } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.commandLine.appendSwitch("disable-features", "Vulkan,Dawn");
if (process.env.ATLAS_IN_PROCESS_GPU === "1") app.commandLine.appendSwitch("in-process-gpu");

const SURFACES = {
  edge: { width: 86, height: 178 },
  brief: { width: 440, height: 820 },
  workspace: { width: 1280, height: 840 },
};
let mainWindow;
let tray;
let quitting = false;
let currentSurface = "edge";

// Keep Chromium profile data beside the local app when the host environment
// restricts writes to the default Windows user-data directory.
if (!process.env.ATLAS_DESKTOP_USER_DATA) app.setPath("userData", path.join(__dirname, "..", ".atlas-desktop-data"));
else app.setPath("userData", process.env.ATLAS_DESKTOP_USER_DATA);

const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) app.quit();

function statePath() { return path.join(app.getPath("userData"), "window-state.json"); }
function readState() {
  try { return JSON.parse(fs.readFileSync(statePath(), "utf8")); } catch { return {}; }
}
function saveState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const state = readState();
  state[currentSurface] = mainWindow.getBounds();
  fs.writeFileSync(statePath(), JSON.stringify(state), "utf8");
}
function boundsFor(surface) {
  const size = SURFACES[surface];
  const stored = readState()[surface];
  const display = screen.getDisplayMatching(mainWindow?.getBounds() || stored || { x: 0, y: 0, width: 1, height: 1 });
  const area = display.workArea;
  const width = Math.min(size.width, area.width);
  const height = Math.min(size.height, area.height);
  if (stored && stored.x < area.x + area.width && stored.y < area.y + area.height && stored.x + 40 > area.x && stored.y + 40 > area.y) return { x: stored.x, y: stored.y, width, height };
  if (surface === "workspace") return { x: area.x + Math.round((area.width - width) / 2), y: area.y + Math.round((area.height - height) / 2), width, height };
  return { x: area.x + area.width - width - 18, y: area.y + Math.round((area.height - height) / 2), width, height };
}
function setSurface(surface, notify = true) {
  if (!SURFACES[surface] || !mainWindow || mainWindow.isDestroyed()) return;
  saveState();
  currentSurface = surface;
  mainWindow.setMaximumSize(10000, 10000);
  mainWindow.setMinimumSize(surface === "workspace" ? 900 : SURFACES[surface].width, surface === "workspace" ? 620 : SURFACES[surface].height);
  mainWindow.setMaximumSize(surface === "edge" ? 86 : 10000, surface === "edge" ? 178 : 10000);
  mainWindow.setBounds(boundsFor(surface), true);
  mainWindow.setResizable(surface !== "edge");
  mainWindow.setSkipTaskbar(surface !== "workspace");
  mainWindow.setAlwaysOnTop(surface !== "workspace", "floating");
  mainWindow.show();
  if (notify) mainWindow.webContents.send("atlas:native-surface", surface);
}
function toggleBrief() { setSurface(currentSurface === "brief" ? "edge" : "brief"); }

function createWindow() {
  const initial = boundsFor("edge");
  mainWindow = new BrowserWindow({
    ...initial,
    title: "Atlas Companion",
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: process.env.NODE_ENV !== "production",
    },
  });
  const atlasUrl = process.env.ATLAS_DESKTOP_URL || "http://localhost:3000/?desktop=1#chat";
  const allowedOrigin = new URL(atlasUrl).origin;
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  mainWindow.webContents.on("will-navigate", (event, url) => { if (new URL(url).origin !== allowedOrigin) { event.preventDefault(); shell.openExternal(url); } });
  mainWindow.webContents.on("did-finish-load", () => mainWindow.webContents.send("atlas:native-surface", currentSurface));
  mainWindow.webContents.on("did-fail-load", (_event, code, description) => console.error(`Atlas failed to load (${code}): ${description}`));
  mainWindow.on("move", saveState);
  mainWindow.on("close", event => { if (!quitting) { event.preventDefault(); mainWindow.hide(); } });
  void mainWindow.loadURL(atlasUrl).catch(error => console.error("Atlas URL failed:", error));
  setSurface("edge");
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, "..", "public", "og.png")).resize({ width: 18, height: 18 });
  tray = new Tray(icon);
  tray.setToolTip("Atlas Companion");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Show Atlas Edge", click: () => setSurface("edge") },
    { label: "Open Atlas Brief", click: () => setSurface("brief") },
    { label: "Open Atlas Workspace", click: () => setSurface("workspace") },
    { type: "separator" },
    { label: "Quit Atlas", click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on("click", toggleBrief);
}

app.whenReady().then(() => {
  if (!hasInstanceLock) return;
  ipcMain.on("atlas:set-surface", (_event, surface) => setSurface(surface, false));
  ipcMain.handle("atlas:get-config", () => ({ shortcut: process.env.ATLAS_SHORTCUT || "Ctrl+Alt+A", surface: currentSurface }));
  createWindow();
  try { createTray(); } catch (error) { console.warn("Atlas tray is unavailable:", error); }
  const shortcut = process.env.ATLAS_SHORTCUT || "Ctrl+Alt+A";
  if (!globalShortcut.register(shortcut, toggleBrief)) console.warn(`Atlas could not register ${shortcut}.`);
});
app.on("second-instance", () => {
  if (!mainWindow || mainWindow.isDestroyed()) { createWindow(); return; }
  if (mainWindow.isMinimized()) mainWindow.restore();
  setSurface("brief");
  mainWindow.focus();
});
app.on("activate", () => mainWindow ? setSurface("brief") : createWindow());
app.on("before-quit", () => { quitting = true; saveState(); globalShortcut.unregisterAll(); });
app.on("window-all-closed", () => {});

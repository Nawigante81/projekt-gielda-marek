const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const net = require("net");

const isDev = !app.isPackaged && process.env.ELECTRON_LOCAL_BUILD !== "1";
let nextProcess = null;
let logFilePath = null;

function writeLog(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);

  if (!logFilePath) {
    return;
  }

  try {
    fs.appendFileSync(logFilePath, `${line}\n`);
  } catch {
    // Ignore logging failures.
  }
}

function getNextCliPath() {
  return path.join(
    app.getAppPath(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "next.cmd" : "next"
  );
}

function getStandaloneDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app", ".next", "standalone");
  }

  if (process.env.ELECTRON_LOCAL_BUILD === "1") {
    return path.join(app.getAppPath(), ".next", "standalone");
  }

  return path.join(app.getAppPath(), ".next", "standalone");
}

function getServerEntry() {
  return path.join(getStandaloneDir(), "server.js");
}

function getServerEnvironment(port) {
  return {
    ...process.env,
    NODE_ENV: isDev ? "development" : "production",
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    ELECTRON_USER_DATA_PATH: app.getPath("userData"),
    ELECTRON_DESKTOP: "1",
  };
}

function startStandaloneServer(port) {
  if (nextProcess && !nextProcess.killed) {
    return;
  }

  writeLog(`Starting standalone server from ${getServerEntry()}`);
  nextProcess = spawn(process.execPath, [getServerEntry()], {
    cwd: getStandaloneDir(),
    env: {
      ...getServerEnvironment(port),
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  nextProcess.stdout?.on("data", (data) => {
    writeLog(`[server stdout] ${data.toString().trim()}`);
  });

  nextProcess.stderr?.on("data", (data) => {
    writeLog(`[server stderr] ${data.toString().trim()}`);
  });

  nextProcess.on("exit", (code, signal) => {
    writeLog(`Standalone server exited with code=${code} signal=${signal}`);
  });

  nextProcess.on("error", (error) => {
    writeLog(`Standalone server spawn error: ${error.stack || error.message}`);
  });
}

async function waitForPort(port, timeoutMs = 30000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const isOpen = await new Promise((resolve) => {
      const socket = net.createConnection({ port }, () => {
        socket.end();
        resolve(true);
      });

      socket.on("error", () => resolve(false));
    });

    if (isOpen) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Timed out waiting for localhost:${port}`);
}

function startNextServer(port) {
  writeLog(`startNextServer called on port ${port} (isDev=${isDev})`);

  if (isDev) {
    if (nextProcess && !nextProcess.killed) {
      return;
    }

    nextProcess = spawn(getNextCliPath(), ["dev", "-p", String(port)], {
      cwd: app.getAppPath(),
      env: getServerEnvironment(port),
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    return;
  }

  startStandaloneServer(port);
}

async function createWindow() {
  const port = 3000;
  startNextServer(port);
  await waitForPort(port);

  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1200,
    minHeight: 780,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await mainWindow.loadURL(`http://127.0.0.1:${port}`);
}

app.whenReady().then(async () => {
  const logDir = app.getPath("userData");
  fs.mkdirSync(logDir, { recursive: true });
  logFilePath = path.join(logDir, "desktop.log");

  writeLog(`App ready. isPackaged=${app.isPackaged}, appPath=${app.getAppPath()}, resourcesPath=${process.resourcesPath}`);

  process.on("uncaughtException", (error) => {
    writeLog(`uncaughtException: ${error.stack || error.message}`);
  });

  process.on("unhandledRejection", (reason) => {
    writeLog(`unhandledRejection: ${reason instanceof Error ? reason.stack : String(reason)}`);
  });

  try {
    await createWindow();
  } catch (error) {
    writeLog(`Failed to start desktop app: ${error.stack || error.message}`);
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch((error) => {
        writeLog(`Failed to recreate window: ${error.stack || error.message}`);
      });
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  writeLog("App before-quit");

  if (nextProcess && !nextProcess.killed) {
    nextProcess.kill();
  }
});

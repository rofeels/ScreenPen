import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";

type AutoUpdateStatusPayload = {
	status:
		| "idle"
		| "checking"
		| "available"
		| "downloading"
		| "downloaded"
		| "up-to-date"
		| "error"
		| "not-supported";
	version?: string;
	message?: string;
	progressPercent?: number;
};

let initialized = false;
let lastStatus: AutoUpdateStatusPayload = { status: "idle" };

export async function checkForUpdatesManually() {
	if (!app.isPackaged || process.platform !== "darwin") {
		broadcastAutoUpdateStatus({
			status: "not-supported",
			message: "Automatic updates are only enabled for packaged macOS builds right now.",
		});
		return { success: false };
	}

	await autoUpdater.checkForUpdates();
	return { success: true };
}

function broadcastAutoUpdateStatus(payload: AutoUpdateStatusPayload) {
	lastStatus = payload;

	for (const window of BrowserWindow.getAllWindows()) {
		if (!window.isDestroyed()) {
			window.webContents.send("auto-update-status", payload);
		}
	}
}

async function showUpdaterDialog(options: Electron.MessageBoxOptions) {
	const focusedWindow = BrowserWindow.getFocusedWindow();
	return focusedWindow
		? dialog.showMessageBox(focusedWindow, options)
		: dialog.showMessageBox(options);
}

export function setupAutoUpdater() {
	if (initialized) {
		return;
	}

	initialized = true;

	if (!app.isPackaged || process.platform !== "darwin") {
		broadcastAutoUpdateStatus({
			status: "not-supported",
			message: "Automatic updates are only enabled for packaged macOS builds right now.",
		});
		return;
	}

	autoUpdater.autoDownload = false;
	autoUpdater.autoInstallOnAppQuit = true;
	autoUpdater.logger = console;

	autoUpdater.on("checking-for-update", () => {
		broadcastAutoUpdateStatus({ status: "checking" });
	});

	autoUpdater.on("update-available", async (info) => {
		broadcastAutoUpdateStatus({
			status: "available",
			version: info.version,
			message: info.releaseName ?? info.version,
		});

		const result = await showUpdaterDialog({
			type: "info",
			buttons: ["Download Update", "Later"],
			defaultId: 0,
			cancelId: 1,
			title: "Update Available",
			message: `ScreenCraft ${info.version} is available.`,
			detail: "Do you want to download the update now?",
		});

		if (result.response === 0) {
			void autoUpdater.downloadUpdate();
		}
	});

	autoUpdater.on("download-progress", (progress) => {
		broadcastAutoUpdateStatus({
			status: "downloading",
			progressPercent: progress.percent,
			message: `${Math.round(progress.percent)}%`,
		});
	});

	autoUpdater.on("update-downloaded", async (info) => {
		broadcastAutoUpdateStatus({
			status: "downloaded",
			version: info.version,
			message: "Update downloaded",
		});

		const result = await showUpdaterDialog({
			type: "info",
			buttons: ["Restart and Install", "Later"],
			defaultId: 0,
			cancelId: 1,
			title: "Update Ready",
			message: `ScreenCraft ${info.version} has been downloaded.`,
			detail: "Restart the app now to install the update.",
		});

		if (result.response === 0) {
			setImmediate(() => autoUpdater.quitAndInstall());
		}
	});

	autoUpdater.on("update-not-available", (info) => {
		broadcastAutoUpdateStatus({
			status: "up-to-date",
			version: info.version,
			message: "You already have the latest version.",
		});
	});

	autoUpdater.on("error", (error) => {
		broadcastAutoUpdateStatus({
			status: "error",
			message: error == null ? "Unknown update error" : String(error),
		});
	});

	ipcMain.handle("get-auto-update-status", () => lastStatus);
	ipcMain.handle("check-for-updates", async () => checkForUpdatesManually());
	ipcMain.handle("get-app-version", () => app.getVersion());

	app.on("browser-window-created", (_event, window) => {
		if (!window.isDestroyed()) {
			window.webContents.once("did-finish-load", () => {
				if (!window.isDestroyed()) {
					window.webContents.send("auto-update-status", lastStatus);
				}
			});
		}
	});

	setTimeout(() => {
		void checkForUpdatesManually().catch((error) => {
			broadcastAutoUpdateStatus({
				status: "error",
				message: String(error),
			});
		});
	}, 15_000);
}

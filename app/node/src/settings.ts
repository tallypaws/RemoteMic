import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const appName = 'RemoteMic';

export type Compression = 'pcm' | 'opus';

export interface Settings {
	audio: {
		deviceName: string;
		sampleRate: 44100 | 48000;
		bitDepth: 16 | 24;
	};

	network: {
		serverAddress: string;
		bufferSize: number;
		compression: Compression;
	};

	ui: {
		closeToTray: boolean;
		trayIconEnabled: boolean;
		themeColor: string;
	};

	debug: {
		overlayEnabled: boolean;
	};
}

const defaults: Settings = {
	audio: {
		deviceName: 'RemoteMic',
		sampleRate: 44100,
		bitDepth: 16
	},
	network: {
		serverAddress: 'localhost',
		bufferSize: 100,
		compression: 'opus'
	},
	ui: {
		closeToTray: false,
		trayIconEnabled: true,
		themeColor: '#000000'
	},
	debug: {
		overlayEnabled: false
	}
};

export function getConfigDir() {
	const home = os.homedir();

	switch (process.platform) {
		case 'win32':
			return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), appName);

		// JUUUUUSSSTT in case i SOMEHOW decide to support macs (WHICH WONT HAPPEN!!!! (BUT JUST IN CASE!!! :3))
		case 'darwin':
			return path.join(home, 'Library', 'Application Support', appName);

		default:
			return path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), appName);
	}
}

const configDir = getConfigDir();

export async function ensureConfigDir() {
	if (!fs.existsSync(configDir)) {
		await fs.promises.mkdir(configDir, { recursive: true });
	}
}

const settingsPath = path.join(configDir, 'settings.json');

// this is currently unused
// async function getSettingsFromFile() {
// 	await ensureConfigDir();

// 	if (!fs.existsSync(settingsPath)) {
// 		await fs.promises.writeFile(settingsPath, JSON.stringify(defaults, null, 2));
// 		return defaults;
// 	}

// 	try {
// 		const data = await fs.promises.readFile(settingsPath, 'utf-8');
// 		return JSON.parse(data) as Settings;
// 	} catch (error) {
// 		console.error('Error reading settings:', error);
// 		await fs.promises.copyFile(settingsPath, settingsPath + '.backup');
// 		await fs.promises.writeFile(settingsPath, JSON.stringify(defaults, null, 2));
// 		return defaults;
// 	}
// }

function ensureConfigDirSync() {
	if (!fs.existsSync(configDir)) {
		fs.mkdirSync(configDir, { recursive: true });
	}
}

function getSettingsFromFileSync() {
	ensureConfigDirSync();
	try {
		const data = fs.readFileSync(settingsPath, 'utf-8');
		return JSON.parse(data) as Settings;
	} catch (error) {
		console.error('Error reading settings:', error);
		return defaults;
	}
}

async function saveSettings(settings: Settings) {
	ensureConfigDir();
	await fs.promises.writeFile(settingsPath, JSON.stringify(settings, null, 2));
}

// doing sync ONCE is fine i think
const settings = getSettingsFromFileSync();

export function getSettings() {
	return settings;
}

export type DeepPartial<T> = {
	[K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

function mergeSettings(defaults: Settings, newSettings: DeepPartial<Settings>): Settings {
	const merged = { ...defaults } as Settings;
	for (const [key, value] of Object.entries(newSettings)) {
		if (value !== undefined) {
			(merged[key as keyof Settings] as unknown) = value;
		}
	}
	return merged;
}

export async function updateSettings(newSettings: DeepPartial<Settings>) {
	const updatedSettings = mergeSettings(await getSettings(), newSettings);

	await saveSettings(updatedSettings);
	Object.assign(settings, updatedSettings);
}

export async function resetSettings() {
	await saveSettings(defaults);
	Object.assign(settings, defaults);
}

import fs from 'fs';
import path from 'path';

const logPath = path.join('./sidecar.log');
fs.writeFileSync(logPath, '');
const logStream = fs.createWriteStream(logPath, { flags: 'a' });
// @ts-ignore

function log(...args) {
	const line =
		`[${new Date().toISOString()}] ` +
		args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a, null, 2))).join(' ') +
		'\n';

	logStream.write(line);
}

function msg(type: string, data?: any) {
	console.log(JSON.stringify({ type, data }));
}

const origStdoutWrite = process.stdout.write.bind(process.stdout);
// @ts-ignore

process.stdout.write = (chunk, encoding, cb) => {
	log('[stdout]', chunk.toString());
	return origStdoutWrite(chunk, encoding, cb);
};

const origStderrWrite = process.stderr.write.bind(process.stderr);
// @ts-ignore

process.stderr.write = (chunk, encoding, cb) => {
	log('[stderr]', chunk.toString());
	return origStderrWrite(chunk, encoding, cb);
};

['log', 'error', 'warn', 'info', 'debug'].forEach((fn) => {
	// @ts-ignore
	const orig = console[fn];
	// @ts-ignore

	console[fn] = (...args) => {
		log(`[console.${fn}]`, ...args);
		orig.apply(console, args);
	};
});

process.on('uncaughtException', (err) => {
	log('[uncaughtException]', err.stack || err);
});

process.on('unhandledRejection', (reason, promise) => {
	const msg =
		reason instanceof Error
			? reason.stack
			: typeof reason === 'object'
				? JSON.stringify(reason, null, 2)
				: String(reason);

	log('[unhandledRejection]', msg);
});

process.on('warning', (warning) => {
	log('[warning]', warning.stack || warning);
});

log('# === sidecar started ===');

import { deferred } from '@thetally/toolbox';
import { WebSocket } from 'ws';

import * as LinuxVmic from './Vmic/linux.js';
import * as Win32Vmic from './Vmic/win32.js';
import { getSettings, updateSettings } from './settings.js';

let ws: WebSocket | null = null;

let base = 'ws://localhost:8080';
let raw = false;

enum State {
	Disconnected,
	Connecting,
	Ready,
	Connected,
	Streaming
}

const vmicMap = {
	linux: () => {
		return LinuxVmic;
	},
	win32: () => {
		return Win32Vmic;
	}
	// "darwin" // macos is EVIL !!!! (also i dont have a mac to test on (also i hate macos (also i hate apple (also macs can eat shit lmao (also i should stop doing this (also its funny (also (also (also macos is bad (also i will die on this hill (also meow)))))))))))
} as const;

const supportedPlatforms = new Set([...Object.keys(vmicMap)] as NodeJS.Process['platform'][]);

if (!supportedPlatforms.has(process.platform)) {
	console.error('Unsupported platform');
	process.exit(1);
}
console.log("# lines starting in '#' are comments, everything else is structured data");
console.log('# platform:', process.platform);
console.log('### 1');

const vmicModule = vmicMap[process.platform as keyof typeof vmicMap]();
console.log('### 2');

await vmicModule.ensureDependencies();
console.log('### 3');

// const { createVmic, removeVmic } = vmicModule;

let state = State.Disconnected;

setState(State.Disconnected);

function setState(newState: State) {
	state = newState;
	// console.log('state::' + state);
	msg('state', state);
}

let onPCMData: (data: Buffer) => void = () => {};

async function connectRoom(roomId: string) {
	if (ws) {
		ws.close();
		ws = null;
	}
	// state = State.Connecting;
	setState(State.Connecting);
	ws = new WebSocket(`${base}/stream/${roomId}`);
	raw = false;

	const connectionTrigger = deferred();

	ws.on('open', () => {
		ws?.send(JSON.stringify({ type: 'role', role: 'drain' }));
	});

	ws.on('message', function handler(data) {
		const message = JSON.parse(data.toString());

		if (message.type === 'ready') {
			setState(State.Ready);
			ws?.off('message', handler);
			connectionTrigger.resolve(message.secCode);
		}
	});

	ws.on('close', () => {
		setState(State.Disconnected);
		raw = false;
	});

	return await connectionTrigger.promise;
}

async function acceptConnection() {
	if (!ws) return;
	if (state !== State.Ready) return;

	const connectedTrigger = deferred();

	ws.on('message', function handler(data) {
		if (raw) {
			onPCMData(Buffer.from(new Uint8Array(data as ArrayBuffer)));
			return;
		}

		const message = JSON.parse(data.toString());

		if (message.type === 'connected') {
			connectedTrigger.resolve(void 0);
			setState(State.Connected);
		}
		if (message.type === 'stream') {
			setState(State.Streaming);
			raw = true;
			return;
		}
	});
	ws.send(JSON.stringify({ type: 'accept' }));

	await connectedTrigger.promise;
}
console.log('### 4');

process.stdin.setEncoding('utf8');
console.log('### 5');
console.log('# ' + !!process.stdin.setRawMode + ' ' + process.stdin.setRawMode);
if (process.stdin.isTTY) {
	process.stdin.setRawMode(true);
}

console.log('### 6');
process.stdin.resume();
console.log('### 7');

let buffer = '';

process.stdin.on('data', (chunk) => {
	buffer += chunk.toString();

	while (true) {
		const newlineIndex = buffer.indexOf('\n');
		if (newlineIndex === -1) break;

		const line = buffer.slice(0, newlineIndex).trim();
		buffer = buffer.slice(newlineIndex + 1);

		if (!line) continue;

		try {
			const msg = JSON.parse(line);
			handleMessage(msg);
		} catch (err) {
			console.error('invalid json:', line);
		}
	}
});

function handleMessage(msg: any) {
	switch (msg.type) {
		case 'connect':
			connectRoom(msg.roomId);
			break;

		case 'accept':
			acceptConnection();
			break;

		case 'settings:update':
			updateSettings(msg.data);
			break;

		case 'settings:get':
			msg('settings:data', getSettings());
			break;

		case 'exit':
			process.exit();
	}
}

// connect::MW4VE1
// accept

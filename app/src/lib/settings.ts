export type Compression = 'pcm' | 'opus';

export interface Settings {
	audio: {
		deviceName: string;
		sampleRate: 44100 | 48000;
		bitDepth: 16 | 24;
	};

	network: {
		serverAddress: string;
		/* frames, idk if will change */
		bufferSize: number;
		compression: Compression;
	};

	ui: {
		closeToTray: boolean;
		trayIconEnabled: boolean;
		/* hex!! it will die if anything else!! */
		themeColor: string;
	};

	debug: {
		overlayEnabled: boolean;
	};
}

<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import { onMount } from 'svelte';

	import Card from '$lib/components/ui/card';
	import { deferred } from '@thetally/toolbox';
	import { slide } from 'svelte/transition';

	import Dialog from '$lib/components/ui/dialog';

	function genRoom() {
		return Math.random().toString(36).substring(2, 8).toUpperCase();
	}

	let room = $state('Loading...');

	let a = $state('');
	let socket: WebSocket;

	let micDenied = $state(false);

	let micHistory: number[] = [];

	type flat<t> = { [k in keyof t]: t[k] } & {};

	type EnumFromArgs<T extends string[]> = {
		[K in keyof T as T[K] extends string
			? T[K]
			: never]: K extends `${infer N extends number}` ? N : never;
	};

	function Enum<T extends string[]>(...args: T): flat<EnumFromArgs<T>> {
		return Object.fromEntries(args.map((arg, i) => [arg, i])) as flat<EnumFromArgs<T>>;
	}

	const steps = Enum('connecting', 'waitingforclient', 'confirmation', 'streaming');

	let step: (typeof steps)[keyof typeof steps] = $state(steps.connecting);

	const micTrigger = deferred();

	let secCode = $state('');

	let wakeLockWarning = $state(false);

	let canvas: HTMLCanvasElement | null = $state(null);

	function drawWaveform() {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		const barWidth = canvas.width / micHistory.length;
		const centerY = canvas.height / 2;

		for (let i = 0; i < micHistory.length; i++) {
			const x = i * barWidth;
			const height = (micHistory[i] / 32768) * (canvas.height / 2);

			ctx.fillStyle = 'green';
			ctx.fillRect(x, centerY - height, barWidth - 1, height * 2);
		}
	}

	onMount(async () => {
		room = genRoom();
		try {
			socket = new WebSocket(
				`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/stream/${room}`
			);
			socket.onopen = () => {
				console.log('WebSocket connection established');
				socket.send(JSON.stringify({ type: 'role', role: 'mic' }));
			};
			socket.onclose = () => {
				console.log('WebSocket connection closed');
			};
			socket.onerror = (error) => {
				console.error('WebSocket error:', error);
			};
			socket.onmessage = (event) => {
				console.log('Received message from server:', event.data);

				const message = JSON.parse(event.data);

				switch (message.type) {
					case 'role-accepted':
						{
							step = steps.waitingforclient;
						}
						break;
					case 'ready':
						{
							secCode = message.secCode;
							step = steps.confirmation;
						}
						break;
					case 'connected':
						{
							step = steps.streaming;
						}
						break;
				}
			};
		} catch (error) {}

		await micTrigger.promise; // this is extremely cursed but im fucking tired okay shut up

		let stream: MediaStream;

		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch (error) {
			console.error('Error accessing microphone:', error);
			micDenied = true;
			a = error instanceof Error ? error.message : String(error);

			return;
		}

		let wakeLock: WakeLockSentinel | null = null;

		if (!('wakeLock' in navigator)) {
			wakeLockWarning = true;
		} else {
			try {
				wakeLock = await navigator.wakeLock.request('screen');
				wakeLock.addEventListener('release', () => {
					console.log('Wake Lock was released');
				});
				console.log('Wake Lock is active');
			} catch (err) {}
		}

		socket.send(JSON.stringify({ type: 'stream' }));

		const ctx = new AudioContext({ sampleRate: 48000 });
		const source = ctx.createMediaStreamSource(stream);

		const audioWorkletCode = `
            class AudioProcessor extends AudioWorkletProcessor {
                process(inputs, outputs, parameters) {
                    const input = inputs[0];
                    if (input.length > 0) {
                        const data = input[0];
                        const pcm = new Int16Array(data.length);
                        for (let i = 0; i < data.length; i++) {
                            pcm[i] = data[i] < 0 ? data[i] * 0x8000 : data[i] * 0x7FFF;
                        }
                        this.port.postMessage({ pcm: pcm.buffer }, [pcm.buffer]);
                    }
                    return true;
                }
            }
            registerProcessor('audio-processor', AudioProcessor);
        `;

		const blob = new Blob([audioWorkletCode], { type: 'application/javascript' });
		const workletUrl = URL.createObjectURL(blob);

		await ctx.audioWorklet.addModule(workletUrl);
		const processor = new AudioWorkletNode(ctx, 'audio-processor');

		processor.port.onmessage = (event) => {
			if (socket.readyState === WebSocket.OPEN) {
				socket.send(event.data.pcm);
			}
			// amplitude for waveform thngy
			const pcm = new Int16Array(event.data.pcm);
			const rms = Math.sqrt(pcm.reduce((sum, sample) => sum + sample ** 2, 0) / pcm.length);
			micHistory = [...micHistory, rms].slice(-100);
			drawWaveform();
		};

		source.connect(processor);
		processor.connect(ctx.destination);

		source.connect(processor);
		processor.connect(ctx.destination);
	});
</script>

{#if micDenied}
	<div class="flex h-screen w-screen items-center justify-center font-sans">
		<div class="max-w-md rounded-lg text-center">
			<h1 class="mb-2 text-4xl font-bold text-red-500">Error</h1>
			<p>Microphone access is required to use the app.</p>
			<p>Please allow microphone and reload the page.</p>
			<Button onclick={() => location.reload()} variant="outline" class="mt-4">Reload</Button>
		</div>
	</div>
{:else}
	<div class="flex h-screen w-screen items-center justify-center font-sans">
		<Card.Root class="w-[90vw] max-w-340">
			<Card.Header>
				<Card.Title class="text-center">
					<div>
						{#if step === steps.connecting}
							<div transition:slide>Connecting...</div>
						{:else if step === steps.waitingforclient}
							<div transition:slide>Waiting for client...</div>
						{:else if step === steps.confirmation}
							<div transition:slide>Security Confirmation</div>
						{:else if step === steps.streaming}
							<div transition:slide>Streaming Audio</div>
						{/if}
					</div>
				</Card.Title>
			</Card.Header>
			<Card.Content class="flex flex-col items-center justify-center p-0">
				{#if step === steps.connecting}
					<div transition:slide>
						<p class="mb-4 text-center text-sm">Connecting to server...</p>
					</div>
				{:else if step === steps.waitingforclient}
					<div transition:slide>
						<p class="mb-4 text-center text-sm">
							Room Code: <span class="font-mono text-lg">{room}</span>
						</p>
						<p class="mb-4 text-center text-sm">
							Use this code on a computer to use this device's microphone. <br />
							<a href="/info" class="text-blue-500 hover:text-blue-700"
								>Client app info & installation</a
							>
						</p>
					</div>
				{:else if step === steps.confirmation}
					<div transition:slide>
						<p class="mb-4 text-center text-sm">
							Security Code: <span class="font-mono text-lg">{secCode}</span>
						</p>
						<p class="mb-4 text-center text-sm">
							Match this code with the one shown on the client device to confirm the connection. <br
							/>
							If they do not match, do not allow the connection and try again. <br /> (Someone might be
							trying to connect to your microphone without permission)
						</p>

						<Button
							onclick={() => socket.send(JSON.stringify({ type: 'accept' }))}
							variant="outline"
						>
							Confirm
						</Button>
					</div>
				{:else if step === steps.streaming}
					<div transition:slide>
						<p class="mb-4 text-center text-sm">Streaming...</p>

						<Button
							onclick={() => {
								micTrigger.resolve(void 0);
							}}
						>
							Start Microphone
						</Button>
						<div class="h-30 w-full">
							<canvas bind:this={canvas} class="h-full w-full"></canvas>
						</div>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
{/if}
<!-- 
<div class="flex h-screen w-screen items-center justify-center font-sans">
	<div class="max-w-md rounded-lg">
		<h1 class="mb-2 text-4xl font-bold">Hosting Room</h1>

		<p>Room Code: {room}</p>
		<p class=" text-sm ">
			Use this code on a computer to use this devices microphone. <br />
			<a href="/info" class="text-blue-500 hover:text-blue-700">Client app info & installation</a>
		</p>
	</div>
</div> -->
{a}

<Dialog.Root bind:open={wakeLockWarning}>
	<Dialog.Overlay class="fixed inset-0 bg-black/50" />
	<Dialog.Content
		class="fixed top-1/2 left-1/2 w-full -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6"
	>
		<Dialog.Title class="text-xl font-bold">Wake Lock Warning</Dialog.Title>
		<Dialog.Description class="mt-2 text-sm">
			It looks like your browser does not support the <a
				href="https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API"
				target="_blank">Wake Lock API</a
			>, which may cause the microphone to stop working when the screen is locked or the browser is
			in the background. For the best experience, please use a browser that supports Wake Lock, such
			as Chrome or Firefox.
		</Dialog.Description>
		<Button variant="outline" class="mt-4" onclick={() => (wakeLockWarning = false)}>Close</Button>
	</Dialog.Content>
</Dialog.Root>

<script lang="ts">
	import { Button } from '@/components/ui/button';
	import { getCurrentWindow, currentMonitor } from '@tauri-apps/api/window';
	import type { UnlistenFn } from '@tauri-apps/api/event';

	import './layout.css';

	const { children } = $props();

	import { ModeWatcher, setMode } from 'mode-watcher';
	import { Maximize, Minimize, Minus, X, Settings as SettingsIcon } from '@lucide/svelte';
	import { setTitle, title } from '@/title';
	import { onAnimationFrame } from '@/utils';
	import { onDestroy, onMount } from 'svelte';
	import { throttle } from '@thetally/toolbox';
	import Settings from './Settings.svelte';

	let showSettings = $state(false);

	const tauriWindow = getCurrentWindow();

	let isMaximized = $state(false);

	tauriWindow.isMaximized().then((maximized) => {
		isMaximized = maximized;
	});

	let touchingEdges = $state({
		left: false,
		right: false,
		top: false,
		bottom: false
	});

	let monitorSize = $state({ width: 0, height: 0 });

	let windowSize = $state({ width: 0, height: 0 });
	let windowPosition = $state({ x: 0, y: 0 });

	let checks = $state(0);

	async function checkEdges() {
		checks += 1;
		const size = await tauriWindow.innerSize();
		const monitor = await currentMonitor();

		if (!monitor) return;

		const { width: screenWidth, height: screenHeight } = monitor.size;
		const { x, y } = await tauriWindow.outerPosition();

		monitorSize = monitor.size;
		windowSize = size;
		windowPosition = { x, y };

		const edgeThreshold = 5;

		const touching = {
			left: x <= edgeThreshold,
			right: x + size.width >= screenWidth - edgeThreshold,
			top: y <= edgeThreshold,
			bottom: y + size.height >= screenHeight - edgeThreshold
		};

		touchingEdges = touching;
	}

	const throttledCheckEdges = throttle(checkEdges, 100);

	const unmountCallbacks: (Promise<UnlistenFn> | UnlistenFn)[] = [];

	unmountCallbacks.push(
		tauriWindow.onResized(() => {
			tauriWindow.isMaximized().then((maximized) => {
				isMaximized = maximized;
			});
			throttledCheckEdges();
		})
	);

	unmountCallbacks.push(
		tauriWindow.onMoved(() => {
			throttledCheckEdges();
		})
	);

	setTitle('RemoteMic');

	function dynamicEdge(touchin: { left: boolean; right: boolean; top: boolean; bottom: boolean }) {
		return [
			touchin.top && touchin.left
				? 'rounded-tl-none'
				: touchin.top
					? 'rounded-t-sm'
					: touchin.left
						? 'rounded-l-sm'
						: '',

			touchin.top && touchin.right
				? 'rounded-tr-none'
				: touchin.top
					? 'rounded-t-sm'
					: touchin.right
						? 'rounded-r-sm'
						: '',

			touchin.bottom && touchin.left
				? 'rounded-bl-none'
				: touchin.bottom
					? 'rounded-b-sm'
					: touchin.left
						? 'rounded-l-sm'
						: '',

			touchin.bottom && touchin.right
				? 'rounded-br-none'
				: touchin.bottom
					? 'rounded-b-sm'
					: touchin.right
						? 'rounded-r-sm'
						: ''
		]
			.filter(Boolean)
			.join(' ');
	}

	// unmountCallbacks.push(
	// 	onAnimationFrame(() => {
	// 		checkEdges();
	// 	})
	// );

	onDestroy(async () => {
		for (const unmount of unmountCallbacks) {
			(await unmount)();
		}
	});
	onMount(() => {
		document.querySelector('#loadingdiv')?.classList.add('gone');
	});
</script>

<ModeWatcher />
<div
	class="wrapper transition-all {!isMaximized
		? 'rounded-2xl border border-muted-foreground/10'
		: ''} {dynamicEdge(touchingEdges)}"
>
	<div class="flex h-full w-full flex-col bg-background">
		<div
			class="relative z-50 flex h-7 w-full flex-row items-center justify-end border-b bg-background"
		>
			<div class="absolute top-0 left-0 flex h-full items-center gap-2 px-2" data-tauri-drag-region>
				<span class="text-xs text-muted-foreground">{$title}</span>
			</div>
			<div
				data-tauri-drag-region
				class="top-0 left-0 mx-0.5 mt-0.5 h-full w-full cursor-grab"
			></div>
			<div class=" flex h-full items-center justify-end gap-0 px-1">
				<Button
					variant={showSettings ? 'default' : 'ghost'}
					size="title"
					onclick={() => {
						showSettings = !showSettings;
					}}
					class="text-muted-foreground"
					><SettingsIcon
						class="{showSettings
							? 'rotate-450 text-foreground duration-500 ease-out'
							: 'duration-1150 ease-in-out'} transition-all "
					/></Button
				>

				<div class="mx-1 h-full border-r border-r-foreground/5"></div>
				<!-- window controls           -->
				<Button
					variant="ghost"
					size="title"
					onclick={() => {
						tauriWindow.minimize();
					}}
					class="text-muted-foreground"><Minus /></Button
				>
				<!-- <Button variant="ghost" size="title"><Minimize /></Button> -->
				<Button
					variant="ghost"
					class="text-muted-foreground"
					size="title"
					onclick={() => {
						tauriWindow.toggleMaximize();
					}}
				>
					<Minimize
						class="scale-100 rotate-0 transition-all! {!isMaximized && 'scale-0! -rotate-90'}"
					/>
					<Maximize
						class="absolute scale-0 rotate-90 transition-all! {!isMaximized &&
							'scale-100! rotate-0'}"
					/>
				</Button>

				<Button
					variant="ghost"
					size="title"
					class="text-muted-foreground hover:bg-destructive/30!"
					onclick={() => {
						tauriWindow.close();
					}}><X /></Button
				>
			</div>
		</div>
		<div class="relative h-full">
			<Settings shown={showSettings} />
			{checks}
			{showSettings}
			<pre>
				{JSON.stringify(
					{
						monitorSize,
						windowSize,
						windowPosition,
						touchingEdges
					},
					null,
					2
				)}
			</pre>
			{@render children()}
		</div>
	</div>
</div>

<style>
	.wrapper {
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		position: relative;
		overflow: hidden;
	}
</style>

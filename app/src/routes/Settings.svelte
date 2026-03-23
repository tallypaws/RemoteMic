<script lang="ts">
	import { Button } from '@/components/ui/button';
	import { setTitle, title } from '@/title';
	import Waves from '@/Waves.svelte';
	import type { Attachment } from 'svelte/attachments';
	import { get } from 'svelte/store';

	const { shown }: { shown: boolean } = $props();
	let last = 'RemoteMic';

	let isOpen = $state(false);

	$effect(() => {
		if (shown) {
			last = get(title);
			setTitle('RemoteMic - Settings');
			show();
		} else {
			setTitle(last === 'RemoteMic - Settings' ? 'RemoteMic' : last);
			hide(800);
		}
	});

	type Entries = Record<
		string,
		{
			name: string;
			element: HTMLElement;
			children: Record<
				string,
				{
					name: string;
					element: HTMLElement;
				}
			>;
		}
	>;

	const entries: Entries = $state({});

	let visible = $state<Set<string>>(new Set());

	let scrollContainer: HTMLElement;

	scrollContainer = null as any; // fuck you svelte

	const observer = new IntersectionObserver(
		(entriesList) => {
			for (const entry of entriesList) {
				const id = entry.target.getAttribute('data-entry-id');
				if (!id) continue;

				if (entry.isIntersecting) {
					visible.add(id);
				} else {
					visible.delete(id);
				}
			}
			visible = new Set(visible);
		},
		{
			root: scrollContainer,
			threshold: 0.05
		}
	);

	function nameToId(name: string) {
		return name.replaceAll(' ', '-').toLowerCase();
	}

	const categoryAttachment: Attachment = (element) => {
		const name = element.textContent.trim();
		const id = nameToId(name);

		entries[id] = {
			children: {},
			element: element as HTMLElement,
			name
		};
		element.parentElement!.dataset.categoryId = id;
		return () => {};
	};

	const entryAttatchment: Attachment = (element) => {
		// const parent = element.closest('[__category_id]');
		const parent = element.parentElement?.parentElement;
		if (!parent) return;
		// const c = parent.getAttribute('__category_id');
		const c = parent.dataset.categoryId;
		if (!c) return;
		const name = element.textContent.trim();
		const id = nameToId(name);
		entries[c].children[id] = {
			element: element as HTMLElement,
			name: name
		};
		(element as HTMLElement).parentElement!.dataset.entryId = id;
		observer.observe(element.parentElement!);

		return () => {
			delete entries[c].children[id];
		};
	};

	function scrollToEntry(categoryId: string, entryId?: string) {
		const entry = entryId
			? entries[categoryId]?.children[entryId]
			: { element: entries[categoryId].element };
		if (!entry) return;

		const el = entry.element;

		const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
		const target = Math.min(el.offsetTop, maxScroll);

		scrollContainer.scrollTo({
			top: target,
			behavior: 'smooth'
		});
	}

	let hidden = $state(true);
	let hideTimeout: number | null = null;

	async function show() {
		if (hideTimeout) {
			clearTimeout(hideTimeout);
		}
		hidden = false;

		requestAnimationFrame(() => {
			isOpen = true;
		});
	}

	function hide(ms: number) {
		isOpen = false;
		if (hideTimeout) {
			clearTimeout(hideTimeout);
		}
		hideTimeout = setTimeout(() => {
			hidden = true;
		}, ms);
	}
</script>

<div
	class="absolute {isOpen
		? 'top-0 duration-500 ease-out'
		: 'top-[calc(100vh+400px)] duration-800 ease-in'} left-0 flex h-full w-full flex-row bg-card transition-all"
	class:hidden
>
	<Waves />

	<div class="absolute top-0 right-full mt-0 min-h-full w-50">
		<div
			class="absolute top-0 left-5 h-full w-full border-r border-r-foreground/5 bg-popover transition-all duration-250 ease-in-out hover:left-50 md:left-50 md:hover:left-50"
		>
			{@render SidebarCap()}
			{@render Sidebar()}
		</div>
	</div>

	<div class="w-5 transition-all duration-250 ease-in-out md:w-50"></div>

	<div class="min-h-full grow overflow-y-scroll" bind:this={scrollContainer}>
		<div>
			{@render Category('App Settings')}
			<div>stuff here</div>
			<div>
				{@render Entry('Virtual Microphone')}
				Name <br />Name <br />Name <br />Name <br />Name <br />Name <br />Name <br />Name <br />Name
				<br />Name <br />Name <br />Name <br />Name <br />Name <br />Name <br />Name <br />Name
				<br />Name <br />Name <br />Name <br />Name <br />Name <br />Name <br />Name <br />
			</div>
			<div>
				{@render Entry('Virtual Microphone2')}
				Name <br />Name <br />Name <br />Name <br />Name <br />Name <br />Name <br />Name <br />Name
				<br />Name <br />Name <br />Name <br />Name <br />Name <br />Name <br />Name <br />Name
				<br />Name <br />Name <br />Name <br />Name <br />Name <br />Name <br />Name <br />
			</div>
		</div>
		<div>
			{@render Category('Mendy')}
			<div>
				{@render Entry('a')}
				stuff here
			</div>
			<div>
				{@render Entry('e')}
				stuff here
			</div>
		</div>
		<div>
			{@render Category('Mendy2')}
			<div>mendy</div>
		</div>
		<div>
			{@render Category('Mendy3')}
			<div>mendy</div>
		</div>
	</div>
</div>

{#snippet Sidebar()}
	<div class="flex h-full w-full flex-col p-4">
		{#each Object.entries(entries) as [id, { children }]}
			{@render SidebarCategory(id, Object.keys(children))}
		{/each}
	</div>
{/snippet}

{#snippet SidebarCategory(id: string, items: string[])}
	<div class="mb-2 flex flex-col gap-1">
		<!-- <div class="text-sm text-foreground/70">{entries[id].name}</div> -->
		<button
			class="text-left text-sm font-medium transition-all px-2 py-0.5 {items.some((i) => visible.has(i))
				? 'text-foreground/80 hover:text-foreground rounded-xs'
				: 'text-foreground/60 hover:text-foreground'} cursor-pointer"
			onclick={() => scrollToEntry(id)}
		>
			{entries[id].name}
		</button>
		<div class="flex flex-col gap-0">
			{#each items as item}
				{#if !item.startsWith('__')}
					{@render SidebarItem(item, id)}
				{/if}
			{/each}
		</div>
	</div>
{/snippet}

{#snippet SidebarItem(id: string, parent: string)}
	<button
		class="ml-2 border-l-2 pl-2 text-left text-xs transition-all {visible.has(id)
			? 'border-foreground/60 text-foreground hover:border-foreground/90'
			: 'border-foreground/5 text-foreground/70 hover:border-foreground/10'} cursor-pointer hover:border-foreground/10 hover:text-foreground"
		onclick={() => scrollToEntry(parent, id)}>{entries[parent].children[id].name}</button
	>
{/snippet}

{#snippet SidebarCap()}
	<div
		class="absolute bottom-full h-4 w-[calc(100%+1px)] rounded-tr-full border-t border-r border-foreground/5 bg-popover"
	></div>
{/snippet}

{#snippet Category(name: string)}
	<h1 {@attach categoryAttachment}>{name}</h1>

	<!-- secret one so category gets marked as visible even if it doesnt have entries -->
	<!-- again, too lazy for a real solution -->
	<div>
		<p {@attach entryAttatchment} class="-mt-3 mb-3 h-0 opacity-0">__{name}</p>
	</div>
{/snippet}

{#snippet Entry(name: string)}
	<h2 class="sticky top-0 bg-card text-base">{name}</h2>
	<!-- tricky trick :3 (makes the scroll to thing not get confused by sticky) -->
	<!-- did this bc im too lazy to find a real solution -->
	<p {@attach entryAttatchment} class="h-0 opacity-0">{name}</p>
{/snippet}

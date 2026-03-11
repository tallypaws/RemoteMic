<script>
	import Button from '$lib/components/ui/button/button.svelte';
</script>

<div class="flex h-screen w-screen items-center justify-center font-sans">
	<div>
		<h1 class="text-4xl font-bold">RemoteMic</h1>
		<p class="mt-4 text-lg text-gray-600 dark:text-gray-400">
			A simple tool to turn your phone <small>(or anything else)</small> into a wireless microphone for
			your computer.
		</p>
		<div class="mt-6 flex space-x-4">
			<Button href="/host" variant="default">Create a Room</Button>
			<Button href="/info" variant="outline">Info</Button>
		</div>
	</div>
</div>

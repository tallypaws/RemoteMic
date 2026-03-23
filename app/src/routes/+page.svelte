<script lang="ts">
	import { listen } from '@tauri-apps/api/event';
	import { invoke } from '@tauri-apps/api/core';

	const out = $state(['']);

	let stdin = $state('');

	function sendStdin(data: string) {
		invoke('send_to_sidecar', { input: data });
	}
</script>

<main class="container"></main>

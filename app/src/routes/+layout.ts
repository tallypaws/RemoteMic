// Tauri doesn't have a Node.js server to do proper SSR
// so we use adapter-static with a fallback to index.html to put the site in SPA mode
// See: https://svelte.dev/docs/kit/single-page-apps

import { listen } from '@tauri-apps/api/event';

// See: https://v2.tauri.app/start/frontend/sveltekit/ for more info
export const ssr = false;

listen('sidecar-stdout', (event) => {
	console.log('STDOUT:', event.payload);
});

listen('sidecar-stderr', (event) => {
	console.error('STDERR:', event.payload);
});

function handleStdout(data: string) {
  console.log('STDOUT:', data);
}
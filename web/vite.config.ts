import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		allowedHosts: true
	},
	ssr: { noExternal: ['bits-ui', 'svelte-sonner', '@icons-pack/svelte-simple-icons'] }
});

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

export function onAnimationFrame(callback: (deltaTime?: number) => void) {
	let frameId: number | null = null;
	let lastTime = performance.now();

	let HALT = false;

	function loop() {
		if (HALT) return;
		const currentTime = performance.now();
		const dt = currentTime - lastTime;
		lastTime = currentTime;
		callback(dt);
		frameId = requestAnimationFrame(loop);
	}

	frameId = requestAnimationFrame(loop);

	return () => {
		HALT = true;
		if (frameId !== null) {
			cancelAnimationFrame(frameId);
		}
	};
}

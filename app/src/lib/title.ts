import { writable } from "svelte/store";

export const title = writable("RemoteMic");

export function setTitle(newTitle: string) {
  title.set(newTitle);
  document.title = newTitle;
}
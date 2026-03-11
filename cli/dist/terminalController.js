import { randomUUID } from "crypto";
export class TerminalController {
    lines = [];
    rendered = new Map();
    destroyed = false;
    constructor() {
        process.stdout.write("\x1b[?25l");
    }
    moveCursor(row) {
        process.stdout.write(`\x1b[${row + 1};1H`);
    }
    clearLine() {
        process.stdout.write("\x1b[2K");
    }
    renderLine(index) {
        if (this.destroyed)
            return;
        const lineEntry = this.lines[index];
        if (!lineEntry)
            return;
        const text = lineEntry.text;
        if (this.rendered.get(lineEntry.id) === text)
            return;
        this.moveCursor(index);
        this.clearLine();
        process.stdout.write(text);
        this.rendered.set(lineEntry.id, text);
    }
    renderAll() {
        for (let i = 0; i < this.lines.length; i++) {
            this.renderLine(i);
        }
    }
    line(text = "") {
        const id = randomUUID();
        const entry = { id, text };
        this.lines.push(entry);
        this.renderLine(this.lines.length - 1);
        return this.createLineManager(id);
    }
    createLineManager(lineId) {
        const _edit = (newText) => {
            const entry = this.lines.find((l) => l.id === lineId);
            if (entry) {
                entry.text = newText;
                this.renderLine(this.lines.indexOf(entry));
            }
        };
        _edit.remove = () => {
            const index = this.lines.findIndex((l) => l.id === lineId);
            if (index < 0)
                return;
            const entry = this.lines.splice(index, 1)[0];
            this.rendered.delete(entry.id);
            this.moveCursor(this.lines.length);
            this.clearLine();
            this.render();
        };
        _edit.insertAbove = (text) => {
            const index = this.lines.findIndex((l) => l.id === lineId);
            if (index < 0)
                return;
            const newEntry = { id: randomUUID(), text };
            this.lines.splice(index, 0, newEntry);
            this.render();
            return this.createLineManager(newEntry.id);
        };
        _edit.insertBelow = (text) => {
            const index = this.lines.findIndex((l) => l.id === lineId);
            if (index < 0)
                return;
            const newEntry = { id: randomUUID(), text };
            this.lines.splice(index + 1, 0, newEntry);
            this.render();
            return this.createLineManager(newEntry.id);
        };
        return _edit;
    }
    edit(id, text) {
        const entry = this.lines.find((l) => l.id === id);
        if (entry) {
            entry.text = text;
            this.renderLine(this.lines.indexOf(entry));
        }
    }
    remove(id) {
        const index = this.lines.findIndex((l) => l.id === id);
        if (index < 0)
            return;
        const entry = this.lines.splice(index, 1)[0];
        this.rendered.delete(entry.id);
        this.moveCursor(this.lines.length);
        this.clearLine();
        this.render();
    }
    clear() {
        this.lines = [];
        this.rendered.clear();
        process.stdout.write("\x1b[2J\x1b[H");
    }
    render() {
        process.stdout.write("\x1b[H");
        this.renderAll();
    }
    destroy() {
        this.destroyed = true;
        process.stdout.write("\x1b[?25h");
    }
}
export function readChar() {
    return new Promise((resolve) => {
        const stdin = process.stdin;
        if (!stdin.isTTY) {
            throw new Error("readChar requires a TTY");
        }
        const wasRaw = stdin.isRaw;
        stdin.setRawMode(true);
        stdin.resume();
        const onData = (buf) => {
            stdin.off("data", onData);
            if (!wasRaw)
                stdin.setRawMode(false);
            resolve(buf.toString("utf8"));
        };
        stdin.on("data", onData);
    });
}

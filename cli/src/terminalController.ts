import { randomUUID } from "crypto";

interface LineEntry {
  id: string;
  text: string;
}

type LineController = ((text: string) => void) & {
  remove(): void;
  insertAbove(text: string): LineController;
  insertBelow(text: string): LineController;
};

export class TerminalController {
  private lines: LineEntry[] = [];
  private rendered: Map<string, string> = new Map();
  private destroyed = false;

  constructor() {
    process.stdout.write("\x1b[?25l");

    const cleanup = () => {
      this.destroy();
    };

    process.on("exit", cleanup);
    process.on("SIGINT", () => {
      cleanup();
      process.exit();
    });
  }

  private moveCursor(row: number) {
    process.stdout.write(`\x1b[${row + 1};1H`);
  }

  private clearLine() {
    process.stdout.write("\x1b[2K");
  }

  private renderLine(index: number) {
    if (this.destroyed) return;

    const lineEntry = this.lines[index];
    if (!lineEntry) return;

    const text = lineEntry.text;

    if (this.rendered.get(lineEntry.id) === text) return;

    this.moveCursor(index);
    this.clearLine();
    process.stdout.write(text);

    this.rendered.set(lineEntry.id, text);
  }

  private renderAll() {
    for (let i = 0; i < this.lines.length; i++) {
      this.renderLine(i);
    }
  }

  line(text = ""): LineController {
    const id = randomUUID();
    const entry = { id, text };
    this.lines.push(entry);
    this.renderLine(this.lines.length - 1);

    return this.createLineManager(id);
  }

  private createLineManager(lineId: string): LineController {
    const _edit = (newText: string) => {
      const entry = this.lines.find((l) => l.id === lineId);
      if (entry) {
        entry.text = newText;
        this.renderLine(this.lines.indexOf(entry));
      }
    };

    _edit.remove = () => {
      const index = this.lines.findIndex((l) => l.id === lineId);
      if (index < 0) return;

      const entry = this.lines.splice(index, 1)[0];
      this.rendered.delete(entry.id);

      this.moveCursor(this.lines.length);
      process.stdout.write("\x1b[J");

      this.scheduleRender();
    };

    _edit.insertAbove = (text: string) => {
      const index = this.lines.findIndex((l) => l.id === lineId);
      if (index < 0) return;

      const newEntry = { id: randomUUID(), text };
      this.lines.splice(index, 0, newEntry);
      this.scheduleRender();
      return this.createLineManager(newEntry.id);
    };

    _edit.insertBelow = (text: string) => {
      const index = this.lines.findIndex((l) => l.id === lineId);
      if (index < 0) return;

      const newEntry = { id: randomUUID(), text };
      this.lines.splice(index + 1, 0, newEntry);
      this.scheduleRender();
      return this.createLineManager(newEntry.id);
    };

    return _edit as LineController;
  }

  edit(id: string, text: string) {
    const entry = this.lines.find((l) => l.id === id);
    if (entry) {
      entry.text = text;
      this.renderLine(this.lines.indexOf(entry));
    }
  }

  remove(id: string) {
    const index = this.lines.findIndex((l) => l.id === id);
    if (index < 0) return;

    const entry = this.lines.splice(index, 1)[0];
    this.rendered.delete(entry.id);
    this.moveCursor(this.lines.length);
    this.clearLine();

    this.scheduleRender();
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

  private pending = false;

  private scheduleRender() {
    if (this.pending) return;
    this.pending = true;

    setImmediate(() => {
      this.pending = false;
      this.render();
    });
  }

  destroy() {
    this.destroyed = true;
    process.stdout.write("\x1b[?25h");
  }
}

export function readChar(): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;

    if (!stdin.isTTY) {
      throw new Error("readChar requires a TTY");
    }

    const wasRaw = stdin.isRaw;

    stdin.setRawMode(true);
    stdin.resume();

    const onData = (buf: Buffer) => {
      stdin.off("data", onData);

      if (!wasRaw) stdin.setRawMode(false);

      resolve(buf.toString("utf8"));
    };

    stdin.on("data", onData);
  });
}

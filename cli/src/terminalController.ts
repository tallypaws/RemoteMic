import { randomUUID } from "crypto";

interface LineEntry {
  id: string;
  text: string;
}

export class TerminalController {
  private lines: LineEntry[] = [];
  private rendered: Map<string, string> = new Map();
  private destroyed = false;

  constructor() {
    process.stdout.write("\x1b[?25l");
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

  line(text = ""): ((newText: string) => void) & {
    remove: () => void;
    insertAbove: (text: string) => ((newText: string) => void) & {
      remove: () => void;
      insertAbove: (
        text: string,
      ) => ReturnType<TerminalController["createLineManager"]>;
      insertBelow: (
        text: string,
      ) => ReturnType<TerminalController["createLineManager"]>;
    };
    insertBelow: (text: string) => ((newText: string) => void) & {
      remove: () => void;
      insertAbove: (
        text: string,
      ) => ReturnType<TerminalController["createLineManager"]>;
      insertBelow: (
        text: string,
      ) => ReturnType<TerminalController["createLineManager"]>;
    };
  } {
    const id = randomUUID();
    const entry = { id, text };
    this.lines.push(entry);
    this.renderLine(this.lines.length - 1);

    return this.createLineManager(id);
  }

  private createLineManager(lineId: string): ((newText: string) => void) & {
    remove: () => void;
    insertAbove: (text: string) => ((newText: string) => void) & {
      remove: () => void;
      insertAbove: (
        text: string,
      ) => ReturnType<TerminalController["createLineManager"]>;
      insertBelow: (
        text: string,
      ) => ReturnType<TerminalController["createLineManager"]>;
    };
    insertBelow: (text: string) => ((newText: string) => void) & {
      remove: () => void;
      insertAbove: (
        text: string,
      ) => ReturnType<TerminalController["createLineManager"]>;
      insertBelow: (
        text: string,
      ) => ReturnType<TerminalController["createLineManager"]>;
    };
  } {
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
      this.clearLine();

      this.render();
    };

    _edit.insertAbove = (text: string) => {
      const index = this.lines.findIndex((l) => l.id === lineId);
      if (index < 0) return;

      const newEntry = { id: randomUUID(), text };
      this.lines.splice(index, 0, newEntry);
      this.render();
      return this.createLineManager(newEntry.id);
    };

    _edit.insertBelow = (text: string) => {
      const index = this.lines.findIndex((l) => l.id === lineId);
      if (index < 0) return;

      const newEntry = { id: randomUUID(), text };
      this.lines.splice(index + 1, 0, newEntry);
      this.render();
      return this.createLineManager(newEntry.id);
    };

    return _edit as ((newText: string) => void) & {
      remove: () => void;
      insertAbove: (
        text: string,
      ) => ReturnType<TerminalController["createLineManager"]>;
      insertBelow: (
        text: string,
      ) => ReturnType<TerminalController["createLineManager"]>;
    };
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

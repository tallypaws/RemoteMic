import { spawn } from "node:child_process";
import fs from "fs";
import Readline from "node:readline/promises";
import { deferred } from "@thetally/toolbox";
import { WebSocket } from "ws";
import { execSync } from "child_process";
import { readChar, TerminalController } from "./terminalController.js";
const rl = Readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
const processArgs = process.argv.slice(2);
const roomId = processArgs[0];
console.clear();
if (!roomId) {
    console.log("Usage: remotemic <room-id>");
    process.exit(1);
}
const ws = new WebSocket(`ws://localhost:8080/stream/${roomId}`);
const terminal = new TerminalController();
const terminalWidth = process.stdout.columns;
const headerText = "  RemoteMic CLI  ";
const padding = Math.max(0, Math.floor((terminalWidth - headerText.length) / 2));
const header = terminal.line("-".repeat(padding) + headerText + "-".repeat(padding));
terminal.line("");
process.stdout.on("resize", () => {
    const newWidth = process.stdout.columns;
    const newPadding = Math.max(0, Math.floor((newWidth - headerText.length) / 2));
    header("-".repeat(newPadding) + headerText + "-".repeat(newPadding));
});
// const bottomRef = terminal.line("");
// terminal.line("-".repeat(terminalWidth));
const status = terminal.line("Connecting to server...");
const connectionTrigger = deferred();
const readyTrigger = deferred();
const connectedTrigger = deferred();
let secCode = "";
let onPCMData = () => { };
ws.addEventListener("open", () => {
    ws.send(JSON.stringify({ type: "role", role: "drain" }));
});
let raw = false;
ws.addEventListener("message", (event) => {
    if (raw) {
        onPCMData(Buffer.from(new Uint8Array(event.data)));
        return;
    }
    const message = JSON.parse(event.data.toString());
    if (message.type === "role-accepted") {
        connectionTrigger.resolve(void 0);
    }
    if (message.type === "ready") {
        // console.log(`Connection ready, security code: ${message.secCode}`);
        secCode = message.secCode;
        readyTrigger.resolve(void 0);
    }
    if (message.type === "connected") {
        connectedTrigger.resolve(void 0);
    }
    if (message.type === "stream") {
        raw = true;
        return;
    }
});
ws.on("close", (event) => {
    status(`Connection closed, Exiting...`);
    process.exit(0);
});
await connectionTrigger.promise;
// ready should fire right after connection bc mic has to connect first
status("Waiting for ready signal...");
await readyTrigger.promise;
status(`Ready!`);
const codeLine = terminal.line(`Security Code: ${secCode}`);
const promptLine = terminal.line(`Does the security code match? (Y/n)`);
const answer = await readChar();
if ((answer.toLowerCase() || "y")[0] !== "y") {
    console.log("Security code mismatch, exiting...");
    process.exit(1);
}
codeLine.remove();
promptLine.remove();
ws.send(JSON.stringify({ type: "accept" }));
// console.log("Waiting for connection...");
status("Waiting for connection...");
await connectedTrigger.promise;
/*
mkfifo /tmp/virtmic
pactl load-module module-pipe-source \
  source_name=virtmic \
  file=/tmp/virtmic \
  format=s16le rate=48000 channels=1
*/
const fifoPath = `/tmp/remotemic`;
if (!fs.existsSync(fifoPath)) {
    // console.log(`Creating named pipe at ${fifoPath}...`);
    spawn("mkfifo", [fifoPath]);
}
const args = [
    "load-module",
    "module-pipe-source",
    `source_name=RemoteMicc`,
    `file=/tmp/remotemic`,
    "format=s16le",
    "rate=48000",
    "channels=1",
];
// console.log("Creating Virtual Microphone");
status("Creating virtual microphone...");
const micTrigger = spawn("pactl", args);
let pactlId = "";
// console.log("Loading virtual microphone module...");
status("Loading virtual microphone module...");
micTrigger.stdout.on("data", (data) => {
    pactlId = data.toString().trim();
    // console.log(`Mic Id: ${data}`);
});
micTrigger.stderr.on("data", (data) => {
    console.error(`stderr: ${data}`);
});
const writeStream = fs.createWriteStream(`/tmp/remotemic`);
status("Connected!");
const statsLine = terminal.line("Waiting for audio stream...");
// white noise for testing ( loud (scary))
// setInterval(() => {
//   const buffer = Buffer.alloc(48000 * 4);
//   for (let i = 0; i < buffer.length; i++) {
//     buffer[i] = Math.floor(Math.random() * 256);
//   }
//   writeStream.write(buffer);
//   console.log("Wrote 1 second of white noise to virtual microphone");
// }, 1000);
let p = 0;
let lastUpdate = 0;
const connectedAt = Date.now();
function msToHMS(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
onPCMData = (data) => {
    writeStream.write(data);
    p += data.length;
    // only update stats every 250ms bc laggy
    const now = Date.now();
    if (now - lastUpdate > 90) {
        statsLine(`Streamed ${(p / 1024).toFixed(2)} KB | Connected for ${msToHMS(now - connectedAt)}`);
        lastUpdate = now;
    }
};
let cleaningUp = false;
const cleanup = () => {
    if (cleaningUp)
        return;
    cleaningUp = true;
    status("Cleaning up...");
    try {
        if (fs.existsSync(fifoPath)) {
            fs.unlinkSync(fifoPath);
            // console.log(`Removed named pipe at ${fifoPath}`);
        }
    }
    catch (err) {
        console.error("Failed removing fifo:", err);
    }
    try {
        // console.log(`Unloading virtual microphone module ${pactlId}...`);
        execSync(`pactl unload-module ${pactlId}`);
    }
    catch (err) {
        console.error("Failed unloading module:", err);
    }
    terminal.line();
    terminal.line("Bye!");
    terminal.destroy();
    process.exit(0);
};
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", (code) => {
    cleanup();
});
process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
    cleanup();
});
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled rejection:", reason);
    cleanup();
});

import fs from "fs";
import { execSync, spawn } from "child_process";

let created = false;
let micId = "";
const fifoPath = `/tmp/remotemic`;

let runningFn = false;

export async function createVmic() {
  if (runningFn) {
    console.warn("ran during existing operation");
    return;
  }
  runningFn = true;
  try {
    if (created) return;
    created = true;

    if (!fs.existsSync(fifoPath)) {
      console.log(`# creating pipe at ${fifoPath}...`);
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
    console.log("# creating virtual microphone");
    micId = execSync("pactl" + " " + args.join(" "))
      .toString()
      .trim();
    console.log(`# virtual microphone created with id ${micId}`);
    const writeStream = fs.createWriteStream(`/tmp/remotemic`);

    function data(data: Buffer) {
      writeStream.write(data);
    }

    return {
      data,
      micId,
    };
  } catch (error) {
    console.error("Error creating virtual microphone:", error);
  } finally {
    runningFn = false;
  }
}

export async function removeVmic() {
  if (!created) return;
  created = false;
  if (runningFn) {
    console.warn("ran during existing operation");
    return;
  }
  runningFn = true;

  try {
    try {
      if (fs.existsSync(fifoPath)) {
        fs.unlinkSync(fifoPath);
        console.log(`# removed fifo at ${fifoPath}`);
      }
    } catch (err) {
      console.error("Failed removing fifo:", err);
    }

    try {
      console.log(`# unloading module with id ${micId}...`);
      execSync(`pactl unload-module ${micId}`);
    } catch (err) {
      console.error("Failed unloading module:", err);
    }
  } catch (error) {
    console.error("Error removing virtual microphone:", error);
  } finally {
    runningFn = false;
  }
}

export async function ensureDependencies() {
  try {
    execSync("which pactl");
  } catch (error) {
    throw new Error("pactl not found. Please install PulseAudio to use RemoteMic on Linux.");
  }
}

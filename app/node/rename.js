import { execSync } from "child_process";
import fs from "fs";

const ext = process.platform === "win32" ? ".exe" : "";

const targetTriple = execSync("rustc --print host-tuple").toString().trim();
if (!targetTriple) {
  console.error("Failed to determine platform target triple");
}

fs.mkdirSync("../src-tauri/binaries", { recursive: true });

fs.renameSync(
  `./package/remotemic-node${ext}`,
  `../src-tauri/binaries/remotemic-node-${targetTriple}${ext}`,
);

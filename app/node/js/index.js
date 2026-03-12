import { deferred } from "@thetally/toolbox";
import { WebSocket } from "ws";
let ws = null;
let base = "ws://localhost:8080";
let raw = false;
var State;
(function (State) {
    State[State["Disconnected"] = 0] = "Disconnected";
    State[State["Connecting"] = 1] = "Connecting";
    State[State["Ready"] = 2] = "Ready";
    State[State["Connected"] = 3] = "Connected";
    State[State["Streaming"] = 4] = "Streaming";
})(State || (State = {}));
let state = State.Disconnected;
setState(State.Disconnected);
function setState(newState) {
    state = newState;
    console.log("state::" + state);
}
let onPCMData = () => { };
async function connectRoom(roomId) {
    if (ws) {
        ws.close();
        ws = null;
    }
    // state = State.Connecting;
    setState(State.Connecting);
    ws = new WebSocket(`${base}/stream/${roomId}`);
    raw = false;
    const connectionTrigger = deferred();
    ws.on("open", () => {
        ws?.send(JSON.stringify({ type: "role", role: "drain" }));
    });
    ws.on("message", function handler(data) {
        const message = JSON.parse(data.toString());
        if (message.type === "ready") {
            setState(State.Ready);
            ws?.off("message", handler);
            connectionTrigger.resolve(message.secCode);
        }
    });
    ws.on("close", () => {
        setState(State.Disconnected);
        raw = false;
    });
    return await connectionTrigger.promise;
}
async function acceptConnection() {
    if (!ws)
        return;
    if (state !== State.Ready)
        return;
    const connectedTrigger = deferred();
    ws.on("message", function handler(data) {
        if (raw) {
            onPCMData(Buffer.from(new Uint8Array(data)));
            return;
        }
        const message = JSON.parse(data.toString());
        if (message.type === "connected") {
            connectedTrigger.resolve(void 0);
            setState(State.Connected);
        }
        if (message.type === "stream") {
            setState(State.Streaming);
            raw = true;
            return;
        }
    });
    ws.send(JSON.stringify({ type: "accept" }));
    await connectedTrigger.promise;
}
process.stdin.setEncoding("utf8");
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on("data", (chunk) => {
    const data = chunk.toString().trim();
    const parts = data.split("::");
    const command = parts[0];
    switch (command) {
        case "connect":
            {
                const roomId = parts[1];
                connectRoom(roomId);
            }
            break;
        case "accept":
            {
                acceptConnection();
            }
            break;
        case "exit":
            {
                process.exit();
            }
    }
    if (chunk === "\u0003")
        process.exit();
});
// connect::6LVA3D
// accept

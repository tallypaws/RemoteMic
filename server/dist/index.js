import { root } from "@thetally/httptree";
import crypto, { randomInt } from "crypto";
const tree = root();
const rooms = {};
tree.ws("/stream/[room]", (ws, req) => {
    const { room } = req.params;
    if (rooms[room]?.drain && rooms[room]?.mic) {
        ws.close(1000, "Room is full");
        return;
    }
    const id = crypto.randomUUID();
    console.log(`client ${id} connected to room ${room}`);
    const client = {
        id: id,
        socket: ws,
        state: "connecting",
    };
    ws.on("message", (message) => {
        try {
            if (client.raw) {
                const otherRole = client.role === "drain" ? "mic" : "drain";
                const otherClient = rooms[room][otherRole];
                if (!otherClient)
                    return;
                if (otherClient.state !== "connected")
                    return;
                otherClient.socket.send(message);
            }
            else {
                const data = JSON.parse(message.toString());
                switch (data.type) {
                    case "role":
                        {
                            if (client.state !== "connecting")
                                return;
                            if (data.role !== "drain" && data.role !== "mic")
                                return;
                            const role = data.role;
                            if (!rooms[room])
                                rooms[room] = {};
                            if (rooms[room][role]) {
                                console.log(`client ${id} attempted to take taken role ${role} in room ${room}`);
                                ws.close(1000, "Role already taken");
                                return;
                            }
                            console.log(`client ${id} took role ${role} in room ${room}`);
                            client.role = role;
                            rooms[room][role] = client;
                            client.socket.send(JSON.stringify({ type: "role-accepted", role }));
                            client.state = "waiting";
                            if (rooms[room].drain && rooms[room].mic) {
                                // this is like the thingy bluetooth does where u have to match the code to know its the right devvice (prevents random people)
                                const secCode = randomInt(1000000).toString().padStart(6, "0");
                                console.log(`room ${room} is ready, security code: ${secCode}`);
                                rooms[room].drain?.socket.send(JSON.stringify({ type: "ready", secCode }));
                                rooms[room].mic?.socket.send(JSON.stringify({ type: "ready", secCode }));
                            }
                        }
                        break;
                    case "accept":
                        {
                            if (client.state !== "waiting")
                                return;
                            const otherRole = client.role === "drain" ? "mic" : "drain";
                            const otherClient = rooms[room][otherRole];
                            if (!otherClient)
                                return;
                            if (otherClient.state !== "waiting")
                                return;
                            console.log(`client ${id} accepted connection in room ${room}`);
                            client.accepted = true;
                            if (otherClient.accepted) {
                                console.log(`room ${room} is connected`);
                                client.state = "connected";
                                otherClient.state = "connected";
                                client.socket.send(JSON.stringify({ type: "connected" }));
                                otherClient.socket.send(JSON.stringify({ type: "connected" }));
                            }
                        }
                        break;
                    case "stream": {
                        console.log(`client ${id} started streaming in room ${room}`);
                        // switching to binary stream, stop parsing as json
                        if (client.state !== "connected")
                            return;
                        const otherRole = client.role === "drain" ? "mic" : "drain";
                        const otherClient = rooms?.[room][otherRole];
                        if (!otherClient)
                            return;
                        if (otherClient.state !== "connected")
                            return;
                        otherClient.socket.send(JSON.stringify({ type: "stream" }));
                        client.raw = true;
                    }
                }
            }
        }
        catch (error) {
            console.error(`error handling message from client ${id} in room ${room}:`, error);
        }
    });
    ws.once("close", () => {
        if (client.state === "connecting")
            return;
        if (client.state === "waiting") {
            const otherRole = client.role === "drain" ? "mic" : "drain";
            const otherClient = rooms?.[room][otherRole];
            if (!otherClient) {
                delete rooms[room];
                return;
            }
            // cancel secCode
            otherClient.socket.send(JSON.stringify({ type: "disconnect" }));
        }
        if (client.state === "connected") {
            const otherRole = client.role === "drain" ? "mic" : "drain";
            const otherClient = rooms[room][otherRole];
            if (!otherClient) {
                delete rooms[room];
                return;
            }
            otherClient.socket.send(JSON.stringify({ type: "disconnect" }));
            otherClient.socket.close(1000, "Other client disconnected");
            delete rooms[room];
        }
    });
});
tree.listen(8080, () => {
    console.log("Server is listening on port 8080");
});

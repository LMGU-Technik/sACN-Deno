import { Sender } from "../src/sender.ts";

function main() {
    const sender = new Sender({
        universe: 1,
        iface: "172.19.0.1",

        minRefreshRate: 5,
    });

    const data = new Uint8Array(512);

    crypto.getRandomValues(data);

    sender.send(data);
}
main();

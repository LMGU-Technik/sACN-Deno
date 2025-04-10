import { Receiver, Sender } from "../mod.ts";

async function main() {
    const receiver = new Receiver();
    receiver.addUniverse(3);
    const sender = new Sender({
        universe: 13,
        iface: "10.101.112.12",
        defaultPacketOptions: {
            priority: 105,
        },
    });
    for await (const packet of receiver.onPacket()) {
        modify(packet.data);
        sender.send(packet.data);
    }
}
export function map(
    x: number,
    in_min: number,
    in_max: number,
    out_min: number,
    out_max: number,
): number {
    return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}
function modify(packet: Uint8Array) {
    const dv = new DataView(packet.buffer);
    const magenta = dv.getUint8(7);
    const yellow = dv.getUint8(8);
    const intens = dv.getUint16(41);
    dv.setUint8(7, 0xFF);
    dv.setUint8(8, 0xFF);
    const intens_alpha = Math.min(
        1,
        Math.max(0, map(yellow * magenta, 0xffff * 0.9, 0xFFFF, 0, 1)),
    );
    dv.setUint16(41, Math.round(intens * intens_alpha));
}
main();

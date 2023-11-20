import { ACN_PID, DmpVector, FrameVector, RootVector } from './constants.ts';

export interface Packet {
    cid: Uint8Array,
    priority: number,
    sequence: number,
    universe: number,
    data: Uint8Array;
    sourceLabel: string,
}

export class PacketError extends Error {

}

function constantField(value: number, expected: number, id: string) {
    if (value !== expected) {
        throw new PacketError(`[PacketError] ${id}: '${value}' !== '${expected}'`);
    }
}

export function flagsAndLength(bytes: number) {
    const length = bytes & 0b1111_1111_1111;
    const flags = (bytes >> 12) & 0b1111;
    constantField(flags, 0x7, "Flags");
    return length;
}

export function parsePacket(packet: Uint8Array): Packet {
    const dv = new DataView(packet.buffer);
    constantField(dv.getUint16(0), 0x0010, "RLP Preamble Size");
    constantField(dv.getUint16(2), 0x0000, "RLP Postamble Size");
    const packetIdentifier = new Uint8Array(packet.buffer, 4, 12);
    for (let i = 0; i < 12; i++) {
        constantField(packetIdentifier[i], ACN_PID[i], `RLP ACN Packet Identifier byte ${i}`);
    }
    constantField(dv.getUint32(18), RootVector.DATA, "Root Vector");
    const cid = new Uint8Array(packet.buffer, 22, 16);
    constantField(dv.getUint32(40), FrameVector.DATA, "Frame Vector");
    const sourceName = new Uint8Array(packet.buffer, 44, 64);
    const sourceLabel = new TextDecoder()
        .decode(
            sourceName.slice(0,
                sourceName.findLastIndex(_ => _ !== 0) + 1)); // last non-null character
    const priority = dv.getUint8(108);
    // const sync = dv.getUint16(109);
    const sequence = dv.getUint8(111);
    // const optFlags = dv.getUint8(112);
    const universe = dv.getUint16(113);
    constantField(dv.getUint8(117), DmpVector.DATA, "DMP Vector");
    constantField(dv.getUint8(118), 0xa1, "Address Type");
    constantField(dv.getUint16(119), 0x0000, "First prop offset");
    constantField(dv.getUint16(121), 0x0001, "Data size");
    const valueCount = dv.getUint16(123);
    const data = new Uint8Array(packet.buffer, 125, valueCount);

    return {
        cid,
        priority,
        sequence,
        universe,
        data,
        sourceLabel,
    };
}

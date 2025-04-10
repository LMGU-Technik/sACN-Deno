/**
 * @license GPL-3.0-or-later
 * LMGU-Technik sACN-Deno
 *
 * Copyright (C) 2023 - 2025 Hans Schallmoser
 * Copyright (C) 2025 Felix Beckh
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { ACN_PID, DmpVector, FrameVector, RootVector } from "./constants.ts";

export type Payload = { [channel: number]: number };

export interface Packet {
    cid: Uint8Array;
    priority: number;
    sequence: number;
    universe: number;
    data: Uint8Array;
    sourceLabel: string;
}

export interface Options {
    universe: Packet["universe"];
    data: Packet["data"];
    sequence: Packet["sequence"];
    sourceLabel: Packet["sourceLabel"];
    priority: Packet["priority"];
    cid: Packet["cid"];
}

export class PacketError extends Error {
}

function constantField(value: number, expected: number, id: string) {
    if (value !== expected) {
        throw new PacketError(
            `[PacketError] ${id}: '${value}' !== '${expected}'`,
        );
    }
}

function computeFlagsAndLengthField(pos: number, length: number) {
    const rem = length - pos;
    const value = (0x7 << 12) | (rem & 0b1111_1111_1111);
    return value;
}

// export function parseFlagsAndLength(bytes: number) {
//     const length = bytes & 0b1111_1111_1111;
//     const flags = (bytes >> 12) & 0b1111;
//     constantField(flags, 0x7, "Flags");
//     return length;
// }

export function parsePacket(packet: Uint8Array): Packet {
    const dv = new DataView(packet.buffer);
    constantField(dv.getUint16(0), 0x0010, "RLP Preamble Size");
    constantField(dv.getUint16(2), 0x0000, "RLP Postamble Size");
    const packetIdentifier = new Uint8Array(packet.buffer, 4, 12);
    for (let i = 0; i < 12; i++) {
        constantField(
            packetIdentifier[i],
            ACN_PID[i],
            `RLP ACN Packet Identifier byte ${i}`,
        );
    }
    constantField(
        dv.getUint16(16),
        computeFlagsAndLengthField(16, packet.byteLength),
        "Flags and Length",
    );
    constantField(dv.getUint32(18), RootVector.DATA, "Root Vector");
    const cid = new Uint8Array(packet.buffer, 22, 16);
    constantField(dv.getUint32(40), FrameVector.DATA, "Frame Vector");
    const sourceName = new Uint8Array(packet.buffer, 44, 64);
    const sourceLabel = new TextDecoder()
        .decode(
            sourceName.slice(0, sourceName.findLastIndex((_) => _ !== 0) + 1),
        ); // last non-null character
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
    // const data = new Uint8Array(packet.buffer, 125, valueCount);
    const data = packet.slice(125, 125 + valueCount);

    return {
        cid,
        priority,
        sequence,
        universe,
        data,
        sourceLabel,
    };
}

export function buildFlagsAndLength(pos: number, packet: {
    data: Uint8Array;
}) {
    return ((125 + packet.data.byteLength) - pos) & 0b1111_1111_1111 |
        (0x7 << 12);
}

export function buildPacket(packet: Packet) {
    const res = new ArrayBuffer(638);
    const dv = new DataView(res);

    // Root layer
    dv.setUint16(0, 0x0010);
    dv.setUint16(2, 0x0000);
    new Uint8Array(res, 4, 12).set(ACN_PID);

    dv.setUint16(16, computeFlagsAndLengthField(16, res.byteLength));

    dv.setUint32(18, RootVector.DATA);
    new Uint8Array(res, 22, 16).set(packet.cid);

    // Framing layer
    dv.setUint16(38, computeFlagsAndLengthField(38, res.byteLength));
    dv.setUint32(40, FrameVector.DATA);

    new Uint8Array(res, 44, 64).set(
        new TextEncoder().encode(packet.sourceLabel),
    );

    dv.setUint8(108, packet.priority);
    // 109 u16 sync
    dv.setUint8(111, packet.sequence);
    // 112 u8 optflags
    dv.setUint16(113, packet.universe);
    // DMP
    dv.setUint16(115, computeFlagsAndLengthField(115, res.byteLength));
    dv.setUint8(117, DmpVector.DATA);
    dv.setUint8(118, 0xa1);
    dv.setUint16(119, 0x0000);
    dv.setUint16(121, 0x0001);
    dv.setUint16(123, packet.data.byteLength);
    new Uint8Array(res, 125).set(packet.data);
    return new Uint8Array(res);
}

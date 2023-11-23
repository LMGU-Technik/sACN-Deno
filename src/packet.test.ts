import { assertEquals } from "https://deno.land/std@0.207.0/assert/mod.ts";
import { } from "./packet.new.ts";
import { buildFlagsAndLength } from "./packet.ts";

Deno.test("Flags & Length", () => {
    assertEquals(buildFlagsAndLength(0, {
        data: new Uint8Array(513)
    }), 638 | (0x7 << 12));
});

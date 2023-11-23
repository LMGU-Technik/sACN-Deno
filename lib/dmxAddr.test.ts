/* 
* LMGU-Technik sACN-Deno

* Copyright (C) 2023 Hans Schallmoser

* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.

* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU General Public License for more details.

* You should have received a copy of the GNU General Public License
* along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { assertEquals } from "https://deno.land/std@0.207.0/assert/mod.ts";
import { dmxToGlobal, globalToDmx } from "./dmxAddr.ts";

Deno.test("dmx > global", () => {
    assertEquals(dmxToGlobal(1, 1), 1);
    assertEquals(dmxToGlobal(1, 512), 512);
    assertEquals(dmxToGlobal(2, 1), 513);
    assertEquals(dmxToGlobal(2, 512), 1024);
    assertEquals(dmxToGlobal(3, 1), 1025);
});
Deno.test("global > dmx", () => {
    assertEquals(globalToDmx(1), [1, 1]);
    assertEquals(globalToDmx(512), [1, 512]);
    assertEquals(globalToDmx(513), [2, 1]);
    assertEquals(globalToDmx(1024), [2, 512]);
    assertEquals(globalToDmx(1025), [3, 1]);
});

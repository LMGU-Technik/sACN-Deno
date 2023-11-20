import { sACNReceiver } from "./receiver.ts";

async function main() {
    for await (const a of sACNReceiver(1)) {
        console.log(a);
    }
}
main().catch(err => {
    console.error(err);
});

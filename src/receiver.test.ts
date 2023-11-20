import { Receiver } from "./receiver.ts";

async function main() {
    const receiver = new Receiver();
    receiver.addUniverse(1);
    for await (const a of receiver) {
        console.log(a);
    }
}
main().catch(err => {
    console.error(err);
});

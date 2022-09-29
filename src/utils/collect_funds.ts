import { getSigningContractInstance } from "@sovryn/perpetual-swap/dist/scripts/utils/walletUtils";

const { MNEMONIC, NODE_URLS } = process.env;
const TOKEN_ADDRESS = "0x77dE0Ad409c36E73F1b55b37B05649A5cC8aA54b";
let collectingAddress = '';


if (!MNEMONIC) {
    throw new Error(`Please set the MNEMONIC env variable`);
}

if (!NODE_URLS) {
    throw new Error(`Please set the NODE_URLS env variable`);
}
if(!collectingAddress) {
    throw new Error(`Please set the collectingAddress variable`);
}

async function main() {
    let nodeUrls = JSON.parse(NODE_URLS || "[]");
    let tokenSigners = getSigningContractInstance(TOKEN_ADDRESS, MNEMONIC, nodeUrls, "MockRbtc", 0, 10);

    // Normally we would let the Wallet populate this for us, but we
    // need to compute EXACTLY how much value to send
    let gasPrice = await tokenSigners[0].provider.getGasPrice();

    // The exact cost (in gas) to send to an Externally Owned Account (EOA)
    let gasLimit = 21000;

    for (const tokenSigner of tokenSigners) {
        const balance = await tokenSigner.provider.getBalance(tokenSigner.signer.address);
        if (balance.toString() === "0") {
            continue;
        }
        console.log(`Balance of ${tokenSigner.signer.address} is ${balance.toString()}`, balance, tokenSigner.signer);
        // The balance less exactly the txfee in wei
        let value = balance.sub(gasPrice.mul(gasLimit));

        let tx = await tokenSigner.signer.sendTransaction({
            gasLimit: gasLimit,
            gasPrice: gasPrice,
            to: collectingAddress,
            value: value,
        });

        console.log("Sent in Transaction: " + tx.hash);
    }
}

main()
    .then(() => console.log("done"))
    .catch((e) => console.error(`General error`, e));

const bitcoin = require('bitcoinjs-lib')
const ecc = require('tiny-secp256k1');
const ecpair = require('ecpair');
const ecpairFactory = ecpair.ECPairFactory(ecc);

let alice = JSON.parse(process.env.ALICE);
let bob = JSON.parse(process.env.BOB);

const network = bitcoin.networks.bitcoin
const p2ms = bitcoin.payments.p2ms({
    m: 1, pubkeys: [
        Buffer.from(alice.publicKey, 'hex'),
        Buffer.from(bob.publicKey, 'hex'),
    ], network
})

console.log('Redeem script:')
console.log(p2ms.output.toString('hex'))

const p2sh = bitcoin.payments.p2sh({redeem: p2ms, network})
console.log('P2SH address')
console.log(p2sh.address)

let psbt = new bitcoin.Psbt({network})
    .addInput({
        hash: '1b5d38d3ac3e507b3c79450472139587caa19d83bd4059ba3107ec4c790b0e70',
        index: 1,
        redeemScript: p2sh.redeem.output,
        nonWitnessUtxo:  Buffer.from('0100000001b6168448565c9576677e71e26e5778afc659d75e63943281352327e97eb088bd010000009200483045022100c11e193a3c67f0bc90e036ee65899fc0e401c8b8b1c5a9a4971338d55c8a52e3022055d7799f5113787378e3ffc3561d0d4a3f842276b4b7e640510af9473740da7d014751210258c35b46772c2050d480e93350f19d418e2d6d5279aa89b8a601cd7017b8ea2721030c49fc69bef08c9d0e38c6b6510cbe715f9542c4ed906c738b54bd1fa1e5284552aeffffffff02742700000000000017a914cc6f8e771ee6b52febae535c45b7135eddc4c5ce872fd500000000000017a9142bb4999cad6a41f3ec93cc704740be9379678f7a8700000000', 'hex')

    })
    .addOutput({
        address: "36b5Z19fLrbgEcV1dwhwiFjix86bGweXKC",
        value: 100,
    })

const keyPairAlice1 = ecpairFactory.fromPrivateKey(Buffer.from(alice.privateKey, 'hex'))
psbt.signInput(0, keyPairAlice1)

psbt.finalizeAllInputs()
console.log('Transaction hexadecimal:')
console.log(psbt.extractTransaction().toHex())

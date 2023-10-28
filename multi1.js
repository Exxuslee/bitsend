const bitcoin = require('./bitcoinjs-lib-master/src')
const ecc = require('tiny-secp256k1');
const ecpair = require('ecpair');
const ecpairFactory = ecpair.ECPairFactory(ecc);
require ('dotenv').config();

let alice = JSON.parse(process.env.ALICE);
let claus = JSON.parse(process.env.CLAUS);
let dima = JSON.parse(process.env.DIMA);

const network = bitcoin.networks.bitcoin
const p2ms = bitcoin.payments.p2ms({
    m: 2, pubkeys: [
        Buffer.from(alice.publicKey, 'hex'),
        Buffer.from(claus.publicKey, 'hex'),
        Buffer.from(dima.publicKey, 'hex'),
    ], network
})

console.log('Redeem script:')
console.log(p2ms.output.toString('hex'))

const p2sh = bitcoin.payments.p2sh({redeem: p2ms, network})
console.log('P2SH address')
console.log(p2sh.address)

let psbt = new bitcoin.Psbt({network})
    .setVersion(2)
    .addInput({
        hash: '088ea60bc6691dae1027019b5214abac0df576a7a7b818c0bc3a8a24fefe36f4',
        index: 0,
        redeemScript: p2sh.redeem.output,
        nonWitnessUtxo:  Buffer.from('02000000000102ba8523dfdce7d2ea383209a038a719b4b077d97c2a90b1d82e92efbacba319c600000000171600146a691a692a766979843c0c8bc9bb7cf9e5210796feffffffba8523dfdce7d2ea383209a038a719b4b077d97c2a90b1d82e92efbacba319c60100000017160014c5414424f1fbb2c81b1c5227770cc88d60a316ebfeffffff02a08601000000000017a914d6632e208a6e6baab40e0d512f88c7c7e2e4315087a0960d000000000017a9142c05edd9acacb6d15831e3b9229e9f8c6e5ba63e87024730440220256ff2981b1ecd6e760dd62164b42d5f5662ee2691a5ea15894772762d0806d302207865d6dc111a2df3e32ca5ac10e0c2572d9afecdf4e8033add9a7deb40244ee8012102e0832f712c2a8ede2a1857ab2044232e0f8bea96967a2b3977dac32080c13f320247304402207c52875d86e10f7d17e17e958b899f72f55833a4cc717f107cb51deaf405b2270220785924f8438ee2e1344a89b9fd9826a066f60b27cf73e5baea6a63c5cdba2fde0121039a996989b4c12aa33937b3afd265f805f1c47aee5c56e65976dbb5b561c998f0a8520c00', 'hex')

    })
    .addOutput({
        address: "36b5Z19fLrbgEcV1dwhwiFjix86bGweXKC",
        value: 95000,
    })

const keyPairClaus1 = ecpairFactory.fromPrivateKey(Buffer.from(claus.privateKey, 'hex'))
const keyPairDima1 = ecpairFactory.fromPrivateKey(Buffer.from(dima.privateKey, 'hex'))
psbt.signInput(0, keyPairClaus1)
psbt.signInput(0, keyPairDima1)

psbt.finalizeAllInputs()
console.log('Transaction hexadecimal:')
console.log(psbt.extractTransaction().toHex())

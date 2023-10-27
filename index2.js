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
const p2wsh = bitcoin.payments.p2wsh({redeem: p2ms, network})
console.log('P2WSH address')
console.log(p2wsh.address)

const psbt = new bitcoin.Psbt({network})
    .addInput({
        hash: '088ea60bc6691dae1027019b5214abac0df576a7a7b818c0bc3a8a24fefe36f4',
        index: 0,
        witnessScript: p2wsh.redeem.output,
        witnessUtxo: {
            script: Buffer.from('0020' + bitcoin.crypto.sha256(p2ms.output).toString('hex'), 'hex'),
            value: 100000,
        }
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

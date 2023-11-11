require ('dotenv').config();
const bitcoin = require('bitcoinjs-lib')
const ecc = require('tiny-secp256k1');
const ecpair = require('ecpair');
const ecpairFactory = ecpair.ECPairFactory(ecc);

bitcoin.initEccLib(ecc)

let alice1 = JSON.parse(process.env.PUZZLE_02);
let alice2 = JSON.parse(process.env.PUZZLE_02);
let alice3 = JSON.parse(process.env.PUZZLE_03);

const network = bitcoin.networks.bitcoin
const keyPairAlice1 = ecpairFactory.fromPrivateKey(Buffer.from(
    "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140", 'hex'), {compressed: true})
const keyPairAlice2 = ecpairFactory.fromPrivateKey(Buffer.from(alice2.privateKey, 'hex'))
const keyPairAlice3 = ecpairFactory.fromPrivateKey(Buffer.from(alice3.privateKey, 'hex'))

const p2pkh = bitcoin.payments.p2pkh({
    pubkey:  keyPairAlice1.publicKey,
    network: network,
})
console.log('p2pkh\t', p2pkh.address)

const p2ms = bitcoin.payments.p2ms({
    m: 2,
    pubkeys: [keyPairAlice1.publicKey, keyPairAlice2.publicKey, keyPairAlice3.publicKey],
    network
})

const p2sh = bitcoin.payments.p2sh({redeem: p2ms, network})
console.log('p2sh\t', p2sh.address)

// const p2wpkh = bitcoin.payments.p2wpkh({
//     pubkey: keyPairAlice1.publicKey,
//     network: network,
// })
// console.log('p2wpkh\t', p2wpkh.address)

const p2tr = bitcoin.payments.p2tr({
    internalPubkey:  keyPairAlice1.publicKey.slice(1, 33),
    network: network,
})
console.log('p2tr\t', p2tr.address)







const psbt = new bitcoin.Psbt({network})
    .addInput({
        hash: 'f3db7c0088b6d2f357008854441cfab93583d4cc0d4dc026de0f158f7ce5ac9b',
        index: 0,
        nonWitnessUtxo: Buffer.from("02000000017ba3a24224c1e6a9a3031591d40de32a15cc94194b301093d27a67ed51b9e3b4000000008a473044022004bf84cd409c313d922dc7b952ea852faa42046e49cb26f35ec23fb64ebfe80302206cf477e3e877177b52e7458bc054eda88d86efa49f8c9cc135f70f37d4e9f845014104354b84ddb18f59c46c10a20e32e1e5c41bd38fa24ad2cea1ca54703f43272d8174296b1058b200820b8bfe8ec4376b72ba1aeb1f6d320083a7e4f2067b73a798ffffffff02b90e0000000000001976a91420d45a6a762535700ce9e0b216e31994335db8a588ac59f80200000000001976a914d939982a722de1b3807d5527c430f15455bc22c788ac00000000", 'hex')
    })
    .addInput({
        hash: 'cf7ad170e2f58aea83686095607b12a04cbef15679383a11c124d953bd2c5a6d',
        index: 0,
        nonWitnessUtxo: Buffer.from("010000000001013b2f374394071e68c98dac561d1b71cc800f5b20c98d5ba34e31b2218901fff101000000000000000001ed020000000000001976a91420d45a6a762535700ce9e0b216e31994335db8a588ac02483045022100a8f50685ec16f5de6b64c4fffc15c6efc98fa7bb88ae6ff66001a71f548a7a0202206d7c299c193559f698d70dc5a2fc70ca6c566178e9bab141cb314317e292158701210237b55bf51bdb5ae5eb50dff97c403c06fed789883c0d520b0682999590fae93c00000000", 'hex')
    })
    .addOutput({
        address: "36b5Z19fLrbgEcV1dwhwiFjix86bGweXKC",
        value: 1
    })

// psbt.signAllInputs(keyPairAlice1)
psbt.signInput(0, keyPairAlice1)
psbt.validateSignaturesOfInput(0)
psbt.finalizeAllInputs()
console.log('Transaction hexadecimal:')
console.log(psbt.extractTransaction().toHex())


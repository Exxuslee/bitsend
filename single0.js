require ('dotenv').config();
const bitcoin = require('bitcoinjs-lib')
const ecc = require('tiny-secp256k1');
const ecpair = require('ecpair');
const ecpairFactory = ecpair.ECPairFactory(ecc);

bitcoin.initEccLib(ecc)

const network = bitcoin.networks.testnet
const keyPairAlice1 = ecpairFactory.fromPrivateKey(Buffer.from(
    "1110000000000000000000000000000000000000000000000000000000000111", 'hex'), {compressed: true})

const p2pkh = bitcoin.payments.p2pkh({
    pubkey:  keyPairAlice1.publicKey,
    network: network,
})
console.log('p2pkh\t', p2pkh.address)

const psbt = new bitcoin.Psbt({network})
    .addInput({
        hash: 'f3db7c0088b6d2f357008854441cfab93583d4cc0d4dc026de0f158f7ce5ac9b',
        index: 0,
        nonWitnessUtxo: Buffer.from("02000000017ba3a24224c1e6a9a3031591d40de32a15cc94194b301093d27a67ed51b9e3b4000000008a473044022004bf84cd409c313d922dc7b952ea852faa42046e49cb26f35ec23fb64ebfe80302206cf477e3e877177b52e7458bc054eda88d86efa49f8c9cc135f70f37d4e9f845014104354b84ddb18f59c46c10a20e32e1e5c41bd38fa24ad2cea1ca54703f43272d8174296b1058b200820b8bfe8ec4376b72ba1aeb1f6d320083a7e4f2067b73a798ffffffff02b90e0000000000001976a91420d45a6a762535700ce9e0b216e31994335db8a588ac59f80200000000001976a914d939982a722de1b3807d5527c430f15455bc22c788ac00000000", 'hex')
    })
    .addOutput({
        address: "tb1q5tn9ky8zxqadxcrzfzs9v8cx3mj6r6thmrxkz5",
        value: 1
    })

// psbt.signAllInputs(keyPairAlice1)
psbt.signInput(0, keyPairAlice1)
psbt.validateSignaturesOfInput(0)
psbt.finalizeAllInputs()
console.log('Transaction hexadecimal:')
console.log(psbt.extractTransaction().toHex())


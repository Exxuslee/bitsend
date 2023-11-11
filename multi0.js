require ('dotenv').config();
const bitcoin = require('bitcoinjs-lib')
const ecc = require('tiny-secp256k1');
const ecpair = require('ecpair');
const ecpairFactory = ecpair.ECPairFactory(ecc);

let alice = JSON.parse(process.env.ALICE);
let bob = JSON.parse(process.env.BOB);

const network = bitcoin.networks.bitcoin
const p2ms = bitcoin.payments.p2ms({
    m: 1,
    pubkeys: [
        Buffer.from(bob.publicKey, 'hex'),
        Buffer.from(alice.publicKey, 'hex'),
    ], network
})

console.log('Redeem script:')
console.log(p2ms.output.toString('hex'))

const p2sh = bitcoin.payments.p2sh({redeem: p2ms, network})
console.log('P2SH address')
console.log(p2sh.address)

let psbt = new bitcoin.Psbt({network})
    .addInput({
        hash: '1bfc082ad6a6e55ae6a6cf5422c8ce398db20468140aa49583fe06800686a10b',
        index: 0    ,
        redeemScript: p2sh.redeem.output,
        nonWitnessUtxo:  Buffer.from('0200000000010105bb1d5d9f03eaf4b33bb87b3308b0906c957406d99ada61a9029bd761b21f9c01000000171600144150416df8be84a37567e4d9cd5de9868dfb8987feffffff02881300000000000017a914bdacf437b2db789c79dc00b9a674ebb2b187a7ef872a3800000000000017a914f00e6b1ae96bb7cdf0d98dd6c3853bf9049511838702483045022100a7348339c4917d36960b468913412bb401e66c8cd622d47353f485df57fc9583022070b2bc1ce5e2ae2513cda9bb0f45e49ea38d96afcd3d8e163e33e0a110847a2b01210392c629c4c6bc8ed476088697e1ead5ec2df64d9c031b0de32b1befd7b4f231c5595a0c00', 'hex')

    })
    .addInput({
        hash: '9c1fb261d79b02a961da9ad90674956c90b008337bb83bb3f4ea039f5d1dbb05',
        index: 0    ,
        redeemScript: p2sh.redeem.output,
        nonWitnessUtxo:  Buffer.from('020000000001019c23e491df409d87ee62363f52dac651edc3300e5d20bc75f68765c9031c59df0000000017160014bcb8cfd51c05d7ff4b85282d31a68b255ab62f73feffffff02204e00000000000017a914bdacf437b2db789c79dc00b9a674ebb2b187a7ef87205400000000000017a914cf5540467d550fc6809d11ae420231fe291011978702483045022100d666199837455745cc468f7c5595f1fb8f33a0b95f84e3e0255008f636a3af1002201d3140bde9352aef9de28dba8c2c9bfe6f6f7c351cb7565bfd219bebfa1d242d0121034fafd2d725ffc1c49c719f684caf51b61837878f55dfb2b5e9be3bc8ede8376772570c00', 'hex')

    })
    .addOutput({
        address: "36b5Z19fLrbgEcV1dwhwiFjix86bGweXKC",
        value: 19000,
    })


const keyPairAlice1 = ecpairFactory.fromPrivateKey(Buffer.from(alice.privateKey, 'hex'))
psbt.signInput(0, keyPairAlice1)
psbt.signInput(1, keyPairAlice1)
psbt.finalizeAllInputs()

console.log("fee:\t",psbt.getFee())
console.log("feeRate:",psbt.getFeeRate())
console.log('Transaction hexadecimal:', psbt.extractTransaction().toHex().length, psbt.extractTransaction().toHex())


// let asd =  bitcoin.Transaction.fromHex(psbt.extractTransaction().toHex())
// console.log(asd.getId())
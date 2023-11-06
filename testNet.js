require('dotenv').config();
const bitcoin = require('bitcoinjs-lib')
const ecc = require('tiny-secp256k1')
const ecpair = require('ecpair')
const ecpairFactory = ecpair.ECPairFactory(ecc)
const config = require('./config.json');

const Client = require('bitcoin-core');
const client = new Client({
    host: '192.168.50.95',
//    network: 'testnet',
    username: process.env.login,
    password: process.env.passw,
    port: 8332
})

async function read_data() {
    let getBlockTemplate = await client.getBlockTemplate({"rules": ["segwit"]})
    let transactions = getBlockTemplate.transactions

    for (const transaction of transactions) {
        //console.log(transaction)
        let decode = await client.decodeRawTransaction(transaction.data)
        for (const vout of decode.vout) {
            // console.log(decode.vout[index].scriptPubKey.addresses)
            if (vout.scriptPubKey.addresses !== undefined) {
                let found = equals(vout.scriptPubKey.addresses[0])
                if (found) create(transaction, found, vout)
            }
        }
    }
}

function equals(address) {
    for (const conf of config) if (conf.addr === address) return conf
    return false
}

function create(transaction, found, vout) {
    console.log(vout)
    console.log(found)
    const network = bitcoin.networks.bitcoin
    const keyPair = ecpairFactory.fromPrivateKey(Buffer.from(found.privateKey, 'hex'), {compressed: found.compressed})
    const psbt = new bitcoin.Psbt({network})
        .addInput({
            hash: transaction.txid,
            index: vout.n,
            nonWitnessUtxo: Buffer.from(transaction.data, 'hex')
        })
        .addOutput({
            address: "36b5Z19fLrbgEcV1dwhwiFjix86bGweXKC",
            value: vout.value * 100000000
        })
    psbt.signInput(0, keyPair)
    psbt.finalizeAllInputs()
    console.log(psbt.extractTransaction().toHex())
}


read_data().then(r => true)


// let asd = await client.getTransactionByHash('b4dd08f32be15d96b7166fd77afd18aece7480f72af6c9c7f9c5cbeb01e686fe', { extension: 'json', summary: false });
// let asd = await client.getRawMempool(true)
//   let asd = await client.prioritiseTransaction("408e0f7ce93dc7a00f9af63d4e83ed3ee3fb8ac1e6667f4818ddd6a4db67efb4", 0.0, 1000000)
// let asd = await client.testMempoolAccept (["0200000000010147775f2a6dc5d37f6f26f8c196bca2ccc837c32ddb1cd0210ec0c162e1a0e15c0000000000fdffffff022006250000000000160014a8e138cd9174651feff7e94a57ac7eb9c4e15fa4786554000000000017a914c0cf3af9a309f212131a57227208a5c6b7cbb62a870247304402203db2c5785b0e2912fc127ac1bc897f920339bb5dcba00a823d34a50d17d66aa802202cb06d816cb3b0adeceb6cdf203d6e1b5edb3e60098b0589810171e8314d830201210212575f84da66cc810589b6062e923d59368b40a46342e75a51f01ae85eaa641eb96f0c00"])

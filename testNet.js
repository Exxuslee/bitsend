require('dotenv').config();
const bitcoin = require('bitcoinjs-lib')
const ecc = require('tiny-secp256k1')
const ecpair = require('ecpair')
const ecpairFactory = ecpair.ECPairFactory(ecc)
const config = require('./config.json')
const dayjs = require("dayjs")

const Client = require('bitcoin-core');
const client = new Client({
    host: '192.168.50.95',
//    network: 'testnet',
    username: process.env.login,
    password: process.env.passw,
    port: 8332
})
const network = bitcoin.networks.bitcoin

let myItems = []
let rivalItems = []
let targetItems = new Set([])
let privateConfig = {}

bitcoin.initEccLib(ecc)
function generateConfig() {
    for (const conf of config) {
        const keyPairC = ecpairFactory.fromPrivateKey(Buffer.from(conf.privateKey, 'hex'), {compressed: true})
        const keyPairU = ecpairFactory.fromPrivateKey(Buffer.from(conf.privateKey, 'hex'), {compressed: false})

        const p2pkhc = bitcoin.payments.p2pkh({pubkey:  keyPairC.publicKey, network: network,})
        console.log('p2pkh\t', p2pkhc.address)

        const p2pkhu = bitcoin.payments.p2pkh({pubkey:  keyPairU.publicKey, network: network,})
        console.log('p2pkh\t', p2pkhu.address)

        const p2msC = bitcoin.payments.p2ms({m: 1, pubkeys: [keyPairC.publicKey], network})
        const p2shC = bitcoin.payments.p2sh({redeem: p2msC, network})
        console.log('p2sh\t', p2shC.address)

        const p2msU = bitcoin.payments.p2ms({m: 1, pubkeys: [keyPairU.publicKey], network})
        const p2shU = bitcoin.payments.p2sh({redeem: p2msU, network})
        console.log('p2sh\t', p2shU.address)

        const p2wpkh = bitcoin.payments.p2wpkh({pubkey: keyPairC.publicKey, network: network,})
        console.log('p2wpkh\t', p2wpkh.address)

        const p2tr = bitcoin.payments.p2tr({internalPubkey:  keyPairC.publicKey.slice(1, 33), network: network,})
        console.log('p2tr\t', p2tr.address)
    }
}


async function read() {
    while (1) {
        try {
            let blockchainInfo = await client.getBlockchainInfo()
            let txsMempool = await client.getRawMempool()
            let date = dayjs(Date.now()).format('DD/MM/YYYY HH:mm');
            console.log(date, "txs:", txsMempool.length, "block:", blockchainInfo.blocks)

            for (const txMempool of txsMempool) {
                //console.log(transaction)
                try {
                    let rawTx = await client.getRawTransaction(txMempool)
                    let decode = await client.decodeRawTransaction(rawTx)
                    // console.log(decode)
                    for (const vout of decode.vout) {
                        //console.log(vout.scriptPubKey.addresses)
                        if (vout.scriptPubKey.addresses !== undefined) {
                            let foundAddr = equals(vout.scriptPubKey.addresses[0])
                            if (foundAddr) targetItems.add({transaction: transaction, foundAddr: foundAddr, vout: vout})
                        }
                    }
                    for (const vin of decode.vin) {
                        //console.log(vin)
                        // if (vout.scriptPubKey.addresses !== undefined) {
                        //     let foundAddr = equals(vout.scriptPubKey.addresses[0])
                        //     if (foundAddr) found.push({transaction: transaction, foundAddr: foundAddr, vout: vout})
                        // }
                    }
                } catch (e) {}

            }
            if (targetItems.length > 0) {
                let blockStats = await client.getBlockStats(blockchainInfo.blocks)
                for (const item of targetItems) {
                    item.minfeerate = blockStats.minfeerate
                    createFirst(item)
                }
            } else {
                myItems = []
                rivalItems = []
            }
        } catch (e) {
            console.log(1, e)
        }
    }
}

function equals(address) {
    const keyPairCompressed = ecpairFactory.fromPrivateKey(Buffer.from(conf.privateKey, 'hex'), {compressed: true})
    const keyPairUncompressed = ecpairFactory.fromPrivateKey(Buffer.from(conf.privateKey, 'hex'), {compressed: false})

    const p2wpkh = bitcoin.payments.p2wpkh({
        pubkey: keyPair.publicKey,
        network: network,
    })
    const p2pkh = bitcoin.payments.p2pkh({
        pubkey: keyPair.publicKey,
        network: network,
    })





    for (const conf of config) if (conf.addr === address) return conf
    return false
}

function createFirst(item) {
    console.log(item.transaction)
    console.log(item.vout)
    console.log(item.foundAddr)
    console.log(item.minfeerate)
    const network = bitcoin.networks.bitcoin
    const keyPair = ecpairFactory.fromPrivateKey(
        Buffer.from(item.foundAddr.privateKey, 'hex'), {compressed: item.foundAddr.compressed}
    )

    let fee = new bitcoin.Psbt({network})
        .addInput({
            hash: item.transaction.txid,
            index: item.vout.n,
            nonWitnessUtxo: Buffer.from(item.transaction.data, 'hex')
        })
        .addOutput({
            address: "36b5Z19fLrbgEcV1dwhwiFjix86bGweXKC", value: Math.floor(item.vout.value * 100000000)
        })
    try {
        fee.signInput(0, keyPair)
        fee.finalizeAllInputs()
        let length = fee.extractTransaction().toHex().length
        let sendAmount = Math.floor(item.vout.value * 100000000 - length * item.minfeerate)
        let psbt = new bitcoin.Psbt({network})
            .addInput({
                hash: item.transaction.txid,
                index: item.vout.n,
                nonWitnessUtxo: Buffer.from(item.transaction.data, 'hex')
            })
            .addOutput({
                address: "36b5Z19fLrbgEcV1dwhwiFjix86bGweXKC",
                value: sendAmount
            })
        psbt.signInput(0, keyPair)
        psbt.finalizeAllInputs()
        myItems.push({address: item.foundAddr.publicKey, amount: sendAmount})
        console.log(psbt.extractTransaction().toHex())

    } catch (e) {
        console.log(e)
    }

}


generateConfig()
read().then(r => console.log(r))


// let asd = await client.getTransactionByHash('b4dd08f32be15d96b7166fd77afd18aece7480f72af6c9c7f9c5cbeb01e686fe', { extension: 'json', summary: false });
// let asd = await client.getRawMempool(true)
//   let asd = await client.prioritiseTransaction("408e0f7ce93dc7a00f9af63d4e83ed3ee3fb8ac1e6667f4818ddd6a4db67efb4", 0.0, 1000000)
// let asd = await client.testMempoolAccept (["0200000000010147775f2a6dc5d37f6f26f8c196bca2ccc837c32ddb1cd0210ec0c162e1a0e15c0000000000fdffffff022006250000000000160014a8e138cd9174651feff7e94a57ac7eb9c4e15fa4786554000000000017a914c0cf3af9a309f212131a57227208a5c6b7cbb62a870247304402203db2c5785b0e2912fc127ac1bc897f920339bb5dcba00a823d34a50d17d66aa802202cb06d816cb3b0adeceb6cdf203d6e1b5edb3e60098b0589810171e8314d830201210212575f84da66cc810589b6062e923d59368b40a46342e75a51f01ae85eaa641eb96f0c00"])

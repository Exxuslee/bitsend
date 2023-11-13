require('dotenv').config();
const bitcoin = require('bitcoinjs-lib')
const ecc = require('tiny-secp256k1')
const ecpair = require('ecpair')
const ecpairFactory = ecpair.ECPairFactory(ecc)
const config = require('./config.json')
const dayjs = require("dayjs")

const Client = require('bitcoin-core');
const {toXOnly} = require("./bitcoinjs-lib-master/src/psbt/bip371");
const client = new Client({
    host: '192.168.50.95',
    network: 'testnet',
    username: process.env.login,
    password: process.env.passw,
    port: 18332
})

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const network = bitcoin.networks.testnet

let myItems = []
let rivalItems = []
let targetItems = new Set()
let privateConfig = []
let txsCacheMemPool = []

bitcoin.initEccLib(ecc)

function generateConfig() {
    for (const conf of config) {
        const keyPairC = ecpairFactory.fromPrivateKey(Buffer.from(conf, 'hex'), {compressed: true})
        const keyPairU = ecpairFactory.fromPrivateKey(Buffer.from(conf, 'hex'), {compressed: false})

        const p2pkhC = bitcoin.payments.p2pkh({pubkey: keyPairC.publicKey, network: network,})
        privateConfig.push({privateKey: conf, address: p2pkhC.address, script: "p2pkhC"})
        console.log("p2pkhC:", p2pkhC.address)
        const p2pkhU = bitcoin.payments.p2pkh({pubkey: keyPairU.publicKey, network: network,})
        privateConfig.push({privateKey: conf, address: p2pkhU.address, script: "p2pkhU"})

        const p2wpkh = bitcoin.payments.p2wpkh({pubkey: keyPairC.publicKey, network: network,})
        privateConfig.push({privateKey: conf, address: p2wpkh.address, script: "p2wpkh"})

        const p2tr = bitcoin.payments.p2tr({internalPubkey: keyPairC.publicKey.slice(1, 33), network: network,})
        privateConfig.push({privateKey: conf, address: p2tr.address, script: "p2tr"})
    }
    // privateConfig.push({
    //     privateKey: "0000000000000000000000000000000000000000000000000000000000000001",
    //     address: "39j37jPTzHCJBC6tjRb8fRmhFrGzoh6ajk",
    //     script: "p2pkhC"
    // })
    console.log("PrivateConfig:", privateConfig.length)
}


async function read() {
    while (1) {
        const start = Date.now()
        try {
            let blockchainInfo = await client.getBlockchainInfo()
            let txsMemPool = await client.getRawMempool()
            let txsNewMemPool = []
            let date = dayjs(Date.now()).format('DD/MM/YYYY HH:mm');

            for (const txMemPool of txsMemPool) if (!txsCacheMemPool.includes(txMemPool)) txsNewMemPool.push(txMemPool)
            console.log(date, "Txs:", `${txsCacheMemPool.length}+${txsNewMemPool.length}`, "block:", blockchainInfo.blocks)
            txsCacheMemPool = txsMemPool

            for (const txMemPool of txsNewMemPool) {
                //console.log(transaction)
                try {
                    let rawTx = await client.getRawTransaction(txMemPool)
                    let decode = await client.decodeRawTransaction(rawTx)
                    // console.log(decode)
                    for (const vout of decode.vout) {
                        if (vout.scriptPubKey.addresses !== undefined) {
                            for (const address of vout.scriptPubKey.addresses) {
                                //console.log(address)
                                let foundConfig = equals(address)
                                if (foundConfig) targetItems.add({
                                    tx: txMemPool,
                                    foundConfig: foundConfig,
                                    vout: vout
                                })
                            }
                        }
                    }
                    for (const vin of decode.vin) {
                        //console.log(vin)
                        // if (vout.scriptPubKey.addresses !== undefined) {
                        //     let foundAddr = equals(vout.scriptPubKey.addresses[0])
                        //     if (foundAddr) found.push({transaction: transaction, foundAddr: foundAddr, vout: vout})
                        // }
                    }
                } catch (e) {
                }
            }
            if (targetItems.size > 0) {
                console.log(targetItems)
                let blockStats = await client.getBlockStats(blockchainInfo.blocks)
                for (const item of targetItems) {
                    item.minfeerate = blockStats.minfeerate
                    createFirst(item.values())
                }
            } else {
                myItems = []
                rivalItems = []
            }
        } catch (e) {
        }
        const workTime = Date.now() - start
        if (workTime < 15000) await delay(15000 - workTime);
    }
}

function equals(address) {
    for (const conf of privateConfig) if (conf.address === address) return conf
    return false
}

function createFirst(item) {
    console.log("transaction:", item.tx)
    console.log("vout:", item.vout)
    console.log("foundConfig:", item.foundConfig)
    console.log("minfeerate:", item.minfeerate)

    let keyPair
    if (item.foundConfig.script === "p2pkhC") keyPair = ecpairFactory.fromPrivateKey(Buffer.from(item.foundConfig.privateKey, 'hex'), {compressed: true})
    if (item.foundConfig.script === "p2pkhU") keyPair = ecpairFactory.fromPrivateKey(Buffer.from(item.foundConfig.privateKey, 'hex'), {compressed: false})

    let fee = new bitcoin.Psbt({network})
    if (item.foundConfig.script === "p2pkhC" || item.foundConfig.script === "p2pkhU") {
        fee.addInput({
            hash: item.tx.txid,
            index: item.vout.n,
            nonWitnessUtxo: Buffer.from(item.tx.data, 'hex')
        })
    }
    if (item.foundConfig.script === "p2wpkh") {
        fee.addInput({
            hash: item.tx.txid,
            index: item.vout.n,
            witnessUtxo: {
                script: Buffer.from('0020' + bitcoin.crypto.sha256(item.tx.data).toString('hex'), 'hex'),
                value: item.vout.value,
            }
        })
    }
    if (item.foundConfig.script === "p2tr") {
        fee.addInput({
            hash: item.transaction.txid,
            index: item.vout.n,
            witnessUtxo: {
                script: Buffer.from('0020' + bitcoin.crypto.sha256(item.tx.data).toString('hex'), 'hex'),
                value: item.vout.value,
            },
            tapInternalKey: toXOnly(item.foundConfig.publicKey),
        })
    }
    fee.addOutput({
        address: "mg8Jz5776UdyiYcBb9Z873NTozEiADRW5H",
        value: Math.floor(item.vout.value * 100000000)
    })
    try {
        fee.signInput(0, keyPair)
        fee.finalizeAllInputs()
        let length = fee.extractTransaction().toHex().length
        let sendAmount = Math.floor(item.vout.value * 100000000 - length * item.minfeerate)
        let psbt = new bitcoin.Psbt({network})
        if (item.foundConfig.script === "p2pkhC" || item.foundConfig.script === "p2pkhU") {
            psbt.addInput({
                hash: item.tx.txid,
                index: item.vout.n,
                nonWitnessUtxo: Buffer.from(item.tx.data, 'hex')
            })
        }
        if (item.foundConfig.script === "p2wpkh") {
            psbt.addInput({
                hash: item.tx.txid,
                index: item.vout.n,
                witnessUtxo: {
                    script: Buffer.from('0020' + bitcoin.crypto.sha256(item.tx.data).toString('hex'), 'hex'),
                    value: item.vout.value,
                }
            })
        }
        if (item.foundConfig.script === "p2tr") {
            psbt.addInput({
                hash: item.tx.txid,
                index: item.vout.n,
                witnessUtxo: {
                    script: Buffer.from('0020' + bitcoin.crypto.sha256(item.tx.data).toString('hex'), 'hex'),
                    value: item.vout.value,
                },
                tapInternalKey: toXOnly(item.foundConfig.publicKey),
            })
        }
        psbt.addOutput({
            address: "mg8Jz5776UdyiYcBb9Z873NTozEiADRW5H",
            value: sendAmount
        })
        psbt.signInput(0, keyPair)
        psbt.finalizeAllInputs()
        myItems.push({address: keyPair.publicKey, amount: sendAmount})
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

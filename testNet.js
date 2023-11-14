require('dotenv').config();
const bitcoin = require('bitcoinjs-lib')
const ecc = require('tiny-secp256k1')
const ecpair = require('ecpair')
const ecpairFactory = ecpair.ECPairFactory(ecc)
const config = require('./config.json')
const dayjs = require("dayjs")

const HOME_TX = "tb1q6z36pfnefqq8k3ghe8wxmnqxf5t5kvtccx03gd"
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

let items = new Map()
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
        let start = Date.now()
        try {
            let blockchainInfo = await client.getBlockchainInfo()
            let blockStats = await client.getBlockStats(blockchainInfo.blocks)
            let txsMemPool = await client.getRawMempool()
            let txsNewMemPool = []
            let date = dayjs(Date.now()).format('DD/MM/YYYY HH:mm');

            for (let txMemPool of txsMemPool) if (!txsCacheMemPool.includes(txMemPool)) txsNewMemPool.push(txMemPool)
            console.log(date, "Txs:", `${txsCacheMemPool.length}+${txsNewMemPool.length}`, "block:", blockchainInfo.blocks)
            txsCacheMemPool = txsMemPool

            for (let txMemPool of txsNewMemPool) {
                try {
                    let rawTx = await client.getRawTransaction(txMemPool)
                    let decode = await client.decodeRawTransaction(rawTx)
                    //console.log("decode:",JSON.stringify(decode))
                    for (let vout of decode.vout) {
                        //console.log("vout:",JSON.stringify(vout))
                        if (vout.scriptPubKey.addresses !== undefined) {
                            for (let address of vout.scriptPubKey.addresses) {
                                //console.log(address)
                                let foundConfig = equals(address)
                                if (foundConfig && !items.has(decode.txid)) {
                                    items.set(decode.txid, {
                                        tx: decode,
                                        foundConfig: foundConfig,
                                        vout: vout,
                                        rawTx: rawTx,
                                        minfeerate: blockStats.minfeerate,
                                        rival: false,
                                        my: false,
                                        myAmount: 0
                                    })
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.log("error:", JSON.stringify(e))
                }
            }
            if (items.size > 0) {
                for (let txMemPool of txsNewMemPool) {
                    try {
                        //console.log("txMemPool:", JSON.stringify(txMemPool))
                        let rawTx = await client.getRawTransaction(txMemPool)
                        let decode = await client.decodeRawTransaction(rawTx)
                        //console.log("decode:", JSON.stringify(decode))
                        for (let vin of decode.vin) {
                            //console.log(vin)
                            //console.log("txid:", vin.txid)
                            if (items.has(vin.txid) && decode.vout[0].scriptPubKey.addresses[0] !== HOME_TX) {
                                items.set(vin.txid, {rival: true})
                            }
                            if (items.has(vin.txid) && decode.vout[0].scriptPubKey.addresses[0] === HOME_TX) {
                                items.set(vin.txid, {my: true})
                            }
                        }
                    } catch (e) {
                    }
                }
            }

            for (const key of items.keys()) {
                console.log("key:", key)
                if (!txsMemPool.includes(key)) items.delete(key)
            }

            for (const item of items.values()) {
                if (!item.rival && !item.my) await createFirst(item)
                if (item.rival && !item.my) await createRival(item)
                if (item.rival && item.my) await createRivalMy(item)
                if (!item.rival && item.my) console.log("0 myTx only")
            }
        } catch (e) {
            console.log("error:", JSON.stringify(e))
        }
        let workTime = Date.now() - start
        if (workTime < 15000) await delay(15000 - workTime);
    }
}

function equals(address) {
    for (const conf of privateConfig) if (conf.address === address) return conf
    return false
}

async function createFirst(item) {
    console.log("0 createFirst")
    console.log("1 tx:", JSON.stringify(item.tx))
    console.log("2 vout:", JSON.stringify(item.vout))
    console.log("3 foundConfig:", JSON.stringify(item.foundConfig))
    console.log("4 rawTx:", item.rawTx)
    console.log("5 minfeerate:", item.minfeerate)

    try {
        let keyPair
        if (item.foundConfig.script === "p2pkhC") keyPair = ecpairFactory.fromPrivateKey(Buffer.from(item.foundConfig.privateKey, 'hex'), {compressed: true})
        if (item.foundConfig.script === "p2pkhU") keyPair = ecpairFactory.fromPrivateKey(Buffer.from(item.foundConfig.privateKey, 'hex'), {compressed: false})

        let fee = new bitcoin.Psbt({network}).clone()
        if (item.foundConfig.script === "p2pkhC" || item.foundConfig.script === "p2pkhU") {
            fee.addInput({
                hash: item.tx.txid,
                index: item.vout.n,
                nonWitnessUtxo: Buffer.from(item.rawTx, 'hex')
            })
        } else if (item.foundConfig.script === "p2wpkh") {
            fee.addInput({
                hash: item.tx.txid,
                index: item.vout.n,
                witnessUtxo: {
                    script: Buffer.from('0020' + bitcoin.crypto.sha256(item.rawTx).toString('hex'), 'hex'),
                    value: item.vout.value,
                }
            })
        } else if (item.foundConfig.script === "p2tr") {
            fee.addInput({
                hash: item.tx.txid,
                index: item.vout.n,
                witnessUtxo: {
                    script: Buffer.from('0020' + bitcoin.crypto.sha256(item.rawTx).toString('hex'), 'hex'),
                    value: item.vout.value,
                },
                tapInternalKey: toXOnly(item.foundConfig.publicKey),
            })
        }
        fee.addOutput({
            address: HOME_TX,
            value: Math.floor(item.vout.value * 100000000)
        })
        fee.signInput(0, keyPair)
        fee.finalizeAllInputs()
        let length = fee.extractTransaction().toHex().length
        let sendAmount = Math.floor(item.vout.value * 100000000 - length * item.minfeerate)
        console.log("6 sendAmount", sendAmount)
        let psbt = new bitcoin.Psbt({network}).clone()
        if (item.foundConfig.script === "p2pkhC" || item.foundConfig.script === "p2pkhU") {
            psbt.addInput({
                hash: item.tx.txid,
                index: item.vout.n,
                nonWitnessUtxo: Buffer.from(item.rawTx, 'hex')
            })
        } else if (item.foundConfig.script === "p2wpkh") {
            psbt.addInput({
                hash: item.tx.txid,
                index: item.vout.n,
                witnessUtxo: {
                    script: Buffer.from('0020' + bitcoin.crypto.sha256(item.rawTx).toString('hex'), 'hex'),
                    value: item.vout.value,
                }
            })
        } else if (item.foundConfig.script === "p2tr") {
            psbt.addInput({
                hash: item.tx.txid,
                index: item.vout.n,
                witnessUtxo: {
                    script: Buffer.from('0020' + bitcoin.crypto.sha256(item.rawTx).toString('hex'), 'hex'),
                    value: item.vout.value,
                },
                tapInternalKey: toXOnly(item.foundConfig.publicKey),
            })
        }
        psbt.addOutput({
            address: HOME_TX,
            value: sendAmount
        })
        psbt.signInput(0, keyPair)
        psbt.finalizeAllInputs()
        console.log("7 extractTransaction:", psbt.extractTransaction().toHex())
        let testMempoolAccept = await client.testMempoolAccept([psbt.extractTransaction().toHex()])
        console.log("8 testMempoolAccept:", JSON.stringify(testMempoolAccept))
        if (testMempoolAccept[0].allowed === true) {
            let sendRawTransaction = await client.sendRawTransaction(psbt.extractTransaction().toHex())
            item.myAmount = sendAmount
            console.log("9 sendRawTransaction:", "" + sendRawTransaction)
        }
    } catch (e) {
        console.log("error:", JSON.stringify(e))
    }
}

async function createRival(item) {
    console.log("0 createRival")
    console.log("1 tx:", JSON.stringify(item.tx))
    console.log("2 vout:", JSON.stringify(item.vout))
    console.log("3 foundConfig:", JSON.stringify(item.foundConfig))
    console.log("4 rawTx:", item.rawTx)
    console.log("5 minfeerate:", item.minfeerate)
}

async function createRivalMy(item) {
    console.log("0 createRivalMy")
    console.log("1 tx:", JSON.stringify(item.tx))
    console.log("2 vout:", JSON.stringify(item.vout))
    console.log("3 foundConfig:", JSON.stringify(item.foundConfig))
    console.log("4 rawTx:", item.rawTx)
    console.log("5 minfeerate:", item.minfeerate)
}

generateConfig()
read().then(r => console.log(r))


// let asd = await client.getTransactionByHash('b4dd08f32be15d96b7166fd77afd18aece7480f72af6c9c7f9c5cbeb01e686fe', { extension: 'json', summary: false });
// let asd = await client.getRawMempool(true)
//   let asd = await client.prioritiseTransaction("408e0f7ce93dc7a00f9af63d4e83ed3ee3fb8ac1e6667f4818ddd6a4db67efb4", 0.0, 1000000)

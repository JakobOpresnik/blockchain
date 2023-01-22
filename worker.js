const {parentPort} = require("worker_threads");
const crypto = require("crypto");

var BLOCKCHAIN = [];    // empty blockchain before we start mining blocks
var INDEX = 0;          // index of the first block of the blockchain
var PREVINDEX = -1;     // index of previous block in the blockchain
var BLOCKS = [];        // array of blocks for checking validity of previous hash
var DIFF = 0;           // mining difficulty

const GEN_INTERVAL = 1000;    // time interval for generating blocks (1000ms = 0.1s)
const ADJUST_DIFF = 5;         // how often the difficulty will be adjusted (5 blocks)

// expected time for mining new blocks (5000)
const EXPECTED_TIME = GEN_INTERVAL * ADJUST_DIFF;

function Block(index, data, timestamp, timeCreated, hash, prevHash, diff, nonce) {
    this.index = index;
    this.data = data;
    this.timestamp = timestamp;
    this.timeCreated = timeCreated;
    this.hash = hash;
    this.prevHash = prevHash;
    this.diff = diff;
    this.nonce = nonce;
}

// mining new blocks
function mineBlock() {
    //var diff = 1;   // mining difficulty
    var nonce = 0;  // one-time-use token (part of generating hash)

    // measuring how long it takes to mine a block
    var start = new Date().getTime();
    var end;

    while (true) {
        
        var diff = DIFF;
        let data = (Math.random()+1).toString(36).substring(7);
        var date = new Date();
        var timestamp = date.getDate() + "/" + (date.getMonth()+1) + "/" + date.getFullYear() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
        var timeCreated = new Date().getTime();
        // calculating hash
        var hash = crypto.createHash("sha256");
        var hashObj = hash.update(INDEX + data + timestamp + diff + nonce, "utf-8");
        var hash = hashObj.digest("hex");


        var correct_hash = "";
        for (let i = 0; i < diff; i++) {
            correct_hash += "0";
        }

        var prevHash;
        // hash is valid if the number of zeros at its start is equal to 'diff'
        if (hash.slice(0, diff) == correct_hash) {
            if (INDEX == 0) {
                prevHash = 0;
            }
            // check if there is a block with the value of previous index
            else {
                var prevBlock;
                for (const block of BLOCKS) {
                    if (block.index == PREVINDEX) {
                        // previous block's hash is the current block's previous hash
                        prevHash = block.hash;
                        prevBlock = block;
                    }
                    // block in chain is valid if his timestamp is at most 1min less than the previous block's timestamp
                    if (block.index == INDEX) {
                        if (block.timeCreated <= prevBlock.timeCreated+6000) {
                            console.log("valid block in blockchain");
                        }
                        else {
                            return;
                        }
                    }
                }
            }
            // previous block's index must always be smaller by 1
            if (INDEX == PREVINDEX+1) {
                var currentTime = new Date().getTime();
                if (timeCreated <= currentTime+60000) {
                    console.log("valid timestamp");
                    end = new Date().getTime(); // end of measuring
                    var timeElapsed = end - start;
                    // if elapsed time was substantially shorter than what we expected we increase mining difficulty
                    var newBlock = new Block(INDEX, data, timestamp, timeCreated, hash, prevHash, diff, nonce);
                    // printBlock(newBlock);
                    BLOCKS.push(newBlock);  // for assigning previous hash
                    if (timeElapsed < EXPECTED_TIME/2) {
                        //console.log(timeElapsed);
                        DIFF++;
                    }
                    // if elapsed time was substantially longer than what we expected we decrease mining difficulty
                    else if (timeElapsed > EXPECTED_TIME*2) {
                        //console.log(timeElapsed);
                        DIFF--;
                    }
                    INDEX++;
                    PREVINDEX++;
                    return newBlock;
                }
                else {
                    console.log("invalid timestamp");
                }
            }
            else {
                console.log("invalid block!");
            }
        }
        else {
            nonce++;
        }
    }
}

// receiving request from server (peer.js)
parentPort.on("message", () => {
    let block = mineBlock();
    // sending block to server (peer.js)
    try {
        parentPort.postMessage(block);
    }
    catch(err) {
        console.log(`ERROR: couldn't send block back to peer.js ${err}`);
    }
})
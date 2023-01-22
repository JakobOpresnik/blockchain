// handling arguments
// 1. argument - node
// 2. argument - file_name.js
// 3. argument - express server port
// 4. argument - p2p server port
var args = process.argv.slice(2);   // first 2 arguments are for running the script so we slice them
console.log("arguments: ", args);


// p2p client
const p2p_client = require("socket.io-client");


// p2p server
const server = require("http").createServer();
const io_server = require("socket.io")(server);
const p2p_server = require("socket.io-p2p-server").Server;
io_server.use(p2p_server);
server.listen(args[1]);
console.log(`p2p server listening on address 127.0.0.1:${args[1]}`);


// server for handling the frontend
const express = require("express");
const http = require("http");
const socket = require("socket.io");

const app = express();
const http_server = http.createServer(app);
const io = socket(http_server);

const {Worker} = require("worker_threads");
const worker = new Worker("./worker.js", {});



// express app for displaying html
app.get("/", function(req, res) {
    res.sendFile(__dirname + "/index.html");
});

var port = args[0];
http_server.listen(port, () => {
    console.log(`express server listening on address 127.0.0.1:${port}\n`);
});



var BLOCKCHAIN = [];    // empty blockchain before we start mining blocks
var PEERS = [];

io.on("connection", (socket) => {

    function printChain(BLOCKCHAIN) {
        for (let i = 0; i < BLOCKCHAIN.length; i++) {
            console.log(`\nindex: ${BLOCKCHAIN[i].index}\ndata: ${BLOCKCHAIN[i].data}`);
        }
    }

    function sendChainToPeers() {
        // send blockchain to every connected peer separately
        for (let i = 0; i < PEERS.length; i++) {
            let peer = p2p_client(`http://localhost:${PEERS[i]}`);
            try {
                peer.emit("send-blockchain", BLOCKCHAIN);
            }
            catch(err) {
                console.long(`ERROR: couldn't send blockchain to peer on port ${PEERS[i]} (${err})`);
            }
        }
    }

    // cumulative chain difference: 2**block.diff
    function cumulativeChainDiff(blockchain) {
        var chainDiff = 0;
        for (let i = 0; i < blockchain.length; i++) {
            chainDiff += Math.pow(2, blockchain[i].diff);
        }
        return chainDiff;
    }

    // returns chain with higher cumulative difference
    function validateChain(blockchain) {
        if (cumulativeChainDiff(BLOCKCHAIN) > cumulativeChainDiff(blockchain)) {
            console.log("local chain is valid");
            return BLOCKCHAIN;
        }
        else {
            console.log("sent chain is valid");
            return blockchain;
        }
    }

    // p2p server 'connection' event
    io_server.on("connection", (p2p_socket) => {

        p2p_socket.on("test-connection", (msg) => {
            console.log(msg);
        });

        p2p_socket.on("test-mining", (msg) => {
            console.log(msg);
            // worker.postMessage(BLOCKCHAIN); // PROBLEM: generates different blocks
        });

        // blockchain sent from index.html javascript
        p2p_socket.on("send-blockchain", (blockchain) => {
            console.log("\nBLOCKCHAIN RECEIVED!");
            
            // we continue to display the validated chain
            printChain(validateChain(blockchain));

        });

    });

    
    socket.on("connect-port", (port) => {
        console.log(`${args[1]} ====> ${port}`);
        var p2p_client_socket = p2p_client(`http://localhost:${port}`);
        try {
            p2p_client_socket.emit("test-connection", `${args[1]} ====> ${port}`);
        }
        catch(err) {
            console.log(`ERROR: couldn't test connection between peers on ports ${args[1]} and ${port} (${err})`);
        }
        PEERS.push(port);
        console.log("peers connected:");
        for (let peer in PEERS) {
            console.log(PEERS[peer]);
        }
    });

    socket.on("mine", () => {

        console.log("starting mining blocks...");
        try {
            worker.postMessage(BLOCKCHAIN);
        }
        catch(err) {
            console.log(`ERROR: couldn't send blockchain to worker.js (${err})`);
        }

    });

    socket.on("send-chain", () => {
        // send blockchain to all connected peers every 5 seconds (5000ms)
        setInterval(sendChainToPeers, 5000);
        
        try {
            socket.emit("send-peers", PEERS);
        }
        catch(err) {
            console.log(`ERROR: couldn't send peers (${err})`);
        }
    });

    // receiving block from worker.js
    worker.on("message", (block) => {
        BLOCKCHAIN.push(block);
        // emiting block to display on page
        try {
            socket.emit("block", block);
        }
        catch(err) {
            console.log(`ERROR: couldn't send block (${err})`);
        }
        // requesting another block to worker.js
        worker.postMessage(BLOCKCHAIN);
        printChain(BLOCKCHAIN);
        try {
            socket.emit("send-chain", BLOCKCHAIN);  // send to index.html
        }
        catch(err) {
            console.log(`ERROR: couldn't send chain (${err})`);
        }
    });

    worker.on("error", (err) => {
        console.log(`ERROR: problem with worker threads (${err})`);
    });

    worker.on("exit", (exit_code) => {
        if (exit_code != 0) {
            console.log(`ERROR: worker thread exit code: ${exit_code}`);
        }
    });

});

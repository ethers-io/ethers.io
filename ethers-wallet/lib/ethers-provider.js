'use strict';

var utils = require('../node_modules/ethers-wallet/lib/utils.js');


function EthersProvider(options) {
    if (!(this instanceof EthersProvider)) { throw new Error('missing new'); }

    var self = this;

    // Explicit endpoint given (with no other options)
    if (typeof(options) === 'string') {
        options = { endpoints: [options] };
    } else if (!options) {
        options = {};
    }

    var endpoints = [
        'wss://linode-newark.ethers.ws:8000/v2/homestead',
    ]

    if (options.endpoints) {
        endpoints = options.endpoints;

    // Testnet
    } else if (options.testnet) {
        endpoints = [
           'wss://linode-newark..ethers.ws:8001/v2/morden',
        ];
    }

    // Return a copy so the user cannot alter tham after instantiation
    Object.defineProperty(this, 'endpoints', {
        enumerable: true,
        get: function() { return endpoints.slice(); }
    });

    var endpoint = null;
    Object.defineProperty(this, 'currentEndpoint', {
        enumerable: true,
        get: function() { return endpoint; }
    });

    // The current block number (as a number)
    var blockNumber = null;
    Object.defineProperty(this, 'blockNumber', {
        enumerable: true,
        get: function() { return blockNumber; }
    });

    // The current gas price (as a hex string)
    var gasPrice = null;
    Object.defineProperty(this, 'gasPrice', {
        enumerable: true,
        get: function() { return gasPrice; }
    });

    var addresses = {};
    Object.defineProperty(this, 'accounts', {
        enumerable: true,
        get: function() { return Object.keys(addresses); }
    });

    var onAccountChange = null;
    function emitAccountChange(address, data) {
        if (!onAccountChange) { return; }
        try {
            if (data.balance) { data.balance = hexToBN(data.balance); }
            onAccountChange(address, data);
        } catch (error) {
            console.log(error);
        }
    }
    Object.defineProperty(this, 'onaccount', {
        enumerable: true,
        get: function() { return onAccountChange; },
        set: function(value) {
            if (typeof(value) !== 'function') { throw new Error('invalid callback'); }
            onAccountChange = value;
        }
    });

    var onBlockChange = null;
    function emitBlockChange(blockNumber) {
        if (!onBlockChange) { return; }
        try {
            onBlockChange(blockNumber);
        } catch (error) {
            console.log(error);
        }
    }
    Object.defineProperty(this, 'onblock', {
        enumerable: true,
        get: function() { return onBlockChange; },
        set: function(value) {
            if (typeof(value) !== 'function') { throw new Error('invalid callback'); }
            onBlockChange = value;
        }
    });

    var nextFilterId = 2;
    var filters = {};

    var webSocket = null;
    var connected = false;
    Object.defineProperty(this, 'isConnected', {
        enumerable: true,
        get: function() { return connected; }
    });

    var nextMessageId = 2;

    // Requests that have not been sent yet (not yet connected, diconnected, error, etc)
    // [{id: number, isFilter: boolean, send: function}, ...]
    //   - id is kept for sorting purposes
    //   - isFilter prevents repeat subscriptions
    //   - send should return the callback (if any)
    var pending = [];

    // Requests that have been sent and are waiting for a response
    // {id => {send: function, isFilter: boolean, callback: function}, ...}
    //   - send is the callback used to send this request (can be used to re-request)
    //   - isFilter is prevents repeat subscriptions
    //   - callback is the result from calling send()
    var inflight = {}

    // Sends any pending (buffered) requests to the backend
    function nudge() {

        if (!connected) { return; }

        while (pending.length) {
            var request = pending.shift();
            inflight[request.id] = {
                send: request.send,
                isFilter: request.isFilter,
                callback: request.send()
            };
        }
    }

    // Send a request to the backend
    function makeSend(messageId, action, params, callback) {
        return (function() {
            var payload = {method: action, jsonrpc: '2.0', id: messageId, params: params};
            webSocket.send(JSON.stringify(payload));

            return callback;
        });
    }

    function reconnect() {

        // Remove all filters for pending (we will re-add them below)
        for (var i = pending.length - 1; i >= 0; i--) {
            if (pending[i].isFilter) { pending.splice(i, 1); }
        }

        // Move all inflight requests back to pending
        for (var messageId in inflight) {
            var request = inflight[messageId];

            // Don't included filters (we will add them below)
            if (request.isFilter) { continue; }

            pending.push({id: messageId, isFilter: request.isFilter, send: request.send});
        }

        // Send them in the order they were originally requests (get addresses and filters in first)
        pending.sort(function (a, b) { return (a.id - b.id); })

        // Clear the inflight requests (all have been moved to pending)
        inflight = {};

        // Put all the address filters at the beginning of the pending requests
        for (var address in addresses) {
            var messageId = (nextMessageId++)
            pending.unshift({
                id: messageId,
                isFilter: true,
                send: makeSend(messageId, 'watchAddress', [{address: address}])
            });
        }

        // @TODO: filters

        // @TODO: exponential back-off
        setTimeout(function() {
            connect();
        }, 1000);
    }

    function connect() {
        if (connected) { throw new Error('already connected'); }

        endpoint = endpoints[parseInt(Math.random() * endpoints.length)];
        webSocket = new WebSocket(endpoint);

        webSocket.onopen = function() {
            connected = true;
            pending.unshift({ id: 0, isFilter: false, send: makeSend(0, 'status', []) });
            nudge();
        }

        webSocket.onmessage = function(message) {
            var data = JSON.parse(message.data);

            // General broadcast (eg. event)
            if (data.id === 0) {
                var result = data.result || {};
                if (result.blockNumber) {
                    blockNumber = result.blockNumber;
                    emitBlockChange(blockNumber);
                }

                if (result.gasPrice && result.gasPrice !== gasPrice) {
                    gasPrice = result.gasPrice;
                }

                var accountChanges = {};
                if (result.accounts) {
                    result.accounts.forEach(function(info) {
                        var address = info.address;
                        delete info.address;
                        emitAccountChange(address, info);
                    });
                }

                if (result.filterId) {
                    var filter = filters[result.filterId];
                    filter.blockNumber = result.blockNumber;
                    try {
                        filter.callback(result.data);
                    } catch (error) {
                        console.log(error);
                    }
                }
                return;
            }

            // Get and remove the original request
            var request = inflight[data.id];
            if (!request) {
                console.warn('missing inflight request for ' + data.id);
                return;
            }
            delete inflight[data.id];

            // Send the response to the original caller
            if (request.callback) {
                try {
                    if (data.code) {
                        var error = new Error(data.message);
                        error.code = data.code;
                        if (data.reason) { error.reason = data.reason; }
                        request.callback(error);
                    } else {
                       request.callback(null, data.result);
                    }
                } catch (error) {
                    console.error(error);
                }
            }

        }

        webSocket.onerror = function(error) {
            connected = false;
            reconnect();
        }

        webSocket.onclose = function() {
            connected = false;
            reconnect();
        }

    }

    utils.defineProperty(this, '_send', function(action, params, check) {
        var messageId = (nextMessageId++);

        // Create a copy of the params (to protect from mutation)
        try {
            params = JSON.parse(JSON.stringify(params));
        } catch (error) {
            console.error(error);
            throw new Error('invalid parameter');
        }

        return (new Promise(function(resolve, reject) {
            var request = {
                id: messageId,
                isFilter: (action === 'watchAddress' || action === 'setupEvent'),
                send: makeSend(messageId, action, params, function(error, result) {
                    if (error) {
                        reject(error);
                    } else {
                        try {
                            if (check) { result = check(result); }
                            resolve(result);
                        } catch (error) {
                            reject(error);
                        }
                    }
                })
            };

            pending.push(request);

            nudge();
        }));
    });

    utils.defineProperty(this, 'watchAccount', function(address) {
        address = utils.getAddress(address);
        if (addresses[address]) { return; }
        addresses[address] = {balance: null, transactionCount: null};
        self._send('watchAddress', [{address: address}]);
    });
/*
    utils.defineProperty(this, 'watchTransaction', function(txid) {
        if (!utils.isHexString(txid, 32)) {
            throw new Error('invalid txid');
        }
    });
*/
    utils.defineProperty(this, 'registerFilter', function(topics, callback) {
        // @TODO: Check topics
        if (typeof(callback) !== 'function') { throw new Error('invalid callback'); }

        var filterId = nextFilterId++;
        filters[filterId] = {blockNumber: blockNumber, callback: callback};
        self._send('registerFilter', [{blockNumber: blockNumber, filterId: filterId, topics: topics}]);

        return filterId;
    });

    utils.defineProperty(this, 'unregisterFilter', function(filterId) {
        self._send('unregisterFilter', [{filterId: filterId}]);
        delete filters[filterId];
    });

    connect();
}


function Contract(source, bytecode, compilerVersion, optimize, deploymentTarget) {
      utils.defineProperty(this, 'source', source);
      utils.defineProperty(this, 'bytecode', bytecode);
      utils.defineProperty(this, 'compilerVersion', compilerVersion);
      utils.defineProperty(this, 'optimize', optimize);
      utils.defineProperty(this, 'deploymentTarget', deploymentTarget);
}
utils.defineProperty(EthersProvider, 'Contract', Contract);


function hexlifyTransaction(transaction) {
    var result = {};
    ['from', 'to'].forEach(function(key) {
        if (!transaction[key]) { return; }
        result[key] = utils.getAddress(transaction[key]);
    });
    ['data', 'gasLimit', 'gasPrice', 'nonce', 'value'].forEach(function(key) {
        if (!transaction[key]) { return; }
        result[key] = utils.hexlify(transaction[key]);
    });
    return result;
}

// @TODO: Merge this into ethers-wallet's providers (these helper functions are already there)
function ensureHex(value, length) {
    if (!utils.isHexString(value)) { throw new Error('invalid hex string'); }
    if (length != null && value.length !== (2 + 2 * length)) {
        throw new Error('invalid hex string length');
    }
    return value;
}

function hexToBN(value) {
    return new Wallet.utils.BN(ensureHex(value).substring(2), 16);
}

function hexToNumber(value) {
    if (!utils.isHexString(value)) { throw new Error('invalid hex string'); }
    return parseInt(value.substring(2), 16);
}

function validBlock(value) {
    if (value == null) { return 'latest'; }
    if (value === 'latest' || value === 'pending') { return value; }

    if (typeof(value) === 'number' && value == parseInt(value)) {
        return parseInt(value);
    }

    throw new Error('invalid blockNumber');
}

// Blockchain transactions
utils.defineProperty(EthersProvider.prototype, 'sendTransaction', function(signedTransaction) {
    return this._send('sendTransaction', [{signedTransaction: signedTransaction}]);
});

utils.defineProperty(EthersProvider.prototype, 'deployContract', function(contract, signedTransaction) {
console.log(contract, signedTransaction);
    if (!(contract instanceof Contract)) { throw new Error('invalid contract'); }
    return this._send('deployContract', [{
        source: contract.source,
        compilerVersion: contract.compilerVersion,
        optimize: contract.optimize,
        deploymentTarget: contract.deploymentTarget,
        signedTransaction: signedTransaction,
    }]);
});


// Blockchain read-only
utils.defineProperty(EthersProvider.prototype, 'call', function(transaction) {
    return this._send('call', [{
        transaction: hexlifyTransaction(transaction)
    }], ensureHex);
});

utils.defineProperty(EthersProvider.prototype, 'estimateGas', function(transaction) {
    return this._send('estimateGas', [{
        transaction: hexlifyTransaction(transaction)
    }], hexToBN);
});

utils.defineProperty(EthersProvider.prototype, 'getBalance', function(address, blockNumber) {
    return this._send('getBalance', [{
        address: utils.getAddress(address),
        blockNumber: validBlock(blockNumber)
    }], hexToBN);
});

utils.defineProperty(EthersProvider.prototype, 'getBlock', function(blockHashOrNumber) {
    return this._send('getBlock', [{
        block: blockHashOrNumber
    }]);
});

utils.defineProperty(EthersProvider.prototype, 'getBlockNumber', function() {
    if (this.blockNumber == null) {
        return this._send('getBlockNumber', [], ensureInteger);
    }

    var blockNumber = this.blockNumber;
    return new Promise(function(resolve, reject) {
        resolve(blockNumber);
    });

});

utils.defineProperty(EthersProvider.prototype, 'getGasPrice', function() {
    if (this.gasPrice == null) {
        return this._send('getGasPrice', [], hexToBN);
    }

    var gasPrice = this.gasPrice;
    return new Promise(function(resolve, reject) {
        resolve(hexToBN(gasPrice));
    });

});

utils.defineProperty(EthersProvider.prototype, 'getTransaction', function(txid) {
    return this._send('getTransaction', [{txid: ensureHex(txid, 32)}]);
});

utils.defineProperty(EthersProvider.prototype, 'getTransactionCount', function(address, blockNumber) {
    return this._send('getTransactionCount', [{
        address: utils.getAddress(address),
        blockNumber: validBlock(blockNumber)
    }], hexToNumber);
});

utils.defineProperty(EthersProvider.prototype, 'getTransactionReceipt', function(txid) {
    return this._send('getTransactionReceipt', [{txid: ensureHex(txid, 32)}]);
});

/*
utils.defineProperty(EthersProvider.prototype, 'getContract', function(address) {
    return this._send('getContract', [{address: address}]);
});
*/
/*
utils.defineProperty(EthersProvider.prototype, 'deployApplication', function(stuff, callback) {
    this._send('deployApplication', [{application: application}], callback);
});
*/
utils.defineProperty(EthersProvider.prototype, 'fundAccount', function(address) {
    return this._send('fundAccount', [{address: utils.getAddress(address)}]);
});

utils.defineProperty(EthersProvider.prototype, 'status', function() {
    return this._send('status', []);
});

module.exports = EthersProvider;

'use strict';

var Interface = require('./node_modules/ethers-wallet/lib/contract.js').Interface;
var units = require('./node_modules/ethers-wallet/lib/units.js');
var utils = require('./node_modules/ethers-wallet/lib/utils.js');


var ethers = {}

var exportUtils = {};
utils.defineProperty(ethers, 'utils', exportUtils);

var blockchain = {};
utils.defineProperty(ethers, 'blockchain', blockchain);

// ethers root functions
utils.defineProperty(ethers, 'normalizeAddress', function(address, icap) {
    if (icap) {
        return utils.getIcapAddress(address);
    }
    return utils.getAddress(address);
});

utils.defineProperty(ethers, 'formatEther', units.formatEther);
utils.defineProperty(ethers, 'parseEther', units.parseEther);

utils.defineProperty(ethers, 'etherSymbol', '\uD835\uDF63');

utils.defineProperty(ethers, 'hasSandbox', function() {
    return (parent !== window);
});

// ethers.utils
utils.defineProperty(exportUtils, 'BN', utils.BN);
utils.defineProperty(exportUtils, 'Buffer', Buffer);
utils.defineProperty(exportUtils, 'sha3', utils.sha3);
utils.defineProperty(exportUtils, 'sha256', utils.sha256);
utils.defineProperty(exportUtils, 'hexlify', utils.hexlify);

utils.defineProperty(exportUtils, 'getContractAddresshexlify', function(fromAddress, nonce) {
    return utils.getContractAddress({
        from: fromAddress,
        nonce: nonce
    });
});


var parentUrl = '*';


function buildEnsureHex(length, name) {
    return function(value) {
        if (!utils.isHexString(value, length)) {
            throw new Error('invalid ' + (name ? name: 'hex value'));
        }
        return value;
    }
}

var ensureHex = buildEnsureHex();
var ensureHex32 = buildEnsureHex(32);


var sendMessage = (function() {

    function setupEvent(object, name) {
        var callback = null;

        Object.defineProperty(object, name, {
            enumerable: true,
            get: function() { return callback; },
            set: function(value) {
                if (value !== null && typeof(value) !== 'function') {
                    throw new Error('invalid ' + name);
                }
                callback = value;
            }
        });
    }

    // onready - After we have finished loading and registered with ethers.io
    setupEvent(ethers, 'onready');

    // onaccount - Whenever the user switches to a new account
    setupEvent(ethers, 'onaccount');

    // onblock - Whenever a new block arrives
    setupEvent(blockchain, 'onblock');

    // Array of {hash: hash, sent: boolean, callback: function}
    var transactions = {};

    // Track filters
    var nextFilterId = 1;
    var filters = {};


    // Track the callbacks that responses call
    var nextMessageId = 1;
    var inflightCallbacks = {};

    // If calls are made before we are setup, buffer them until after setup
    var pending = [];


    // Send a message to ethers.io (or buffer for deferred delivery)
    function sendMessage(action, params, callback) {
        var messageId = nextMessageId++;
        if (callback) {
            if (typeof(callback) !== 'function') { throw new Error('invalid callback'); }
            inflightCallbacks[messageId] = callback;
        }

        var payload = {
            action: action,
            ethers: 'v\x01\n',
            id: messageId,
            params: params
        }

        if (doneSetup) {
            parent.postMessage(payload, parentUrl);

        } else {
            // Create an immutable copy for the deferred request
            pending.push(JSON.stringify(payload));
        }
    }

    function checkTransaction(hash) {
        sendMessage('getTransaction', {hash: hash}, function(error, transaction) {
            if (!error && transaction.blockHash) {
                var callbacks = transactions[hash];
                if (!callbacks) { return; }
                callbacks.forEach(function(callback) {
                    try {
                        callback(null, transaction);
                    } catch (error) {
                        console.log(error);
                    }
                });
                delete transactions[hash];
            }
        });
    }

    function checkTransactions() {
        for (var hash in transactions) {
            checkTransaction(hash);
        }
    }

    var doneSetup = false;
    function setup() {
        if (doneSetup) { return; }
        doneSetup = true;

        global.addEventListener('message', function(event) {
            //if (event.origin !== parentUrl) { return; }

            var data = event.data;
            if (!data || data.ethers !== 'v\x01\n') { return; }

            if (data.id) {
                var callback = inflightCallbacks[data.id];
                delete inflightCallbacks[data.id];
                if (callback) {
                    var results = null;
                    if (data.error) {
                        results = [new Error(data.error)];
                    } else {
                        results = [null, data.result];
                    }

                    try {
                        callback.apply(global, results);
                    } catch (error) {
                        console.error(error);
                    }
                }

            } else {
                switch (data.action) {
                    case 'accountChanged':
                        if (ethers.onaccount) {
                            try {
                                ethers.onaccount(data.account);
                            } catch(error) {
                                console.log(error);
                            }
                        }
                        break;

                    case 'block':
                        if (blockchain.onblock) {
                            try {
                                blockchain.onblock.call(global, data.blockNumber);
                            } catch (error) {
                                console.log(error);
                            }
                        }
                        checkTransactions();
                        break

                    case 'event':
                        var filter = filters[data.eventId];
                        if (!filter || filter.on == null) { break; }
                        try {
                            filter.on(data.data);
                        } catch (error) {
                            console.log(error);
                        }
                        break;

                    case 'ready':
                        if (ethers.onready) {
                            try {
                                ethers.onready.call(global);
                            } catch(error) {
                                console.log(error);
                            }
                        }
                        break;

                    default:
                        console.log('Unknown Action: ' + data.action);
                }
            }
        }, false);

        // Flush any pending requests made before setup
        pending.forEach(function(operation) {
            parent.postMessage(JSON.parse(operation), parentUrl);
        });

        pending = [];
    }
    utils.defineProperty(ethers, 'setup', setup);

    function Event(filterId, topics) {
        if (!(this instanceof Event)) { throw new Error('missing new'); }
        utils.defineProperty(this, 'id', filterId);

        var frozenTopics = JSON.stringify(topics);
        Object.defineProperty(this, 'topics', {
            enumerable: true,
            get: function() { return JSON.parse(frozenTopics); }
        });

        // @TODO: When set to null, issue teardown?
        setupEvent(this, 'on');
    }

    utils.defineProperty(Event.prototype, 'remove', function() {
        sendMessage('teardownEvent', {eventId: this.id});
        delete filters[this.id];
    });

    utils.defineProperty(blockchain, 'setupEvent', function(topics) {
        var event = new Event(nextFilterId++, topics);
        sendMessage('setupEvent', {eventId: event.id, topics: event.topics});
        filters[event.id] = event;
        return event;
    });

    utils.defineProperty(blockchain, 'waitForTransaction', function(hash, timeout) {
        hash = ensureHex32(hash)

        if (!transactions[hash]) { transactions[hash] = []; }
        var promise = new Promise(function(resolve, reject) {
            var done = false;

            var timer = null;
            if (timeout) {
                timer = setTimeout(function() {
                    timer = null;
                    if (done) { return; }
                    done = true;
                    reject(new Error('timeout'));
                }, timeout);
            }

            transactions[hash].push(function(error, transaction) {
                if (timer) { clearTimeout(timer); }
                if (done) { return; }
                done = true;

                if (error) {
                    reject(error);
                } else {
                    resolve(transaction);
                }
            });
        });
        checkTransaction(hash);

        return promise;
    });


    // Notify ethers.io that we're ready.
    document.addEventListener('DOMContentLoaded', function() {
        setup();
        sendMessage('ready', {title: document.title});
    });

    return sendMessage;
})();

(function() {
    function promisify(action, params, convert) {
        return new Promise(function(resolve, reject) {
            sendMessage(action, params, function(error, result) {
                if (error) {
                    reject(error);
                } else {
                    if (convert) {
                        try {
                            result = convert(result);
                        } catch(error) {
                            console.log(error);
                            reject('invalid response');
                            return
                        }
                    }
                    resolve(result);
                }
            });
        });
    }

    function ensureInteger(value, name) {
        if (typeof(value) !== 'number' || parseInt(value) !== value || value < 0) {
            throw new Error('invalid ' + (name ? name: 'integer'));
        }
        return value;
    }

    function ensureValidBlock(value, name) {
        if (value == null) { return 'latest'; }
        if (value === 'latest' || value === 'pending') { return value; }
        return ensureInteger(value, name);
    }

    function convertHexToBN(hex) {
        return new utils.BN(ensureHex(hex).substring(2), 16);
    }

    function convertTransaction(transaction) {
        var result = {};
        ['from', 'to'].forEach(function(key) {
            if (!transaction[key]) { return; }
            result[key] = utils.getAddress(transaction[key]);
        });
        ['gasLimit', 'gasPrice', 'value'].forEach(function(key) {
            if (!transaction[key]) { return; }
            result[key] = convertHexToBN(transaction[key]);
        });
        ['blockHash', 'hash'].forEach(function(key) {
            if (!transaction[key]) { return; }
            result[key] = ensureHex32(transaction[key]);
        });
        ['data'].forEach(function(key) {
            if (!transaction[key]) { return; }
            result[key] = ensureHex(transaction[key]);
        });
        ['nonce'].forEach(function(key) {
            if (!transaction[key]) { return; }
            result[key] = ensureInteger(transaction[key]);
        });
        return result;
    }

    function convertBlock(block) {
        return block;
    }

    utils.defineProperty(ethers, 'getAccount', function() {
        return promisify('getAccount', {}, function(address) {
            if (address) {
                return utils.getAddress(address);
            }
            return null;
        });
    });

    utils.defineProperty(ethers, 'getNetwork', function() {
        return promisify('getNetwork', {});
    });

    utils.defineProperty(ethers, 'send', function(address, amountWei) {
        return promisify('send', {
            address: utils.getAddress(address),
            amountWei: utils.hexlify(amountWei, 'amountWei')
        }, ensureHex32);
    });

    utils.defineProperty(ethers, 'sendTransaction', function(transaction) {
        // @TODO: Check transaction
        return promisify('sendTransaction', {
            transaction: transaction
        }, ensureHex32)
    });

    utils.defineProperty(ethers, 'deployContract', function(contract) {
        return promisify('deployContract', {
            bytecode: contract.bytecode,
            compilerVersion: contract.compilerVersion,
            deploymentTarget: contract.deploymentTarget,
            optimize: contract.optimize,
            source: contract.source
        }, function(info) {
            ensureHex32(info.hash);
            utils.getAddress(info.address);
            return info;
        })
    });

    utils.defineProperty(ethers, 'fundAccount', function(address) {
        return promisify('fundAccount', {address: utils.getAddress(address)}, ensureHex32);
    });


    // call(transaction)
    utils.defineProperty(blockchain, 'call', function(transaction) {
        // @TODO: Check transaction
        return promisify('call', {
            transaction: transaction
        }, ensureHex);
    });

    // estimateGas(transaction)
    utils.defineProperty(blockchain, 'estimateGas', function(transaction) {
        // @TODO: Check transaction
        return promisify('estimateGas', {
            transaction: transaction
        }, convertHexToBN);
    });

    // getBalance(address, block)
    utils.defineProperty(blockchain, 'getBalance', function(address, blockNumber) {
        /// @TODO: check address, valid block
        return promisify('getBalance', {
            address: utils.getAddress(address),
            blockNumber: blockNumber
        }, convertHexToBN);
    });

    // getBlock(blockHashOrNumber)
    utils.defineProperty(blockchain, 'getBlock', function(blockHashOrNumber) {
        var params = {};
        return promisify('getBlock', {
            block: blockHashOrNumber
        }, convertBlock);
    });

    utils.defineProperty(blockchain, 'getBlockNumber', function() {
        return promisify('getBlockNumber', {}, ensureInteger);
    });

    utils.defineProperty(blockchain, 'getGasPrice', function() {
        return promisify('getGasPrice', {}, convertHexToBN);
    });

    // getTransaction(hash)
    utils.defineProperty(blockchain, 'getTransaction', function(hash) {
        return promisify('getTransaction', {hash: ensureHex32(hash)}, convertTransaction);
    });

    // getTransactionCount(address, block)
    utils.defineProperty(blockchain, 'getTransactionCount', function(address, blockNumber) {
        /// @TODO: check address, valid block
        return promisify('getTransactionCount', {
            address: utils.getAddress(address),
            blockNumber: blockNumber
        }, ensureInteger);
    });

    // getTransactionReceipt(hash)
    utils.defineProperty(blockchain, 'getTransactionReceipt', function(hash) {
        return promisify('getTransactionReceipt', {hash: ensureHex32(hash)}, convertTransaction);
    });

    //var web3 = {};
    //utils.defineProperty(ethers, 'web3', web3);

    var allowedTransactionKeys = {
        data: true, from: true, gasLimit: true, gasPrice:true, to: true, value: true
    }

    function prepareMethod(contractInterface, address, method, estimateOnly) {
        return function() {

            var transaction = {};
            var params = Array.prototype.slice.call(arguments);
            if (params.length == contractInterface[method].inputs.length + 1) {
                transaction = params.pop();
                if (transaction === null || typeof(transaction) !== 'object') {
                    throw new Error('invalid transaction overrides');
                }
                for (var key in transaction) {
                    if (!allowedTransactionKeys[key]) {
                        throw new Error('unknown transaction override ' + key);
                    }
                }
            }

            var call = contractInterface[method].apply(contractInterface, params);
            switch (call.type) {
                case 'call':
                    ['data', 'gasLimit', 'gasPrice', 'to', 'value'].forEach(function(key) {
                        if (transaction[key] != null) {
                            throw new Error('call cannot override ' + key) ;
                        }
                    });

                    if (estimateOnly) {
                        return new Promise(function(resolve, reject) {
                            resolve(new utils.BN(0));
                        });
                    }

                    transaction.data = call.data;
                    transaction.to = address;

                    return promisify('call', {transaction: transaction}, function(value) {
                        return call.parse(value);
                    });

               case 'transaction':
                    ['data', 'from', 'to'].forEach(function(key) {
                        if (transaction[key] != null) {
                            throw new Error('transaction cannot override ' + key) ;
                        }
                    });
                    transaction.data = call.data;
                    transaction.to = address;

                    if (estimateOnly) {
                        return promisify('estimateGas', {
                            transaction: transaction
                        }, convertHexToBN);
                    }

                    return promisify('sendTransaction', {
                        transaction: transaction
                    }, ensureHex32);

               default:
                   console.log('unsupported contract method type: ' + call.type);
            }
        }
    }


    function Contract(address, abi) {
        if (!(this instanceof Contract)) { throw new Error('missing new'); }

        utils.defineProperty(this, 'address', address);

        var execute = {};
        utils.defineProperty(this, 'execute', execute);

        var estimate = {};
        utils.defineProperty(this, 'estimate', estimate);

        var contractInterface = new Interface(abi);
        utils.defineProperty(this, 'interface', contractInterface);

        contractInterface.methods.forEach(function(method) {
            var call = prepareMethod(contractInterface, address, method, false)

            // If a method/property in the contracy conflicts with an internal
            // value, it will not be included here (but will still be
            // aailable in the .execute below)
            if (!this[method]) {
                utils.defineProperty(this, method, call);
            }

            utils.defineProperty(execute, method, call);
            utils.defineProperty(estimate, method, prepareMethod(contractInterface, address, method, true));
        }, this);

        contractInterface.events.forEach(function(eventName) {
            var callback = null;
            var event = null;
            Object.defineProperty(this, 'on' + eventName.toLowerCase(), {
                enumerable: true,
                get: function() { return callback; },
                set: function(value) {
                    if (value !== null && typeof(value) !== 'function') {
                        throw new Error('ivalid on' + eventName.toLowerCase());
                    }
                    callback = value;

                    // Remove any existing event
                    if (event) { event.remove(); }

                    var methodInterface = contractInterface[eventName]();

                    if (value) {
                        event = blockchain.setupEvent(methodInterface.topics);
                        event.on = function(data) {
                            try {
                                callback.apply(global, methodInterface.parse(data));
                            } catch (error) {
                                console.log(error);
                            }
                        }
                    }
                }
            });
        }, this);
    }
    utils.defineProperty(ethers, 'Contract', Contract);

    utils.defineProperty(ethers, 'notify', function(message, messageType) {
        sendMessage('notify', {message: message, messageType: messageType});
    });
})();

module.exports = ethers;

'use strict';

// @TODO: Once we collapse the umbrella package, we can simplify this
var Contract = require('ethers-contracts/contract');
var providers = require('ethers-providers');
var utils = require('ethers-utils');

var ProviderBridge = require('ethers-web3-bridge');

function defineCallback(object, name) {
    var callback = null;

    Object.defineProperty(object, name, {
        enumerable: true,
        get: function() { return callback; },
        set: function(value) {
            callback = value;
        }
    });
}

function ethersLog() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[Ethers Client Library]');
    var onlyStrings = true;
    args.forEach(function(arg) {
        if (typeof(arg) !== 'string') { onlyStrings = false; }
    });
    if (onlyStrings) { args = [ args.join(' ') ]; }
    console.log.apply(console, args);
}

function proxyObject(object, deferProperties, chainProperties, syncProperties) {
    var setProxy = null;
    var proxyTarget = null;
    var proxyPromise = new Promise(function(resolve) {
        setProxy = function(value) {
            proxyTarget = value;
            resolve(proxyTarget);
            setProxy = null;
        }
    });

    deferProperties.forEach(function(property) {
        utils.defineProperty(object, property, function() {
            var targetArgs = Array.prototype.slice.call(arguments);
            return proxyPromise.then(function(proxyTarget) {
                return proxyTarget[property].apply(proxyTarget, targetArgs);
            });
        });
    });

    chainProperties.forEach(function(property) {
        utils.defineProperty(object, property, function() {
            var targetArgs = Array.prototype.slice.call(arguments);
            proxyPromise.then(function(proxyTarget) {
                proxyTarget[property].apply(proxyTarget, targetArgs);
            });
            return object;
        });
    });

    syncProperties.forEach(function(property) {
        Object.defineProperty(object, property, {
            enumerable: true,
            get: function() {
                if (!proxyTarget) { throw new Error('cannot access property before connection: ' + property); }
                return proxyTarget[property];
            }
        });
    });

    utils.defineProperty(object, 'ready', function() {
        return proxyPromise.then(function(proxyTarget) {
            return null;
        });
    });

    return setProxy;
}


function Provider() { }
var provider = new Provider();
var setProviderProxyTarget = proxyObject(provider, [
    'getBlockNumber',
    'getGasPrice',
    'getBalance',
    'getTransactionCount',
    'getCode',
    'getStorageAt',
    'call',
    'estimateGas',
    'getBlock',
    'getTransaction',
    'getTransactionReceipt',
    'getLogs',
    'resolveName',
    'waitForTransaction',
], [
    'on',
    'once',
    'removeAllListeners',
    'removeListener'
], [
    'listenerCount',
    'listeners',
    'chainId',
    'ensAddress',
    'name',
]);


function Signer() { }
var signer = new Signer();
utils.defineProperty(signer, 'provider', provider);
var setSignerProxyTarget = proxyObject(signer, [
    'getAddress',
    'getBalance',
    'sendTransaction',
    'signMessage',
], [ ], [ ]);



var ethers = {}

utils.defineProperty(ethers, 'provider', provider);
utils.defineProperty(ethers, 'signer', signer);

var exportUtils = {};
utils.defineProperty(ethers, 'utils', exportUtils);

var blockchain = {};
utils.defineProperty(ethers, 'blockchain', blockchain);

// onready - After we have finished loading and registered with ethers.io
var onready = (function() {
    var ready = false;

    var callback = null;
    function trigger() {
        ethersLog('Ready');
        ready = true;
        if (!callback) { return; }
        var cb = callback;
        setTimeout(function() { cb(); });
    }

    Object.defineProperty(ethers, 'onready', {
        enumerable: true,
        get: function() { return callback; },
        set: function(value) {
            callback = value;
            if (ready) { trigger(); }
        }
    });

    return trigger;
})();

// onaccount - Whenever the user switches to a new account
defineCallback(ethers, 'onaccount');


// ethers
utils.defineProperty(ethers, 'getAddress', utils.getAddress);

utils.defineProperty(ethers, 'formatEther', utils.formatEther);
utils.defineProperty(ethers, 'parseEther', utils.parseEther);

utils.defineProperty(ethers, 'formatUnits', utils.formatUnits);
utils.defineProperty(ethers, 'parseUnits', utils.parseUnits);

utils.defineProperty(ethers, 'etherSymbol', utils.etherSymbol);


// ethers.utils
utils.defineProperty(exportUtils, 'arrayify', utils.arrayify);
utils.defineProperty(exportUtils, 'bigNumberify', utils.bigNumberify);
utils.defineProperty(exportUtils, 'concat', utils.concat);
utils.defineProperty(exportUtils, 'hexlify', utils.hexlify);
utils.defineProperty(exportUtils, 'id', utils.id);
utils.defineProperty(exportUtils, 'keccak256', utils.keccak256);
utils.defineProperty(exportUtils, 'sha256', utils.sha256);
utils.defineProperty(exportUtils, 'solidityKeccak256', utils.solidityKeccak256);
utils.defineProperty(exportUtils, 'soliditySha256', utils.soliditySha256);

utils.defineProperty(exportUtils, 'namehash', utils.namehash);

utils.defineProperty(exportUtils, 'toUtf8Bytes', utils.toUtf8Bytes);
utils.defineProperty(exportUtils, 'toUtf8String', utils.toUtf8String);

utils.defineProperty(exportUtils, 'getContractAddress', utils.getContractAddress);


utils.defineProperty(ethers, 'getContract', function(address, abi) {
    return new Contract(address, abi, ethers.signer);
});


utils.defineProperty(ethers, 'getAccount', function() {
    return ethers.signer.getAddress();
});

utils.defineProperty(ethers, 'getNetwork', function() {
    return provider.ready().then(function() {
        return ethers.provider.name;
    });
});

utils.defineProperty(ethers, 'sendTransaction', function(tx) {
    return ethers.signer.sendTransaction(tx);
});

utils.defineProperty(ethers, 'send', function(addressOrName, amountWei) {
    return ethers.signer.sendTransaction({
        to: addressOrName,
        value: amountWei
    });
});

[
  'getBlockNumber',
  'getGasPrice',
  'getBalance',
  'getTransactionCount',
  'getCode',
  'getStorageAt',
  'call',
  'estimateGas',
  'getBlock',
  'getTransaction',
  'getTransactionReceipt',
  'getLogs',
//  'getEthersPrice',
  'resolveName',
  'waitForTransaction'
].forEach(function(method) {
    utils.defineProperty(blockchain, method, function() {
        var args = Array.prototype.slice.call(arguments);
        return ethers.provider[method].apply(ethers.provider, args);
    });
});


function Handler(parentUrl) {
    this.parentUrl = parentUrl;

    this.nextMessageId = 1;

    this.pending = [];
    this.inflightCallbacks = {};

    this.window = null;
}

utils.defineProperty(Handler.prototype, 'setupWindow', function(window) {
    if (this.window) { throw new Error('already has window'); }

    this.window = window;

    var self = this;
    this.window.addEventListener('message', function(event) {
        //if (event.origin !== parentUrl) { return; }

        var data = event.data;
        if (!data || data.ethers !== 'v\x01\n') { return; }

        try {
            if (data.id) {
                var callback = self.inflightCallbacks[data.id];
                delete self.inflightCallbacks[data.id];

                if (callback) {
                    var results = [null, data.result];
                    if (data.error) {
                        results[0] = new Error(data.error);
                    }

                    callback.apply(self.window, results);
                }

            } else {
                switch (data.action) {
                    case 'accountChanged':
                        if (ethers.onaccount) {
                            ethers.onaccount.call(self.window, data.account);
                        }
                        break;

                    case 'ready':
                        // Already know if we are ready from the connectEthers()
                        if (ethers.onaccount) {
                            ethers.onaccount.call(self.window, data.account);
                        }
                        break;

                    default:
                        throw new Error('Unknown Action: ' + data.action);
                }
            }
        } catch (error) {
            ethersLog(error);
        }
    }, false);

    // Send the 'ready' first
    var readyPayload = this.buildPayload('ready', { title: this.window.document.title })
    this.window.parent.postMessage(readyPayload, this.parentUrl);

    // Flush any pending requests made before the window was set up
    this.pending.forEach(function(operation) {
        this.window.parent.postMessage(JSON.parse(operation), this.parentUrl);
    }, this);

    this.pending = null;
});

utils.defineProperty(Handler.prototype, 'buildPayload', function(action, params) {
    return {
        action: action,
        ethers: 'v\x01\n',
        id: this.nextMessageId++,
        params: params
    };
});

utils.defineProperty(Handler.prototype, 'sendMessage', function(action, params, callback) {

    var payload = this.buildPayload(action, params);
    if (callback) {
        this.inflightCallbacks[payload.id] = callback;
    }

    if (this.window) {
        this.window.parent.postMessage(payload, this.parentUrl);

    } else {
        // Create an immutable copy for the deferred request
        this.pending.push(JSON.stringify(payload));
    }
});


function EthersSigner(handler) {
    utils.defineProperty(this, '_handler', handler);
}

utils.defineProperty(EthersSigner.prototype, 'getAddress', function() {
    var self = this;
    return new Promise(function(resolve, reject) {
        self._handler.sendMessage('getAccount', { }, function(error, address) {
            if (error) { return reject(new Error('no account')); }
            resolve(address);
        });
    });
});

utils.defineProperty(EthersSigner.prototype, 'getBalance', function(blockTag) {
    var self = this;
    return this.getAddress().then(function(address) {
        return ethers.provider.getBalance(address);
    });
});

utils.defineProperty(EthersSigner.prototype, 'sendTransaction', function(tx) {
    var hexTx = {};
    for (var key in tx) {
        if (tx[key] == null) { continue; }
        hexTx[key] = utils.hexlify(tx[key]);
    }

    var self = this;
    return new Promise(function(resolve, reject) {
        self._handler.sendMessage('sendTransaction', { transaction: hexTx }, function(error, tx) {
            if (error) { return reject(error); }
            resolve(tx);
        });
    });
});

utils.defineProperty(EthersSigner.prototype, 'signMessage', function(message) {
    var self = this;
    return new Promise(function(resolve, reject) {
        self._handler.sendMessage('signMessage', { message: message }, function(error, signature) {
            if (error) { return reject(error); }
            resolve(signature);
        });
    });
});


function connectEthers(window) {
    if (window.parent === window || window.ethersSkip) {
        return Promise.reject(new Error('no container'));
    }

    return new Promise(function(resolve, reject) {

        var handler = new Handler('*');

        var timer = null;
        handler.sendMessage('getNetwork', {}, function(error, network) {
            if (timer === null) {
                return reject(new Error('Ethers container took too long to reply. Not setting up.'));
            }

            ethersLog('Connected to Ethers Wallet Container: network=' + network);

            clearTimeout(timer);
            timer = null;

            if (network === 'mainnet') {
                network = 'homestead';
            } else if (network === 'testnet') {
                network = 'ropsten';
            }

            setProviderProxyTarget(providers.getDefaultProvider(network));
            setSignerProxyTarget(new EthersSigner(handler));

            // @TODO: Make this available as a proxy?
            utils.defineProperty(ethers, 'loadApplication', function(url) {
                return new Promise(function(resolve, reject) {
                    handler.sendMessage('loadApplication', { url: url }, function(error) {
                        if (error) { return reject(error); }
                        resolve();
                    });
                });
            });

            resolve(ethers);
        });

        window.document.addEventListener('DOMContentLoaded', function() {
            handler.setupWindow(window);

            // If after 2 seconds, the container has not responded to our 'ready',
            // assume it is not an Ethers container.
            timer = setTimeout(function() {
                timer = null;
                reject(new Error('In a container, but not Ethers. Falling back.'));
            }, 2000);
        });
    });
}

function inject(window) {
    if (window.ethers) { ethers._ethers = window.ethers; }
    window.ethers = ethers;

    // Keep any existing web3 instance; if we cannot find a container, we will
    // hook it up to our bridge
    var oldWeb3 = window.web3;

    // A bridge that allows a Web3 instance to talk to an Ethers provider and signer
    var providerBridge = new ProviderBridge();

    if (window.Web3) {
        window.web3 = new window.Web3(providerBridge);
    } else {
        window.web3 = { currentProvider: providerBridge };
    }

    connectEthers(window).then(function(ethers) {
        providerBridge.connectEthers(ethers.provider, ethers.signer);
    }).catch(function(error) {
        var network = window.ethersNetwork || 'homestead';

        // MetaMask, Mist or such
        if (oldWeb3 && oldWeb3.currentProvider) {
            ethersLog('Connected Injected Web3: network=' + network);
            providerBridge.connectWeb3(oldWeb3.currentProvider);

            // Expose the Ethers API on injected Web3
            setProviderProxyTarget(new providers.Web3Provider(window.web3.currentProvider, network));
            setSignerProxyTarget(provider.getSigner());

        // No Ethers, MetaMask, Mist or anything else... Create a generic provider (no signer)
        } else {
            ethersLog('Connected Default Provider: network=' + network);
            setProviderProxyTarget(providers.getDefaultProvider(network));

            // No private keys to sign with
            var zeroSigner = new Signer();
            utils.defineProperty(zeroSigner, 'getAddress', function() { return Promise.resolve(null); });
            utils.defineProperty(zeroSigner, 'getBalance', function() { return Promise.reject(new Error('no signer')); });
            utils.defineProperty(zeroSigner, 'sendTransaction', function() { return Promise.reject(new Error('no signer')); });
            utils.defineProperty(zeroSigner, 'signMessage', function() { return Promise.reject(new Error('no signer')); });
            setSignerProxyTarget(zeroSigner);

            providerBridge.connectEthers(provider);
        }
    }).then(function() {
        onready();
    });
}

inject(global);

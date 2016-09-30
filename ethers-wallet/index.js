var scrypt = require('./node_modules/ethers-wallet/node_modules/scrypt-js/scrypt.js');
var utils = require('./node_modules/ethers-wallet/lib/utils.js');
var Wallet = require('./node_modules/ethers-wallet/index.js');

var EthersProvider = require('./lib/ethers-provider.js');
utils.defineProperty(Wallet.providers, 'EthersProvider', EthersProvider);

utils.defineProperty(Wallet.utils, 'scrypt', scrypt);

module.exports = Wallet;

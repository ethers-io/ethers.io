Wallet API
**********

ethers.getAccount()
===================

If the user has an account, this call will request it and return it as a Promise_. If the user does not have an account the result will be null.

Example::

    ethers.getAccount().then(function(address) {
        console.log('Account address: ' + address);
    }, function(error) {
        console.log('Error: ' + error.message);
    });


ethers.getNetwork()
===================

Returns a Promise_ that indicates the name of the network the user is attached to.
It can be one of 3 values:

- **morden** -- The test network, ether is free and plentiful
- **homestead** -- The live, main network

Example::

    ethers.getNetwork().then(function(network) {
        if (network === 'homestead') {
            console.log('You are on mainnet.');
        } else {
            console.log('You are on testnet.');
        }
    });


ethers.send([destinationAddress][, amountWei])
==============================================

Prompts the user (in the ethers.io wallet interface) for an address and an amount
to send. Returns a Promise_ that resolves to the transaction hash of the
transaction if successful, and reject if any error (ex. cancelled by user)
occurs.

destinationAddress --- *Optional*
    The :ref:`address <addresses>` to fill in for the user in the wallet user interface.

amountWei --- *Optional*
    The amount to send (in Wei), which may be specified as a :ref:`Hex String <hex-strings>` or a :ref:`Big Number <big-numbers>`.

Example::

    // These are all equivalent
    var amountWei = '0xde0b6b3a7640000';
    var amountWei = new ethers.utils.BN('1000000000000000000'); // 18 zeros
    var amountWei = ethers.parseEther('1.0');
    
    ethers.send('...', '0x).then(function(hash) {
    }, function(error) {
        console.log('Error: ' + error.message);
    });


ethers.sendTransaction(transaction[, overrides])
================================================

Prompts the user (in the ethers.io wallet interface) to accept or decline a
transaction. Returns a Promise_ that resolves to the transaction hash of the
transaction if successful, and reject if any error (ex. cancelled by user)
occurs.


transaction:
    transaction object... @TODO: Explain more

overrides:
    overrides object... @TODO: Explain more    

Example::

    var transaction = {
        // The target account address or contract address to send to
        to: '0x0123456789012345678901234567890123456789',

        // The data to include in a transaction
        data: '0xdeafbeef',

        // The amount of ether (in Wei) to send [default: 0]
        value: '0x1234',
    }

    // Most overrides should never be necessary, and are provided only for
    // rare instances where an application is trying to do something border-line
    // insane (yet possibly useful). :)
    //
    // Any value in here may be specified as a number, hex string or Big Number.
    var overrides = {
        gasLimit: 3000000,  // You should not need to change this
        gasPrice: 100000,   // You should not need to change this
        nonce: 1234,        // You should NEVER need this
    }

    ethers.sendTransaction(transaction, overrides).then(function(txid) {
        console.log('This transaction was submitted with the hash: ' + txid);

    }, function(error) {
        if (error.message === 'cancelled') {
            console.log('The user cancelled this transaction.');

        } else {
            console.log('Error: ' + error.message);
        }
    }


Event: ethers.onaccount
=======================

This event will only be triggered after a call to getAccount, and
will notify the application that the currently active account has changed.

.. js:data:: ethers.onaccount

    Hello world?

Example::

    ethers.onaccount = function(address) {
        console.log('The user has switched to account: ' + address);
    }


.. _Promise: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise


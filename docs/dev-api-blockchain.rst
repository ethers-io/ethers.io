Blockchain
**********

Accounts
========

ethers.blockchain.getBalance(address[, blockNumber])
----------------------------------------------------

Example::

    ethers.


ethers.blockchain.getTransactionCount(address[, blockNumber])
-------------------------------------------------------------

Example::

    ethers.



Running Code
============

ethers.blockchain.call(transaction[, options])
----------------------------------------------

Example::

    ethers.


ethers.blockchain.estimateGas(transaction[, options])
-----------------------------------------------------

Example::

    ethers.


ethers.blockchain.sendTransaction(signedTransaction)
----------------------------------------------------

Example::

    ethers.



State
=====

ethers.blockchain.getBlock(blockHashOrNumber)
---------------------------------------------

Example::

    ethers.



ethers.blockchain.getGasPrice()
-------------------------------

Example::

    ethers.



ethers.blockchain.getTransaction(hash)
--------------------------------------

Example::

    ethers.



ethers.blockchain.getTransactionReceipt(hash)
---------------------------------------------

Example::

    ethers.



Event: ethers.blockchian.onblock
================================

Example::

    ethers.blockchain.onblock = function(blockNumber) {
        console.log('New block mined: ' + blockNumber);
    }


.. _Promise: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise


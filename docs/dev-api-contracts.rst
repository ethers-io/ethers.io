Contracts
*********

What is a Contract?
===================

A contract is... @TOOD


What is an ABI
==============

The Application Binary Interface (ABI) is a simple JSON description of
the constructor, methods and events of a contract. The primary details
of interest are the input and output parameter names and types.

Where do I get the ABI?
-----------------------

When you compile a Solidity Contract, you get a few things:

- The Runtime Bytecode -- This is like assembly for the Ethereum network, it is the actual code that will run inside the Ethereum Virtual Machine (EVM)
- The bytecode -- The same as the Runtime Bytecode, except it has a little bit of bootstrapping code prepended to it that is responsible for actually deploying the runtime bytecode to the Ethereum network
- The ABI -- The ABI we are interested in to create an object in JavaScript, that will act as an interface to the contract on the blockchain


Contract Interface
==================

Creating an instance of a Contract object in JavaScript does **not** create any
contract on the blockchain. This simple creates an object that will act as an
interface to an already-deployed contract. If you are familiar with ORM (Object
Relational Models) for databases, the idea is similar.

Once you have created a Contract instance, you may interact with the contract on
the Ethereum Network.

Once created, the object will have all the methods of the contract as a normal
JavaScript object.


Constant Methods (read-only, free)
----------------------------------

Any methods of the contract which are marked as ``constant`` do not modify the
blockchain, and are free to call. These methods will return a Promise_ which
resolves to the return values of the method.


Non-Constant Methods (creates, modifies, and/or deletes, costs ether)
---------------------------------------------------------------------

Any attempt to call a method which is not constant will cause **ethers.io** to prompt
the user to accept the transaction, as they will be required to pay ether to
execute the transaction. These methods will return a Promise_ which resolves to the
transaction hash of the transaction on the network, if the user accepts the
transaction. If they do not, the promise will fail with a :ref:`Cancelled Error <cancelled-error>`.

Events
------

Each event specified in the ABI can be assigned a function, whihc will be called
when the event occurs, with the values passed into that event. The event name will
be the string ``on`` followed by the lower-case string of the event name.


Example
=======

Here is a complete example that demonstrates all the above::

    var contract = new ethers.Contract(address, abi);
    


.. _Promise: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise


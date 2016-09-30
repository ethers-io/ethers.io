Tutorial
********

Here is a quick and simple examples of an ethers.io project.

What is Ethereum?
=================

Ethereum is a world-wide distributed system that allows the execution of simple computer
programs and to get consensus on what the correct output of those programs is, in a
way that is tamper-proof and protected from censorship.

Not all aspects of your applications will likely need to go onto the actual
blockchain, as it can be expensive to store large amounts of data and process expensive, long
computations.

@TODO: add more here


Using Testnet
=============

The Ethereum test network (called *morden*) is an instance of the Ethereum network
created by the devlopers to help create and test applications and new features.

An enormous amount of testnet ether was pre-mined when the developers created it,
so **NEVER** pay for testnet ether. Once you have created an account on testnet.ethers.io
you can get some testnet ether by visiting `the testnet faucet`_ application.

This allows us to create and experiment with the network without having to spend real
ether (aving us real-world money).

.. _the testnet faucet: https://testnet.ethers.io/#!/app-link/0xa5681b1fbda76e0d4ab646e13460a94fdcd3c1c1.ethers.space/


Your First Solidity Contract
============================

@TODO: Add the SimpleStore contract


Running Code on the Blockchain
==============================

Now you may open your favorite editor and create a new file in this directory::

    <html>
        <head>
            <title>My First App</title>
        </head>
        <body>
            Hello world!
        </body>
    </html>

Run your application locally::

    /Users/ethers> ethers serve --port 8000
    Generating new self-signed certificate. (.ethers-self-signed.pem)
    Listening on port: 8000
    Open in your browser: https://testnet.ethers.io/#!/app-link/localhost:8000/
    (Please make sure you allow the self-signed certificate, if prompted)


Publishing Your Application
===========================

For this tutorial, we will use the ethers.space hosting provied by ethers.io, however
you may always use any hosting service you wish.

The ethers.space hosting must be used in tandem with git, and will only deploy files
tracked in git.

Begin a new application slug::

    # Create a git repository
    /Users/ethers> mkdir test-application
    /Users/ethers> cd test-application
    /Users/ethers/test-application> git init
    
    # Creating a new account requires you to choose a password; do not lose
    # this, as NOBODY can recover this
    /Users/ethers/test-application> ethers init
    Do NOT lose or forget this password. It cannot be reset.
    New Account Password: ******
    Confirm Password: ******
    Encrypting Account... (this may take a few seconds)
    Account successfully created. Keep this file SAFE. Do NOT check it into source control.
    
    # This created an account.json file, which contains an ecrypted Ethereum account
    # Do NOT check this into your source control, but make sure you keep it somewhere
    # safe; without this file and the password you will be unable to update your
    # application.
    /Users/ethers/test-application> ls
    account.json

Add your application code::

    /Users/ethers/test-application> git add index.html
    /Users/ethers/test-application> git commit -m 'My first application'


Deploy your application slug::

    
    /Users/ethers/test-application> ethers push


Exercises
=========

Here are some additional features you may wish to add to your application:

- Add a way to see multiple messages
- Include the time of a message
- Include the sender of a message

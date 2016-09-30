Miscellaneous
*************

These are things that are important, but don't currently have a sane place to go. So
they are here for you to check out and for me to make sure I don't lose track of.


Various URLS
============

We separate many aspects of ethers.io across multiple domain names to protect localStorage instances
and to prevent the comprimise of any SSL certificates from breaking the entire system.

ethes.io:
    Main entry point for production ethers.io; via AWS CloudFront

testnet.ethers.io:
    Main entry point for testnet ethers.io; via AWS CloudFront (same origin as ethers.io)

*<server location>*.ethers.ws:
    The WebSocket endpoints for the ethers.io services which communicate with the blockchain

ethers-api.herokuapp.com
    The (current) API url for storing and validating contracts, deployments and slugs.

*<ethereum address>*.ethers.space:
    The static page system; ensures each application can have its own sandbox (localStorage, etc)
    

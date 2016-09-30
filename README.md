ethers.io
=========

The frontend website HTML, JavaScript and CSS for ethers.io.


Live Instances
--------------

The JavaScript detects it's domain and selects its Ethereum network:

- **[testnet.ethers.io](https://testnet.ethers.io/)** - The Morden test network
- **[ethers.io](https://ethers.io/)** - The Homestead live network


Distribution
------------

The `/dist/index.html` file contains the entire application, flattened into a HTML page.

To generate this file, run:

```
/Users/ethers> python3 flatten.py
```

Which performs the following transformations:
- Minifies and inlines all JavaScript files
- Minifies and inlines all Cascading Style Sheet files
- Minifies and inlines all font files
- Minifies and inlines all images as [base64 encoded data URIs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs)
- Converts exactly one instance of `DEBUG=true` to `DEBUG=false` (if more or less changes are made, the build fails)


License
-------

MIT License.

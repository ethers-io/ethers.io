ethers.io
=========

The frontend website HTML, JavaScript and CSS for ethers.io.


Live Instances
--------------

The JavaScript detects it's domain and selects its Ethereum network:

- **[ropsten.ethers.io](https://ropsten.ethers.io/)** - The Ropsten test network
- **[rinkeby.ethers.io](https://rinkeby.ethers.io/)** - The Rinkeby test network
- **[kovan.ethers.io](https://kovan.ethers.io/)** - The Kovan test network
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


License
-------

MIT License.

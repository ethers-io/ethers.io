Common Types
************

There are several parameter formats and types that come up often:

- Addresses_ -- Ethereum Accounts and Contracts all have an address, which is needed to interact with them
- `Big Numbers`_ (BN.js) -- Precise numbers to work around JavaScripts lossy floating point system
- `Hex Strings`_ -- Strings of hexidecimal encoded binary data and numbers
- `Errors` -- An error indicating the user (explicitly or implicitly) cancelled an operation


.. _addresses:

Addresses
=========

Addresses come in many formats, but all blach...

- Hex Strings (eg. 0x1234567890abcdef1234567890abcdef12345678)
- ICAP Addresses  (eg. XE0724JX5HRQ9R1XA24VWJM008DMOB17YBC)
- Checksum Address (eg. 0x1234567890AbcdEF1234567890aBcdef12345678; notice uppercase and lowercase letters)

The **ICAP Address** format uses the `International Bank Account Number (IBAN)`_
format with a prefex of ``XE``.

The **Checksum Address** format uses a mixture of uppercase and lowercase
letters to encode checksum information in an address, but remains backward
compatible with systems that do not understand checksum addresses. Because of
this, addresses which are not checksum addresses must use entirely uppercase or
entirely lowercase letters.

To convert between the various formats::

    // Get an ICAP address (from any address format)
    var icapAddress = ethers.getIcapAddress(address);

    // Get a checksum address (from any address format)
    var address = ethers.getAddress(address)

.. _big-numbers:

Big Numbers
===========

Since **Ethereum** deals a great deal with large numberic values (far larger
than JavaScript can handle without `loss of precission`_), many calls require and return instances
of **BN.js**, which can be accessed at ``ethers.utils.BN``.

Some common things you will likely want to do with **BN.js**::

    // Convert to base 10 number
    var valueBase10 = value.toString(10);

    // Convert from a base 10 string
    var value = new ethers.utils.BN('1000000');
    
    // Convert to hex string
    var valueHexString = '0x' + value.toString(16);
    
    // Convert from a hex string
    var value = new ethers.utils.BN(valueHexString.substring(2), 16);
    
    // Multiple two values
    var product = value1.mul(value2)

    // Convert from ether (string) to wei (BN)
    var wei = ethers.parseEther('1.0');

    // Convert from wei (BN or hex string) to ether (string)
    var ether = ethers.formatEther(wei)
    

For the complete documentation on **BN.js**, see `BN.js on GitHub`_.

.. _hex-strings:

Hex Strings
===========

Often functions deal with binary data, which should be specified using a hex
string. Functions which require big numbers can also be passed the
hex string equivalent.

It is important to note, it **MUST** be a string, and it **MUST** begin with
the prefix ``0x``. 

Example::

    var binaryHelloWorld = '0x48656c6c6f576f726c64';
    var thirtySeven = '0x25';


Errors
======

.. _cancelled-error:

Cancelled Error
---------------

Any operation which requires the user to accept or decline, may reject with an error
with the message `cancelled`. This could occur without user interaction, if for example,
the application attempts to send a transaction, but the user is new and has not added
an account.

Example::

    somePromise.then(function(result) {
        // The call returned a result

    }, function(error) {
        if (error.message === 'cancelled') {
            // Whatever needs to be done
        }
    });


.. _server-error:

Server Error
------------

Any operation that requests further information from the **ethers.io services**
may reject with an error with the message ``server error``.

Example::

    somePromise.then(function(result) {
        // The call returned a result

    }, function(error) {
        if (error.message === 'server error') {
            // Whatever needs to be done
        }
    });


.. _Promise: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise

.. _loss of precission: http://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html

.. _BN.js on GitHub: https://github.com/indutny/bn.js

.. _international bank account number (iban): https://en.wikipedia.org/wiki/International_Bank_Account_Number

.. _foobar: http://www.ecma-international.org/ecma-262/5.1/#sec-8.5
.. _foobar2: http://reference.wolfram.com/language/tutorial/MachinePrecisionNumbers.html

.. _foobar3: http://floating-point-gui.de/formats/fp/

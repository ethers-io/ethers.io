Overview
********

This overview is intended for developers who wish to create *ethers.io*
applications. Understanding the finer details is likely not necessary,
but this document should help with anyone who wants to interate tightly
with *ethers.io*.


Sandbox Architecture
====================

Applications are isolated in their own sandbox by running in an **iframe**,
each hosted on a separate domain, ensuring that a browser's cross-origin
policies will protect each application's state from another application's
state as well as the *ethers.io* state.

.. image:: ../assets/dev-sandbox.svg
    :align: center
    :alt: sandbox design
    :width: 100%

Private Key
    The private key **NEVER** leaves the secure *ethers.io* container and is
    never sent to any server nor shared with any application.

Secure Communication and Storage
    All applications are run on a separate domain, ensuring the only 
    communication between ethers.io and the application occurs over the
    `Window postMessage API`_. This also ensures the localStorage of an
    application cannot access the *ethers.io* container's localStorage.
    If you are hosting multiple applications on the same domain, keep in 
    mind they will share a localStorage.

URL Privacy
    The ethers.io container loads the URL indicated in the fragment (part
    after the hash) into the iframe. Since `a fragment is never sent to the server`_
    this remains private even from *ether.io*. Only the end applcation knows it
    was loaded.

*ethers.io* Services
    The calls to the *ethers.io* services allow interaction with the Ethereum blockchain
    and do not send any private information. The source code for the *ethers.io* services
    is `available on GitHub`_.

Applications
    An application can be written in any web technology. It may be a single static
    page, a single page with a backend AJAX responder, or a multi-page site. There
    is no restrictions, as long as pages that need to interact with *ether.io* include
    the *ether.io* JavaScript client library.


Layout and Design
=================

Your application's frame has its top 75px covered by the **Wallet Interface**,
which is semi-transparent, so you should ensure that content does not appear
above the 75px mark while ensuring backgrounds fill that space. No adjustment
is required for the bottom status bar.

.. image:: ../assets/dev-layout.svg
    :align: center
    :alt: container layout
    :width: 100%

The wallet user interface is always 800px wide, and centered. Depending on
your design, you may or may not wish to line your application up with this.
You can use the following CSS and HTML to acheive this::

    <html>
        <head>
            <style type="text/css">
                .centerer {
                    margin-left: 50%;
                }
                .centered {
                    margin-left: -400px;
                    width: 800px;
                }
            </style>
        </head>
        <body>
            <div class="centerer">
                <div class="centered">
                    Your content here will be lined up with the wallet and status interface.
                </div>
            </div>
        </body>
    </html>


Serving Content
===============

Content for *ethers.io* can be served using nearly any service or technology. All an
application needs to do to be *ethers.io* ready is include the *ethers.io* JavaScript
library::

    <script type="text/javascript" src="https://ethers.io/ethers-v0.1.min.js"></script>

Here is a quick list of some services we recommend for building *ethers.io* applications:

Amazon Web Services S3
    A cheap (and for low usage, free) option to host static
    content (HTML, images, videos, et cetera)

Heroku
    A cheap (and for low usage, free) option to host dynamic
    content, with a database and all that jazz. Heroku supports
    node.js, PHP, Rails, and many more.

IPFS
    A free open-source project to provide the Merkle Web. You
    can use their public gateay, or run your own.

ethers.space
    A free service, provided by *ethers.io* for small static applications.


Application Links
=================

And application's link may be in the following forms: (@TODO: fill in more)

- ethers.io/#/app-link/APP_DOMAIN/PATH
- ethers.io/#/app-link-insecure/APP_DOMAIN/PATH
- ethers.io/#/app/ETHER_SPACE_NAME



Complete Template
=================

Here is a quick start template, that you can cut and paste into a new file to
begin building your application::

    <html>
        <head>
            <style type="text/css">
                .centerer {
                    margin-left: 50%;
                }
                .centered {
                    margin-bottom: 25px;   /* Leave a little space at the bottom */
                    margin-left: -400px;
                    margin-top: 95px;      /* Leave space for the wallet (75px) and a litte extra at the top*/
                    width: 800px;
                }
            </style>
        </head>
        <body>
            <div class="centerer">
                <div class="centered">
                    <!-- Your content here -->
                    <h1>Hello World</h1>
                    <p>
                        Welcome to my first <i>ethers.io</i> Application. Your
                        current account address is <span id="account-address">(loading...)</span>.
                    </p>
                </div>
            </div>
            <script type="text/javascript" src="https://ethers.io/scripts/ethers-v0.1.min.js"></script>
            <script type="text/javascript">
                ethers.onready = function(error) {
                    if (error) {
                        console.log('This application was not loaded inside an ethers.io container.');
                        return;
                    }
                }

                var spanAccountAddress = document.getElementById('account-address');

                ethers.getAccount().then(function(address) {
                    spanAccountAddress.textContent = address;
                }, function(error) {
                    spanAccountAddress.textContent = '(' + error.message + ')';                    
                });

                ethers.onaccount = function(address) {
                    spanAccountAddress.textContent = address;
                }
            </script>
        </body>
    </html>


.. _Window postMessage API: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
.. _a fragment is never sent to the server: https://tools.ietf.org/html/rfc3986#section-3.5
.. _available on GitHub: https://github.com/ethers-io/ethers-server

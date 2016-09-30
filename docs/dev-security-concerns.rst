Security Concerns
*****************

Shared localStorage
===================

If you host mulitple applications on the same domain, or use a domain which
is controlled by someone else (for example: wordpress), the localStorage
across these applications will be shared.

This can be a useful way to have multiple applications communicate with one
another, but can also present a security issue, if you place sensitive data
in the localStorage, or take actions on its value.

Keep this in mind when developing applications on shared hosting.

Note that *ethers.space* does not have this issue, since every application is
hosted on its own domain name (eg. myapp.ethers.space).


Cross-Site Scripting (XSS)
==========================

@TODO: Explain cross-site scripting, sanitizing user input and ideally not
setting innerHTML.


Cross-Site Foragery Requests (CSFR)
===================================

@TODO: Explain cross-site foragery requests, including session keys in URLs and
verifying them.

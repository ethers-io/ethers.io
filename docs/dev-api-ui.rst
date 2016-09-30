User Interface
**************

Notifications
=============

Notifications provide a non-interactive notice to the user. For example, they are displayed to the user when an account becomes unlocked or the balance of an account changes.

They may be useful for your program when it wishes to keep the user informed about the state or status of an event, but do not need distract them.

Function Call::
    
    ethers.notify(message[, messageType])

:message: The message to show in the notification. The title of a notification is the application's name.
:messageType: This indicates what icon to display in a notification. It should be one of **"info"**, **"success"** or **"error"**. (default: **"info"**)

Examples::

    ethers.notify("Hello World");
    ethers.notify("Hello World", 'info');
    ethers.notify("There was an error", 'error');


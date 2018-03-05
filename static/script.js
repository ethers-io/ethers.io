(function(window) {
    var ethers = window.ethers;

    var defaultUrl = 'https://welcome.ethers.space/';
    var walletUrl = 'https://wallet.ethers.space/';

    //var defaultUrl = 'http://localhost:8081';
    //var walletUrl = 'http://localhost:8081/wallet/';

    function forEach(root, selector, callback) {
        if (arguments.length === 2) {
            callback = selector;
            selector = root;
            root = document;
        }
        Array.prototype.forEach.call(root.querySelectorAll(selector), function(el) {
            callback(el);
        });
    }

    function get(id) {
        if (id.match(/^[A-Za-z0-9_-]$/)) {
            return document.getElementById(id);
        } else {
            return document.querySelector(id);
        }
    }

    function timer(timeout, result) {
        return new Promise(function(resolve, reject) {
            setTimeout(function() { resolve(result); }, timeout);
        });
    }

    function ethersLog() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[Ethers Container]');
        var onlyStrings = true;
        args.forEach(function(arg) {
            if (typeof(arg) !== 'string') { onlyStrings = false; }
        });
        if (onlyStrings) { args = [ args.join(' ') ]; }
        console.log.apply(console, args);
    }

    function fuzzyEther(value) {
        var comps = ethers.utils.formatEther(value).split('.');
        if (comps[1].length > 5) {
            comps[1] = String(Math.round(parseInt(comps[1].substring(0, 6)) / 10));
            while (comps[1].length < 5) { comps[1] = '0' + comps[1]; }
        }
        return comps.join('.');
    }

    function normalizePassword(password) {
        return new ethers.utils.toUtf8Bytes(password.normalize('NFKC'));
    }

    function copyObject(object) {
        var result = {};
        for (var key in object) { result[key] = object[key]; }
        return result;
    }

    function commify(value) {
        return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    function defineProperty(object, name, value) {
         Object.defineProperty(object, name, {
             enumerable: true,
             value: value,
             writable: false,
         });
    }

    function defineLookup(object, name, getter, setter) {
         var def = {
             enumerable: true,
             get: getter,
         };
         if (setter) { def.set = setter; }
         Object.defineProperty(object, name, def);
    }

    function defineCallback(object, name) {
        var callback = null;
        Object.defineProperty(object, name, {
            enumerable: true,
            get: function() { return callback; },
            set: function(func) { callback = func; }
        });
    }

    function defineEventListener(object) {
        var events = {};

        var addListener = function(name, type, callback) {
            if (!events[name]) { events[name] = []; }
            events[name].push({ callback: callback, type: type });
            return object;
        };

        defineProperty(object, 'on', function(name, callback) {
            return addListener(name, 'on', callback);
        });

        defineProperty(object, 'once', function(name, callback) {
            return addListener(name, 'once', callback);
        });

        defineProperty(object, 'removeListener', function(name, callback) {
            if (!callback) {
                delete events[name];
                return;
            }

            // Remove the first matching listener
            var listeners = events[name];
            for(var i = 0; i < listeners.length; i++) {
                if (listeners[i].callback !== callback) { continue; }
                listeners.splice(i, 1);
                return;
            }

            // No listeners left
            if (listeners.length == 0) { delete events[name]; }

            return object;
        });

        defineProperty(object, 'emit', function(name) {
            var listeners = events[name];
            if (!listeners) { return; }

            var args = Array.prototype.slice.call(arguments, 1);

            var remove = [];

            listeners.forEach(function(listener, index) {
                if (listener.type === 'once') { removed.unshift(index); }
                setTimeout(function() {
                    try {
                        listener.callback.apply(object, args);
                    } catch (error) {
                        error.eventName = name;
                        error.eventArgs = args;
                        throw error;
                    }
                }, 0);
            });

            remove.forEach(function(index) {
                events.splice(index, 1);
            })

            return object;
        });

        return object;
    }

    var Store = (function() {
        function Store(key) {
            if (!(this instanceof Store)) { throw new Error('missing new'); }
            defineProperty(this, 'key', key);
            defineEventListener(this);
        }

        defineProperty(Store.prototype, '_load', function() {
            var json = localStorage.getItem(this.key);
            var data = {};
            if (json) {
                try {
                    data = JSON.parse(json);
                } catch (error) {
                    ethersLog(error);
                }
            }
            return data;
        });

        defineProperty(Store.prototype, 'get', function(key) {
            return this._load()[key];
        });

        defineProperty(Store.prototype, 'set', function(key, value) {
            var values = this._load();
            var oldValue = values[key];
            values[key] = value;
            localStorage.setItem(this.key, JSON.stringify(values));
            this.emit('changed', key, value, oldValue);
        });

        return Store;
    })();

    function getGasPrices() {
        var gasPriceUrl = '/gas-prices-v2.raw';
        var gasPriceSigner = '0xcf49182a885E87fD55f4215def0f56EC71bB7511';
        return new Promise(function(resolve, reject) {
            var request = new XMLHttpRequest();
            request.open('GET', gasPriceUrl, true);

            request.onload = function() {
                if (request.status >= 200 && request.status < 400) {
                    var data = request.responseText.trim();
                    var tx = ethers.Wallet.parseTransaction(data);
                    if (tx.from !== gasPriceSigner) {
                        reject(new Error('invalid gas price signer'));
                    } else {
                        try {
                            data = JSON.parse(ethers.utils.toUtf8String(tx.data));
                            var result = [];
                            for (var i = 0; i < data.titles.length; i++) {
                                result.push({
                                    title: data.titles[i],
                                    subtitle: data.subtitles[i],
                                    price: ethers.utils.bigNumberify(data.prices[i]),
                                });
                            }
                            resolve(result);
                        } catch (error) {
                            ethersLog(error);
                            reject('invalid payload');
                        }
                    }
                } else {
                    reject(new Error('server error'));
                }
            };

            request.onerror = function() {
                reject(new Error('connection error'));
            };

            request.send();
        });

    }

    // Settings
    var settings = new Store('ethers.io-settings');

    // Navigation Controllers
    var navigation = (function() {
        var navigation = defineEventListener({});

        var divHeader = document.getElementById('header');
        var divControllers = document.getElementById('controllers');
        var divLogo = document.getElementById('logo');
        var divTemplates = document.getElementById('templates');

        var controllers = [];

        var divCancel = document.getElementById('cancel');
        var divAppContainer = document.getElementById('app-container');

        function setupCancel(enable) {
            if (enable) {
                divCancel.onclick = function() {
                    navigation.clear(true);
                };
                document.onkeyup = function(event) {
                    if (event.keyCode == 27) {
                        navigation.clear(true);
                    }
                };
                divCancel.classList.remove('hidden');
                divAppContainer.classList.add('blur');
            } else {
                divCancel.onclick = undefined;
                document.onkeyup = undefined;
                divCancel.classList.add('hidden');
                divAppContainer.classList.remove('blur');
            }
        }

        function adjustHeader() {
            var height = 50;
            var topController = controllers[controllers.length - 1];
            if (topController) {
                height = topController.div.offsetHeight;
            }
            if (controllers.length <= 1) {
                logo.classList.remove('hidden');
            } else {
                logo.classList.add('hidden');
            }
            divHeader.style.transform = 'translateY(' + -(600 - height) + 'px)';
            divControllers.style.transform = 'translateY(' + (600 - height) + 'px)';

            setupCancel(controllers.length > 1);
        }

        function Controller(div, options) {
            if (!(this instanceof Controller)) { throw new Error('missing new'); }
            if (!options) { options = {}; }

            defineProperty(this, 'div', div);

            var self = this;
            forEach(div, '.button a', function(el) {
                el.onclick = function() {
                    if (self.onbutton) { self.onbutton.call(self, el); }
                };
            });

            defineCallback(this, 'onbutton');
            defineCallback(this, 'oncancel');

            defineCallback(this, 'ondrag');
            defineCallback(this, 'ondrop');

            defineCallback(this, 'onsubmit');
            defineCallback(this, 'onchange');

            var button = this.query('.button a');

            defineLookup(this, 'enabled', function() {
                return !(button.classList.contains('disabled'));
            }, function(value) {
                button.classList[value ? 'remove': 'add']('disabled');
            });

            var input = this.query('.input-container input');
            if (input) {
                defineLookup(this, 'value', function() {
                    return input.value;
                }, function(value) {
                    input.value = value;
                });

                var self = this;

                function submit() {
                    if (self.enabled && self.onsubmit) {
                        input.blur();
                        self.onsubmit.call(self, input.value);
                    }
                }

                input.onkeyup = function(event) {
                    if (event.which === 13) { submit(); }
                };

                this.onbutton = function() {
                    submit();
                }

                input.oninput = function() {
                    if (self.onchange) { self.onchange.call(self, self.value); }
                }

                if ((options.focus == null || !options.focus)) {
                    setTimeout(function() { input.focus(); }, 50);
                }
            }
        }

        // Fill in the textContent (or value for input) with value for the class .populate-{suffix}
        defineProperty(Controller.prototype, 'populate', function(suffix, value, allowHtml) {
            forEach(this.div, '.populate-' + suffix, function(el) {
                if (el.tagName === 'INPUT') {
                    el.value = value;
                } else {
                    if (allowHtml) {
                        el.innerHTML = value;
                    } else {
                        el.textContent = value;
                    }
                }
            });
        });

        defineLookup(Controller.prototype, 'cancellable', function() {
            return (divCancel.onclick != null);
        }, function(value) {
            setupCancel(!!value)
        });

        // Query the Controller DOM for a given selector
        defineProperty(Controller.prototype, 'query', function(selector) {
            return this.div.querySelector(selector);
        });

        function getTopController() {
            return controllers[controllers.length - 1];
        }

        /**
         *  Drag and Drop events
         *   - controller.ondrag(dragging)
         *   - controller.ondrop(contents)
         */

        // Track the stack of DOM nodes entered for drag events
        var entered = [];

        document.body.ondragover = function(event) {
            event.preventDefault();
            event.stopPropagation();

            var topController = getTopController();
            if (!topController.ondrag && !topController.ondrop) { return; }

            event.dataTransfer.dropEffect = 'copy';
        };

        document.body.ondragenter = function() {
            event.preventDefault();
            event.stopPropagation();

            var enteredIndex = entered.indexOf(event.target);
            if (enteredIndex >= 0) { ethersLog('This should not happen', entered); }
            entered.push(event.target);

            var topController = getTopController();
            if (topController.ondrag) {
                topController.ondrag.call(topController, true);
            }
        };

        document.body.ondragleave = function(event) {
            event.preventDefault();
            event.stopPropagation();

            var enteredIndex = entered.indexOf(event.target);
            if (enteredIndex === -1) { ethersLog('This should not happen', entered); }
            entered.splice(enteredIndex, 1);

            var topController = getTopController();
            if (topController.ondrag && entered.length === 0) {
                topController.ondrag.call(topController, false);
            }
        }

        document.body.ondrop = function(event) {

            var files = event.dataTransfer.files;

            event.preventDefault();
            event.stopPropagation();

            var topController = getTopController();
            if (!topController.ondrag) { return; }

            entered = [];

            setTimeout(function() {
                topController.ondrag.call(topController, false);
            }, 0);

            if (files.length !== 1) { return; }

            if (!topController.ondrop) { return; }
            var ondrop = topController.ondrop;

            var fileReader = new FileReader();
            fileReader.onload = function(e) {
                ondrop.call(topController, e.target.result);
            }
            fileReader.readAsText(files[0]);
        }

        // Push a new Controller onto the Controller stack
        defineProperty(navigation, 'push', function(template) {
            var nodes = divTemplates.getElementsByClassName('nav-' + template);
            if (nodes.length !== 1) { throw new Error('invalid template name - ' + template); }

            var animated = document.body.classList.contains('animated');

            var div = nodes[0].cloneNode(true);
            if (animated) {
                div.classList.add('right');
            }

            var controller = new Controller(div);
            defineProperty(controller, 'depth', controllers.length);

            divControllers.appendChild(div);

            var topController = controllers[controllers.length - 1];
            if (topController) {
                topController.div.classList.add('left');
            }

            controllers.push(controller);

            if (animated) {
                setTimeout(function() {
                    div.classList.remove('right');
                    adjustHeader();
                }, 100);
            } else {
                setTimeout(function() {
                    adjustHeader();
                }, 0);
            }

            return controller;
        });

        // Pop a Controller from the Controller stack
        defineProperty(navigation, 'pop', function() {
            if (controllers.length <= 1) { return; }

            var topController = controllers[controllers.length - 1];

            topController.div.classList.add('right');
            setTimeout(function() {
                topController.div.parentNode.removeChild(topController.div);
            }, 1100);
            controllers.splice(controllers.length - 1, 1);

            var controller = controllers[controllers.length - 1];
            if (controller) {
                controller.div.classList.remove('left');
            }

            adjustHeader();
        });

        // Clear all Controllers except the root Controller, optionally purging the entire workflow
        defineProperty(navigation, 'clear', function(purge) {
            if (controllers.length > 1) {
                var topController = controllers[controllers.length - 1];
                if (purge) {
                    if (topController.oncancel) { topController.oncancel(); }
                    topController.div.classList.add('hidden');
                } else {
                    topController.div.classList.add('left');
                }

                setTimeout(function() {
                    topController.div.remove();
                }, 1000);

                for (var i = 1; i < controllers.length - 1; i++) {
                    controllers[i].div.remove();
                }

                controllers.splice(1, controllers.length - 1);
            }

            controllers[0].div.classList.remove('left');

            adjustHeader();
        });

        // Push a progress bar Controller onto the Controller stack
        defineProperty(navigation, 'pushProgress', function() {
            var controller = navigation.push('progress');

            var cancelled = false;
            controller.oncancel = function() {
                cancelled = true;
            };

            var divBar = controller.query('.progress-bar');
            var divPercent = controller.query('.populate-percent');

            defineProperty(controller, 'updateProgress', function(percent) {
                if (percent === 1) {
                    divBar.classList.add('complete');
                }
                percent = 100 * (0.1 + 0.9 * percent);
                divBar.style.width = String(percent) + '%';
                divPercent.textContent = parseInt(percent) + '%';
                return cancelled;
            });

            return controller;
        });

        defineProperty(navigation, 'pushNotice', function(title, blurb) {
            if (!title) { title = ''; }
            if (!blurb) { blurb = ''; }

            var controller = navigation.push('notice');
            controller.populate('title', title);
            controller.populate('blurb', blurb);

            defineCallback(controller, 'ondone');

            var timer = null;
            function complete() {
                if (timer === null) { return; }
                clearTimeout(timer);
                timer = null;
                navigation.clear();
                if (controller.ondone) { controller.ondone.call(controller); }
            }

            controller.oncancel = function() { complete(); }
            timer = setTimeout(complete, 5000);

            return controller;
        });

        /**
         *  AccountController
         *
         *  Controller for each account in the Accounts UI.
         */

        function AccountController(div) {
            defineProperty(this, 'div', div);

            defineCallback(this, 'onselect');
            defineCallback(this, 'onedit');
            defineCallback(this, 'onremove');
        }

        // Remove the Account Controller from the Accounts UI
        defineProperty(AccountController.prototype, 'remove', function() {
            this.div.remove();
        });

        // Remove the Account Controller from the Accounts UI
        defineLookup(AccountController.prototype, 'locked', function() {
            return this.div.querySelector('.lock-state').classList.contains('locked');
        }, function (value) {
            this.div.querySelector('.lock-state').classList[!!value ? 'add': 'remove']('locked');
        });

        // Select the Account Controller from the Accounts UI
        defineProperty(AccountController.prototype, 'select', function() {
            var div = this.div;
            forEach('.accounts > div', function(el) {
                el.classList[(el === div) ? 'add': 'remove']('selected')
            });
        });

        var divAccounts = document.querySelector('#account-list .accounts');

        var metamaskAccountController = null;

        // Add an Account Controller to the Accounts UI
        defineProperty(navigation, 'addAccount', function(address, json, nickname) {
            var nodes = divTemplates.getElementsByClassName('account');
            if (nodes.length !== 1) { throw new Error('invalid account template'); }

            var div = nodes[0].cloneNode(true);
            forEach(div, '.populate-nickname', function(el) { el.value = nickname; });

            var controller = new AccountController(div);
            div.querySelector('.action.edit').onclick = function() {
                var input = div.querySelector('input.nickname');
                var nickname = input.value.trim();
                input.readOnly = false;
                input.focus();
                document.body.classList.add('editing-account');

                function submit() {
                    var value = input.value;
                    input.readOnly = true;
                    input.blur();
                    document.body.classList.remove('editing-account');
                    if (value !== nickname) {
                        navigation.emit('didEditAccount', controller, value);
                        if (controller.onedit) {
                            controller.onedit.call(controller, value);
                        }
                    }
                }

                input.onkeyup = function(event) {
                    if (event.which === 13) {
                        submit();
                    }
                };
                input.onblur = submit;
            }
            div.querySelector('.action.remove').onclick = function() {
                navigation.emit('didRemoveAccount', controller);
                if (controller.onremove) { controller.onremove.call(controller); }
            }
            div.querySelector('.clickable').onclick = function() {
                navigation.emit('didSelectAccount', controller);
                if (controller.onselect) { controller.onselect.call(controller); }
            }

            //div.setAttribute('data-address', address);

            // Setup downloading the JSON
            var anchor = div.querySelector('.action.download a');
            anchor.setAttribute('download', 'wallet.json');
            anchor.setAttribute('href', 'data:text/plain;base64,' + btoa(json));

            // Add the new Account to the accounts at the end but before any MetaMask account
            var nextDiv = null;
            if (!json) {
                metamaskAccountController = controller;
            } else if (metamaskAccountController) {
                nextDiv = metamaskAccountController.div;
            }

            divAccounts.insertBefore(div, nextDiv);

            return controller;
        });

        (function() {

            var spanAddressBar = document.querySelector('.address-bar span');
            var divAddressBar = document.querySelector('.address-bar div');
            var inputAddressBar = document.querySelector('.address-bar input');

            var scheme = null;
            var url = null;
            var pendingUrl = null;
            var pendingCursor = null;

            function encodeFragment(url) {
                url = encodeURI(url).replace(/#/g, '%23');
                if (url.substring(0, 8) === 'https://') {
                    return '#!/app-link/' + url.substring(8);
                } else if (url.substring(0, 7) === 'http://') {
                    return '#!/app-link-insecure/' + url.substring(7);
                //} else if (url.match(/^[A-Za-z0-9](-?[A-Za-z0-9])*$/)) {
                //    return '#!/app/' + url.toLowerCase();
                }

                throw new Error('invalid url');
            }

            function decodeFragment(fragment) {
                fragment = decodeURI(fragment.replace(/%23/g, '#'));
                if (fragment.substring(0, 12) === '#!/app-link/') {
                    return 'https://' + fragment.substring(12);
                } else if (fragment.substring(0, 21) === '#!/app-link-insecure/') {
                    return 'http://' + fragment.substring(21);
                }

                throw new Error('invalid fragment');
            }

            function setUrl(value, updateState) {

                var comps = value.split('://');
                if (comps.length !== 2 || !({ http: true, https: true }[comps[0].toLowerCase()])) {
                    throw new Error('invalid URL');
                }

                if (updateState) {
                    var state = { url: value };
                    var fragmentUrl = location.href.split('#')[0] + encodeFragment(value);
                    history[updateState + 'State'](state, '', fragmentUrl);
                }

                scheme = comps[0];
                url = comps[1];

                spanAddressBar.textContent = scheme + '://';
                inputAddressBar.value = url;
            }

            defineLookup(navigation, 'url', function() {
                return scheme + '://' + url;
            }, function(value) {
                setUrl(value, 'push');
            });

            // Check if we started with a fragment and set the url to that
            try {
                var fragmentUrl = decodeFragment(location.hash);
                ethersLog('Found Fragment URL:', fragmentUrl);
                setUrl(fragmentUrl, 'replace');
            } catch (error) {
                ethersLog('Default Frament URL:', defaultUrl);
                setUrl(defaultUrl, 'replace');
            }

            window.onpopstate = function(event) {
                setUrl(event.state ? event.state.url: decodeFragment(location.hash));
                navigation.emit('didChangeUrl', navigation.url);
            }

            function commitUrl(value) {
                pendinglUrl = null;
                url = value;

                inputAddressBar.value = url;
                setUrl(navigation.url, 'push');

                navigation.emit('didChangeUrl', navigation.url);
            }

            function update() {
                inputAddressBar.classList[(inputAddressBar.value === url) ? 'add': 'remove']('matches');
            }

            spanAddressBar.onclick = function() {
                inputAddressBar.focus();
            };

            divAddressBar.onclick = function() {
                if (pendingUrl && pendingUrl !== url) {
                    commitUrl(pendingUrl);
                }
            };

            inputAddressBar.onfocus = function() {
                if (pendingUrl && pendingUrl !== inputAddressBar.value) {
                    inputAddressBar.value = pendingUrl;
                    if (partialCursor != null) {
                        var cursor = partialCursor;
                        setTimeout(function() {
                            inputAddressBar.setSelectionRange(cursor, cursor);
                        }, 0);
                    }
                }
                document.body.classList.add('editing-url');
                update();
            };

            inputAddressBar.onblur = function() {
                pendingUrl = null;
                partialCursor = null;
                if (inputAddressBar.value !== url) {
                    pendingUrl = inputAddressBar.value;
                    var cursor = inputAddressBar.selectionStart;
                    if (cursor != null && cursor === inputAddressBar.selectionEnd) {
                        partialCursor = cursor;
                    }
                }
                document.body.classList.remove('editing-url');
                inputAddressBar.value = url;
            };

            inputAddressBar.onkeyup = function(event) {
                if (event.which === 13) {
                    commitUrl(inputAddressBar.value);
                    inputAddressBar.blur();
                }
            }

            inputAddressBar.oninput = update;
        })();


        return navigation;
    })();


    /**
     *  Network
     *
     *  Select the Ethereum Network to connect to.
     */

    var network = (function() {
        var network = null;

        switch (location.hostname) {
            case 'ethers.io':
                network = 'homestead';
                break;
            case 'rinkeby.ethers.io':
                network = 'rinkeby';
                break;
            case 'testnet.ethers.io':
            case 'ropsten.ethers.io':
                network = 'ropsten';
                break;
            case 'kovan.ethers.io':
                network = 'kovan';
                break;
            default:
                break;
        };

        // We allow a simple search-and-replace of the following to change the target network
        if (('<ETHERS_USE_CUSTOM_NETWORK>').length === 0) {
            network = JSON.parse('ETHERS_CUSTOM_NETWORK');
        }

        // Fallback onto homestead
        if (!network) {
            ethersLog('WARNING: no network detected; defaulting to homestead');
            network = 'homestead';
        }
        return network;
    })();;

    defineProperty(ethers, 'versionHash', '<ETHERS_HASH>');

    var provider = ethers.providers.getDefaultProvider(network);

    ethersLog('Connected Provider: network=' + provider.name + ', chainId=' + provider.chainId);


    /**
     *  Accounts
     *
     *  All private keys, passwords and otherwise private data are managed from
     *  this closure, and are kept safe from anything outside of it.
     */
    var wallet = (function() {
        var wallet = defineEventListener({});

        var accountPrefix = 'ethers.io-account-';
        var accountExtendedPrefix = 'x-ethers.io-account-';

        var gasLimitTiers = [ 21000, 75000, 150000, 250000, 500000, 750000, 1500000 ];

        // Get the required parameters for sending a transaction
        function getTransactionInfo(tx) {
            return Promise.all([
                (tx.to ? provider.getCode(tx.to): Promise.resolve('INVALID')),
                provider.estimateGas(tx),
                provider.getTransactionCount(tx.from),
                getGasPrices(),
            ]).then(function(result) {
                var gasLimit = 21000;
                var transfer = true;
                if (result[0] !== '0x') {
                    transfer = false;
                    gasLimit = result[1].toNumber();
                    gasLimit = parseInt(gasLimit * 1.1);
                    var found = false;
                    for (var i = 0; i < gasLimitTiers.length; i++) {
                        if (gasLimitTiers[i] < gasLimit) { continue; }
                        gasLimit = gasLimitTiers[i];
                        found = true;
                        break;
                    }

                    // @TODO: What should we do here? Need to convey to the user that the
                    //        gas limit is too high (likely contract will throw)
                    if (!found) {
                        throw new Error('invalid transaction gas limit');
                    }
                }

                return {
                    gasLimit: gasLimit,
                    gasPrices: result[3],
                    nonce: result[2],
                    transfer: transfer
                }
            });
        }

        function Account(json) {
            if (!(this instanceof Account)) { throw new Error('missing new'); }

            var data = JSON.parse(json);

            defineProperty(this, 'json', json);

            var self = this;

            var wallet = null;

            function unlockAccount() {
                var controller = navigation.push('password');
                controller.populate('title', 'Unlock Account');
                controller.populate('blurb', 'Enter your password to unlock your account.');
                controller.populate('action', 'UNLOCK');

                return new Promise(function(resolve, reject) {
                    function decrypt(password) {
                        var progressController = navigation.pushProgress();
                        progressController.populate('title', 'Decrypting Account');
                        progressController.populate('blurb', 'Decrypting your account. Please wait.');

                        ethers.Wallet.fromEncryptedWallet(json, password, progressController.updateProgress).then(function(account) {
                            wallet = account;
                            wallet.provider = provider;
                            self.emit('didUnlock');
                            setTimeout(function() {
                                resolve();
                            }, 500);
                        }, function (error) {
                            if (error.message === 'cancelled') {
                                reject(new Error('cancelled'));
                                return;
                            }
                            navigation.pop();
                        });
                    }

                    controller.onsubmit = function(password) {
                        decrypt(password);
                    }
                });
            }

            defineProperty(this, 'address', ethers.utils.getAddress(data.address));

            defineLookup(this, 'locked', function() { return (wallet === null); });

            defineProperty(this, 'lock', function() {
                if (wallet === null) { return; }
                wallet = null;
                this.emit('didLock');
            });

            defineProperty(this, 'send', function(tx) {

                // Dismiss any existing navigation
                navigation.clear(true);

                tx = {
                    // The sender
                    from: this.address,

                    // From the transaction
                    to: tx.to,
                    value: tx.value,
                    data: tx.data,

                    // These get filled in after looking up the gas estimate and gas prices
                    gasPrice: 0,
                    gasLimit: 0,
                };

                var transactionInfo = getTransactionInfo(tx);

                var seq = Promise.resolve();

                // The account is locked; UI to unlock it
                if (this.locked) {

                    // Show the transaction summary
                    seq = seq.then(function() {
                        var controller = navigation.push('transaction-summary');
                        controller.populate('address', tx.to || 'Create New Contract');
                        controller.populate('amount', ethers.utils.formatEther(tx.value || '0x0'));
                        controller.populate('data-length', (ethers.utils.arrayify(tx.data || '0x').length) + ' bytes');

                        return new Promise(function(resolve, reject) {
                            controller.oncancel = function() {
                                reject(new Error('cancelled'));
                            };
                            controller.onbutton = function() {
                                resolve();
                            };
                        });
                    });

                    // Request the account unlocked
                    seq = seq.then(function() {
                        return unlockAccount();
                    });
                }

                // Show the transaction to approve
                seq = seq.then(function() {
                    var controller = navigation.push('transaction');
                    controller.enabled = false;

                    if (tx.to) {
                        controller.populate('address', tx.to);
                    } else {
                        controller.populate('address', '(calculating)');
                        controller.populate('header-address', 'Create Contract:');
                    }

                    controller.populate('amount', ethers.utils.formatEther(tx.value || '0x0'));
                    controller.populate('data-length', (ethers.utils.arrayify(tx.data || '0x').length) + ' bytes');

                    return transactionInfo.then(function(result) {
                        function updateFee(div, index, price) {
                            console.log('updatePrice', price);

                            forEach(divOptions, '.selected', function(el) {
                                el.classList.remove('selected');
                            });
                            div.classList.add('selected');

                            divOptions.style.transform = 'translateY(' + (-1 + -26 * index) + 'px)';

                            controller.populate('fee', fuzzyEther(price.mul(result.gasLimit)));

                            tx.gasPrice = price;
                        }

                        tx.nonce = result.nonce;
                        if (!tx.to) {
                            controller.populate('address', ethers.utils.getContractAddress(tx));
                        }

                        if (!result.transfer) {
                            controller.populate('header-gas-limit', 'Maximum Gas Limit');
                            controller.populate('header-fee', 'Maximum Fee');
                        }
                        controller.populate('gas-limit', commify(result.gasLimit));

                        tx.gasLimit = result.gasLimit;

                        var templateOption = document.querySelector('#templates .option');
                        var divOptions = controller.query('.options-container .options');

                        result.gasPrices.forEach(function(gasPrice, index) {
                            var price = gasPrice.price;
                            console.log('gg', price);

                            var div = templateOption.cloneNode(true);

                            var comps = gasPrice.title.toLowerCase().split(/ |-/g);
                            for (var i = 0; i < comps.length; i++) {
                                comps[i] = comps[i].substring(0, 1).toUpperCase() + comps[i].substring(1);
                            }
                            div.querySelector('.populate-name').textContent = comps.join(' ');

                            var match = gasPrice.subtitle.match(/^completes in (.*)$/);
                            div.querySelector('.populate-duration').textContent = match[1] || gasPrice.subtitle;

                            div.querySelector('.populate-price').textContent = ethers.utils.formatUnits(price, 9) + ' Gwei';;
                            divOptions.appendChild(div);

                            div.onclick = function() {
                                updateFee(div, index, price);
                            };

                            if (index === 0) { updateFee(div, index, price); }
                        });

                         controller.enabled = true;

                        return new Promise(function(resolve, reject) {
                            controller.oncancel = function() {
                                reject(new Error('cancelled'));
                            };

                            controller.onbutton = function(el) {
                                // @TODO: Maybe we should delay sending for 3s, so it can be cancelled?
                                var controller = navigation.push('button');
                                controller.populate('title', 'Sending Transaction');
                                controller.populate('blurb', 'Please wait.');
                                controller.populate('action', 'OK');
                                controller.enabled = false;

                                controller.onbutton = function() {
                                    navigation.pop();
                                };
                                controller.cancellable = false;
                                wallet.sendTransaction(tx).then(function(tx) {
                                    self.emit('didSendTransaction', tx);

                                    var controller = navigation.pushNotice(
                                        'Transaction Sent',
                                        'Your transaction has successfully been sent to the Ethereum network.'
                                    );
                                    controller.ondone = function() { resolve(tx); };
                                }, function(error) {
                                    ethersLog(error);
                                    controller.populate('blurb', 'Error: ' + error.message);
                                    controller.enabled = true;
                                });
                            };
                        });
                    });
                });

                return seq;
            });

            var hexChars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f' ];
            function showMessage(messageData) {
                var controller = navigation.push('message');

                var ascii = true;
                var dataString = '';
                for (var i = 0; i < messageData.length; i++) {
                    var c = messageData[i];
                    dataString += hexChars[c >> 4] + hexChars[c & 0x0f];
                    if ((i % 8) === 7) { dataString += ' '; }
                    if ((c < 32 || c >= 127) && c !== 13) {
                        ascii = false;
                    }
                }

                if (ascii) {
                    controller.populate('message', ethers.utils.toUtf8String(messageData).replace(/\\n/g, 'FOO'));
                } else {
                    controller.populate('header', 'Data');
                    controller.populate('message', dataString);
                }

                return controller;
            }

            defineProperty(this, 'signMessage', function(message) {
                // Dismiss any existing navigation
                navigation.clear(true);

                var messageData = ethers.utils.arrayify(message);

                // The account is locked; UI to unlock it
                var seq = Promise.resolve();

                if (this.locked) {

                    // Show the transaction summary
                    seq = seq.then(function() {

                        var controller = showMessage(messageData);
                        controller.populate('action', 'UNLOCK ACCOUNT...');

                        return new Promise(function(resolve, reject) {
                            controller.oncancel = function() {
                                reject(new Error('cancelled'));
                            };
                            controller.onbutton = function() {
                                resolve();
                            };
                        });
                    });

                    // Request the account unlocked
                    seq = seq.then(function() {
                        return unlockAccount();
                    });
                }

                seq = seq.then(function() {
                    var controller = showMessage(messageData);

                    return new Promise(function(resolve, reject) {
                        controller.oncancel = function() {
                            reject(new Error('cancelled'));
                        };
                        controller.onbutton = function() {
                            resolve();
                        };
                    });
                });

                seq = seq.then(function() {
                    navigation.clear();
                    return wallet.signMessage(messageData);
                });

                return seq;
            });


            var store = new Store(accountExtendedPrefix + this.address);

            defineLookup(this, 'nickname', function() {
                return store.get('nickname') || 'Ethers Account';
            }, function(value) {
                if (typeof(value) !== 'string') { throw new Error('invalid nickname'); }
                if (this.nickname !== value) {
                    this.emit('didChangeNickname', this, value);
                }
                store.set('nickname', value);
            });

            defineLookup(this, 'balance', function() {
                return ethers.utils.bigNumberify(store.get('balance') || '0');
            });

            var updateBalance = (function(balance) {
                if (balance.toString() === store.get('balance')) { return; }
                store.set('balance', balance.toString());
                this.emit('didChangeBalance', balance);
            }).bind(this);

            // When the balance changes
            provider.on(this.address, function(balance) {
                updateBalance(balance);
            });

            // Bootstrap the balance
            provider.getBalance(this.address).then(function(balance) {
                updateBalance(balance);
            });

            defineEventListener(this);
        }

        defineProperty(Account.prototype, 'remove', function() {
            var self = this;
            return new Promise(function(resolve, reject) {
                var controller = navigation.push('notice');
                controller.populate('title', 'Verify JSON Wallet Backup');
                controller.populate('blurb', 'Drag and drop the JSON Wallet backup here to verify you have a valid copy.');

                controller.oncancel = function() {
                    reject(new Error('cancelled'));
                };
                controller.ondrag = function(dragging) {
                };
                controller.ondrop = function(content) {
                    if (content === self.json) {
                        self.controller.remove();
                        delete accounts[self.address];
                        localStorage.removeItem(accountPrefix + self.address);

                        self.emit('didRemove');
                        var controller = navigation.pushNotice(
                            'Account Removed',
                            'The "' + self.nickname + '" has been removed from this browser'
                        );
                        controller.ondone = function() { resolve(); }
                    } else {
                        ethersLog('JSON file does not match');
                    }
                };
            });
        });

        function MetaMaskAccount(web3) {
            if (!(this instanceof MetaMaskAccount)) { throw new Error('missing new'); }

            defineProperty(this, 'isMetaMask', true);

            defineProperty(this, 'web3', web3);
            defineProperty(this, 'provider', new ethers.providers.Web3Provider(web3.currentProvider));
            defineProperty(this, 'signer', this.provider.getSigner());
            defineProperty(this, 'nickname', web3.currentProvider.isMetaMask ? 'MetaMask': 'Injected Web3');

            defineEventListener(this);

            this._balance = ethers.utils.bigNumberify(0);
            var self = this;
            function updateBalance() {
                var address = self.address;
                if (!address) { return; }
                provider.getBalance(address).then(function(balance) {
                    self._balance = balance;
                    self.emit('didChangeBalance', balance);
                });
            }

            var self = this;
            var lastAddress = null;
            function check() {
                var address = self.address;
                if (address !== lastAddress) {
                    if (address && !lastAddress) {
                        self.emit('didUnlock', self);
                    } else if (!address && lastAddress) {
                        self.emit('didLock', self);
                    } else {
                        updateBalance();
                        self.emit('didChangeAddress', self);
                    }
                    lastAddress = address;
                }
            }

            provider.onblock = updateBalance;
            updateBalance();

            setInterval(check, 500);
            check();
        }

        defineLookup(MetaMaskAccount.prototype, 'balance', function() {
            return this._balance;
        });

        defineLookup(MetaMaskAccount.prototype, 'locked', function() {
            return (this.address == null);
        });

        defineLookup(MetaMaskAccount.prototype, 'address', function() {
            if (this.web3.eth.defaultAccount && parseInt(this.web3.version.network) === provider.chainId) {
                return ethers.utils.getAddress(this.web3.eth.defaultAccount);
            }
            return null;
        });

        defineProperty(MetaMaskAccount.prototype, 'unlock', function() {
            var self = this;

            var result = this.address;
            if (result) { return Promise.resolve(result); }

            return new Promise(function(resolve, reject) {
                var controller = navigation.push('notice');
                controller.populate('title', 'Unlock MetaMask');
                controller.populate('blurb', 'Plese unlock MetaMask and select a "' + network + '" account.');

                var timer = setInterval(function() {
                    var result = self.address;
                    if (!result) { return; }

                    if (timer === null) { return; }
                    clearInterval(timer);
                    timer = null;

                    resolve(result);
                    navigation.pop();
                }, 250);

                controller.oncancel = function() {
                    if (timer === null) { return; }
                    clearInterval(timer);
                    timer = null;

                    reject(new Error('cancelled'));
                };
            });
        });

        defineProperty(MetaMaskAccount.prototype, 'send', function(tx) {
            return this.signer.sendTransaction(tx);
        });

        defineProperty(MetaMaskAccount.prototype, 'signMessage', function(message) {
            var self = this;
            return this.unlock().then(function(address) {
                return self.signer.signMessage(message).catch(function(error) {
                    throw new Error('cancelled');
                });;
            });
        });

        var currentAccount = null;
        function updateCurrentAccount(account, initial) {
            if (account === currentAccount) { return; }
            currentAccount = account;

            if (!initial) {
                wallet.emit('didChangeCurrentAccount', (account ? account.address: null));

                if (!account) {
                    settings.set('activeAccount', null);
                } else if (account.isMetaMask) {
                    settings.set('activeAccount', 'injected');
                } else {
                    settings.set('activeAccount', account.address);
                }
            }

            if (account) { account.controller.select(); }

            document.body.classList[(account && account.isMetaMask && account.locked) ? 'add': 'remove']('locked');
        }

        var accounts = {};

        function installAccount(account) {

            // Propagate all account events to the wallet (with the account passed in first)
            ['didChangeAddress', 'didChangeBalance', 'didChangeNickname', 'didLock', 'didRemove', 'didSendTransaction', 'didSignMessage', 'didUnlock'].forEach(function(event) {
                account.on(event, function() {
                    var args = Array.prototype.slice.call(arguments);
                    args.unshift(account.address);
                    args.unshift(event);
                    wallet.emit.apply(wallet, args);
                });
            });

            // Add the account
            accounts[account.address] = account;

            var controller = navigation.addAccount(account.address, account.json, account.nickname);
            account.controller = controller;

            if (account.isMetaMask) {
                // @TODO: Better way to do this, not accessing the div directly?
                controller.div.classList.add('metamask');

                // Since locking/unlocking metamask changes the address
                function update() {
                    if (currentAccount === account) {
                        wallet.emit('didChangeCurrentAccount', account.address);
                    }
                }
                account.on('didLock', update);
                account.on('didUnlock', update);
                account.on('didChangeAddress', update);

            } else {
                controller.onremove = function() {
                    account.remove().then(function() {
                        controller.remove();
                    });
                };

                controller.onedit = function(value) {
                    account.nickname = value;
                };
            }

            controller.onselect = function() {
                updateCurrentAccount(account);
                controller.select();
            }

            account.on('didLock', function(account) {
                controller.locked = true;
            });

            account.on('didUnlock', function(account) {
                controller.locked = false;
            });

            controller.locked = account.locked;

            return controller;
        }

        (function() {
            var first = null;
            for (var key in localStorage) {
                var match = key.match(/^ethers\.io-account-(.*)$/);
                if (match) {
                    var address = ethers.utils.getAddress(match[1]);
                    var data = JSON.parse(localStorage.getItem(key));
                    var account = new Account(data.json);
                    if (account.address !== address) { throw new Error('address mismatch'); }

                    account.controller = installAccount(account);
                    if (!first) { first = account; }
                }
            }

            var activeAddress = settings.get('activeAccount');

            // MetaMask injected Web3
            if (window.web3 && window.web3.currentProvider) {
                var metamask = new MetaMaskAccount(window.web3);
                metamask.controller = installAccount(metamask);
                if (activeAddress === 'injected') {
                    activeAddress = null;
                    first = metamask;
                }
            }

            var account = accounts[activeAddress] || first || null;
            updateCurrentAccount(account, true);
        })();

        ethersLog('Initial Account:', currentAccount);

        // Returns a Promise that resolve to the account created
        defineProperty(wallet, 'addAccount', function() {
            function getPassword() {
                return new Promise(function(resolve, reject) {
                    var controller = navigation.push('password');
                    controller.populate('title', 'Choose Password');
                    controller.populate('blurb', 'Choose a password for encrypting your account. Your password must be at least 6 characters long.');
                    controller.populate('action', 'NEXT');
                    controller.enabled = false;

                    controller.oncancel = function() {
                        reject(new Error('cancelled'));
                    };

                    controller.onchange = function() {
                        this.enabled = (this.value.length >= 6);
                    };

                    controller.onsubmit = function(password) {
                        var controller = navigation.push('password');
                        controller.populate('title', 'Confirm Password');
                        controller.populate('blurb', 'Confirm your password.');
                        controller.populate('action', 'CONFIRM');
                        controller.enabled = false;

                        controller.oncancel = function() {
                            reject(new Error('cancelled'));
                        };

                        controller.onchange = function() {
                            this.enabled = (this.value === password);
                        }

                        controller.onsubmit = function(confirmPassword) {
                            if (password !== confirmPassword) {
                                reject(new Error('should not happen'));
                                return;
                            }
                            resolve(password);
                        };
                    }
                });
            }

            function encrypt(wallet) {
                return getPassword().then(function(password) {
                    password = normalizePassword(password);

                    var progressController = navigation.pushProgress();
                    progressController.populate('title', 'Encrypting Account');
                    progressController.populate('blurb', 'Encrypting your account. Please wait.');

                    var options = { scrypt: { N: (1 << 17) } };
                    return wallet.encrypt(password, options, progressController.updateProgress).then(function(wallet) {
                        return timer(500, wallet);
                    });
                });
            }

            function verifyJson(json) {
                var controller = navigation.push('button');
                controller.populate('title', 'Download JSON Wallet Backup');
                controller.populate('blurb', 'Keep this file <b>SAFE</b> and <b>do NOT</b> forget your password. Anyone with this file and your password can steal your ether. If you forget your password or lose this file, your ether <b>cannot</b> be recovered.', true);
                controller.populate('action', 'DOWNLOAD');

                var anchor = controller.query('.button a');
                anchor.setAttribute('download', 'wallet.json');
                anchor.setAttribute('href', 'data:text/plain;base64,' + btoa(json));
                return new Promise(function(resolve, reject) {
                    controller.onbutton = function() {
                        var controller = navigation.push('notice');
                        controller.populate('title', 'Verify JSON Wallet Backup');
                        controller.populate('blurb', 'Drag and drop your JSON Wallet Backup to verify it.');

                        controller.oncancel = function() {
                            reject(new Error('cancelled'));
                        };
                        controller.ondrag = function(dragging) {
                            // @TODO: Highlight something?
                        };
                        controller.ondrop = function(contents) {
                            if (contents === json) {
                                resolve(json);
                            }
                        };
                    };

                    controller.oncancel = function() {
                        reject(new Error('cancelled'));
                    };
                });
            }

            function done(json, resolve, method) {

                // Prepare the account
                var account = new Account(json);
                installAccount(account);

                // Make sure we never clobber existing accounts
                var key = accountPrefix + account.address;
                if (!localStorage.getItem(key)) {
                    var data = {
                        address: account.address,
                        createdData: parseInt(new Date().getTime()),
                        json: json,
                        method: (method || 'unknown'),
                        version: 1,
                    };
                    localStorage.setItem(key, JSON.stringify(data));
                    accounts[account.address] = account;

                    wallet.emit('didAddAccount', account);
                }

                var controller = navigation.push('button');
                controller.populate('title', 'Done');
                controller.populate('blurb', 'Your encrypted account has been added to this browser. Keep you private key safe and do <b>NOT</b> forget your password. We do not keep any data on any server and cannot recover a lost account.', true);
                controller.populate('action', 'OK');

                controller.onbutton = function() {
                    navigation.clear();
                    resolve(account.address);
                };
            }

            // Extract various types of wallets
            function getWallet(text) {
                text = text.trim();

                // Mnemonic Phrase
                if (text.split(/ /g).length == 12) {
                     if (ethers.HDNode.isValidMnemonic(text)) {
                         return {
                             generate: function() { return ethers.Wallet.fromMnemonic(text); },
                             method: 'mnemonic'
                         }
                     }

                // Raw Private Key
                } else if (text.match(/^(0x)?[0-9a-f]{64}$/i)) {
                    return {
                        generate: function() { return new ethers.Wallet(text); },
                        method: 'rawkey'
                    }
                }

                return null;
            }

            return new Promise(function(resolve, reject) {
                var controller = navigation.push('add-account');
                controller.onbutton = function(el) {
                    var name = el.getAttribute('data-name');
                    if (name === 'create') {
                        encrypt(ethers.Wallet.createRandom()).then(function(json) {
                            return verifyJson(json);

                        }).then(function(json) {
                            return done(json, resolve, 'created');

                        }).catch(function(error) {
                            navigation.clear();
                            reject(error);
                        });

                    } else if (name === 'import') {
                        var controller = navigation.push('import', { focus: false });
                        controller.enabled = false;
                        controller.onchange = function(text) {
                            this.enabled = !!getWallet(text);
                        };
                        controller.onsubmit = function(text) {
                            var walletInfo = getWallet(text);
                            encrypt(walletInfo.generate()).then(function(json) {
                                return done(json, resolve, walletInfo.method);
                            }).catch(function(error) {
                                reject(error);
                            });
                        }
                        controller.ondrag = function(dragging) {
                            this.enabled = dragging;
                        };
                        controller.ondrop = function(contents) {
                            if (!ethers.Wallet.isEncryptedWallet(contents)) {
                                this.enabled = false;
                                return;
                            }

                            var controller = navigation.push('password');
                            controller.populate('title', 'Import Account');

                            controller.oncancel = function() {
                                reject(new Error('cancelled'));
                            };
                            controller.onsubmit = function(password) {
                                password = normalizePassword(password);
                                var progressController = navigation.pushProgress();
                                progressController.populate('title', 'Enter JSON Account Password');
                                ethers.Wallet.fromEncryptedWallet(contents, password, progressController.updateProgress).then(function(account) {
                                    return timer(500, account);
                                }).then(function(account) {
                                    return done(contents, resolve, 'imported');
                                }).catch(function (error) {
                                    if (error.message === 'cancelled') {
                                        reject(error);
                                        return;
                                    }
                                    navigation.pop();
                                });
                            };
                        };
                        controller.oncancel = function() {
                            reject(new Error('cancelled'));
                        };
                    }
                }
            });
        });

        defineProperty(wallet, 'get', function(address) {
            return accounts[ethers.utils.getAddress(address)];
        });

        defineProperty(wallet, 'list', function() {
            return Object.keys(accounts);
        });

        defineLookup(wallet, 'currentAccount', function() {
            return currentAccount;
        });

        function setNoAccount() {
            if (Object.keys(accounts).length === 0) {
                document.body.classList.add('no-account');
                updateCurrentAccount(null);
            } else {
                document.body.classList.remove('no-account');

                // The current account no longer exists
                if (currentAccount && (!currentAccount.isMetaMask && !accounts[currentAccount.address])) {
                    currentAccount = null;
                }

                // No current account; just pick one
                if (!currentAccount) {
                    updateCurrentAccount(accounts[Object.keys(accounts)[0]]);
                }
            }
        }

        wallet.on('didRemove', function(account) {
            setNoAccount();
        });

        wallet.on('didAddAccount', function(account) {
            setNoAccount();
        });

        setNoAccount();

        return wallet;
    })();


    // Applications
    (function() {
        var divAppContainer = document.getElementById('app-container');


        var nextApplicationId = 1;
        function Application(origin, url) {
            if (!(this instanceof Application)) { throw new Error('missing new'); }

            defineProperty(this, 'origin', origin);
            defineProperty(this, 'url', url);
            defineProperty(this, 'id', nextApplicationId++);
            defineProperty(this, 'iframe', document.createElement('iframe'));
        }

        defineProperty(Application.prototype, 'launch', function() {
            this.iframe.src = this.url;
        });

        var currentApplication = null;

        var addressBar = document.querySelector('.address-bar input');
        function load(url) {
            var originMatch = url.match(/^(https?:\/\/[^\/]*)/);
            if (!originMatch) { return Promise.reject(new Error('invalid origin')); }

            var origin = originMatch[1];

            function go() {

                // Kill any current Application
                if (currentApplication) { currentApplication.iframe.remove(); }

                // Create and attach the new Application
                currentApplication = new Application(origin, url);
                divAppContainer.appendChild(currentApplication.iframe);

                // Start the Application
                currentApplication.launch();
            }

            var insecureUntil = parseInt(settings.get('insecureUntil') || '0');

            if (origin.substring(0, 5) === 'https' || insecureUntil > (new Date()).getTime()) {
                go();
                return Promise.resolve(url)
            } else {
                navigation.clear(true);
                return new Promise(function(resolve, reject) {
                    var controller = navigation.push('button');
                    controller.populate('title', 'Warning - Insecure Connection');
                    controller.populate('blurb', 'You are about to load an Ethereum dApp over an insecure HTTP connection. This is <b>NOT</b> recommended for most users. Only developers should continue. Allow insecure dApps for 30 minutes?', true);
                    controller.populate('action', 'Enable Insecure dApps');
                    controller.onbutton = function() {
                        go();
                        navigation.clear();
                        settings.set('insecureUntil', String((new Date()).getTime() + (30 * 60 * 1000)));
                        resolve(url);
                    };
                    controller.oncancel = function() {
                        reject(new Error('cancelled'));
                    };
                });
            }
        }

        function send(payload) {
            payload.ethers = 'v\x01\n';
            currentApplication.iframe.contentWindow.postMessage(payload, currentApplication.url);
        }

        wallet.on('didChangeCurrentAccount', function(address) {
            send({ action: 'accountChanged', account: address });
        });

        window.addEventListener('message', function(event) {
            // Make sure we are coming from the correct application

            if (!currentApplication || event.source !== currentApplication.iframe.contentWindow) {
                return;
            }

            // The application that received this message
            var application = currentApplication;

            if (event.origin !== application.origin) { return; }

            var data = event.data;
            if (data.ethers !== 'v\x01\n') { return; }

            var params = data.params;


            function sendMessage(messageId, results) {
                if (currentApplication.id !== application.id) { return; }
                send({ id: messageId, result: results });
            }

            function sendError(messageId, message) {
                if (currentApplication.id !== application.id) { return; }
                send({ id: messageId, error: message });
            }

            switch (data.action) {

                case 'ready':
                    var title = 'ethers.io';
                    if (typeof(params.title) === 'string') {
                        var safeTitle = params.title.match(/^[A-Za-z0-9 ._]*/);
                        if (safeTitle) {
                            safeTitle = safeTitle[0].trim();
                            if (safeTitle.length) { title = safeTitle + ' - ethers.io' }
                        }
                    }
                    document.title = title;

                    // @TODO: don't send ready back until blockNumber, gasPrice, etc. set up
                    //divLoadingSpinner.classList.remove('showing');
//                    divApp.style.opacity = '1';

                    send({ action: 'ready', account: (wallet.currentAccount ? wallet.currentAccount.address: null), network: network });
                    //send({action: 'block', 'blockNumber': provider.blockNumber});
                    //lastBlockNumberSent = provider.blockNumber;
                    break;

                case 'getAccount':
                    sendMessage(data.id, (wallet.currentAccount ? wallet.currentAccount.address: null));
                    break;

                case 'getNetwork':
                    if (network === 'ropsten') {
                        sendMessage(data.id, 'testnet');
                    } else if (network === 'homestead') {
                        sendMessage(data.id, 'mainnet');
                    } else {
                        sendMessage(data.id, network);
                    }
                    break;

                case 'loadApplication':
                    load(params.url).then(function(url) {
                        navigation.url = params.url;
                    }, function(error) {
                        ethersLog(error);
                        sendError(data.id, 'cancelled');
                    });
                    break;

                 case 'notify':
                     try {
                         Modal.notify('Application \u2014 ' + application.name, ensureString(params.message));
                     } catch (error) {
                         sendError(data.id, 'unknown error');
                     }
                     break;

                case 'sendTransaction':
                    if (!wallet.currentAccount) {
                        sendError(data.id, 'cancelled');
                        break;
                    }

                    wallet.currentAccount.send(params.transaction).then(function(tx) {
                        var hexTx = {};
                        for (var key in tx) {
                            hexTx[key] = ethers.utils.hexlify(tx[key]);
                        }
                        // @TODO:
                        ethersLog('Send', hexTx);
                        sendMessage(data.id, hexTx);
                    }, function (error) {
                        if (error.message === 'cancelled') {
                            sendError(data.id, 'cancelled');
                        } else {
                            ethersLog('Error Sending Transaction: ' + error.message);
                            sendError(data.id, 'unknown error');
                        }
                    });
                    break;

                case 'signMessage':
                    if (!wallet.currentAccount) {
                        sendError(data.id, 'cancelled');
                        break;
                    }

                    wallet.currentAccount.signMessage(params.message).then(function(signature) {
                        // @TODO:
                        sendMessage(data.id, signature);
                    }, function (error) {
                        if (error.message === 'cancelled') {
                            sendError(data.id, 'cancelled');
                        } else {
                            sendError(data.id, 'unknown error');
                        }
                    });
                    break;

                default:
                    ethersLog('Unknown action: ' + data.action);
                    sendError(data.id, 'invalid command')
            }
        }, false);

        setTimeout(function() {
            load(navigation.url).then(function(url) {
                ethersLog('Loaded:', url);
            }, function(error) {
                ethersLog(error);
            });
        }, 0);

        navigation.on('didChangeUrl', function(url) {
            load(url);
        });

        get('.button a.wallet').onclick = function() {
            var url = walletUrl;
            load(url).then(function(url) {
                navigation.url = url;
            }, function(error) {
                ethersLog(error);
            });
        };

        get('.button a.home').onclick = function() {
            load(defaultUrl).then(function(url) {
                navigation.url = defaultUrl;
            }, function(error) {
                ethersLog(error);
            });
        };

    })();


    var controllerWallet = navigation.push('wallet');
    controllerWallet.update = function() {
        if (!wallet.currentAccount) {
            controllerWallet.populate('address', 'no account');
            controllerWallet.populate('nickname', '');
            controllerWallet.populate('balance-whole', '');
            controllerWallet.populate('balance-decimal', '');
            return;
        }

        controllerWallet.populate('address', wallet.currentAccount.address);
        controllerWallet.populate('nickname', wallet.currentAccount.nickname);

        var comps = fuzzyEther(wallet.currentAccount.balance).split('.');
        controllerWallet.populate('balance-whole', comps[0]);
        controllerWallet.populate('balance-decimal', comps[1]);
    }
    controllerWallet.update();

    (function() {
        var input = controllerWallet.query('input');
        input.onclick = function() {
            input.setSelectionRange(0, input.value.length);
        };
    })();

    wallet.on('didChangeBalance', function(address, balance) {
        controllerWallet.update();
    });

    wallet.on('didChangeNickname', function(address, nickname) {
        controllerWallet.update();
    });

    wallet.on('didChangeCurrentAccount', function(address) {
        controllerWallet.update();
    });

    wallet.on('didLock', function(address) {
        controllerWallet.update();
    });

    wallet.on('didUnlock', function(address) {
        controllerWallet.update();
    });

    wallet.on('didChangeAddress', function(address) {
        controllerWallet.update();
    });

    forEach('.add-account', function(el) {
        el.onclick = function() {
            wallet.addAccount().then(function(address) {
                ethersLog('Added Account', address);
            }, function (error) {
                ethersLog('Error', error);
            });
        };
    });

    // Make sure layout is complete before enabling animations
    setTimeout(function() {
        document.body.classList.add('animated');
    }, 200);

    ethersLog('Ready');

})(window);

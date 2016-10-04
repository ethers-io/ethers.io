(function(_this) {
    var utils = {}

    Object.defineProperty(utils, 'defineProperty', {
        enumerable: true,
        value: function(object, name, value) {
            Object.defineProperty(object, name, {
                configurable: false,
                enumerable: true,
                writable: false,
                value: value
            })
        }
    });

    utils.defineProperty(_this, 'utils', utils);

    utils.defineProperty(utils, 'defineReadValue', function(object, name) {
        var value = null;
        Object.defineProperty(object, name, {
            enumerable: true,
            get: function() { return value; }
        });

        return function(newValue) {
            value = newValue;
        }
    });

    // See: http://youmightnotneedjquery.com/#outer_width_with_margin
    utils.defineProperty(utils, 'getSize', function(el) {
        var style = getComputedStyle(el);

        var height = el.offsetHeight;
        height += parseInt(style.marginTop) + parseInt(style.marginBottom);

        var width = el.offsetWidth;
        width += parseInt(style.marginLeft) + parseInt(style.marginRight);

        return { height: height, width: width };
    });


    utils.defineProperty(utils, 'forEach', function(el, selector, callback) {
        if (!callback) {
            callback = selector;
            selector = el;
            el = document.body;
        }
        if (typeof(callback) !== 'function') { throw new Error('invalid callback'); }
        Array.prototype.forEach.call(el.querySelectorAll(selector), function(el, i) {
            callback(el, i);
        });
    });

    utils.defineProperty(utils, 'get', function(el, selector) {
        if (!selector) {
            selector = el;
            el = document.body;
        }
        return el.querySelector(selector);
    });

    utils.defineProperty(utils, 'defineEventEmitter', function(object) {
        var events = {};

        utils.defineProperty(object, 'on', function(eventName, listener) {
            if (typeof(listener) !== 'function') { throw new Error('invalid listener'); }
            if (!events[eventName]) { events[eventName] = []; }
            events[eventName].push({callback: listener, once: false})
            return this;
        });

        utils.defineProperty(object, 'once', function(eventName, listener) {
            if (typeof(listener) !== 'function') { throw new Error('invalid listener'); }
            if (!events[eventName]) { events[eventName] = []; }
            events[eventName].push({callback: listener, once: true});
            return this;
        });

        utils.defineProperty(object, 'removeListener', function(eventName, listener) {
            var listeners = events[eventName];
            if (listeners) {
                setTimeout((function(listeners) {
                    for (var i = 0; i < listeners.length; i++) {
                        if (listener !== listeners[i]) { continue; }
                        listeners.splice(i, 1);
                        break;
                    }
                })(), 0);
            }
            return this;
        });

        utils.defineProperty(object, 'emit', function(eventName) {
            var params = Array.prototype.slice.call(arguments, 1);
            var listeners = events[eventName] || [];
            for (var i = 0; i < listeners.length; i++) {
                var listener = listeners[i];
                setTimeout((function(listener) {
                    try {
                        listener.apply(object, params);
                    } catch (error) {
                        console.log(error);
                    }
                })(listener.callback), 0);

                if (listener.once) { listeners.splice(i--, 1); }
            }
        });
    });

    /**
     *   Store
     *
     *   Maintains a key-value store in localStorage inside a specifiy key.
     */
    function Store(key) {
        utils.defineProperty(this, 'key', key);
    }
    utils.defineProperty(utils, 'Store', Store);

    utils.defineProperty(Store.prototype, '_load', function() {
        var json = localStorage.getItem(this.key);
        var data = {};
        if (json) {
            try {
                data = JSON.parse(json);
            } catch (error) {
                console.log(error);
            }
        }
        return data;
    })

    utils.defineProperty(Store.prototype, 'get', function(key) {
        return this._load()[key];
    });

    utils.defineProperty(Store.prototype, 'set', function(key, value) {
        var values = this._load();
        var oldValue = values[key];
        values[key] = value;
        localStorage.setItem(this.key, JSON.stringify(values));
        this.emit('change', key, value, oldValue);
    });

    utils.defineEventEmitter(Store.prototype);

    utils.defineProperty(utils, 'gethFilename', (function() {
        function zpad(value) {
            value = String(value);
            if (value.length != 2) { value = '0' + value; }
            return value;
        }

        return function(address, now) {
            if (!address.match(/^0x[0-9A-Fa-f]{40}$/)) {
                throw new Error('invalid address');
            }
            address = address.substring(2).toLowerCase();

            if (!now) { now = new Date(); }

            var date = [
                now.getUTCFullYear(),
                zpad(now.getUTCMonth() + 1),
                zpad(now.getUTCDate())
            ].join('-');

            var time = [
                zpad(now.getUTCHours()),
                zpad(now.getUTCMinutes()),
                zpad(now.getUTCSeconds())
            ].join('-');

            return ('UTC--' + date + 'T' + time + '.0Z--' + address)
        }
    })());

})(this);

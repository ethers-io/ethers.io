// @TODO: Move push(..., filedropCallback) to .onfiledrop
(function(_this) {
    var Modal = {};
    utils.defineProperty(_this, 'Modal', Modal);

    var divTemplates = document.getElementById('templates');

    var divInterface = document.getElementById('interface');
    var divModal = document.getElementById('modal');

    var divWallet = document.getElementById('wallet');

    var divApp = document.getElementById('app');
    //var iframeApp = document.getElementById('app-iframe');

    var templateStack = [], filedropStack = [];

    var currentBlur = false;
    function setBlur(blur) {
        if (blur === currentBlur) { return false; }
        currentBlur = blur;

        var iframe = utils.get(divApp, 'iframe');

        if (blur) {
            // Blur the app and make sure it doesn't scroll (and prevent mouse events)
            if (iframe) {
                iframe.classList.add('blur');
                iframe.style.pointerEvents = 'none';
            }

            divInterface.classList.remove('hover');
            divWallet.style.opacity = '0';
            divWallet.style.pointerEvents = 'none';

        } else {
            // Unblur and allow mouse events
            if (iframe) {
                iframe.classList.remove('blur');
                iframe.style.pointerEvents = '';
            }

            // Weird WebKit bug; after resetting pointer-events, scroll doesn't
            // work. This seems to force it to reset internal pointer events
            var height = utils.getSize(divApp).height;
            divApp.style.height = (height - 1) + 'px';
            setTimeout(function() {
                divApp.style.height = '';
            }, 0);
        }

        return true;
    }

    function resize(template) {
        if (template) {
            divInterface.style.height = utils.getSize(template).height + 'px';
        } else {
            divInterface.style.height = '';
        }
    }
    utils.defineProperty(Modal, 'resize', function() {
        var currentTemplate = null;
        if (templateStack.length) { currentTemplate = templateStack[templateStack.length - 1]; }
        resize(currentTemplate);
    });



    function push(templateName, filedropCallback, animated) {
        var template = divTemplates.querySelector('.modal-' + templateName);
        if (!template) { throw new Error('invalid template: ' + templateName); }

        if (typeof(filedropCallback) === 'boolean') {
            animated = filedropCallback;
            filedropCallback = null;
        }

        if (filedropCallback) {
            if (typeof(filedropCallback) !== 'function') {
                throw new Error('invalid filedropCallback');
            }

            var input = utils.get(template, 'input[type=file]');
            input.onchange = function() {
                if (input.files.length !== 1) { return; }
                var fileReader = new FileReader();
                fileReader.onload = function(e) {
                    var content = e.target.result;
                    filedropCallback(content);
                }
                fileReader.readAsText(input.files[0]);
            }
        } else {
            filedropCallback = null;
        }

        template = template.cloneNode(true);
        divModal.appendChild(template);

        setBlur(true);
        resize(template);

        var currentTemplate = null;
        if (templateStack.length) { currentTemplate = templateStack[templateStack.length - 1]; }

        if (currentTemplate) {
            currentTemplate.style.opacity = '0';
            currentTemplate.style.transform = 'translateX(-100px)';
            currentTemplate.style.pointerEvents = 'none';
        }


        template.style.opacity = '0';
        template.style.transform = 'translateX(250px)';
        setTimeout(function() {
            template.style.transition = 'transform 0.3s ease-out, opacity 0.3s linear';
            template.style.opacity = '1';
            template.style.transform = 'translateX(0)';
        }, 10);

        templateStack.push(template);
        filedropStack.push(filedropCallback);


        var onPurge = null;
        Object.defineProperty(template, 'onpurge', {
            enumerable: true,
            get: function() { return onPurge; },
            set: function(value) {
                if (value !== null && typeof(value) !== 'function') {
                    throw new Error('invalid oncancel');
                }
                onPurge = value;
            }
        });


        return template;
    }
    utils.defineProperty(Modal, 'push', push);


    function pop() {
        if (templateStack.length === 0) { throw new Error('invalid pop'); }
        if (templateStack.length === 1) {
            clear();
            return;
        }

        var currentTemplate = templateStack.pop();
        filedropStack.pop();

        var template = templateStack[templateStack.length - 1];
        resize(template);

        currentTemplate.style.opacity = '0';
        currentTemplate.style.transform = 'translateX(250px)';
        currentTemplate.style.pointerEvents = 'none';

        setTimeout(function() {
            currentTemplate.remove();
        }, 300);

        template.style.opacity = '1';
        template.style.transform = 'translateX(0)';
        template.style.pointerEvents = '';
    }
    utils.defineProperty(Modal, 'pop', pop);


    function purge() {
        if (templateStack.length === 0) { return; }

        var currentTemplate = templateStack[templateStack.length - 1];
        currentTemplate.style.opacity = '0';
        currentTemplate.style.pointerEvents = 'none';

        if (currentTemplate.onpurge) {
            currentTemplate.onpurge();
        }

        var oldTemplateStack = templateStack;
        templateStack = [];
        filedropStack = [];

        setTimeout(function() {
            oldTemplateStack.forEach(function(e) {
                e.remove();
            });
        }, 300);
    }
    utils.defineProperty(Modal, 'purge', purge);


    function clear() {
        if (templateStack.length === 0) { return; }

        purge();

        divWallet.style.opacity = '1';
        divWallet.style.pointerEvents = '';

        setTimeout(function() {
            resize(null);
            setBlur(false);

            function addHover() {
                divInterface.classList.add('hover');
                divInterface.removeEventListener('mouseenter', addHover, true);
            }
            divInterface.addEventListener('mouseenter', addHover, true);
        }, 300);

    }
    utils.defineProperty(Modal, 'clear', clear);

    function disable() {
        if (templateStack.length === 0) { return; }

        var currentTemplate = templateStack[templateStack.length - 1];
        currentTemplate.style.pointerEvents = 'none';
    }
    utils.defineProperty(Modal, 'disable', disable);


    var noticeStack = [];
    var noticeTemplate = utils.get(divTemplates, '.notice');
    var divNotices = document.getElementById('notices');
    function notify(title, message, icon) {
        var notice = noticeTemplate.cloneNode(true);
        utils.get(notice, '.title').textContent = title;
        utils.get(notice, '.message').textContent = message;
        divNotices.appendChild(notice);

        var height = utils.getSize(notice).height;
        if (noticeStack.length) {
            for (var i = 0; i < noticeStack.length; i++) {
                var move = noticeStack[i];
                move.dy = move.dy - height - 30;
                move.style.transform = 'translateY(' + move.dy + 'px)';
            }
        }

        notice.dy = -110;
        setTimeout(function() {
            notice.style.transform = 'translateY(' + notice.dy + 'px)';
            notice.style.opacity = '1';
        }, 0);

        setTimeout(function() {
            var kill = noticeStack.shift();
            kill.style.opacity = '0';
            kill.style.transform = 'translate(100px, ' + kill.dy + 'px)';
            setTimeout(function() { kill.remove(); }, 500);
        }, 7000);

        noticeStack.push(notice);
    }
    utils.defineProperty(Modal, 'notify', notify);

    (function() {
        var inputFiledrop = document.getElementById('filedrop');

        function getCallback() {
            if (filedropStack.length === 0) { return null; }
            return filedropStack[filedropStack.length - 1];
        }

        var dragging = false;

        function showDropTarget() {
            if (dragging || !getCallback()) { return; }
            dragging = true;
            inputFiledrop.style.display = 'block';
            utils.forEach('.dropTarget', function(el) {
                el.classList.add('highlight');
            });
        }

        function hideDropTarget() {
            if (!dragging) { return; }
            dragging = false;
            inputFiledrop.style.display = 'none';
            utils.forEach('.dropTarget', function(el) {
                el.classList.remove('highlight');
            });
        }

        var entered = [];

        document.body.ondragover = function(event) {
            event.dataTransfer.dropEffect = 'copy';
            event.preventDefault();
            event.stopPropagation();
        }

        document.body.ondragenter = function(event) {
            event.preventDefault();
            event.stopPropagation();

            var enteredIndex = entered.indexOf(event.target);
            if (enteredIndex >= 0) { console.log('This should not happen', entered); }
            entered.push(event.target);

            showDropTarget();
        }

        document.body.ondragleave = function(event) {
            event.preventDefault();
            event.stopPropagation();

            var enteredIndex = entered.indexOf(event.target);
            if (enteredIndex === -1) { console.log('This should not happen', entered); }
            entered.splice(enteredIndex, 1);

            if (entered.length === 0) {
                hideDropTarget();
            }
        }

        document.body.ondrop = function(event) {

            var files = event.dataTransfer.files;

            event.preventDefault();
            event.stopPropagation();

            var callback = getCallback();
            entered = [];

            setTimeout(function() {
                hideDropTarget();
            }, 0);

            if (!callback || files.length !== 1) { return; }

            var fileReader = new FileReader();
            fileReader.onload = function(e) {
                callback(e.target.result);
            }
            fileReader.readAsText(files[0]);
        }

    })();

})(this);

/* Copyright (c) 2014, Victor Petrov <victor.petrov@gmail.com>. All rights reserved. License: BSD New (see license.txt for details). */

//handles messages from the content script
function onMessageReceived(message, sender, sendResponse) {
    "use strict";

    var response = { result: true };

    switch (message.action) {
        case 'show': chrome.pageAction.show(sender.tab.id); break;
        case 'hide': chrome.pageAction.hide(sender.tab.id); break;
    }

    // return a response
    if (typeof sendResponse === 'function') {
        sendResponse(response);
    }
}

// Listen for the content script to send a message to the background page.
chrome.runtime.onMessage.addListener(onMessageReceived);

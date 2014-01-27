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

function onTabUrlChanged(tab_id, change, tab) {
    console.log('Tab changed, send attach action to tab:', tab_id, 'change:', change);
    if (change.status === 'complete') {
        chrome.tabs.sendMessage(tab_id, {action:'attach'});
    }
}

// Listen for the content script to send a message to the background page.
chrome.runtime.onMessage.addListener(onMessageReceived);
chrome.tabs.onUpdated.addListener(onTabUrlChanged);

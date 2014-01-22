/* Copyright (c) 2014, Victor Petrov <victor.petrov@gmail.com>. All rights reserved. License: BSD New (see license.txt for details). */
"use strict";

console.log('Kona JS v.1.0');

//setting this to false lets us load 'inflate.js' and 'deflate.js'
//directly via the extension
zip.useWebWorkers = false;

var progress_span = [],
    progress_id = 0,
    current_progress_el,
    download_link,
    download_error;

//requests a local filesystem of size 'bytes'
function getFS(bytes, success, error) {

    //choose which method to use
    var requestFileSystem = window.webkitRequestFileSystem || window.mozRequestFileSystem || window.requestFileSystem;

    if (!requestFileSystem) {
        error("Your browser doesn't support local filesystems");
        return;
    }

    //request local space
    requestFileSystem(window.TEMPORARY, bytes,
        //request filesystem succeeded
        function (fs) {
            //create a new file or overwrite an existing one
            fs.root.getFile('kona.zip', {create: true},
                //create file succeeded
                function (file) {
                    //create a new zip writer based on a file entry object
                    zip.createWriter(new zip.FileWriter(file), success, error);
                },
                //create file failed
                function (e) {
                    if (error) {
                        error(getFileError(e.code));
                    }
                }
            );
        },
        //request filesystem error
        function (e) {
            if (error) {
                error(getFileError(e.code));
            }
        }
    );
}

//'Download all' button click handler. Requests a 4GB filesystem and starts
//downloading all the files.
function onDownloadAll() {

    //find all downloadable files
    var links = document.querySelectorAll('a.file_item.attachment_icon_link');

    if (!links || !links.length) {
        console.error('KonaJS: No files to download');
        showError("no files to download");
        return;
    }

    //request 4GB because we don't know how large the zip file is going to be
    getFS(4 * 1024 * 1024 * 1024,
        function (zip_file) {
            //start downloading all files
            downloadLinks(links, zip_file, function () {
                console.log('KonaJS: All files downloaded');
                zip_file.close(
                    function (blob) {
                        var blobURL = URL.createObjectURL(blob);

                        var clickEvent = document.createEvent("MouseEvent");
                        clickEvent.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
                        download_link.href = blobURL;
                        download_link.download = "kona.zip";
                        download_link.dispatchEvent(clickEvent);
                    });

            }, function (msg) {
                console.error(msg);
                showError(msg);
            });
        }
    );
}

//starts downloading a list of links
function downloadLinks(links, zip_file, success, error) {
    return _downloadLinks(links, zip_file, 0, success, error);
}

//iteratively downloads all links in the list
function _downloadLinks(links, zip_file, current_link, success, error) {

    //if all links have been downloaded, hide all progress information
    //and call the success callback
    if (current_link >= links.length) {
        hideAllProgressInfo();
        success();
        return;
    }

    //download one link. when done, display a checkmark, recurse and increment current_link
    downloadLink(links[current_link], zip_file, function () {
        //display checkmark
        var progress = getProgressElement(links[current_link]) || createProgressElement(links[current_link]);
        progress.innerHTML = '<b>&#10003;</b>';

        //download next link
        _downloadLinks(links, zip_file, current_link + 1, success, error);
    }, error);
}

//Calls the actual 'download' method that fetches the data from the server.
//When the data are ready, it is added to the zip file.
//The progress function relies on the download progress to already be at 50%,
//with the other 50% reserved for the zip_file.add() progress callback.
//That is, the first 50% represent download progress, the second 50% represent zipping progress.
//Zipping is performed with no compression for faster processing.
function downloadLink(link, zip_file, success, error) {
    //start by downloading the data
    download(link,
        //on download success
        function (data) {
            var path = data.url.pathname;
            var progress = getProgressElement(link) || createProgressElement(link);
            //extract the file name from the URL
            var file_name = path.substr(path.lastIndexOf('/') + 1);

            console.log('KonaJS: Adding', file_name);
            //add data to zip as 'file_name'
            zip_file.add(file_name, new zip.BlobReader(data.blob), success,
                //progress callback
                function (loaded, total) {
                    //second part of progress indicator
                    progress.innerHTML = Math.ceil(50.0 + (loaded / total) * 50.0) + '%';
                },
                //no compression
                {level: 0}
            );
        },
        //on download error
        function (reason) {
            console.error('KonaJS: Failed to download file from', link.href, reason.currentTarget.status);
            var message = 'connection failed.';

            if (reason instanceof XMLHttpRequestProgressEvent) {
                message = reason.error || reason.currentTarget.statusText || message;
            }

            error(message);
        }
    );

}

//Uses XMLHttpRequest to make a GET request and retrieve file data as a Blob
function download(link, success, error) {
    console.log('KonaJS: Downloading', link.href);
    var r = new XMLHttpRequest();
    r.responseType = "blob";
    r.onreadystatechange = function () {
        downloadStateChanged(link, r.readyState);

        if (r.readyState === XMLHttpRequest.DONE) {
            //download failed, rely on 'onerror' to be called by XMLHttpRequest
            if (r.response === null) {
                console.log('KonaJS: no data received for', link.href);
                return;
            }

            var result = {
                url: (new URL(link.href)),
                blob: r.response
            };

            success(result);
        }
    };

    //callbacks
    r.onprogress = updateDownloadProgress;
    r.onerror = error;

    r.open("GET", link.href, true);
    r.send();
}

//Hides the elements which display progress information.
function hideAllProgressInfo() {
    for (var i in progress_span) {
        if (progress_span.hasOwnProperty(i)) {
            progress_span[i].style.visibility = 'hidden';
        }
    }
}

//Creates a <span> element for displaying download/zipping progress.
//This element is cached in the progress_span list
//each progress element is assigned an ID which is stored as an
//attribute of the <a> link.
function createProgressElement(link) {
    var p = link.parentNode.parentNode,
        span = document.createElement('span');

    span.classList.add('kona-ext-progress');
    span.innerHTML = '0%';

    p.appendChild(span);

    progress_span[progress_id] = span;
    link.setAttribute('kona-progress', progress_id);
    progress_id++;

    return span;
}

//Returns an existing <span> progress element, or null otherwise
function getProgressElement(link) {
    var pid = link.getAttribute('kona-progress');

    if (pid === undefined || pid === null) {
        return null;
    }

    return progress_span[pid - 0];
}

//Computes the download progress. Downloading is only half the battle,
//so this progress indicator only goes up to 50%. The other 50% is the zipping
//procedure.
function updateDownloadProgress(e) {
    if (!current_progress_el || !e.lengthComputable) {
        return;
    }

    current_progress_el.innerHTML = Math.floor((e.loaded / e.total) * 50.0) + '%';
}

//When the XMLHttpRequest object changes its state, we show the progress element
function downloadStateChanged(link, state) {
    switch (state) {
        //unsent
        case XMLHttpRequest.UNSENT:
            break;
        case XMLHttpRequest.OPENED:
            current_progress_el = getProgressElement(link);
            if (!current_progress_el) {
                current_progress_el = createProgressElement(link);
            }
            current_progress_el.style.visibility = '';
            break;
        case XMLHttpRequest.HEADERS_RECEIVED:
            break;
        case XMLHttpRequest.LOADING:
            break;
        case XMLHttpRequest.DONE:
            break;
    }
}

//Set up the Download button and link, as well as the error message <span>
function attachToPage(el) {
    if (!el) {
        console.error('KonaJS: No element to attach to');
        return;
    }

    var li = document.createElement('li'),
        link = document.createElement('button');

    //'Download all' button
    link.setAttribute('id', 'kona-download-button');
    link.innerHTML = 'Download all';
    link.addEventListener('click', onDownloadAll);

    //create the download link
    download_link = document.createElement('a');
    download_link.style.visibility = 'hidden';

    //create the error message element
    download_error = document.createElement('span');
    download_error.style.visibility = 'hidden';
    download_error.classList.add('kona-download-error');

    li.appendChild(link);
    el.appendChild(li);

    el.appendChild(download_link);
    el.appendChild(download_error);

    //show the extension icon
    chrome.runtime.sendMessage({action: 'show'});

    console.log('KonaJS: lets rock!');
}

//displays an error message
function showError(message) {
    console.error('KonaJS: error:', message);
    download_error.innerHTML = 'Download failed: ' + message;
    download_error.style.visibility = '';
}

//returns a meaningful message based on a FileError code
function getFileError(code) {
    var msg = '';

    switch (code) {
        case FileError.QUOTA_EXCEEDED_ERR:
            msg = 'quota exceeded';
            break;
        case FileError.NOT_FOUND_ERR:
            msg = 'file not found';
            break;
        case FileError.SECURITY_ERR:
            msg = 'security error';
            break;
        case FileError.INVALID_MODIFICATION_ERR:
            msg = 'invalid modification';
            break;
        case FileError.INVALID_STATE_ERR:
            msg = 'invalid state';
            break;
        default:
            msg = 'unknown error';
            break;
    }

    return msg;
}

//get the entry point element
var entry = document.querySelector('.files ul.quick_view_pill_list');

//attach to entry point
attachToPage(entry);


//TODO FIND OUT WHY I HAVE TO RESIZE A TEXTBOX AND THEN START USING IT TO AVOID THE 1px WHITE LINE ON LEFT EDGES DURING IMG2IMG
//...lmao did setting min width 200 on info div fix that accidentally?  once the canvas is infinite and the menu bar is hideable it'll probably be a problem again

window.onload = startup;

var stableDiffusionData = { //includes img2img data but works for txt2img just fine
    prompt: "",
    negative_prompt: "",
    seed: -1,
    cfg_scale: 7,
    sampler_index: "DDIM",
    steps: 30,
    denoising_strength: 1,
    mask_blur: 0,
    batch_size: 2,
    width: 512,
    height: 512,
    n_iter: 2, // batch count
    mask: "",
    init_images: [],
    inpaint_full_res: false,
    inpainting_fill: 2,
    enable_hr: false,
    firstphase_width: 0,
    firstphase_height: 0,
    // here's some more fields that might be useful

    // ---txt2img specific:
    // "enable_hr": false,   // hires fix
    // "denoising_strength": 0, // ok this is in both txt and img2img but txt2img only applies it if enable_hr == true
    // "firstphase_width": 0, // hires fp w
    // "firstphase_height": 0, // see above s/w/h/

    // ---img2img specific
    // "init_images": [ // imageS!??!? wtf maybe for batch img2img?? i just dump one base64 in here
    //     "string"
    // ],
    // "resize_mode": 0, 
    // "denoising_strength": 0.75, // yeah see
    // "mask": "string", // string is just a base64 image
    // "mask_blur": 4,
    // "inpainting_fill": 0, // 0- fill, 1- orig, 2- latent noise, 3- latent nothing
    // "inpaint_full_res": true,
    // "inpaint_full_res_padding": 0, // px
    // "inpainting_mask_invert": 0, // bool??????? wtf
    // "include_init_images": false // ??????

}

// stuff things use
var blockNewImages = false;
var returnedImages;
var imageIndex = 0;
var tmpImgXYWH = {};
var host = "";
var url = "/sdapi/v1/";
var endpoint = "txt2img"
var frameX = 512;
var frameY = 512;
var prevMouseX = 0;
var prevMouseY = 0;
var mouseX = 0;
var mouseY = 0;
var canvasX = 0;
var canvasY = 0;
var snapX = 0;
var snapY = 0;
var drawThis = {};
var clicked = false;
const basePixelCount = 64; //64 px - ALWAYS 64 PX
var scaleFactor = 8; //x64 px
var snapToGrid = true;
var paintMode = false;
var eraseMode = false; //TODO this is broken, functionality still exists in code but UI element is just naively disabled
var backupMaskPaintCanvas; //???
var backupMaskPaintCtx;  //...? look i am bad at this
var backupMaskChunk = null;
var backupMaskX = null;
var backupMaskY = null;
var totalImagesReturned;
// var maskEdgePixels = {};
var overMask = true;
var overMaskPx = 10;
var drawTargets = []; // is this needed?  i only draw the last one anyway...
var dropTargets = []; // uhhh yeah similar to the above but for arbitrary dropped images
var arbitraryImage;
var arbitraryImageData;
var arbitraryImageBitmap;
var arbitraryImageBase64; // seriously js cmon work with me here
var placingArbitraryImage = false; // for when the user has loaded an existing image from their computer

// info div, sometimes hidden
let mouseXInfo = document.getElementById("mouseX");
let mouseYInfo = document.getElementById("mouseY");
let canvasXInfo = document.getElementById("canvasX");
let canvasYInfo = document.getElementById("canvasY");
let snapXInfo = document.getElementById("snapX");
let snapYInfo = document.getElementById("snapY");

// canvases and related
const ovCanvas = document.getElementById("overlayCanvas"); // where mouse cursor renders
const ovCtx = ovCanvas.getContext("2d");
const tgtCanvas = document.getElementById("targetCanvas"); // where "box" gets drawn before dream happens
const tgtCtx = tgtCanvas.getContext("2d");
const maskPaintCanvas = document.getElementById("maskPaintCanvas"); // where masking brush gets painted 
const maskPaintCtx = maskPaintCanvas.getContext("2d");
const tempCanvas = document.getElementById("tempCanvas"); // where select/rejects get superimposed temporarily
const tempCtx = tempCanvas.getContext("2d");
const imgCanvas = document.getElementById("canvas"); // where dreams go
const imgCtx = imgCanvas.getContext("2d");
const bgCanvas = document.getElementById("backgroundCanvas"); // gray bg grid
const bgCtx = bgCanvas.getContext("2d");

function startup() {
    loadSettings();
    drawBackground();
    changeScaleFactor();
    changePaintMode();
    changeEraseMode();
    changeSampler();
    changeSteps();
    changeCfgScale();
    changeBatchCount();
    changeBatchSize();
    changeSnapMode();
    changeMaskBlur();
    changeSeed();
    changeOverMask();
    changeOverMaskPx();
    changeHiResFix();
    document.getElementById("overlayCanvas").onmousemove = mouseMove;
    document.getElementById("overlayCanvas").onmousedown = mouseDown;
    document.getElementById("overlayCanvas").onmouseup = mouseUp;
    document.getElementById("scaleFactor").value = scaleFactor;
}

function drop(imageParams) {
    const img = new Image();
    img.src = arbitraryImageBase64;
    if (img.complete) {
        writeArbitraryImage(img, imageParams.x, imageParams.y)
    }
}

function writeArbitraryImage(img, x, y) {
    imgCtx.drawImage(img, x, y);
    blockNewImages = false;
    placingArbitraryImage = false;
    document.getElementById("preloadImage").files = null;
}

function dream(x, y, prompt) {
    tmpImgXYWH.x = x;
    tmpImgXYWH.y = y;
    tmpImgXYWH.w = prompt.width;
    tmpImgXYWH.h = prompt.height;
    console.log("dreaming to " + host + url + endpoint + ":\r\n" + JSON.stringify(prompt));
    postData(prompt)
        .then((data) => {
            returnedImages = data.images;
            totalImagesReturned = data.images.length;
            blockNewImages = true;
            //console.log(data); // JSON data parsed by `data.json()` call
            imageAcceptReject(x, y, data);
        });
}

async function postData(promptData) {
    this.host = document.getElementById("host").value;
    // Default options are marked with *
    const response = await fetch(this.host + this.url + this.endpoint, {
        method: 'POST', // *GET, POST, PUT, DELETE, etc.
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'default', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'same-origin', // include, *same-origin, omit
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        redirect: 'follow', // manual, *follow, error
        referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
        body: JSON.stringify(promptData) // body data type must match "Content-Type" header
    });
    return response.json(); // parses JSON response into native JavaScript objects
}

function imageAcceptReject(x, y, data) {
    const img = new Image();
    img.onload = function () {
        tempCtx.drawImage(img, x, y); //imgCtx for actual image, tmp for... holding?
        var div = document.createElement("div");
        div.id = "veryTempDiv";
        div.style.position = "absolute";
        div.style.left = parseInt(x) + "px";
        div.style.top = parseInt(y + data.parameters.height) + "px";
        div.style.width = "150px";
        div.style.height = "50px";
        div.innerHTML = "<button onclick=\"prevImg(this)\">&lt;</button><button onclick=\"nextImg(this)\">&gt;</button><span id=\"currentImgIndex\"></span> of <span id=\"totalImgIndex\"></span><button onclick=\"accept(this)\">Y</button><button onclick=\"reject(this)\">N</button>"
        document.getElementById("tempDiv").appendChild(div);
        document.getElementById("currentImgIndex").innerText = "1";
        document.getElementById("totalImgIndex").innerText = totalImagesReturned;
    }
    // set the image displayed as the first regardless of batch size/count
    imageIndex = 0;
    // load the image data after defining the closure
    img.src = "data:image/png;base64," + returnedImages[imageIndex];
}

function accept(evt) {
    // write image to imgcanvas
    clearBackupMask();
    placeImage();
    removeChoiceButtons();
    clearTargetMask();
    blockNewImages = false;
}

function reject(evt) {
    // remove image entirely
    restoreBackupMask();
    clearBackupMask();
    clearTargetMask();
    removeChoiceButtons();
    blockNewImages = false;
}

function newImage(evt) {
    clearBackupMask();
    clearTargetMask();
    clearImgMask();
}

function prevImg(evt) {
    if (imageIndex == 0) {
        imageIndex = totalImagesReturned;
    }
    changeImg(false);
}

function nextImg(evt) {
    if (imageIndex == (totalImagesReturned - 1)) {
        imageIndex = -1;
    }
    changeImg(true);
}

function changeImg(forward) {
    const img = new Image();
    tempCtx.clearRect(0, 0, tempCtx.width, tempCtx.height);
    img.onload = function () {
        tempCtx.drawImage(img, tmpImgXYWH.x, tmpImgXYWH.y); //imgCtx for actual image, tmp for... holding?
    }
    var tmpIndex = document.getElementById("currentImgIndex");
    if (forward) {
        imageIndex++;
    } else {
        imageIndex--;
    }
    tmpIndex.innerText = imageIndex + 1;
    // load the image data after defining the closure
    img.src = "data:image/png;base64," + returnedImages[imageIndex];  //TODO need way to dream batches and select from results
}

function removeChoiceButtons(evt) {
    const element = document.getElementById("veryTempDiv");
    element.remove();
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
}

function restoreBackupMask() {
    // reapply mask if exists
    if (backupMaskChunk != null && backupMaskX != null && backupMaskY != null) {
        // backup mask data exists
        var iData = new ImageData(backupMaskChunk.data, backupMaskChunk.height, backupMaskChunk.width);
        maskPaintCtx.putImageData(iData, backupMaskX, backupMaskY);
    }
}

function clearBackupMask() {
    // clear backupmask 
    backupMaskChunk = null;
    backupMaskX = null;
    backupMaskY = null;
}

function clearTargetMask() {
    tgtCtx.clearRect(0, 0, tgtCanvas.width, tgtCanvas.height);
}

function clearImgMask() {
    imgCtx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
}

function placeImage() {
    const img = new Image();
    img.onload = function () {
        imgCtx.drawImage(img, tmpImgXYWH.x, tmpImgXYWH.y);
        tmpImgXYWH = {};
        returnedImages = null;
    }
    // load the image data after defining the closure
    img.src = "data:image/png;base64," + returnedImages[imageIndex];

}

function sleep(ms) {
    // what was this even for, anyway?
    return new Promise(resolve => setTimeout(resolve, ms));
}

function snap(i) {
    // very cheap test proof of concept but it works surprisingly well
    var scaleOffset = 0;
    if (scaleFactor % 2 != 0) {
        // odd number, snaps to center of cell, oops
        scaleOffset = (basePixelCount / 2);
    }
    var snapOffset = i % basePixelCount - scaleOffset;
    if (snapOffset == 0) {
        return snapOffset;
    }
    return -snapOffset;
}


function mouseMove(evt) {
    const rect = ovCanvas.getBoundingClientRect() // not-quite pixel offset was driving me insane
    const canvasOffsetX = rect.left;
    const canvasOffsetY = rect.top;
    mouseXInfo.innerText = mouseX = evt.clientX;
    mouseYInfo.innerText = mouseY = evt.clientY;
    canvasXInfo.innerText = canvasX = parseInt(evt.clientX - rect.left);
    canvasYInfo.innerText = canvasY = parseInt(evt.clientY - rect.top);
    snapXInfo.innerText = canvasX + snap(canvasX);
    snapYInfo.innerText = canvasY + snap(canvasY);
    ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height); // clear out the previous mouse cursor 
    if (placingArbitraryImage) {
        // ugh refactor so this isn't duplicated between arbitrary image and dream reticle modes
        snapOffsetX = 0;
        snapOffsetY = 0;
        if (snapToGrid) {
            snapOffsetX = snap(canvasX);
            snapOffsetY = snap(canvasY);
        }
        finalX = snapOffsetX + canvasX;
        finalY = snapOffsetY + canvasY;
        ovCtx.drawImage(arbitraryImage, parseInt(finalX - ((basePixelCount * scaleFactor) / 2)), parseInt(finalY - ((basePixelCount * scaleFactor) / 2)));
    } else if (!paintMode) {
        // draw targeting square reticle thingy cursor
        ovCtx.strokeStyle = "#00000077";
        snapOffsetX = 0;
        snapOffsetY = 0;
        if (snapToGrid) {
            snapOffsetX = snap(canvasX);
            snapOffsetY = snap(canvasY);
        }
        finalX = snapOffsetX + canvasX;
        finalY = snapOffsetY + canvasY;
        ovCtx.strokeRect(parseInt(finalX - ((basePixelCount * scaleFactor) / 2)), parseInt(finalY - ((basePixelCount * scaleFactor) / 2)), basePixelCount * scaleFactor, basePixelCount * scaleFactor); //origin is middle of the frame
    } else {
        // draw big translucent red blob cursor
        ovCtx.beginPath();
        ovCtx.arc(canvasX, canvasY, 4 * scaleFactor, 0, 2 * Math.PI, true); // for some reason 4x on an arc is === to 8x on a line???
        ovCtx.fillStyle = "#FF6A6A50";
        ovCtx.fill();
        // in case i'm trying to draw
        mouseX = parseInt(evt.clientX - canvasOffsetX);
        mouseY = parseInt(evt.clientY - canvasOffsetY);
        if (clicked) {
            // i'm trying to draw, please draw :(             
            if (eraseMode) {
                // THIS IS SOOOO BROKEN AND I DON'T UNDERSTAND WHY BECAUSE I AM THE BIG DUMB
                maskPaintCtx.globalCompositeOperation = 'destination-out';
                // maskPaintCtx.strokeStyle = "#FFFFFF00";
            } else {
                maskPaintCtx.globalCompositeOperation = 'source-over';
                maskPaintCtx.strokeStyle = "#FF6A6A10";
            }

            maskPaintCtx.lineWidth = 8 * scaleFactor;
            maskPaintCtx.beginPath();
            maskPaintCtx.moveTo(prevMouseX, prevMouseY);
            maskPaintCtx.lineTo(mouseX, mouseY);
            maskPaintCtx.lineJoin = maskPaintCtx.lineCap = 'round';
            maskPaintCtx.stroke();
        }
        prevMouseX = mouseX;
        prevMouseY = mouseY;
    }
}

function mouseDown(evt) {
    const rect = ovCanvas.getBoundingClientRect()
    if (placingArbitraryImage) {
        var nextBox = {};
        nextBox.x = evt.clientX - ((basePixelCount * scaleFactor) / 2) - rect.left; //origin is middle of the frame 
        nextBox.y = evt.clientY - ((basePixelCount * scaleFactor) / 2) - rect.top; //TODO make a way to set the origin to numpad dirs?
        nextBox.w = basePixelCount * scaleFactor;
        nextBox.h = basePixelCount * scaleFactor;
        dropTargets.push(nextBox);
    } else if (paintMode) {
        //const rect = ovCanvas.getBoundingClientRect() // not-quite pixel offset was driving me insane
        const canvasOffsetX = rect.left;
        const canvasOffsetY = rect.top;
        prevMouseX = mouseX = evt.clientX - canvasOffsetX;
        prevMouseY = mouseY = evt.clientY - canvasOffsetY;
        clicked = true;
    } else {
        //const rect = ovCanvas.getBoundingClientRect()
        var nextBox = {};
        nextBox.x = evt.clientX - ((basePixelCount * scaleFactor) / 2) - rect.left; //origin is middle of the frame 
        nextBox.y = evt.clientY - ((basePixelCount * scaleFactor) / 2) - rect.top; //TODO make a way to set the origin to numpad dirs?
        nextBox.w = basePixelCount * scaleFactor;
        nextBox.h = basePixelCount * scaleFactor;
        drawTargets.push(nextBox);
    }
}

function mouseUp(evt) {
    if (placingArbitraryImage) {
        //TODO DO SOMETHING
        // jeez i REALLY need to refactor tons of this to not be duplicated all over, that's definitely my next chore after figuring out that razza frazza overmask fade
        var target = dropTargets[dropTargets.length - 1]; //get the last one... why am i storing all of them?
        snapOffsetX = 0;
        snapOffsetY = 0;
        if (snapToGrid) {
            snapOffsetX = snap(target.x);
            snapOffsetY = snap(target.y);
        }
        finalX = snapOffsetX + target.x;
        finalY = snapOffsetY + target.y;

        drawThis.x = finalX;
        drawThis.y = finalY;
        drawThis.w = target.w;
        drawThis.h = target.h;
        drawIt = drawThis; // i still think this is really stupid and redundant and unnecessary and redundant
        drop(drawIt);
    } else if (paintMode) {
        clicked = false;
        return;
    } else {
        if (!blockNewImages) {
            //TODO seriously, refactor this
            blockNewImages = true;
            clearTargetMask();
            tgtCtx.strokeStyle = "#55000077";
            var drawIt = {}; //why am i doing this????
            var target = drawTargets[drawTargets.length - 1]; //get the last one... why am i storing all of them?

            snapOffsetX = 0;
            snapOffsetY = 0;
            if (snapToGrid) {
                snapOffsetX = snap(target.x);
                snapOffsetY = snap(target.y);
            }
            finalX = snapOffsetX + target.x;
            finalY = snapOffsetY + target.y;

            drawThis.x = finalX;
            drawThis.y = finalY;
            drawThis.w = target.w;
            drawThis.h = target.h;
            tgtCtx.strokeRect(finalX, finalY, target.w, target.h);
            drawIt = drawThis; //TODO this is WRONG but also explicitly only draws the last image  ... i think
            //check if there's image data already there
            // console.log(downX + ":" + downY + " :: " + this.isCanvasBlank(downX, downY));
            if (!isCanvasBlank(drawIt.x, drawIt.y, drawIt.w, drawIt.h, imgCanvas)) {
                // img2img
                var mainCanvasCtx = document.getElementById("canvas").getContext("2d");
                const imgChunk = mainCanvasCtx.getImageData(drawIt.x, drawIt.y, drawIt.w, drawIt.h); // imagedata object of the image being outpainted
                const imgChunkData = imgChunk.data; // imagedata.data object, a big inconvenient uint8clampedarray
                // these are the 3 mask monitors on the bottom of the page
                var maskCanvas = document.getElementById("maskCanvasMonitor");
                var maskCanvasCtx = maskCanvas.getContext("2d");
                var initImgCanvas = document.getElementById("initImgCanvasMonitor");
                var initImgCanvasCtx = initImgCanvas.getContext("2d");
                var overMaskCanvas = document.getElementById("overMaskCanvasMonitor");
                var overMaskCanvasCtx = overMaskCanvas.getContext("2d");
                // get blank pixels to use as mask
                const maskImgData = maskCanvasCtx.createImageData(drawIt.w, drawIt.h);
                const initImgData = mainCanvasCtx.createImageData(drawIt.w, drawIt.h);
                const overMaskImgData = overMaskCanvasCtx.createImageData(drawIt.w, drawIt.h);
                // cover entire masks in black before adding masked areas

                for (let i = 0; i < imgChunkData.length; i += 4) {
                    // l->r, top->bottom, R G B A pixel values in a big ol array
                    // make a simple mask            
                    if (imgChunkData[i + 3] == 0) { // rgba pixel values, 4th one is alpha, if it's 0 there's "nothing there" in the image display canvas and its time to outpaint
                        maskImgData.data[i] = 255; // white mask gets painted over
                        maskImgData.data[i + 1] = 255;
                        maskImgData.data[i + 2] = 255;
                        maskImgData.data[i + 3] = 255;

                        overMaskImgData.data[i] = 255; //lets just set this up now
                        overMaskImgData.data[i + 1] = 255;
                        overMaskImgData.data[i + 2] = 255;
                        overMaskImgData.data[i + 3] = 255;


                        initImgData.data[i] = 0; // null area on initial image becomes opaque black pixels
                        initImgData.data[i + 1] = 0;
                        initImgData.data[i + 2] = 0;
                        initImgData.data[i + 3] = 255;
                    } else { // leave these pixels alone 
                        maskImgData.data[i] = 0; // black mask gets ignored for in/outpainting
                        maskImgData.data[i + 1] = 0;
                        maskImgData.data[i + 2] = 0;
                        maskImgData.data[i + 3] = 255; // but it still needs an opaque alpha channel 

                        overMaskImgData.data[i] = 0;
                        overMaskImgData.data[i + 1] = 0;
                        overMaskImgData.data[i + 2] = 0;
                        overMaskImgData.data[i + 3] = 255;

                        initImgData.data[i] = imgChunkData[i]; // put the original picture back in the painted area
                        initImgData.data[i + 1] = imgChunkData[i + 1];
                        initImgData.data[i + 2] = imgChunkData[i + 2];
                        initImgData.data[i + 3] = imgChunkData[i + 3]; //it's still RGBA so we can handily do this in nice chunks'o'4
                    }
                }
                // make a list of all the white pixels to expand so we don't waste time on non-mask pixels
                let pix = { x: [], y: [], index: [] };
                var x, y, index;
                for (y = 0; y < drawIt.h; y++) {
                    for (x = 0; x < drawIt.w; x++) {
                        index = ((y * drawIt.w + x) * 4);
                        if (overMaskImgData.data[index] > 0) {
                            pix.x.push(x);
                            pix.y.push(y);
                            pix.index.push(index);
                        }
                    }
                }
                for (i = 0; i < pix.index.length; i++) {
                    // get the index in the stupid array
                    // why? it's unused
                    // var currentMaskPixelIndex = pix.index[i];

                    // for any horizontal expansion, we need to ensure that the target pixel is in the same Y row
                    // horizontal left (west) is index-4 per pixel
                    // horizontal right (east) is index+4 per pixel
                    var currentMaskPixelY = pix.y[i];

                    // for any vertical expansion, we need to ensure that the target pixel is in the same X column
                    // vertical up (north) is index-(imagedata.width) per pixel
                    // vertical down (south) is index+(imagedata.width) per pixel
                    var currentMaskPixelX = pix.x[i];

                    // i hate uint8clampedarray and math
                    // primarily math
                    // actually just my brain  
                    // ok so now lets check neighbors to see if they're in the same row/column
                    for (j = overMaskPx; j > 0; j--) { // set a variable to the extreme end of the overmask size and work our way back inwards
                        // i hate uint8clampedarray and math
                        // this is so inefficient but i warned you all i'm bad at this
                        //TODO refactor like all of this, it's horrible and shameful 
                        // BUT IT WORKS
                        // but it is crushingly inefficient i'm sure
                        // BUT IT WORKS and i came up with it all by myself because i'm a big boy

                        // ... sigh it doesn't work _well_
                        // just moves the seam 
                        //TODO find a way to fade/gradient the edge without making weird artifacts or literally crashing the browser with inefficient data storage

                        // west
                        var potentialPixelIndex = ((currentMaskPixelY * drawIt.w + currentMaskPixelX) * 4) - (j * 4);
                        var potentialPixelX = (potentialPixelIndex / 4) % drawIt.w;
                        var potentialPixelY = Math.floor((potentialPixelIndex / 4) / drawIt.w);
                        // west/east: ENSURE SAME ROW using the y axis unintuitively
                        if (potentialPixelY == currentMaskPixelY) {
                            // ok then 
                            // ensure it's not already a mask pixel
                            if (overMaskImgData.data[potentialPixelIndex] != 255) {
                                // welp fingers crossed
                                overMaskImgData.data[potentialPixelIndex] = 255;
                                overMaskImgData.data[potentialPixelIndex + 1] = 255;
                                overMaskImgData.data[potentialPixelIndex + 2] = 255;
                                overMaskImgData.data[potentialPixelIndex + 3] = 255;
                            }
                        }

                        // east
                        var potentialPixelIndex = ((currentMaskPixelY * drawIt.w + currentMaskPixelX) * 4) + (j * 4);
                        var potentialPixelX = (potentialPixelIndex / 4) % drawIt.w;
                        var potentialPixelY = Math.floor((potentialPixelIndex / 4) / drawIt.w);
                        if (potentialPixelY == currentMaskPixelY) {
                            if (overMaskImgData.data[potentialPixelIndex] != 255) {
                                overMaskImgData.data[potentialPixelIndex] = 255;
                                overMaskImgData.data[potentialPixelIndex + 1] = 255;
                                overMaskImgData.data[potentialPixelIndex + 2] = 255;
                                overMaskImgData.data[potentialPixelIndex + 3] = 255;
                            }
                        }

                        // north
                        var potentialPixelIndex = ((currentMaskPixelY * drawIt.w + currentMaskPixelX) * 4) - ((j * drawIt.w) * 4);
                        var potentialPixelX = (potentialPixelIndex / 4) % drawIt.w;
                        var potentialPixelY = Math.floor((potentialPixelIndex / 4) / drawIt.w);
                        // north/south: ENSURE SAME COLUMN using the x axis unintuitively
                        if (potentialPixelX == currentMaskPixelX) {
                            if (overMaskImgData.data[potentialPixelIndex] != 255) {
                                overMaskImgData.data[potentialPixelIndex] = 255;
                                overMaskImgData.data[potentialPixelIndex + 1] = 255;
                                overMaskImgData.data[potentialPixelIndex + 2] = 255;
                                overMaskImgData.data[potentialPixelIndex + 3] = 255;
                            }
                        }

                        // south
                        var potentialPixelIndex = ((currentMaskPixelY * drawIt.w + currentMaskPixelX) * 4) + ((j * drawIt.w) * 4);
                        var potentialPixelX = (potentialPixelIndex / 4) % drawIt.w;
                        var potentialPixelY = Math.floor((potentialPixelIndex / 4) / drawIt.w);
                        if (potentialPixelX == currentMaskPixelX) {
                            if (overMaskImgData.data[potentialPixelIndex] != 255) {
                                overMaskImgData.data[potentialPixelIndex] = 255;
                                overMaskImgData.data[potentialPixelIndex + 1] = 255;
                                overMaskImgData.data[potentialPixelIndex + 2] = 255;
                                overMaskImgData.data[potentialPixelIndex + 3] = 255;
                            }
                        }
                    }
                }

                // also check for painted masks in region, add them as white pixels to mask canvas
                const maskChunk = maskPaintCtx.getImageData(drawIt.x, drawIt.y, drawIt.w, drawIt.h);
                const maskChunkData = maskChunk.data;
                for (let i = 0; i < maskChunkData.length; i += 4) {
                    if (maskChunkData[i + 3] != 0) {
                        maskImgData.data[i] = 255;
                        maskImgData.data[i + 1] = 255;
                        maskImgData.data[i + 2] = 255;
                        maskImgData.data[i + 3] = 255;
                        overMaskImgData.data[i] = 255;
                        overMaskImgData.data[i + 1] = 255;
                        overMaskImgData.data[i + 2] = 255;
                        overMaskImgData.data[i + 3] = 255;
                    }
                }
                // backup any painted masks ingested then them, replacable if user doesn't like resultant image
                var clearArea = maskPaintCtx.createImageData(drawIt.w, drawIt.h);
                backupMaskChunk = maskChunk;
                backupMaskX = drawIt.x;
                backupMaskY = drawIt.y;

                var clearD = clearArea.data;
                for (let i = 0; i < clearD.length; i++) {
                    clearD[i] = 0; // just null it all out
                }
                maskPaintCtx.putImageData(clearArea, drawIt.x, drawIt.y);
                // mask monitors
                maskCanvasCtx.putImageData(maskImgData, 0, 0);
                var maskBase64 = maskCanvas.toDataURL();
                overMaskCanvasCtx.putImageData(overMaskImgData, 0, 0); // :pray:
                var overMaskBase64 = overMaskCanvas.toDataURL();
                initImgCanvasCtx.putImageData(initImgData, 0, 0);
                var initImgBase64 = initImgCanvas.toDataURL();
                // img2img
                endpoint = "img2img";
                var selectedMask = overMask ? overMaskBase64 : maskBase64;
                stableDiffusionData.mask = selectedMask;
                // stableDiffusionData.mask = maskBase64;
                stableDiffusionData.init_images = [initImgBase64];
                // slightly more involved than txt2img
            } else {
                // txt2img
                endpoint = "txt2img";
                // easy enough
            }
            stableDiffusionData.prompt = document.getElementById("prompt").value;
            stableDiffusionData.negative_prompt = document.getElementById("negPrompt").value;
            stableDiffusionData.width = drawIt.w;
            stableDiffusionData.height = drawIt.h;
            stableDiffusionData.firstphase_height = (drawIt.h / 2);
            stableDiffusionData.firstphase_width = (drawIt.w / 2);
            dream(drawIt.x, drawIt.y, stableDiffusionData);
        }
    }
}

function changeScaleFactor() {
    document.getElementById("scaleFactorTxt").innerText = scaleFactor = document.getElementById("scaleFactor").value;
    localStorage.setItem("scaleFactor", scaleFactor);
}

function changeSteps() {
    document.getElementById("stepsTxt").innerText = stableDiffusionData.steps = document.getElementById("steps").value;
    localStorage.setItem("steps", stableDiffusionData.steps);
}

function changePaintMode() {
    paintMode = document.getElementById("cbxPaint").checked;
    clearTargetMask();
    ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
}

function changeEraseMode() {
    eraseMode = document.getElementById("cbxErase").checked;
    clearTargetMask();
    ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
}

function changeSampler() {
    stableDiffusionData.sampler_index = document.getElementById("samplerSelect").value;
    localStorage.setItem("sampler", stableDiffusionData.sampler_index);
}

function changeCfgScale() {
    document.getElementById("cfgScaleTxt").innerText = stableDiffusionData.cfg_scale = document.getElementById("cfgScale").value;
    localStorage.setItem("cfg_scale", stableDiffusionData.cfg_scale);
}

function changeBatchSize() {
    document.getElementById("batchSizeText").innerText = stableDiffusionData.batch_size = document.getElementById("batchSize").value;
    localStorage.setItem("batch_size", stableDiffusionData.batch_size);
}

function changeBatchCount() {
    document.getElementById("batchCountText").innerText = stableDiffusionData.n_iter = document.getElementById("batchCount").value;
    localStorage.setItem("n_iter", stableDiffusionData.n_iter);
}

function changeSnapMode() {
    snapToGrid = document.getElementById("cbxSnap").checked;
}

function changeMaskBlur() {
    stableDiffusionData.mask_blur = document.getElementById("maskBlur").value;
    localStorage.setItem("mask_blur", stableDiffusionData.mask_blur);
}

function changeSeed() {
    stableDiffusionData.seed = document.getElementById("seed").value;
    localStorage.setItem("seed", stableDiffusionData.seed);
}

function changeOverMask() {
    overMask = document.getElementById("cbxOverMask").checked;
}

function changeOverMaskPx() {
    overMaskPx = document.getElementById("overMaskPx").value;
}

function changeHiResFix() {
    stableDiffusionData.enable_hr = Boolean(document.getElementById("cbxHRFix").checked);
    localStorage.setItem("enable_hr", stableDiffusionData.enable_hr);
}

function isCanvasBlank(x, y, w, h, specifiedCanvas) {
    var canvas = document.getElementById(specifiedCanvas.id);
    return !canvas.getContext('2d')
        .getImageData(x, y, w, h).data
        .some(channel => channel !== 0);
}

function drawBackground() {
    bgCtx.lineWidth = 1;
    bgCtx.strokeStyle = '#999';
    var gridbox = bgCanvas.getBoundingClientRect();
    for (var i = 0; i < gridbox.width; i += 64) {
        bgCtx.moveTo(i, 0);
        bgCtx.lineTo(i, bgCanvas.height);
        bgCtx.stroke();
    }
    for (var i = 0; i < gridbox.height; i += 64) {
        bgCtx.moveTo(0, i);
        bgCtx.lineTo(gridbox.width, i);
        bgCtx.stroke();
    }
}

function preloadImage() {
    // gonna legit scream 
    document.getElementById("overlayCanvas").onmousemove = null;
    document.getElementById("overlayCanvas").onmousedown = null;
    document.getElementById("overlayCanvas").onmouseup = null;

    var file = document.getElementById("preloadImage").files[0];
    var reader = new FileReader();
    reader.onload = function (evt) {
        var imgCanvas = document.createElement("canvas");
        var imgCtx = imgCanvas.getContext("2d");
        arbitraryImage = new Image();
        arbitraryImage.onload = function () {
            blockNewImages = true;
            // now put it into imagedata for canvas fun
            imgCanvas.width = arbitraryImage.width;
            imgCanvas.height = arbitraryImage.height;
            imgCtx.drawImage(arbitraryImage, 0, 0);
            arbitraryImageData = imgCtx.getImageData(0, 0, arbitraryImage.width, arbitraryImage.height); // can't use that to drawImage on a canvas...
            arbitraryImageBitmap = createImageBitmap(arbitraryImageData); // apparently that either... maybe just the raw image?
            arbitraryImageBase64 = imgCanvas.toDataURL();
            placingArbitraryImage = true;
            document.getElementById("overlayCanvas").onmousemove = mouseMove;
            document.getElementById("overlayCanvas").onmousedown = mouseDown;
            document.getElementById("overlayCanvas").onmouseup = mouseUp;
        }
        arbitraryImage.src = evt.target.result;
    }
    reader.readAsDataURL(file);
}

function downloadCanvas() {
    var link = document.createElement('a');
    link.download = new Date().toISOString().slice(0, 19).replace('T', ' ').replace(':', ' ') + ' openOutpaint image.png';
    var croppedCanvas = cropCanvas(imgCanvas);
    if (croppedCanvas != null) {
        link.href = croppedCanvas.toDataURL('image/png');
        link.click();
    }
}

function cropCanvas(sourceCanvas) {
    var w = sourceCanvas.width;
    var h = sourceCanvas.height;
    var pix = { x: [], y: [] };
    var imageData = sourceCanvas.getContext('2d').getImageData(0, 0, w, h);
    var x, y, index;

    for (y = 0; y < h; y++) {
        for (x = 0; x < w; x++) {
            // lol i need to learn what this part does 
            index = (y * w + x) * 4; // OHHH OK this is setting the imagedata.data uint8clampeddataarray index for the specified x/y coords
            //this part i get, this is checking that 4th RGBA byte for opacity
            if (imageData.data[index + 3] > 0) {
                pix.x.push(x);
                pix.y.push(y);
            }
        }
    }
    // ...need to learn what this part does too :badpokerface:
    // is this just determining the boundaries of non-transparent pixel data?
    pix.x.sort(function (a, b) { return a - b });
    pix.y.sort(function (a, b) { return a - b });
    var n = pix.x.length - 1;
    w = pix.x[n] - pix.x[0];
    h = pix.y[n] - pix.y[0];
    // yup sure looks like it

    try {
        var cut = sourceCanvas.getContext('2d').getImageData(pix.x[0], pix.y[0], w, h);
        var cutCanvas = document.createElement('canvas');
        cutCanvas.width = w;
        cutCanvas.height = h;
        cutCanvas.getContext('2d').putImageData(cut, 0, 0);
    } catch (ex) {
        // probably empty image
        //TODO confirm edge cases?
        cutCanvas = null;
    }
    return cutCanvas;
}

function loadSettings() {
    // set default values if not set                                    DEFAULTS
    var _sampler = localStorage.getItem("sampler") == null ? "DDIM" : localStorage.getItem("sampler");
    var _steps = localStorage.getItem("steps") == null ? 30 : localStorage.getItem("steps");
    var _cfg_scale = localStorage.getItem("cfg_scale") == null ? 7.0 : localStorage.getItem("cfg_scale");
    var _batch_size = localStorage.getItem("batch_size") == null ? 2 : localStorage.getItem("batch_size");
    var _n_iter = localStorage.getItem("n_iter") == null ? 2 : localStorage.getItem("n_iter");
    var _scaleFactor = localStorage.getItem("scaleFactor") == null ? 8 : localStorage.getItem("scaleFactor");
    var _mask_blur = localStorage.getItem("mask_blur") == null ? 0 : localStorage.getItem("mask_blur");
    var _seed = localStorage.getItem("seed") == null ? -1 : localStorage.getItem("seed");
    var _enable_hr = Boolean(localStorage.getItem("enable_hr") == (null || "false") ? false : localStorage.getItem("enable_hr"));

    // set the values into the UI
    document.getElementById("samplerSelect").value = String(_sampler);
    document.getElementById("steps").value = Number(_steps);
    document.getElementById("cfgScale").value = Number(_cfg_scale);
    document.getElementById("batchSize").value = Number(_batch_size);
    document.getElementById("batchCount").value = Number(_n_iter);
    document.getElementById("scaleFactor").value = Number(_scaleFactor);
    document.getElementById("maskBlur").value = Number(_mask_blur);
    document.getElementById("seed").value = Number(_seed);
    document.getElementById("cbxHRFix").checked = Boolean(_enable_hr);
}

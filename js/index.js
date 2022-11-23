//TODO FIND OUT WHY I HAVE TO RESIZE A TEXTBOX AND THEN START USING IT TO AVOID THE 1px WHITE LINE ON LEFT EDGES DURING IMG2IMG
//...lmao did setting min width 200 on info div fix that accidentally?  once the canvas is infinite and the menu bar is hideable it'll probably be a problem again

window.onload = startup;

var stableDiffusionData = {
	//includes img2img data but works for txt2img just fine
	prompt: "",
	negative_prompt: "",
	seed: -1,
	cfg_scale: null,
	sampler_index: "DDIM",
	steps: null,
	denoising_strength: 1,
	mask_blur: 0,
	batch_size: null,
	width: 512,
	height: 512,
	n_iter: null, // batch count
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
};

/**
 * Some Utility Functions
 */
function sliderChangeHandlerFactory(
	sliderId,
	textBoxId,
	dataKey,
	defaultV,
	setter = (k, v) => (stableDiffusionData[k] = v),
	getter = (k) => stableDiffusionData[k]
) {
	const sliderEl = document.getElementById(sliderId);
	const textBoxEl = document.getElementById(textBoxId);
	const savedValue = localStorage.getItem(dataKey);

	if (savedValue) setter(dataKey, savedValue || defaultV);

	function changeHandler(evn) {
		const eventSource = evn && evn.srcElement;
		const value = eventSource && Number(eventSource.value);

		if (value) setter(dataKey, value);

		if (!eventSource || eventSource.id === textBoxId)
			sliderEl.value = getter(dataKey);
		setter(dataKey, Number(sliderEl.value));
		textBoxEl.value = getter(dataKey);

		localStorage.setItem(dataKey, getter(dataKey));
	}

	textBoxEl.onchange = changeHandler;
	sliderEl.oninput = changeHandler;

	return changeHandler;
}

// stuff things use
var blockNewImages = false;
var returnedImages;
var imageIndex = 0;
var tmpImgXYWH = {};
var host = "";
var url = "/sdapi/v1/";
var endpoint = "txt2img";
var frameX = 512;
var frameY = 512;
var prevMouseX = 0;
var prevMouseY = 0;
var mouseX = 0;
var mouseY = 0;
var canvasX = 0;
var canvasY = 0;
var heldButton = 0;
var snapX = 0;
var snapY = 0;
var drawThis = {};
var clicked = false;
const basePixelCount = 64; //64 px - ALWAYS 64 PX
var scaleFactor = 8; //x64 px
var snapToGrid = true;
var paintMode = false;
var backupMaskPaintCanvas; //???
var backupMaskPaintCtx; //...? look i am bad at this
var backupMaskChunk = null;
var backupMaskX = null;
var backupMaskY = null;
var totalImagesReturned;
var overMaskPx = 16;
var drawTargets = []; // is this needed?  i only draw the last one anyway...
var dropTargets = []; // uhhh yeah similar to the above but for arbitrary dropped images
var arbitraryImage;
var arbitraryImageData;
var arbitraryImageBitmap;
var arbitraryImageBase64; // seriously js cmon work with me here
var placingArbitraryImage = false; // for when the user has loaded an existing image from their computer
var enableErasing = false; // accidental right-click erase if the user isn't trying to erase is a bad thing
var marchOffset = 0;
var marching = false;
var inProgress = false;
var marchCoords = {};

// info div, sometimes hidden
let mouseXInfo = document.getElementById("mouseX");
let mouseYInfo = document.getElementById("mouseY");
let canvasXInfo = document.getElementById("canvasX");
let canvasYInfo = document.getElementById("canvasY");
let snapXInfo = document.getElementById("snapX");
let snapYInfo = document.getElementById("snapY");
let heldButtonInfo = document.getElementById("heldButton");

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
	checkIfWebuiIsRunning();
	loadSettings();
	getSamplers();
	getUpscalers();
	getModels();
	drawBackground();
	changeScaleFactor();
	changePaintMode();
	changeSampler();
	changeSteps();
	changeCfgScale();
	changeBatchCount();
	changeBatchSize();
	changeSnapMode();
	changeMaskBlur();
	changeSeed();
	changeOverMaskPx();
	changeHiResFix();
	changeEnableErasing();
	document.getElementById("overlayCanvas").onmousemove = mouseMove;
	document.getElementById("overlayCanvas").onmousedown = mouseDown;
	document.getElementById("overlayCanvas").onmouseup = mouseUp;
	document.getElementById("scaleFactor").value = scaleFactor;
}

function drop(imageParams) {
	const img = new Image();
	img.onload = function () {
		writeArbitraryImage(img, imageParams.x, imageParams.y);
	};
	img.src = arbitraryImageBase64;
}

function writeArbitraryImage(img, x, y) {
	commands.runCommand("drawImage", "Image Stamp", {
		x,
		y,
		image: img,
	});
	blockNewImages = false;
	placingArbitraryImage = false;
	document.getElementById("preloadImage").files = null;
}

function dream(x, y, prompt) {
	tmpImgXYWH.x = x;
	tmpImgXYWH.y = y;
	tmpImgXYWH.w = prompt.width;
	tmpImgXYWH.h = prompt.height;
	console.log(
		"dreaming to " + host + url + endpoint + ":\r\n" + JSON.stringify(prompt)
	);
	postData(prompt).then((data) => {
		returnedImages = data.images;
		totalImagesReturned = data.images.length;
		blockNewImages = true;
		//console.log(data); // JSON data parsed by `data.json()` call
		imageAcceptReject(x, y, data);
	});
	checkProgress();
}

async function postData(promptData) {
	this.host = document.getElementById("host").value;
	// Default options are marked with *
	const response = await fetch(this.host + this.url + this.endpoint, {
		method: "POST", // *GET, POST, PUT, DELETE, etc.
		mode: "cors", // no-cors, *cors, same-origin
		cache: "default", // *default, no-cache, reload, force-cache, only-if-cached
		credentials: "same-origin", // include, *same-origin, omit
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		redirect: "follow", // manual, *follow, error
		referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
		body: JSON.stringify(promptData), // body data type must match "Content-Type" header
	});
	return response.json(); // parses JSON response into native JavaScript objects
}

function imageAcceptReject(x, y, data) {
	inProgress = false;
	document.getElementById("progressDiv").remove();
	const img = new Image();
	img.onload = function () {
		tempCtx.drawImage(img, x, y); //imgCtx for actual image, tmp for... holding?
		var div = document.createElement("div");
		div.id = "veryTempDiv";
		div.style.position = "absolute";
		div.style.left = parseInt(x) + "px";
		div.style.top = parseInt(y + data.parameters.height) + "px";
		div.style.width = "200px";
		div.style.height = "70px";
		div.innerHTML =
			'<button onclick="prevImg(this)">&lt;</button><button onclick="nextImg(this)">&gt;</button><span class="strokeText" id="currentImgIndex"></span><span class="strokeText"> of </span><span class="strokeText" id="totalImgIndex"></span><button onclick="accept(this)">Y</button><button onclick="reject(this)">N</button><span class="strokeText" id="estRemaining"></span>';
		document.getElementById("tempDiv").appendChild(div);
		document.getElementById("currentImgIndex").innerText = "1";
		document.getElementById("totalImgIndex").innerText = totalImagesReturned;
	};
	// set the image displayed as the first regardless of batch size/count
	imageIndex = 0;
	// load the image data after defining the closure
	img.src = "data:image/png;base64," + returnedImages[imageIndex];
}

function accept(evt) {
	// write image to imgcanvas
	marching = false;
	clearBackupMask();
	placeImage();
	removeChoiceButtons();
	clearTargetMask();
	blockNewImages = false;
}

function reject(evt) {
	// remove image entirely
	marching = false;
	restoreBackupMask();
	clearBackupMask();
	clearTargetMask();
	removeChoiceButtons();
	blockNewImages = false;
}

function newImage(evt) {
	clearPaintedMask();
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
	if (imageIndex == totalImagesReturned - 1) {
		imageIndex = -1;
	}
	changeImg(true);
}

function changeImg(forward) {
	const img = new Image();
	tempCtx.clearRect(0, 0, tempCtx.width, tempCtx.height);
	img.onload = function () {
		tempCtx.drawImage(img, tmpImgXYWH.x, tmpImgXYWH.y); //imgCtx for actual image, tmp for... holding?
	};
	var tmpIndex = document.getElementById("currentImgIndex");
	if (forward) {
		imageIndex++;
	} else {
		imageIndex--;
	}
	tmpIndex.innerText = imageIndex + 1;
	// load the image data after defining the closure
	img.src = "data:image/png;base64," + returnedImages[imageIndex]; //TODO need way to dream batches and select from results
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
		var iData = new ImageData(
			backupMaskChunk.data,
			backupMaskChunk.height,
			backupMaskChunk.width
		);
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

function clearPaintedMask() {
	maskPaintCtx.clearRect(0, 0, maskPaintCanvas.width, maskPaintCanvas.height);
}

function placeImage() {
	const img = new Image();
	img.onload = function () {
		commands.runCommand("drawImage", "Image Dream", {
			x: tmpImgXYWH.x,
			y: tmpImgXYWH.y,
			image: img,
		});
		tmpImgXYWH = {};
		returnedImages = null;
	};
	// load the image data after defining the closure
	img.src = "data:image/png;base64," + returnedImages[imageIndex];
}

function sleep(ms) {
	// what was this even for, anyway?
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function snap(i, scaled = true) {
	// very cheap test proof of concept but it works surprisingly well
	var scaleOffset = 0;
	if (scaled) {
		if (scaleFactor % 2 != 0) {
			// odd number, snaps to center of cell, oops
			scaleOffset = basePixelCount / 2;
		}
	}
	var snapOffset = (i % basePixelCount) - scaleOffset;
	if (snapOffset == 0) {
		return snapOffset;
	}
	return -snapOffset;
}

function march() {
	if (marching) {
		marchOffset++;
		if (marchOffset > 16) {
			marchOffset = 0;
		}
		drawMarchingAnts();
		setTimeout(march, 20);
	}
}

function drawMarchingAnts() {
	clearTargetMask();
	tgtCtx.strokeStyle = "#FFFFFFFF"; //"#55000077";
	tgtCtx.setLineDash([4, 2]);
	tgtCtx.lineDashOffset = -marchOffset;
	tgtCtx.strokeRect(marchCoords.x, marchCoords.y, marchCoords.w, marchCoords.h);
}

function checkProgress() {
	document.getElementById("progressDiv") &&
		document.getElementById("progressDiv").remove();
	endpoint = "progress?skip_current_image=false";
	var div = document.createElement("div");
	div.id = "progressDiv";
	div.style.position = "absolute";
	div.style.width = "200px";
	div.style.height = "70px";
	div.style.left = parseInt(marchCoords.x + marchCoords.w - 100) + "px";
	div.style.top = parseInt(marchCoords.y + marchCoords.h) + "px";
	div.innerHTML = '<span class="strokeText" id="estRemaining"></span>';
	document.getElementById("tempDiv").appendChild(div);
	updateProgress();
}

function updateProgress() {
	if (inProgress) {
		fetch(host + url + endpoint)
			.then((response) => response.json())
			.then((data) => {
				var estimate =
					Math.round(data.progress * 100) +
					"% :: " +
					Math.floor(data.eta_relative) +
					" sec.";

				document.getElementById("estRemaining").innerText = estimate;
			});
		setTimeout(updateProgress, 500);
	}
}

function mouseMove(evt) {
	const rect = ovCanvas.getBoundingClientRect(); // not-quite pixel offset was driving me insane
	const canvasOffsetX = rect.left;
	const canvasOffsetY = rect.top;
	heldButton = evt.buttons;
	mouseXInfo.innerText = mouseX = evt.clientX;
	mouseYInfo.innerText = mouseY = evt.clientY;
	canvasXInfo.innerText = canvasX = parseInt(evt.clientX - rect.left);
	canvasYInfo.innerText = canvasY = parseInt(evt.clientY - rect.top);
	snapXInfo.innerText = canvasX + snap(canvasX);
	snapYInfo.innerText = canvasY + snap(canvasY);
	heldButtonInfo.innerText = heldButton;
	ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height); // clear out the previous mouse cursor
	if (placingArbitraryImage) {
		// ugh refactor so this isn't duplicated between arbitrary image and dream reticle modes
		snapOffsetX = 0;
		snapOffsetY = 0;
		if (snapToGrid) {
			snapOffsetX = snap(canvasX, false);
			snapOffsetY = snap(canvasY, false);
		}
		finalX = snapOffsetX + canvasX;
		finalY = snapOffsetY + canvasY;
		ovCtx.drawImage(arbitraryImage, finalX, finalY);
	} else if (!paintMode) {
		// draw targeting square reticle thingy cursor
		ovCtx.strokeStyle = "#FFFFFF";
		snapOffsetX = 0;
		snapOffsetY = 0;
		if (snapToGrid) {
			snapOffsetX = snap(canvasX);
			snapOffsetY = snap(canvasY);
		}
		finalX = snapOffsetX + canvasX;
		finalY = snapOffsetY + canvasY;
		ovCtx.strokeRect(
			parseInt(finalX - (basePixelCount * scaleFactor) / 2),
			parseInt(finalY - (basePixelCount * scaleFactor) / 2),
			basePixelCount * scaleFactor,
			basePixelCount * scaleFactor
		); //origin is middle of the frame
	}
}

/**
 * Mask implementation
 */
mouse.listen.canvas.onmousemove.on((evn) => {
	if (paintMode && evn.target.id === "overlayCanvas") {
		// draw big translucent red blob cursor
		ovCtx.beginPath();
		ovCtx.arc(evn.x, evn.y, 4 * scaleFactor, 0, 2 * Math.PI, true); // for some reason 4x on an arc is === to 8x on a line???
		ovCtx.fillStyle = "#FF6A6A50";
		ovCtx.fill();
	}
});

mouse.listen.canvas.left.onpaint.on((evn) => {
	if (paintMode && evn.initialTarget.id === "overlayCanvas") {
		maskPaintCtx.globalCompositeOperation = "source-over";
		maskPaintCtx.strokeStyle = "#FF6A6A";

		maskPaintCtx.lineWidth = 8 * scaleFactor;
		maskPaintCtx.beginPath();
		maskPaintCtx.moveTo(evn.px, evn.py);
		maskPaintCtx.lineTo(evn.x, evn.y);
		maskPaintCtx.lineJoin = maskPaintCtx.lineCap = "round";
		maskPaintCtx.stroke();
	}
});

mouse.listen.canvas.right.onpaint.on((evn) => {
	if (paintMode && evn.initialTarget.id === "overlayCanvas") {
		maskPaintCtx.globalCompositeOperation = "destination-out";
		maskPaintCtx.strokeStyle = "#FFFFFFFF";

		maskPaintCtx.lineWidth = 8 * scaleFactor;
		maskPaintCtx.beginPath();
		maskPaintCtx.moveTo(evn.px, evn.py);
		maskPaintCtx.lineTo(evn.x, evn.y);
		maskPaintCtx.lineJoin = maskPaintCtx.lineCap = "round";
		maskPaintCtx.stroke();
	}
});

function mouseDown(evt) {
	const rect = ovCanvas.getBoundingClientRect();
	var oddOffset = 0;
	if (scaleFactor % 2 != 0) {
		oddOffset = basePixelCount / 2;
	}
	if (evt.button == 0) {
		// left click
		if (placingArbitraryImage) {
			var nextBox = {};
			nextBox.x = evt.offsetX;
			nextBox.y = evt.offsetY;
			nextBox.w = arbitraryImageData.width;
			nextBox.h = arbitraryImageData.height;
			dropTargets.push(nextBox);
		} else if (!paintMode) {
			//const rect = ovCanvas.getBoundingClientRect()
			var nextBox = {};
			nextBox.x =
				evt.clientX -
				(basePixelCount * scaleFactor) / 2 -
				rect.left +
				oddOffset; //origin is middle of the frame
			nextBox.y =
				evt.clientY - (basePixelCount * scaleFactor) / 2 - rect.top + oddOffset; //TODO make a way to set the origin to numpad dirs?
			nextBox.w = basePixelCount * scaleFactor;
			nextBox.h = basePixelCount * scaleFactor;
			drawTargets.push(nextBox);
		}
	} else if (evt.button == 2) {
		if (enableErasing && !paintMode) {
			// right click, also gotta make sure mask blob isn't being used as it's visually inconsistent with behavior of erased region
			ctx = imgCanvas.getContext("2d");
			if (snapToGrid) {
				ctx.clearRect(
					canvasX + snap(canvasX) - (basePixelCount * scaleFactor) / 2,
					canvasY + snap(canvasY) - (basePixelCount * scaleFactor) / 2,
					basePixelCount * scaleFactor,
					basePixelCount * scaleFactor
				);
			} else {
				ctx.clearRect(
					canvasX - (basePixelCount * scaleFactor) / 2,
					canvasY - (basePixelCount * scaleFactor) / 2,
					basePixelCount * scaleFactor,
					basePixelCount * scaleFactor
				);
			}
		}
	}
}

function mouseUp(evt) {
	if (evt.button == 0) {
		// left click
		if (placingArbitraryImage) {
			// jeez i REALLY need to refactor tons of this to not be duplicated all over, that's definitely my next chore after figuring out that razza frazza overmask fade
			var target = dropTargets[dropTargets.length - 1]; //get the last one... why am i storing all of them?
			snapOffsetX = 0;
			snapOffsetY = 0;
			if (snapToGrid) {
				snapOffsetX = snap(target.x, false);
				snapOffsetY = snap(target.y, false);
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
				marching = inProgress = true;
				var drawIt = {}; //why am i doing this????
				var target = drawTargets[drawTargets.length - 1]; //get the last one... why am i storing all of them?
				var oddOffset = 0;
				if (scaleFactor % 2 != 0) {
					oddOffset = basePixelCount / 2;
				}
				snapOffsetX = 0;
				snapOffsetY = 0;
				if (snapToGrid) {
					snapOffsetX = snap(target.x);
					snapOffsetY = snap(target.y);
				}
				finalX = snapOffsetX + target.x - oddOffset;
				finalY = snapOffsetY + target.y - oddOffset;

				drawThis.x = marchCoords.x = finalX;
				drawThis.y = marchCoords.y = finalY;
				drawThis.w = marchCoords.w = target.w;
				drawThis.h = marchCoords.h = target.h;
				march(finalX, finalY, target.w, target.h);
				drawIt = drawThis; //TODO this is WRONG but also explicitly only draws the last image  ... i think
				//check if there's image data already there
				// console.log(downX + ":" + downY + " :: " + this.isCanvasBlank(downX, downY));
				if (!isCanvasBlank(drawIt.x, drawIt.y, drawIt.w, drawIt.h, imgCanvas)) {
					// image exists, set up for img2img
					var mainCanvasCtx = document
						.getElementById("canvas")
						.getContext("2d");
					const imgChunk = mainCanvasCtx.getImageData(
						drawIt.x,
						drawIt.y,
						drawIt.w,
						drawIt.h
					); // imagedata object of the image being outpainted
					const imgChunkData = imgChunk.data; // imagedata.data object, a big inconvenient uint8clampedarray
					// these are the 3 mask monitors on the bottom of the page
					var initImgCanvas = document.getElementById("initImgCanvasMonitor");
					var overMaskCanvas = document.getElementById("overMaskCanvasMonitor");
					overMaskCanvas.width = initImgCanvas.width = target.w; //maskCanvas.width = target.w;
					overMaskCanvas.height = initImgCanvas.height = target.h; //maskCanvas.height = target.h;
					var initImgCanvasCtx = initImgCanvas.getContext("2d");
					var overMaskCanvasCtx = overMaskCanvas.getContext("2d");
					// get blank pixels to use as mask
					const initImgData = mainCanvasCtx.createImageData(drawIt.w, drawIt.h);
					let overMaskImgData = overMaskCanvasCtx.createImageData(
						drawIt.w,
						drawIt.h
					);
					// cover entire masks in black before adding masked areas

					for (let i = 0; i < imgChunkData.length; i += 4) {
						// l->r, top->bottom, R G B A pixel values in a big ol array
						// make a simple mask
						if (imgChunkData[i + 3] == 0) {
							// rgba pixel values, 4th one is alpha, if it's 0 there's "nothing there" in the image display canvas and its time to outpaint
							overMaskImgData.data[i] = 255; // white mask gets painted over
							overMaskImgData.data[i + 1] = 255;
							overMaskImgData.data[i + 2] = 255;
							overMaskImgData.data[i + 3] = 255;

							initImgData.data[i] = 0; // null area on initial image becomes opaque black pixels
							initImgData.data[i + 1] = 0;
							initImgData.data[i + 2] = 0;
							initImgData.data[i + 3] = 255;
						} else {
							// leave these pixels alone
							overMaskImgData.data[i] = 0; // black mask gets ignored for in/outpainting
							overMaskImgData.data[i + 1] = 0;
							overMaskImgData.data[i + 2] = 0;
							overMaskImgData.data[i + 3] = 255; // but it still needs an opaque alpha channel

							initImgData.data[i] = imgChunkData[i]; // put the original picture back in the painted area
							initImgData.data[i + 1] = imgChunkData[i + 1];
							initImgData.data[i + 2] = imgChunkData[i + 2];
							initImgData.data[i + 3] = imgChunkData[i + 3]; //it's still RGBA so we can handily do this in nice chunks'o'4
						}
					}
					if (overMaskPx > 0) {
						// https://stackoverflow.com/a/30204783 ???? !!!!!!!!
						overMaskCanvasCtx.fillStyle = "black";
						overMaskCanvasCtx.fillRect(0, 0, drawIt.w, drawIt.h); // fill with black instead of null to start
						for (i = 0; i < overMaskImgData.data.length; i += 4) {
							if (overMaskImgData.data[i] == 255) {
								// white pixel?
								// just blotch all over the thing
								var rando = Math.floor(Math.random() * overMaskPx);
								overMaskCanvasCtx.beginPath();
								overMaskCanvasCtx.arc(
									(i / 4) % overMaskCanvas.width,
									Math.floor(i / 4 / overMaskCanvas.width),
									scaleFactor + rando, // was 4 * sf + rando, too big
									0,
									2 * Math.PI,
									true
								);
								overMaskCanvasCtx.fillStyle = "#FFFFFFFF";
								overMaskCanvasCtx.fill();
							}
						}
						overMaskImgData = overMaskCanvasCtx.getImageData(
							0,
							0,
							overMaskCanvas.width,
							overMaskCanvas.height
						);
						overMaskCanvasCtx.putImageData(overMaskImgData, 0, 0);
					}
					// also check for painted masks in region, add them as white pixels to mask canvas
					const maskChunk = maskPaintCtx.getImageData(
						drawIt.x,
						drawIt.y,
						drawIt.w,
						drawIt.h
					);
					const maskChunkData = maskChunk.data;
					for (let i = 0; i < maskChunkData.length; i += 4) {
						if (maskChunkData[i + 3] != 0) {
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
					overMaskCanvasCtx.putImageData(overMaskImgData, 0, 0); // :pray:
					var overMaskBase64 = overMaskCanvas.toDataURL();
					initImgCanvasCtx.putImageData(initImgData, 0, 0);
					var initImgBase64 = initImgCanvas.toDataURL();
					// anyway all that to say NOW let's run img2img
					endpoint = "img2img";
					stableDiffusionData.mask = overMaskBase64;
					stableDiffusionData.init_images = [initImgBase64];
					// slightly more involved than txt2img
				} else {
					// time to run txt2img
					endpoint = "txt2img";
					// easy enough
				}
				stableDiffusionData.prompt = document.getElementById("prompt").value;
				stableDiffusionData.negative_prompt =
					document.getElementById("negPrompt").value;
				stableDiffusionData.width = drawIt.w;
				stableDiffusionData.height = drawIt.h;
				stableDiffusionData.firstphase_height = drawIt.h / 2;
				stableDiffusionData.firstphase_width = drawIt.w / 2;
				dream(drawIt.x, drawIt.y, stableDiffusionData);
			}
		}
	}
}

function changePaintMode() {
	paintMode = document.getElementById("cbxPaint").checked;
	clearTargetMask();
	ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
}

function changeEnableErasing() {
	// yeah because this is for the image layer
	enableErasing = document.getElementById("cbxEnableErasing").checked;
	localStorage.setItem("enable_erase", enableErasing);
}

function changeSampler() {
	if (!document.getElementById("samplerSelect").value == "") {
		// must be done, since before getSamplers is done, the options are empty
		console.log(document.getElementById("samplerSelect").value == "");
		stableDiffusionData.sampler_index =
			document.getElementById("samplerSelect").value;
		localStorage.setItem("sampler", stableDiffusionData.sampler_index);
	}
}

const changeCfgScale = sliderChangeHandlerFactory(
	"cfgScale",
	"cfgScaleTxt",
	"cfg_scale",
	7.0
);
const changeBatchSize = sliderChangeHandlerFactory(
	"batchSize",
	"batchSizeText",
	"batch_size",
	2
);
const changeBatchCount = sliderChangeHandlerFactory(
	"batchCount",
	"batchCountText",
	"n_iter",
	2
);
const changeScaleFactor = sliderChangeHandlerFactory(
	"scaleFactor",
	"scaleFactorTxt",
	"scaleFactor",
	8,
	(k, v) => (scaleFactor = v),
	(k) => scaleFactor
);
const changeSteps = sliderChangeHandlerFactory(
	"steps",
	"stepsTxt",
	"steps",
	30
);

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

function changeOverMaskPx() {
	overMaskPx = document.getElementById("overMaskPx").value;
	localStorage.setItem("overmask_px", overMaskPx);
}

function changeHiResFix() {
	stableDiffusionData.enable_hr = Boolean(
		document.getElementById("cbxHRFix").checked
	);
	localStorage.setItem("enable_hr", stableDiffusionData.enable_hr);
}

function isCanvasBlank(x, y, w, h, specifiedCanvas) {
	var canvas = document.getElementById(specifiedCanvas.id);
	return !canvas
		.getContext("2d")
		.getImageData(x, y, w, h)
		.data.some((channel) => channel !== 0);
}

function drawBackground() {
	// Checkerboard
	let darkTileColor = "#333";
	let lightTileColor = "#555";
	for (var x = 0; x < bgCanvas.width; x += 64) {
		for (var y = 0; y < bgCanvas.height; y += 64) {
			bgCtx.fillStyle = (x + y) % 128 === 0 ? lightTileColor : darkTileColor;
			bgCtx.fillRect(x, y, 64, 64);
		}
	}
}

function preloadImage() {
	// possible firefox-only bug?
	// attempt to prevent requesting a dream if double-clicking a selected image
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
			arbitraryImageData = imgCtx.getImageData(
				0,
				0,
				arbitraryImage.width,
				arbitraryImage.height
			); // can't use that to drawImage on a canvas...
			arbitraryImageBitmap = createImageBitmap(arbitraryImageData); // apparently that either... maybe just the raw image?
			arbitraryImageBase64 = imgCanvas.toDataURL();
			placingArbitraryImage = true;
			document.getElementById("overlayCanvas").onmousemove = mouseMove;
			document.getElementById("overlayCanvas").onmousedown = mouseDown;
			document.getElementById("overlayCanvas").onmouseup = mouseUp;
		};
		arbitraryImage.src = evt.target.result;
	};
	reader.readAsDataURL(file);
}

function downloadCanvas() {
	var link = document.createElement("a");
	link.download =
		new Date().toISOString().slice(0, 19).replace("T", " ").replace(":", " ") +
		" openOutpaint image.png";
	var croppedCanvas = cropCanvas(imgCanvas);
	if (croppedCanvas != null) {
		link.href = croppedCanvas.toDataURL("image/png");
		link.click();
	}
}

function cropCanvas(sourceCanvas) {
	var w = sourceCanvas.width;
	var h = sourceCanvas.height;
	var pix = {x: [], y: []};
	var imageData = sourceCanvas.getContext("2d").getImageData(0, 0, w, h);
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
	pix.x.sort(function (a, b) {
		return a - b;
	});
	pix.y.sort(function (a, b) {
		return a - b;
	});
	var n = pix.x.length - 1;
	w = pix.x[n] - pix.x[0] + 1;
	h = pix.y[n] - pix.y[0] + 1;
	// yup sure looks like it

	try {
		var cut = sourceCanvas
			.getContext("2d")
			.getImageData(pix.x[0], pix.y[0], w, h);
		var cutCanvas = document.createElement("canvas");
		cutCanvas.width = w;
		cutCanvas.height = h;
		cutCanvas.getContext("2d").putImageData(cut, 0, 0);
	} catch (ex) {
		// probably empty image
		//TODO confirm edge cases?
		cutCanvas = null;
	}
	return cutCanvas;
}

function checkIfWebuiIsRunning() {
	var url = document.getElementById("host").value + "/startup-events";
	fetch(url)
		.then((response) => {
			if (response.status == 200) {
				console.log("webui is running");
			}
		})
		.catch((error) => {
			alert(
				"WebUI doesnt seem to be running, please start it and try again\nCheck console for additional info\n" +
					error
			);
		});
}

function getUpscalers() {
	/*
	 so for some reason when upscalers request returns upscalers, the real-esrgan model names are incorrect, and need to be fetched from /sdapi/v1/realesrgan-models
	 also the realesrgan models returned are not all correct, extra fun!
	 LDSR seems to have problems so we dont add that either ->  RuntimeError: Number of dimensions of repeat dims can not be smaller than number of dimensions of tensor
	 need to figure out why that is, if you dont get this error then you can add it back in

	 Hacky way to get the correct list all in one go is to purposefully make an incorrect request, which then returns
	 { detail: "Invalid upscaler, needs to be on of these: None , Lanczos , Nearest , LDSR , BSRGAN , R-ESRGAN General 4xV3 , R-ESRGAN 4x+ Anime6B , ScuNET , ScuNET PSNR , SwinIR_4x" }
	 from which we can extract the correct list of upscalers
	*/

	// hacky way to get the correct list of upscalers
	var upscalerSelect = document.getElementById("upscalers");
	var extras_url =
		document.getElementById("host").value + "/sdapi/v1/extra-single-image/"; // endpoint for upscaling, needed for the hacky way to get the correct list of upscalers
	var empty_image = new Image(512, 512);
	empty_image.src =
		"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAFCAAAAABCAYAAAChpRsuAAAALklEQVR42u3BAQ0AAAgDoJvc6LeHAybtBgAAAAAAAAAAAAAAAAAAAAAAAAB47QD2wAJ/LnnqGgAAAABJRU5ErkJggg=="; //transparent pixel
	var purposefully_incorrect_data = {
		"resize-mode": 0, // 0 = just resize, 1 = crop and resize, 2 = resize and fill i assume based on theimg2img tabs options
		upscaling_resize: 2,
		upscaler_1: "fake_upscaler",
		image: empty_image.src,
	};

	fetch(extras_url, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify(purposefully_incorrect_data),
	})
		.then((response) => response.json())
		.then((data) => {
			console.log("purposefully_incorrect_data response, ignore above error");
			// result = purposefully_incorrect_data response: Invalid upscaler, needs to be on of these: None , Lanczos , Nearest , LDSR , BSRGAN , R-ESRGAN General 4xV3 , R-ESRGAN 4x+ Anime6B , ScuNET , ScuNET PSNR , SwinIR_4x
			let upscalers = data.detail.split(": ")[1].trim().split(" , "); // converting the result to a list of upscalers
			for (var i = 0; i < upscalers.length; i++) {
				// if(upscalers[i] == "LDSR") continue; // Skip LDSR, see reason in the first comment // readded because worksonmymachine.jpg but leaving it here in case of, uh, future disaster?
				var option = document.createElement("option");
				option.text = upscalers[i];
				option.value = upscalers[i];
				upscalerSelect.add(option);
			}
		});

	/* THE NON HACKY WAY THAT I SIMPLY COULD NOT GET TO PRODUCE A LIST WITHOUT NON WORKING UPSCALERS, FEEL FREE TO TRY AND FIGURE IT OUT

	var url = document.getElementById("host").value + "/sdapi/v1/upscalers";
	var realesrgan_url = document.getElementById("host").value + "/sdapi/v1/realesrgan-models";

	// get upscalers
	fetch(url)
		.then((response) => response.json())
		.then((data) => {
			console.log(data);

			for (var i = 0; i < data.length; i++) {
				var option = document.createElement("option");

				if (data[i].name.includes("ESRGAN") || data[i].name.includes("LDSR")) {
					continue;
				}
				option.text = data[i].name;
				upscalerSelect.add(option);
			}
		})
		.catch((error) => {
			alert(
				"Error getting upscalers, please check console for additional info\n" +
					error
			);
		});
	// fetch realesrgan models separately
	fetch(realesrgan_url)
		.then((response) => response.json())
		.then((data) => {
			var model = data;
			for(var i = 0; i < model.length; i++){
				let option = document.createElement("option");
				option.text = model[i].name;
				option.value = model[i].name;
				upscalerSelect.add(option);

			}
		
	})
	*/
}

async function getModels() {
	var modelSelect = document.getElementById("models");
	var url = document.getElementById("host").value + "/sdapi/v1/sd-models";
	await fetch(url)
		.then((response) => response.json())
		.then((data) => {
			//console.log(data); All models
			for (var i = 0; i < data.length; i++) {
				var option = document.createElement("option");
				option.text = data[i].model_name;
				option.value = data[i].title;
				modelSelect.add(option);
			}
		});

	/* 	To get the current model, we might need to call /config/ which returns a json file with EVERYTHING from the webui, 25k lines of json... i havent figured out any other way to get the model thats loaded
		response >> components >> second component(quicksettings with checkpoint chooser as default) >> value = the current model
		The current model we get only updates on full restart of WebUI, so if we change the model, and then refresh the page, it will still show the old model.
		We could just not show the current model, but i think it would be nice to show it.
	*/
	await fetch(document.getElementById("host").value + "/config/")
		.then((response) => response.json())
		.then((data) => {
			//console.log(data)
			var model = data.components[1].props.value;
			console.log("Current model: " + model);
			modelSelect.value = model;
		});
}

function changeModel() {
	// change the model
	console.log("changing model to " + document.getElementById("models").value);
	var model_title = document.getElementById("models").value;
	var payload = {
		sd_model_checkpoint: model_title,
	};
	var url = document.getElementById("host").value + "/sdapi/v1/options/";
	fetch(url, {
		method: "POST",
		mode: "cors", // no-cors, *cors, same-origin
		cache: "default", // *default, no-cache, reload, force-cache, only-if-cached
		credentials: "same-origin", // include, *same-origin, omit
		redirect: "follow", // manual, *follow, error
		referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	})
		.then((response) => response.json())
		.then(() => {
			alert("Model changed to " + model_title);
		})
		.catch((error) => {
			alert(
				"Error changing model, please check console for additional info\n" +
					error
			);
		});
}

function getSamplers() {
	var samplerSelect = document.getElementById("samplerSelect");
	var url = document.getElementById("host").value + "/sdapi/v1/samplers";
	fetch(url)
		.then((response) => response.json())
		.then((data) => {
			//console.log(data); All samplers
			for (var i = 0; i < data.length; i++) {
				// PLMS SAMPLER DOES NOT WORK FOR ANY IMAGES BEYOND FOR THE INITIAL IMAGE (for me at least), GIVES ASGI Exception; AttributeError: 'PLMSSampler' object has no attribute 'stochastic_encode'

				var option = document.createElement("option");
				option.text = data[i].name;
				option.value = data[i].name;
				samplerSelect.add(option);
			}
			if (localStorage.getItem("sampler") != null) {
				samplerSelect.value = localStorage.getItem("sampler");
			} else {
				// needed now, as hardcoded sampler cant be guaranteed to be in the list
				samplerSelect.value = data[0].name;
				localStorage.setItem("sampler", samplerSelect.value);
			}
		})
		.catch((error) => {
			alert(
				"Error getting samplers, please check console for additional info\n" +
					error
			);
		});
}
async function upscaleAndDownload() {
	// Future improvements: some upscalers take a while to upscale, so we should show a loading bar or something, also a slider for the upscale amount

	// get cropped canvas, send it to upscaler, download result
	var upscale_factor = 2; // TODO: make this a user input 1.x - 4.0 or something
	var upscaler = document.getElementById("upscalers").value;
	var croppedCanvas = cropCanvas(imgCanvas);
	if (croppedCanvas != null) {
		var upscaler = document.getElementById("upscalers").value;
		var url =
			document.getElementById("host").value + "/sdapi/v1/extra-single-image/";
		var imgdata = croppedCanvas.toDataURL("image/png");
		var data = {
			"resize-mode": 0, // 0 = just resize, 1 = crop and resize, 2 = resize and fill i assume based on theimg2img tabs options
			upscaling_resize: upscale_factor,
			upscaler_1: upscaler,
			image: imgdata,
		};
		console.log(data);
		await fetch(url, {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify(data),
		})
			.then((response) => response.json())
			.then((data) => {
				console.log(data);
				var link = document.createElement("a");
				link.download =
					new Date()
						.toISOString()
						.slice(0, 19)
						.replace("T", " ")
						.replace(":", " ") +
					" openOutpaint image upscaler_" +
					upscaler +
					".png";
				link.href = "data:image/png;base64," + data["image"];
				link.click();
			});
	}
}

function loadSettings() {
	// set default values if not set
	var _sampler =
		localStorage.getItem("sampler") == null
			? "DDIM"
			: localStorage.getItem("sampler");
	var _mask_blur =
		localStorage.getItem("mask_blur") == null
			? 0
			: localStorage.getItem("mask_blur");
	var _seed =
		localStorage.getItem("seed") == null ? -1 : localStorage.getItem("seed");
	var _enable_hr = Boolean(
		localStorage.getItem("enable_hr") == (null || "false")
			? false
			: localStorage.getItem("enable_hr")
	);
	var _enable_erase = Boolean(
		localStorage.getItem("enable_erase") == (null || "false")
			? false
			: localStorage.getItem("enable_erase")
	);
	var _overmask_px =
		localStorage.getItem("overmask_px") == null
			? 0
			: localStorage.getItem("overmask_px");

	// set the values into the UI
	document.getElementById("samplerSelect").value = String(_sampler);
	document.getElementById("maskBlur").value = Number(_mask_blur);
	document.getElementById("seed").value = Number(_seed);
	document.getElementById("cbxHRFix").checked = Boolean(_enable_hr);
	document.getElementById("cbxEnableErasing").checked = Boolean(_enable_erase);
	document.getElementById("overMaskPx").value = Number(_overmask_px);
}

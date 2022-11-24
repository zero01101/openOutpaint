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
const basePixelCount = 64; //64 px - ALWAYS 64 PX
var scaleFactor = 8; //x64 px
var snapToGrid = true;
var backupMaskPaintCanvas; //???
var backupMaskPaintCtx; //...? look i am bad at this
var backupMaskChunk = null;
var backupMaskX = null;
var backupMaskY = null;
var totalImagesReturned;
var overMaskPx = 0;
var drawTargets = []; // is this needed?  i only draw the last one anyway...
var dropTargets = []; // uhhh yeah similar to the above but for arbitrary dropped images
var arbitraryImage;
var arbitraryImageData;
var arbitraryImageBitmap;
var arbitraryImageBase64; // seriously js cmon work with me here
var placingArbitraryImage = false; // for when the user has loaded an existing image from their computer
var marchOffset = 0;
var stopMarching = null;
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
	changeSampler();
	changeSnapMode();
	changeMaskBlur();
	changeSeed();
	changeOverMaskPx();
	changeHiResFix();
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

function dream(
	x,
	y,
	prompt,
	extra = {
		method: endpoint,
		stopMarching: () => {},
		bb: {x, y, w: prompt.width, h: prompt.height},
	}
) {
	tmpImgXYWH.x = x;
	tmpImgXYWH.y = y;
	tmpImgXYWH.w = prompt.width;
	tmpImgXYWH.h = prompt.height;
	console.log(
		"dreaming to " +
			host +
			url +
			(extra.method || endpoint) +
			":\r\n" +
			JSON.stringify(prompt)
	);
	console.info(`dreaming "${prompt.prompt}"`);
	console.debug(prompt);

	// Start checking for progress
	const progressCheck = checkProgress(extra.bb);
	postData(prompt, extra)
		.then((data) => {
			returnedImages = data.images;
			totalImagesReturned = data.images.length;
			blockNewImages = true;
			//console.log(data); // JSON data parsed by `data.json()` call
			imageAcceptReject(x, y, data, extra);
		})
		.finally(() => clearInterval(progressCheck));
}

async function postData(promptData, extra = null) {
	this.host = document.getElementById("host").value;
	// Default options are marked with *
	const response = await fetch(
		this.host + this.url + extra.method || endpoint,
		{
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
		}
	);
	return response.json(); // parses JSON response into native JavaScript objects
}

function imageAcceptReject(x, y, data, extra = null) {
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
	stopMarching && stopMarching();
	stopMarching = null;
	clearBackupMask();
	placeImage();
	removeChoiceButtons();
	clearTargetMask();
	blockNewImages = false;
}

function reject(evt) {
	// remove image entirely
	stopMarching && stopMarching();
	stopMarching = null;
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

function march(bb) {
	let offset = 0;

	const interval = setInterval(() => {
		drawMarchingAnts(bb, offset++);
		offset %= 16;
	}, 20);

	return () => clearInterval(interval);
}

function drawMarchingAnts(bb, offset) {
	clearTargetMask();
	tgtCtx.strokeStyle = "#FFFFFFFF"; //"#55000077";
	tgtCtx.setLineDash([4, 2]);
	tgtCtx.lineDashOffset = -offset;
	tgtCtx.strokeRect(bb.x, bb.y, bb.w, bb.h);
}

function checkProgress(bb) {
	document.getElementById("progressDiv") &&
		document.getElementById("progressDiv").remove();
	// Skip image to stop using a ton of networking resources
	endpoint = "progress?skip_current_image=true";
	var div = document.createElement("div");
	div.id = "progressDiv";
	div.style.position = "absolute";
	div.style.width = "200px";
	div.style.height = "70px";
	div.style.left = parseInt(bb.x + bb.w - 100) + "px";
	div.style.top = parseInt(bb.y + bb.h) + "px";
	div.innerHTML = '<span class="strokeText" id="estRemaining"></span>';
	document.getElementById("tempDiv").appendChild(div);
	return setInterval(() => {
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
	}, 1500);
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
	}
}

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
		}
	}
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

const makeSlider = (
	label,
	el,
	lsKey,
	min,
	max,
	step,
	defaultValue,
	valuecb = null
) => {
	const local = localStorage.getItem(lsKey);
	const def = parseFloat(local === null ? defaultValue : local);
	return createSlider(label, el, {
		valuecb:
			valuecb ||
			((v) => {
				stableDiffusionData[lsKey] = v;
				localStorage.setItem(lsKey, v);
			}),
		min,
		max,
		step,
		defaultValue: def,
	});
};

makeSlider(
	"CFG Scale",
	document.getElementById("cfgScale"),
	"cfg_scale",
	-1,
	25,
	0.5,
	7.0
);
makeSlider(
	"Batch Size",
	document.getElementById("batchSize"),
	"batch_size",
	1,
	8,
	1,
	2
);
makeSlider(
	"Iterations",
	document.getElementById("batchCount"),
	"n_iter",
	1,
	8,
	1,
	2
);
makeSlider(
	"Scale Factor",
	document.getElementById("scaleFactor"),
	"scale_factor",
	1,
	16,
	1,
	8,
	(v) => {
		scaleFactor = v;
	}
);

makeSlider("Steps", document.getElementById("steps"), "steps", 1, 70, 1, 30);

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
	// overMaskPx = document.getElementById("overMaskPx").value;
	// localStorage.setItem("overmask_px", overMaskPx);
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
	// document.getElementById("overMaskPx").value = Number(_overmask_px);
}

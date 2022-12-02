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
	styles: [],
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
let debug = false;
var returnedImages;
var imageIndex = 0;
var tmpImgXYWH = {};
var host = "";
var url = "/sdapi/v1/";
var endpoint = "txt2img";
var frameX = 512;
var frameY = 512;
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
var inProgress = false;
var marchCoords = {};

//
function startup() {
	testHostConfiguration();
	loadSettings();

	const hostEl = document.getElementById("host");
	testHostConnection().then((checkConnection) => {
		hostEl.onchange = () => {
			host = hostEl.value.endsWith("/")
				? hostEl.value.substring(0, hostEl.value.length - 1)
				: hostEl.value;
			hostEl.value = host;
			localStorage.setItem("host", host);
			checkConnection();
		};
	});

	const promptEl = document.getElementById("prompt");
	promptEl.oninput = () => {
		stableDiffusionData.prompt = promptEl.value;
		promptEl.title = promptEl.value;
		localStorage.setItem("prompt", stableDiffusionData.prompt);
	};

	const negPromptEl = document.getElementById("negPrompt");
	negPromptEl.oninput = () => {
		stableDiffusionData.negative_prompt = negPromptEl.value;
		negPromptEl.title = negPromptEl.value;
		localStorage.setItem("neg_prompt", stableDiffusionData.negative_prompt);
	};

	drawBackground();
	changeSampler();
	changeMaskBlur();
	changeSeed();
	changeOverMaskPx();
	changeHiResFix();
	document.getElementById("scaleFactor").value = scaleFactor;
}

/**
 * Initial connection checks
 */
function testHostConfiguration() {
	/**
	 * Check host configuration
	 */
	const hostEl = document.getElementById("host");
	hostEl.value = localStorage.getItem("host");

	const requestHost = (prompt, def = "http://127.0.0.1:7860") => {
		let value = window.prompt(prompt, def);
		if (value === null) value = "http://127.0.0.1:7860";

		value = value.endsWith("/") ? value.substring(0, value.length - 1) : value;
		host = value;
		hostEl.value = host;
		localStorage.setItem("host", host);

		testHostConfiguration();
	};

	const current = localStorage.getItem("host");
	if (current) {
		if (!current.match(/^https?:\/\/[a-z0-9][a-z0-9.]+[a-z0-9](:[0-9]+)?$/i))
			requestHost(
				"Host seems to be invalid! Please fix your host here:",
				current
			);
		else
			host = current.endsWith("/")
				? current.substring(0, current.length - 1)
				: current;
	} else {
		requestHost(
			"This seems to be the first time you are using openOutpaint! Please set your host here:"
		);
	}
}

async function testHostConnection() {
	class CheckInProgressError extends Error {}

	const connectionIndicator = document.getElementById(
		"connection-status-indicator"
	);

	let connectionStatus = false;
	let firstTimeOnline = true;

	const setConnectionStatus = (status) => {
		const connectionIndicatorText = document.getElementById(
			"connection-status-indicator-text"
		);

		const statuses = {
			online: () => {
				connectionIndicator.classList.add("online");
				connectionIndicator.classList.remove(
					"cors-issue",
					"offline",
					"before",
					"server-error"
				);
				connectionIndicatorText.textContent = connectionIndicator.title =
					"Connected";
				connectionStatus = true;
			},
			error: () => {
				connectionIndicator.classList.add("server-error");
				connectionIndicator.classList.remove(
					"online",
					"offline",
					"before",
					"cors-issue"
				);
				connectionIndicatorText.textContent = "Error";
				connectionIndicator.title =
					"Server is online, but is returning an error response";
				connectionStatus = false;
			},
			corsissue: () => {
				connectionIndicator.classList.add("cors-issue");
				connectionIndicator.classList.remove(
					"online",
					"offline",
					"before",
					"server-error"
				);
				connectionIndicatorText.textContent = "CORS";
				connectionIndicator.title =
					"Server is online, but CORS is blocking our requests";
				connectionStatus = false;
			},
			offline: () => {
				connectionIndicator.classList.add("offline");
				connectionIndicator.classList.remove(
					"cors-issue",
					"online",
					"before",
					"server-error"
				);
				connectionIndicatorText.textContent = "Offline";
				connectionIndicator.title =
					"Server seems to be offline. Please check the console for more information.";
				connectionStatus = false;
			},
			before: () => {
				connectionIndicator.classList.add("before");
				connectionIndicator.classList.remove(
					"cors-issue",
					"online",
					"offline",
					"server-error"
				);
				connectionIndicatorText.textContent = "Waiting";
				connectionIndicator.title = "Waiting for check to complete.";
				connectionStatus = false;
			},
		};

		statuses[status] && statuses[status]();
	};

	setConnectionStatus("before");

	let checkInProgress = false;

	const checkConnection = async (notify = false) => {
		if (checkInProgress)
			throw new CheckInProgressError(
				"Check is currently in progress, please try again"
			);
		checkInProgress = true;
		var url = document.getElementById("host").value + "/startup-events";
		// Attempt normal request
		try {
			/** @type {Response} */
			const response = await fetch(url, {
				signal: AbortSignal.timeout(5000),
			});

			if (response.status === 200) {
				setConnectionStatus("online");
				// Load data as soon as connection is first stablished
				if (firstTimeOnline) {
					getStyles();
					getSamplers();
					getUpscalers();
					getModels();
					firstTimeOnline = false;
				}
			} else {
				setConnectionStatus("error");
				const message = `Server responded with ${response.status} - ${response.statusText}. Try running the webui with the flag '--api'`;
				console.error(message);
				if (notify) alert(message);
			}
		} catch (e) {
			try {
				if (e instanceof DOMException) throw "offline";
				// Tests if problem is CORS
				await fetch(url, {mode: "no-cors"});

				setConnectionStatus("corsissue");
				const message = `CORS is blocking our requests. Try running the webui with the flag '--cors-allow-origins=${window.location.protocol}//${window.location.host}/'`;
				console.error(message);
				if (notify) alert(message);
			} catch (e) {
				setConnectionStatus("offline");
				const message = `The server seems to be offline. Is host '${
					document.getElementById("host").value
				}' correct?`;
				console.error(message);
				if (notify) alert(message);
			}
		}
		checkInProgress = false;
		return status;
	};

	await checkConnection(true);

	// On click, attempt to refresh
	connectionIndicator.onclick = async () => {
		try {
			await checkConnection(true);
			checked = true;
		} catch (e) {
			console.debug("Already refreshing");
		}
	};

	// Checks every 5 seconds if offline, 30 seconds if online
	const checkAgain = () => {
		setTimeout(
			async () => {
				await checkConnection();
				checkAgain();
			},
			connectionStatus ? 30000 : 5000
		);
	};

	checkAgain();

	return () => {
		checkConnection().catch(() => {});
	};
}

function newImage(evt) {
	clearPaintedMask();
	clearBackupMask();
	commands.runCommand("eraseImage", "Clear Canvas", {
		x: 0,
		y: 0,
		w: imgCanvas.width,
		h: imgCanvas.height,
	});
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

function backupAndClearMask(x, y, w, h) {
	var clearArea = maskPaintCtx.createImageData(w, h);
	backupMaskChunk = maskPaintCtx.getImageData(x, y, w, h);
	backupMaskX = x;
	backupMaskY = y;
	var clearD = clearArea.data;
	for (i = 0; i < clearD.length; i += 4) {
		clearD[i] = 0;
		clearD[i + 1] = 0;
		clearD[i + 2] = 0;
		clearD[i + 3] = 0;
	}
	maskPaintCtx.putImageData(clearArea, x, y);
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
	const expanded = {...bb};
	expanded.x--;
	expanded.y--;
	expanded.w += 2;
	expanded.h += 2;

	// Get temporary layer to draw marching ants
	const layer = imageCollection.registerLayer(null, {
		bb: expanded,
	});
	layer.canvas.style.imageRendering = "pixelated";
	let offset = 0;

	const interval = setInterval(() => {
		drawMarchingAnts(layer.ctx, bb, offset++);
		offset %= 12;
	}, 20);

	return () => {
		clearInterval(interval);
		imageCollection.deleteLayer(layer);
	};
}

function drawMarchingAnts(ctx, bb, offset) {
	ctx.clearRect(0, 0, bb.w + 2, bb.h + 2);
	ctx.strokeStyle = "#FFFFFFFF"; //"#55000077";
	ctx.strokeWidth = "2px";
	ctx.setLineDash([4, 2]);
	ctx.lineDashOffset = -offset;
	ctx.strokeRect(1, 1, bb.w, bb.h);
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
	stableDiffusionData.mask_blur = parseInt(
		document.getElementById("maskBlur").value
	);
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
	for (var x = 0; x < bgLayer.canvas.width; x += 64) {
		for (var y = 0; y < bgLayer.canvas.height; y += 64) {
			bgLayer.ctx.fillStyle =
				(x + y) % 128 === 0 ? lightTileColor : darkTileColor;
			bgLayer.ctx.fillRect(x, y, 64, 64);
		}
	}
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

	// get currently loaded model

	await fetch(document.getElementById("host").value + "/sdapi/v1/options")
		.then((response) => response.json())
		.then((data) => {
			var model = data.sd_model_checkpoint;
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

async function getStyles() {
	/** @type {HTMLSelectElement} */
	var styleSelect = document.getElementById("styleSelect");
	var url = document.getElementById("host").value + "/sdapi/v1/prompt-styles";
	try {
		const response = await fetch(url);
		/** @type {{name: string, prompt: string, negative_prompt: string}[]} */
		const data = await response.json();

		/** @type {string[]} */
		let stored = null;
		try {
			stored = JSON.parse(localStorage.getItem("promptStyle"));
			// doesn't seem to throw a syntaxerror if the localstorage item simply doesn't exist?
			if (stored == null) stored = [];
		} catch (e) {
			stored = [];
		}

		data.forEach((style) => {
			const option = document.createElement("option");
			option.classList.add("style-select-option");
			option.text = style.name;
			option.value = style.name != "None" ? style.name : "";
			option.title = `prompt: ${style.prompt}\nnegative: ${style.negative_prompt}`;
			option.selected = !!stored.find((styleName) => style.name === styleName);
			styleSelect.add(option);
		});

		changeStyles();

		stored.forEach((styleName, index) => {
			if (!data.findIndex((style) => style.name === styleName)) {
				stored.splice(index, 1);
			}
		});
		localStorage.setItem("promptStyle", JSON.stringify(stored));
	} catch (e) {
		console.warn("[index] Failed to fetch prompt styles");
		console.warn(e);
	}
}

function changeStyles() {
	/** @type {HTMLSelectElement} */
	const styleSelectEl = document.getElementById("styleSelect");
	const selected = Array.from(styleSelectEl.options).filter(
		(option) => option.selected
	);
	const selectedString = selected.map((option) => option.value);

	selectedString != ""
		? localStorage.setItem("promptStyle", JSON.stringify(selectedString))
		: localStorage.setItem("promptStyle", "[]");

	// change the model
	console.log(`[index] Changing styles to ${selectedString.join(", ")}`);
	stableDiffusionData.styles = selectedString;
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
		var imgdata = croppedCanvas.canvas.toDataURL("image/png");
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
	var _prompt =
		localStorage.getItem("prompt") == null
			? "ocean floor scientific expedition, underwater wildlife"
			: localStorage.getItem("prompt");
	var _negprompt =
		localStorage.getItem("neg_prompt") == null
			? "people, person, humans, human, divers, diver, glitch, error, text, watermark, bad quality, blurry"
			: localStorage.getItem("neg_prompt");
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
	document.getElementById("prompt").value = String(_prompt);
	document.getElementById("prompt").title = String(_prompt);
	document.getElementById("negPrompt").value = String(_negprompt);
	document.getElementById("negPrompt").title = String(_negprompt);
	document.getElementById("samplerSelect").value = String(_sampler);
	document.getElementById("maskBlur").value = Number(_mask_blur);
	document.getElementById("seed").value = Number(_seed);
	document.getElementById("cbxHRFix").checked = Boolean(_enable_hr);
	// document.getElementById("overMaskPx").value = Number(_overmask_px);
}

imageCollection.element.addEventListener(
	"wheel",
	(evn) => {
		evn.preventDefault();
	},
	{passive: false}
);

imageCollection.element.addEventListener(
	"contextmenu",
	(evn) => {
		evn.preventDefault();
	},
	{passive: false}
);

function resetToDefaults() {
	if (confirm("Are you sure you want to clear your settings?")) {
		localStorage.clear();
	}
}

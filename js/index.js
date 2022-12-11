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
	changeMaskBlur();
	changeSmoothRendering();
	changeSeed();
	changeHiResFix();
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
					"webui-issue",
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
					"webui-issue"
				);
				connectionIndicatorText.textContent = "Error";
				connectionIndicator.title =
					"Server is online, but is returning an error response";
				connectionStatus = false;
			},
			corsissue: () => {
				connectionIndicator.classList.add("webui-issue");
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
			apiissue: () => {
				connectionIndicator.classList.add("webui-issue");
				connectionIndicator.classList.remove(
					"online",
					"offline",
					"before",
					"server-error"
				);
				connectionIndicatorText.textContent = "API";
				connectionIndicator.title =
					"Server is online, but the API seems to be disabled";
				connectionStatus = false;
			},
			offline: () => {
				connectionIndicator.classList.add("offline");
				connectionIndicator.classList.remove(
					"webui-issue",
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
					"webui-issue",
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
			// Check if API is available
			const response = await fetch(
				document.getElementById("host").value + "/sdapi/v1/options",
				{method: "OPTIONS"}
			);
			switch (response.status) {
				case 200: {
					setConnectionStatus("online");
					// Load data as soon as connection is first stablished
					if (firstTimeOnline) {
						getConfig();
						getStyles();
						getSamplers();
						getUpscalers();
						getModels();
						firstTimeOnline = false;
					}
					break;
				}
				case 404: {
					setConnectionStatus("apiissue");
					const message = `The host is online, but the API seems to be disabled. Have you run the webui with the flag --api?`;
					console.error(message);
					if (notify) alert(message);
					break;
				}
				default: {
					setConnectionStatus("offline");
					const message = `The host is online, but the API seems to be disabled. Have you run the webui with the flag --api?`;
					console.error(message);
					if (notify) alert(message);
				}
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
	uil.layers.forEach(({layer}) => {
		commands.runCommand("eraseImage", "Clear Canvas", {
			x: 0,
			y: 0,
			w: layer.canvas.width,
			h: layer.canvas.height,
			ctx: layer.ctx,
		});
	});
}

function clearPaintedMask() {
	maskPaintCtx.clearRect(0, 0, maskPaintCanvas.width, maskPaintCanvas.height);
}

function march(bb, options = {}) {
	defaultOpt(options, {
		style: "#FFFF",
		width: "2px",
		filter: null,
	});

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
		drawMarchingAnts(layer.ctx, bb, offset++, options);
		offset %= 12;
	}, 20);

	return () => {
		clearInterval(interval);
		imageCollection.deleteLayer(layer);
	};
}

function drawMarchingAnts(ctx, bb, offset, options) {
	ctx.save();

	ctx.clearRect(0, 0, bb.w + 2, bb.h + 2);
	ctx.strokeStyle = options.style;
	ctx.strokeWidth = options.width;
	ctx.filter = options.filter;
	ctx.setLineDash([4, 2]);
	ctx.lineDashOffset = -offset;
	ctx.strokeRect(1, 1, bb.w, bb.h);

	ctx.restore();
}

const makeSlider = (
	label,
	el,
	lsKey,
	min,
	max,
	step,
	defaultValue,
	textStep = null,
	valuecb = null
) => {
	const local = lsKey && localStorage.getItem(lsKey);
	const def = parseFloat(local === null ? defaultValue : local);
	let cb = (v) => {
		stableDiffusionData[lsKey] = v;
		if (lsKey) localStorage.setItem(lsKey, v);
	};
	if (valuecb) {
		cb = (v) => {
			valuecb(v);
			localStorage.setItem(lsKey, v);
		};
	}
	return createSlider(label, el, {
		valuecb: cb,
		min,
		max,
		step,
		defaultValue: def,
		textStep,
	});
};

const modelAutoComplete = createAutoComplete(
	"Model",
	document.getElementById("models-ac-select")
);

const samplerAutoComplete = createAutoComplete(
	"Sampler",
	document.getElementById("sampler-ac-select")
);

const upscalerAutoComplete = createAutoComplete(
	"Upscaler",
	document.getElementById("upscaler-ac-select")
);

makeSlider(
	"Resolution",
	document.getElementById("resolution"),
	"resolution",
	64,
	1024,
	64,
	512,
	2,
	(v) => {
		stableDiffusionData.width = stableDiffusionData.height = v;
		stableDiffusionData.firstphase_width =
			stableDiffusionData.firstphase_height = v / 2;
	}
);
makeSlider(
	"CFG Scale",
	document.getElementById("cfgScale"),
	"cfg_scale",
	-1,
	25,
	0.5,
	7.0,
	0.1
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
	"Upscale X",
	document.getElementById("upscaleX"),
	"upscale_x",
	1.0,
	4.0,
	0.1,
	2.0,
	0.1
);

makeSlider("Steps", document.getElementById("steps"), "steps", 1, 70, 5, 30, 1);

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

function changeHiResFix() {
	stableDiffusionData.enable_hr = Boolean(
		document.getElementById("cbxHRFix").checked
	);
	localStorage.setItem("enable_hr", stableDiffusionData.enable_hr);
}
function changeSmoothRendering() {
	const layers = document.getElementById("layer-render");
	if (document.getElementById("cbxSmooth").checked) {
		layers.classList.remove("pixelated");
	} else {
		layers.classList.add("pixelated");
	}
}

function isCanvasBlank(x, y, w, h, canvas) {
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

async function getUpscalers() {
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
	var extras_url =
		document.getElementById("host").value + "/sdapi/v1/extra-single-image/"; // endpoint for upscaling, needed for the hacky way to get the correct list of upscalers
	var empty_image = new Image(1, 1);
	var purposefully_incorrect_data = {
		"resize-mode": 0, // 0 = just resize, 1 = crop and resize, 2 = resize and fill i assume based on theimg2img tabs options
		upscaling_resize: 2,
		upscaler_1: "fake_upscaler",
		image: empty_image.src,
	};

	try {
		const response = await fetch(extras_url, {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify(purposefully_incorrect_data),
		});
		const data = await response.json();

		console.log(
			"[index] purposefully_incorrect_data response, ignore above error"
		);
		// result = purposefully_incorrect_data response: Invalid upscaler, needs to be on of these: None , Lanczos , Nearest , LDSR , BSRGAN , R-ESRGAN General 4xV3 , R-ESRGAN 4x+ Anime6B , ScuNET , ScuNET PSNR , SwinIR_4x
		const upscalers = data.detail
			.split(": ")[1]
			.split(",")
			.map((v) => v.trim())
			.filter((v) => v !== "None"); // converting the result to a list of upscalers

		upscalerAutoComplete.options = upscalers.map((u) => {
			return {name: u, value: u};
		});

		upscalerAutoComplete.value = upscalers[0];
	} catch (e) {
		console.warn("[index] Failed to fetch upscalers:");
		console.warn(e);
	}

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
	var url = document.getElementById("host").value + "/sdapi/v1/sd-models";
	try {
		const response = await fetch(url);
		const data = await response.json();

		modelAutoComplete.options = data.map((option) => ({
			name: option.title,
			value: option.title,
		}));

		try {
			const optResponse = await fetch(
				document.getElementById("host").value + "/sdapi/v1/options"
			);
			const optData = await optResponse.json();

			const model = optData.sd_model_checkpoint;
			console.log("Current model: " + model);
			modelAutoComplete.value = model;
		} catch (e) {
			console.warn("[index] Failed to fetch current model:");
			console.warn(e);
		}
	} catch (e) {
		console.warn("[index] Failed to fetch models:");
		console.warn(e);
	}

	modelAutoComplete.onchange.on(async ({value}) => {
		console.log(`[index] Changing model to [${value}]`);
		var payload = {
			sd_model_checkpoint: value,
		};
		var url = document.getElementById("host").value + "/sdapi/v1/options/";
		try {
			await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			});

			alert(`Model changed to [${value}]`);
		} catch (e) {
			console.warn("[index] Error changing model");
			console.warn(e);

			alert(
				"Error changing model, please check console for additional information"
			);
		}
	});
}

async function getConfig() {
	var url = document.getElementById("host").value + "/sdapi/v1/options";

	let message =
		"The following options for the AUTOMATIC1111's webui are not recommended to use with this software:";

	try {
		const response = await fetch(url);

		const data = await response.json();

		let wrong = false;

		// Check if img2img color correction is disabled and inpainting mask weight is set to one
		// TODO: API Seems bugged for retrieving inpainting mask weight - returning 0 for all values different than 1.0
		if (data.img2img_color_correction) {
			message += "\n - Image to Image Color Correction: false recommended";
			wrong = true;
		}

		if (data.inpainting_mask_weight < 1.0) {
			message += `\n - Inpainting Conditioning Mask Strength: 1.0 recommended`;
			wrong = true;
		}

		message += "\n\nShould these values be changed to the recommended ones?";

		if (!wrong) {
			console.info("[index] WebUI Settings set as recommended.");
			return;
		}

		console.info(
			"[index] WebUI Settings not set as recommended. Prompting for changing settings automatically."
		);

		if (!confirm(message)) return;

		try {
			await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					img2img_color_correction: false,
					inpainting_mask_weight: 1.0,
				}),
			});
		} catch (e) {
			console.warn("[index] Failed to fetch WebUI Configuration");
			console.warn(e);
		}
	} catch (e) {
		console.warn("[index] Failed to fetch WebUI Configuration");
		console.warn(e);
	}
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
			option.value = style.name;
			option.title = `prompt: ${style.prompt}\nnegative: ${style.negative_prompt}`;
			if (stored.length === 0) option.selected = style.name === "None";
			else
				option.selected = !!stored.find(
					(styleName) => style.name === styleName
				);

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
	let selectedString = selected.map((option) => option.value);

	if (selectedString.find((selected) => selected === "None")) {
		selectedString = [];
		Array.from(styleSelectEl.options).forEach((option) => {
			if (option.value !== "None") option.selected = false;
		});
	}

	localStorage.setItem("promptStyle", JSON.stringify(selectedString));

	// change the model
	if (selectedString.length > 0)
		console.log(`[index] Changing styles to ${selectedString.join(", ")}`);
	else console.log(`[index] Clearing styles`);
	stableDiffusionData.styles = selectedString;
}

async function getSamplers() {
	var url = document.getElementById("host").value + "/sdapi/v1/samplers";

	try {
		const response = await fetch(url);
		const data = await response.json();
		samplerAutoComplete.options = data.map((sampler) => ({
			name: sampler.name,
			value: sampler.name,
		}));

		// Initial sampler
		if (localStorage.getItem("sampler") != null) {
			samplerAutoComplete.value = localStorage.getItem("sampler");
		} else {
			samplerAutoComplete.value = data[0].name;
			localStorage.setItem("sampler", samplerAutoComplete.value);
		}

		samplerAutoComplete.onchange.on(({value}) => {
			stableDiffusionData.sampler_index = value;
			localStorage.setItem("sampler", value);
		});
	} catch (e) {
		console.warn("[index] Failed to fetch samplers");
		console.warn(e);
	}
}
async function upscaleAndDownload() {
	// Future improvements: some upscalers take a while to upscale, so we should show a loading bar or something, also a slider for the upscale amount

	// get cropped canvas, send it to upscaler, download result
	var upscale_factor = localStorage.getItem("upscale_x")
		? localStorage.getItem("upscale_x")
		: 2;
	var upscaler = upscalerAutoComplete.value;
	var croppedCanvas = cropCanvas(
		uil.getVisible({
			x: 0,
			y: 0,
			w: imageCollection.size.w,
			h: imageCollection.size.h,
		})
	);
	if (croppedCanvas != null) {
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
					"_x" +
					upscale_factor +
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

	// set the values into the UI
	document.getElementById("prompt").value = String(_prompt);
	document.getElementById("prompt").title = String(_prompt);
	document.getElementById("negPrompt").value = String(_negprompt);
	document.getElementById("negPrompt").title = String(_negprompt);
	document.getElementById("maskBlur").value = Number(_mask_blur);
	document.getElementById("seed").value = Number(_seed);
	document.getElementById("cbxHRFix").checked = Boolean(_enable_hr);
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

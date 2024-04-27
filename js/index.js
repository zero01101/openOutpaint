//TODO FIND OUT WHY I HAVE TO RESIZE A TEXTBOX AND THEN START USING IT TO AVOID THE 1px WHITE LINE ON LEFT EDGES DURING IMG2IMG
//...lmao did setting min width 200 on info div fix that accidentally?  once the canvas is infinite and the menu bar is hideable it'll probably be a problem again

/**
 * Workaround for Firefox bug #733698
 *
 * https://bugzilla.mozilla.org/show_bug.cgi?id=733698
 *
 * Workaround by https://github.com/subzey on https://gist.github.com/subzey/2030480
 *
 * Replaces and handles NS_ERROR_FAILURE errors triggered by 733698.
 */
(function () {
	var FakeTextMetrics,
		proto,
		fontSetterNative,
		measureTextNative,
		fillTextNative,
		strokeTextNative;

	if (
		!window.CanvasRenderingContext2D ||
		!window.TextMetrics ||
		!(proto = window.CanvasRenderingContext2D.prototype) ||
		!proto.hasOwnProperty("font") ||
		!proto.hasOwnProperty("mozTextStyle") ||
		typeof proto.__lookupSetter__ !== "function" ||
		!(fontSetterNative = proto.__lookupSetter__("font"))
	) {
		return;
	}

	proto.__defineSetter__("font", function (value) {
		try {
			return fontSetterNative.call(this, value);
		} catch (e) {
			if (e.name !== "NS_ERROR_FAILURE") {
				throw e;
			}
		}
	});

	measureTextNative = proto.measureText;
	FakeTextMetrics = function () {
		this.width = 0;
		this.isFake = true;
		this.__proto__ = window.TextMetrics.prototype;
	};
	proto.measureText = function ($0) {
		try {
			return measureTextNative.apply(this, arguments);
		} catch (e) {
			if (e.name !== "NS_ERROR_FAILURE") {
				throw e;
			} else {
				return new FakeTextMetrics();
			}
		}
	};

	fillTextNative = proto.fillText;
	proto.fillText = function ($0, $1, $2, $3) {
		try {
			fillTextNative.apply(this, arguments);
		} catch (e) {
			if (e.name !== "NS_ERROR_FAILURE") {
				throw e;
			}
		}
	};

	strokeTextNative = proto.strokeText;
	proto.strokeText = function ($0, $1, $2, $3) {
		try {
			strokeTextNative.apply(this, arguments);
		} catch (e) {
			if (e.name !== "NS_ERROR_FAILURE") {
				throw e;
			}
		}
	};
})();

// Parse url parameters
const urlParams = new URLSearchParams(window.location.search);

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
	inpainting_fill: 1,
	outpainting_fill: 2,
	enable_hr: false,
	restore_faces: false,
	//firstphase_width: 0,
	//firstphase_height: 0, //20230102 welp looks like the entire way HRfix is implemented has become bonkersly different
	hr_scale: 2.0,
	hr_upscaler: "None",
	hr_second_pass_steps: 0,
	hr_resize_x: 0,
	hr_resize_y: 0,
	hr_square_aspect: false,
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
var host = "";
var url = "/sdapi/v1/";
const basePixelCount = 64; //64 px - ALWAYS 64 PX
var focused = true;
let defaultScripts = {};
let userScripts = {};

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
			localStorage.setItem("openoutpaint/host", host);
			checkConnection();
		};
	});

	drawBackground();
	changeMaskBlur();
	changeSmoothRendering();
	changeSeed();
	changeRefinerEnabled();
	changeHiResFix();
	changeHiResSquare();
	// changeRestoreFaces();
	changeSyncCursorSize();
	changeControlNetExtension();
	changeControlNetReference();
	checkFocus();
	refreshScripts();
}

function setFixedHost(h, changePromptMessage) {
	console.info(`[index] Fixed host to '${h}'`);
	const hostInput = document.getElementById("host");
	host = h;
	hostInput.value = h;
	hostInput.readOnly = true;
	hostInput.style.cursor = "default";
	hostInput.style.backgroundColor = "#ddd";
	hostInput.addEventListener("dblclick", async () => {
		if (await notifications.dialog("Host is Locked", changePromptMessage)) {
			hostInput.style.backgroundColor = null;
			hostInput.style.cursor = null;
			hostInput.readOnly = false;
			hostInput.focus();
		}
	});
}

/**
 * Initial connection checks
 */
function testHostConfiguration() {
	/**
	 * Check host configuration
	 */
	const hostEl = document.getElementById("host");
	hostEl.value = localStorage.getItem("openoutpaint/host");

	const requestHost = (prompt, def = "http://127.0.0.1:7860") => {
		let value = null;

		if (!urlParams.has("noprompt")) value = window.prompt(prompt, def);
		if (value === null) value = def;

		value = value.endsWith("/") ? value.substring(0, value.length - 1) : value;
		host = value;
		hostEl.value = host;
		localStorage.setItem("openoutpaint/host", host);
	};

	const current = localStorage.getItem("openoutpaint/host");
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

		statuses[status] &&
			(() => {
				statuses[status]();
				global.connection = status;
			})();
	};

	setConnectionStatus("before");

	let checkInProgress = false;

	const checkConnection = async (
		notify = false,
		simpleProgressStatus = false
	) => {
		const apiIssueResult = () => {
			setConnectionStatus("apiissue");
			const message = `The host is online, but the API seems to be disabled.<br>Have you run the webui with the flag '--api', or is the flag '--gradio-debug' currently active?`;
			console.error(message);
			if (notify)
				notifications.notify(message, {
					type: NotificationType.ERROR,
					timeout: config.notificationTimeout * 2,
				});
		};

		const offlineResult = () => {
			setConnectionStatus("offline");
			const message = `The connection with the host returned an error: ${response.status} - ${response.statusText}`;
			console.error(message);
			if (notify)
				notifications.notify(message, {
					type: NotificationType.ERROR,
					timeout: config.notificationTimeout * 2,
				});
		};
		if (checkInProgress)
			throw new CheckInProgressError(
				"Check is currently in progress, please try again"
			);
		checkInProgress = true;
		var url = document.getElementById("host").value + "/startup-events";
		// Attempt normal request
		try {
			if (simpleProgressStatus) {
				const response = await fetch(
					document.getElementById("host").value + "/sdapi/v1/progress" // seems to be the "lightest" endpoint?
				);
				switch (response.status) {
					case 200: {
						setConnectionStatus("online");
						break;
					}
					case 404: {
						apiIssueResult();
						break;
					}
					default: {
						offlineResult();
					}
				}
			} else {
				// Check if API is available
				const response = await fetch(
					document.getElementById("host").value + "/sdapi/v1/options"
				);
				const optionsdata = await response.json();
				if (optionsdata["use_scale_latent_for_hires_fix"]) {
					const message = `You are using an outdated version of A1111 webUI.<br>The HRfix options will not work until you update to at least commit ef27a18 or newer.<br>(https://github.com/AUTOMATIC1111/stable-diffusion-webui/commit/ef27a18b6b7cb1a8eebdc9b2e88d25baf2c2414d)<br>HRfix will fallback to half-resolution only.`;
					console.warn(message);
					if (notify)
						notifications.notify(message, {
							type: NotificationType.WARN,
							timeout: config.notificationTimeout * 4,
						});
					// Hide all new hrfix options
					document
						.querySelectorAll(".hrfix")
						.forEach((el) => (el.style.display = "none"));

					// We are using old HRFix
					global.isOldHRFix = true;
					stableDiffusionData.enable_hr = false;
				}
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
							getSchedulers();
							extensions.getExtensions(
								controlNetModelAutoComplete,
								controlNetModuleAutoComplete,
								controlNetReferenceModuleAutoComplete
							);
							getLoras();
							// getTIEmbeddings();
							// getHypernets();
							firstTimeOnline = false;
						}
						break;
					}
					case 404: {
						apiIssueResult();
						break;
					}
					default: {
						offlineResult();
					}
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
				if (notify)
					notifications.notify(message, {
						type: NotificationType.ERROR,
						timeout: config.notificationTimeout * 2,
					});
			} catch (e) {
				setConnectionStatus("offline");
				const message = `The server seems to be offline. Is host '${
					document.getElementById("host").value
				}' correct?`;
				console.error(message);
				if (notify)
					notifications.notify(message, {
						type: NotificationType.ERROR,
						timeout: config.notificationTimeout * 2,
					});
			}
		}
		checkInProgress = false;
		return status;
	};

	if (focused || firstTimeOnline) {
		await checkConnection(!urlParams.has("noprompt"));
	}

	// On click, attempt to refresh
	connectionIndicator.onclick = async () => {
		try {
			await checkConnection(true);
			checked = true;
		} catch (e) {
			console.debug("Already refreshing");
		}
	};

	// Checks every 5 seconds if offline, 60 seconds if online
	const checkAgain = () => {
		checkFocus();
		if (focused || firstTimeOnline) {
			setTimeout(
				async () => {
					let simple = !firstTimeOnline;
					await checkConnection(false, simple);
					checkAgain();
				},
				connectionStatus ? 60000 : 5000
			);
		} else {
			setTimeout(() => {
				checkAgain();
			}, 60000);
		}
	};

	checkAgain();

	return () => {
		checkConnection().catch(() => {});
	};
}

function newImage(evt) {
	clearPaintedMask();
	uil.layers.forEach(({layer}) => {
		commands.runCommand(
			"eraseImage",
			"Clear Canvas",
			{
				...layer.bb,
				ctx: layer.ctx,
			},
			{
				extra: {
					log: `Cleared Canvas`,
				},
			}
		);
	});
}

function clearPaintedMask() {
	maskPaintLayer.clear();
}

function march(bb, options = {}) {
	defaultOpt(options, {
		title: null,
		titleStyle: "#FFF5",
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
		category: "display",
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

	// Draw Tool Name
	if (bb.h > 40 && options.title) {
		ctx.font = `bold 20px Open Sans`;

		ctx.textAlign = "left";
		ctx.fillStyle = options.titleStyle;
		ctx.fillText(options.title, 10, 30, bb.w);
	}

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
	const local = lsKey && localStorage.getItem(`openoutpaint/${lsKey}`);
	const def = parseFloat(local === null ? defaultValue : local);
	let cb = (v) => {
		stableDiffusionData[lsKey] = v;
		if (lsKey) localStorage.setItem(`openoutpaint/${lsKey}`, v);
	};
	if (valuecb) {
		cb = (v) => {
			valuecb(v);
			localStorage.setItem(`openoutpaint/${lsKey}`, v);
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

let modelAutoComplete = createAutoComplete(
	"Model",
	document.getElementById("models-ac-select"),
	{},
	document.getElementById("refreshModelsBtn"),
	"refreshable"
);
modelAutoComplete.onchange.on(({value}) => {
	/**
	 * TODO implement optional API call to check model unet channel count
	 * extension users guaranteed to have it as of
	 * https://github.com/zero01101/openOutpaint-webUI-extension/commit/1f22f5ea5b860c6e91f77edfb47743a124596dec
	 * but still need a fallback check like below
	 */

	if (value.toLowerCase().includes("inpainting"))
		document.querySelector(
			"#models-ac-select input.autocomplete-text"
		).style.backgroundColor = "#cfc";
	else
		document.querySelector(
			"#models-ac-select input.autocomplete-text"
		).style.backgroundColor = "#fcc";
});

let refinerAutoComplete = createAutoComplete(
	"Refiner",
	document.getElementById("refiner-ac-select")
);
refinerAutoComplete.onchange.on(({value}) => {
	stableDiffusionData.refiner_checkpoint = value;
});

let loraAutoComplete = createAutoComplete(
	"LoRa",
	document.getElementById("lora-ac-select")
);
loraAutoComplete.onchange.on(({value}) => {
	// add selected lora to the end of the prompt
	let passVal = "  <lora:" + value + ":1>";
	let promptInput = document.getElementById("prompt");
	promptInput.value += passVal;
	let promptThing = prompt;
});

const samplerAutoComplete = createAutoComplete(
	"Sampler",
	document.getElementById("sampler-ac-select")
);

const schedulerAutoComplete = createAutoComplete(
	"Scheduler",
	document.getElementById("scheduler-ac-select")
);

const upscalerAutoComplete = createAutoComplete(
	"Upscaler",
	document.getElementById("upscaler-ac-select")
);

const hrFixUpscalerAutoComplete = createAutoComplete(
	"HRfix Upscaler",
	document.getElementById("hrFixUpscaler")
);

let controlNetModelAutoComplete = createAutoComplete(
	"Inpaint Model",
	document.getElementById("controlNetModel-ac-select")
);

controlNetModelAutoComplete.onchange.on(({value}) => {
	extensions.selectedControlNetModel = value;
});

let controlNetModuleAutoComplete = createAutoComplete(
	"Inpaint Preprocessor",
	document.getElementById("controlNetModule-ac-select")
);

controlNetModuleAutoComplete.onchange.on(({value}) => {
	extensions.selectedControlNetModule = value;
});

let controlNetReferenceModuleAutoComplete = createAutoComplete(
	"Reference Preprocessor",
	document.getElementById("controlNetReferenceModule-ac-select")
);

controlNetReferenceModuleAutoComplete.onchange.on(({value}) => {
	extensions.selectedCNReferenceModule = value;
});

// const extensionsAutoComplete = createAutoComplete(
// 	"Extension",
// 	document.getElementById("extension-ac-select")
// );

hrFixUpscalerAutoComplete.onchange.on(({value}) => {
	stableDiffusionData.hr_upscaler = value;
	localStorage.setItem(`openoutpaint/hr_upscaler`, value);
});

const resSlider = makeSlider(
	"Resolution",
	document.getElementById("resolution"),
	"resolution",
	128,
	2048,
	128,
	512,
	2,
	(v) => {
		stableDiffusionData.width = stableDiffusionData.height = v;

		toolbar.currentTool &&
			toolbar.currentTool.redraw &&
			toolbar.currentTool.redraw();
	}
);

const refinerSlider = makeSlider(
	"Refiner Switch At",
	document.getElementById("refinerSwitchAt"),
	"refiner_switch_at",
	0.0,
	1.0,
	0.1,
	0.8,
	0.01,
	(v) => {
		stableDiffusionData.refiner_switch_at = v;
	}
);

const refSlider = makeSlider(
	"Reference Fidelity",
	document.getElementById("controlNetReferenceFidelity"),
	"cn_reference_fidelity",
	0.0,
	1.0,
	0.1,
	0.5,
	0.01,
	(v) => {
		extensions.controlNetReferenceFidelity = v;

		toolbar.currentTool &&
			toolbar.currentTool.redraw &&
			toolbar.currentTool.redraw();
	}
);

makeSlider(
	"CFG Scale",
	document.getElementById("cfgScale"),
	"cfg_scale",
	localStorage.getItem("openoutpaint/settings.min-cfg") || 1,
	localStorage.getItem("openoutpaint/settings.max-cfg") || 25,
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

makeSlider(
	"Steps",
	document.getElementById("steps"),
	"steps",
	1,
	localStorage.getItem("openoutpaint/settings.max-steps") || 70,
	5,
	30,
	1
);

// 20230102 grumble grumble
const hrFixScaleSlider = makeSlider(
	"HRfix Scale",
	document.getElementById("hrFixScale"),
	"hr_scale",
	1.0,
	4.0,
	0.1,
	2.0,
	0.1
);

makeSlider(
	"HRfix Denoising",
	document.getElementById("hrDenoising"),
	"hr_denoising_strength",
	0.0,
	1.0,
	0.05,
	0.7,
	0.01
);

const lockPxSlider = makeSlider(
	"HRfix Autoscale Lock Px.",
	document.getElementById("hrFixLockPx"),
	"hr_fix_lock_px",
	0,
	2048,
	256,
	0,
	1
);

const hrStepsSlider = makeSlider(
	"HRfix Steps",
	document.getElementById("hrFixSteps"),
	"hr_second_pass_steps",
	0,
	localStorage.getItem("openoutpaint/settings.max-steps") || 70,
	5,
	0,
	1
);

function changeMaskBlur() {
	stableDiffusionData.mask_blur = parseInt(
		document.getElementById("maskBlur").value
	);
	localStorage.setItem("openoutpaint/mask_blur", stableDiffusionData.mask_blur);
}

function changeSeed() {
	stableDiffusionData.seed = document.getElementById("seed").value;
	localStorage.setItem("openoutpaint/seed", stableDiffusionData.seed);
}

function changeHRFX() {
	stableDiffusionData.hr_resize_x =
		document.getElementById("hr_resize_x").value;
}

function changeHRFY() {
	stableDiffusionData.hr_resize_y =
		document.getElementById("hr_resize_y").value;
}

function changeDynamicPromptsExtension() {
	extensions.dynamicPromptsActive =
		document.getElementById("cbxDynPrompts").checked;
}

function changeControlNetExtension() {
	extensions.controlNetActive =
		document.getElementById("cbxControlNet").checked;
	if (extensions.controlNetActive) {
		document
			.querySelectorAll(".controlNetElement")
			.forEach((el) => el.classList.remove("invisible"));
	} else {
		document
			.querySelectorAll(".controlNetElement")
			.forEach((el) => el.classList.add("invisible"));
	}
	changeControlNetReference();
}

function changeControlNetReference() {
	extensions.controlNetReferenceActive = document.getElementById(
		"cbxControlNetReferenceLayer"
	).checked;
	if (extensions.controlNetReferenceActive && extensions.controlNetActive) {
		document
			.querySelectorAll(".controlNetReferenceElement")
			.forEach((el) => el.classList.remove("invisible"));
	} else {
		document
			.querySelectorAll(".controlNetReferenceElement")
			.forEach((el) => el.classList.add("invisible"));
	}
}

function changeRefinerEnabled() {
	stableDiffusionData.enable_refiner = Boolean(
		document.getElementById("cbxRefiner").checked
	);
	localStorage.setItem(
		"openoutpaint/enable_refiner",
		stableDiffusionData.enable_refiner
	);
	if (stableDiffusionData.enable_refiner) {
		document
			.querySelectorAll(".refiner")
			.forEach((el) => el.classList.remove("invisible"));
		stableDiffusionData.refiner_checkpoint = refinerAutoComplete.value;
		stableDiffusionData.refiner_switch_at = refinerSlider.value;
	} else {
		document
			.querySelectorAll(".refiner")
			.forEach((el) => el.classList.add("invisible"));
		delete stableDiffusionData.refiner_checkpoint;
		delete stableDiffusionData.refiner_switch_at;
	}
}

function changeHiResFix() {
	stableDiffusionData.enable_hr = Boolean(
		document.getElementById("cbxHRFix").checked
	);
	localStorage.setItem("openoutpaint/enable_hr", stableDiffusionData.enable_hr);
	// var hrfSlider = document.getElementById("hrFixScale");
	// var hrfOpotions = document.getElementById("hrFixUpscaler");
	// var hrfLabel = document.getElementById("hrFixLabel");
	// var hrfDenoiseSlider = document.getElementById("hrDenoising");
	// var hrfLockPxSlider = document.getElementById("hrFixLockPx");
	if (stableDiffusionData.enable_hr) {
		document
			.querySelectorAll(".hrfix")
			.forEach((el) => el.classList.remove("invisible"));
	} else {
		document
			.querySelectorAll(".hrfix")
			.forEach((el) => el.classList.add("invisible"));
	}
}

function changeHiResSquare() {
	stableDiffusionData.hr_square_aspect = Boolean(
		document.getElementById("cbxHRFSquare").checked
	);
}

function changeRestoreFaces() {
	stableDiffusionData.restore_faces = Boolean(
		document.getElementById("cbxRestoreFaces").checked
	);
	localStorage.setItem(
		"openoutpaint/restore_faces",
		stableDiffusionData.restore_faces
	);
}

function changeSyncCursorSize() {
	global.syncCursorSize = Boolean(
		document.getElementById("cbxSyncCursorSize").checked
	);
	localStorage.setItem("openoutpaint/sync_cursor_size", global.syncCursorSize);
}

function changeSmoothRendering() {
	const layers = document.getElementById("layer-render");
	if (localStorage.getItem("openoutpaint/settings.smooth") === "true") {
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
	{
		// Existing Canvas BG
		const canvas = document.createElement("canvas");
		canvas.width = config.gridSize * 2;
		canvas.height = config.gridSize * 2;

		const ctx = canvas.getContext("2d");
		ctx.fillStyle = theme.grid.dark;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = theme.grid.light;
		ctx.fillRect(0, 0, config.gridSize, config.gridSize);
		ctx.fillRect(
			config.gridSize,
			config.gridSize,
			config.gridSize,
			config.gridSize
		);

		canvas.toBlob((blob) => {
			const url = window.URL.createObjectURL(blob);
			console.debug(url);
			bgLayer.canvas.style.backgroundImage = `url(${url})`;
		});
	}
}

async function exportWorkspaceState() {
	return {
		defaultLayer: {
			id: uil.layerIndex.default.id,
			name: uil.layerIndex.default.name,
		},
		bb: {
			x: imageCollection.bb.x,
			y: imageCollection.bb.y,
			w: imageCollection.bb.w,
			h: imageCollection.bb.h,
		},
		history: await commands.export(),
	};
}

async function importWorkspaceState(state) {
	// Start from zero, effectively
	await commands.clear();

	// Setup initial layer
	const layer = uil.layerIndex.default;
	layer.deletable = true;

	await commands.runCommand(
		"addLayer",
		"Temporary Layer",
		{name: "Temporary Layer", key: "tmp"},
		{recordHistory: false}
	);

	await commands.runCommand(
		"deleteLayer",
		"Deleted Layer",
		{
			layer,
		},
		{recordHistory: false}
	);

	await commands.runCommand(
		"addLayer",
		"Initial Layer Creation",
		{
			id: state.defaultLayer.id,
			name: state.defaultLayer.name,
			key: "default",
			deletable: false,
		},
		{recordHistory: false}
	);

	await commands.runCommand(
		"deleteLayer",
		"Deleted Layer",
		{
			layer: uil.layerIndex.tmp,
		},
		{recordHistory: false}
	);

	// Resize canvas to match original size
	const sbb = new BoundingBox(state.bb);

	const bb = imageCollection.bb;
	let eleft = 0;
	if (bb.x > sbb.x) eleft = bb.x - sbb.x;
	let etop = 0;
	if (bb.y > sbb.y) etop = bb.y - sbb.y;

	let eright = 0;
	if (bb.tr.x < sbb.tr.x) eright = sbb.tr.x - bb.tr.x;
	let ebottom = 0;
	if (bb.br.y < sbb.br.y) ebottom = sbb.br.y - bb.br.y;

	imageCollection.expand(eleft, etop, eright, ebottom);

	// Run commands in order
	for (const command of state.history) {
		await commands.import(command);
	}
}

async function saveWorkspaceToFile() {
	const workspace = await exportWorkspaceState();

	const blob = new Blob([JSON.stringify(workspace)], {
		type: "application/json",
	});

	const url = URL.createObjectURL(blob);
	var link = document.createElement("a"); // Or maybe get it from the current document
	link.href = url;
	link.download = `${new Date().toISOString()}_openOutpaint_workspace.json`;
	link.click();
}

async function getUpscalers() {
	var url = document.getElementById("host").value + "/sdapi/v1/upscalers";
	let upscalers = [];

	try {
		const response = await fetch(url, {
			method: "GET",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
		});
		const data = await response.json();
		for (var i = 0; i < data.length; i++) {
			if (data[i].name.includes("None")) {
				continue;
			}
			upscalers.push(data[i].name);
		}
	} catch (e) {
		console.warn("[index] Failed to fetch upscalers:");
		console.warn(e);
		upscalers = [
			"Lanczos",
			"Nearest",
			"LDSR",
			"SwinIR",
			"R-ESRGAN General 4xV3",
			"R-ESRGAN General WDN 4xV3",
			"R-ESRGAN AnimeVideo",
			"R-ESRGAN 4x+",
			"R-ESRGAN 4x+ Anime6B",
			"R-ESRGAN 2x+",
		];
	}
	const upscalersPlusNone = [...upscalers];
	upscalersPlusNone.unshift("None");
	upscalersPlusNone.push("Latent");
	upscalersPlusNone.push("Latent (antialiased)");
	upscalersPlusNone.push("Latent (bicubic)");
	upscalersPlusNone.push("Latent (bicubic, antialiased)");
	upscalersPlusNone.push("Latent (nearest)");

	upscalerAutoComplete.options = upscalers.map((u) => {
		return {name: u, value: u};
	});
	hrFixUpscalerAutoComplete.options = upscalersPlusNone.map((u) => {
		return {name: u, value: u};
	});

	upscalerAutoComplete.value =
		localStorage.getItem("openoutpaint/upscaler") === null
			? upscalers[0]
			: localStorage.getItem("openoutpaint/upscaler");

	hrFixUpscalerAutoComplete.value =
		localStorage.getItem("openoutpaint/hr_upscaler") === null
			? "None"
			: localStorage.getItem("openoutpaint/hr_upscaler");
}

async function getModels(refresh = false) {
	const url = document.getElementById("host").value + "/sdapi/v1/sd-models";
	let opt = null;

	try {
		const response = await fetch(url);
		const data = await response.json();

		opt = data.map((option) => ({
			name: option.title,
			value: option.title,
			optionelcb: (el) => {
				if (option.title.toLowerCase().includes("inpainting"))
					el.classList.add("inpainting");
			},
		}));

		refinerAutoComplete.options = modelAutoComplete.options = opt;

		try {
			const optResponse = await fetch(
				document.getElementById("host").value + "/sdapi/v1/options"
			);
			const optData = await optResponse.json();

			var model = optData.sd_model_checkpoint;
			// 20230722 - sigh so this key is now removed https://github.com/AUTOMATIC1111/stable-diffusion-webui/commit/66c5f1bb1556a2d86d9f11aeb92f83d4a09832cc
			// no idea why but time to deal with it
			if (model === undefined) {
				const modelHash = optData.sd_checkpoint_hash;
				const hashMap = data.map((option) => ({
					hash: option.sha256,
					title: option.title,
				}));
				model = hashMap.find((option) => option.hash === modelHash).title;
			}
			console.log("Current model: " + model);
			if (modelAutoComplete.value !== model) modelAutoComplete.value = model;
		} catch (e) {
			console.warn("[index] Failed to fetch current model:");
			console.warn(e);
		}
	} catch (e) {
		console.warn("[index] Failed to fetch models:");
		console.warn(e);
	}

	if (!refresh)
		modelAutoComplete.onchange.on(async ({value}) => {
			console.log(`[index] Changing model to [${value}]`);
			const payload = {
				sd_model_checkpoint: value,
			};
			const url = document.getElementById("host").value + "/sdapi/v1/options/";
			try {
				await fetch(url, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(payload),
				});

				notifications.notify(`Model changed to [${value}]`, {type: "success"});
			} catch (e) {
				console.warn("[index] Error changing model");
				console.warn(e);

				notifications.notify(
					"Error changing model, please check console for additional information",
					{
						type: NotificationType.ERROR,
						timeout: config.notificationTimeout * 2,
					}
				);
			}
		});

	// If first time running, ask if user wants to switch to an inpainting model
	if (global.firstRun && !modelAutoComplete.value.includes("inpainting")) {
		const inpainting = opt.find(({name}) => name.includes("inpainting"));

		let message =
			"It seems this is your first time using openOutpaint. It is highly recommended that you switch to an inpainting model. \
			These are highlighted as green in the model selector.";

		if (inpainting) {
			message += `<br><br>We have found the inpainting model<br><br> - ${inpainting.name}<br><br>available in the webui. Do you want to switch to it?`;
			if (await notifications.dialog("Automatic Model Switch", message)) {
				modelAutoComplete.value = inpainting.value;
			}
		} else {
			message += `<br><br>No inpainting model seems to be available in the webui. It is recommended that you download an inpainting model, or outpainting results may not be optimal.`;
			notifications.notify(message, {
				type: NotificationType.WARN,
				timeout: null,
			});
		}
	}
}

async function getLoras() {
	var url = document.getElementById("host").value + "/sdapi/v1/loras";
	let opt = null;

	try {
		const response = await fetch(url);
		const data = await response.json();

		loraAutoComplete.options = data.map((lora) => ({
			name: lora.name,
			value: lora.name,
		}));
	} catch (e) {
		console.warn("[index] Failed to fetch loras");
		console.warn(e);
	}
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
			message += "<br> - Image to Image Color Correction: false recommended";
			wrong = true;
		}

		if (data.inpainting_mask_weight < 1.0) {
			message += `<br> - Inpainting Conditioning Mask Strength: 1.0 recommended`;
			wrong = true;
		}

		message +=
			"<br><br>Should these values be changed to the recommended ones?";

		if (!wrong) {
			console.info("[index] WebUI Settings set as recommended.");
			return;
		}

		console.info(
			"[index] WebUI Settings not set as recommended. Prompting for changing settings automatically."
		);

		if (!(await notifications.dialog("Recommended Settings", message))) return;

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

	localStorage.setItem(
		"openoutpaint/promptStyle",
		JSON.stringify(selectedString)
	);

	// change the model
	if (selectedString.length > 0)
		console.log(`[index] Changing styles to ${selectedString.join(", ")}`);
	else console.log(`[index] Clearing styles`);
	stableDiffusionData.styles = selectedString;
}

function changeScheduler() {
	const schedulerSelectEl = document.getElementById("schedulerSelect");
	var selectedString = schedulerSelectEl.value;

	stableDiffusionData.scheduler = selectedString;
}

async function getSamplers() {
	var url = document.getElementById("host").value + "/sdapi/v1/samplers";

	try {
		const response = await fetch(url);
		const data = await response.json();

		samplerAutoComplete.onchange.on(({value}) => {
			stableDiffusionData.sampler_index = value;
			localStorage.setItem("openoutpaint/sampler", value);
		});

		samplerAutoComplete.options = data.map((sampler) => ({
			name: sampler.name,
			value: sampler.name,
		}));

		// Initial sampler
		if (localStorage.getItem("openoutpaint/sampler") != null) {
			samplerAutoComplete.value = localStorage.getItem("openoutpaint/sampler");
		} else {
			samplerAutoComplete.value = data[0].name;
			localStorage.setItem("openoutpaint/sampler", samplerAutoComplete.value);
		}
		stableDiffusionData.sampler_index = samplerAutoComplete.value;
	} catch (e) {
		console.warn("[index] Failed to fetch samplers");
		console.warn(e);
	}
}

async function getSchedulers() {
	var url = document.getElementById("host").value + "/sdapi/v1/schedulers";

	try {
		const response = await fetch(url);
		const data = await response.json();

		schedulerAutoComplete.onchange.on(({value}) => {
			stableDiffusionData.scheduler = value;
			localStorage.setItem("openoutpaint/scheduler", value);
		});

		schedulerAutoComplete.options = data.map((scheduler) => ({
			name: scheduler.label,
			value: scheduler.label,
		}));

		if (localStorage.getItem("openoutpaint/scheduler") != null) {
			schedulerAutoComplete.value = localStorage.getItem(
				"openoutpaint/scheduler"
			);
		} else {
			schedulerAutoComplete.value = data[0].name;
			localStorage.setItem(
				"openoutpaint/scheduler",
				schedulerAutoComplete.value
			);
		}
		stableDiffusionData.scheduler = schedulerAutoComplete.value;
	} catch (e) {
		console.warn("[index] Failed to fetch schedulers");
		console.warn(e);
	}
}

async function upscaleAndDownload(
	download = false,
	add_resource = false,
	aCanvas = null
) {
	// Future improvements: some upscalers take a while to upscale, so we should show a loading bar or something, also a slider for the upscale amount

	// get cropped canvas, send it to upscaler, download result
	var upscale_factor = localStorage.getItem("openoutpaint/upscale_x")
		? localStorage.getItem("openoutpaint/upscale_x")
		: 2;
	var upscaler = upscalerAutoComplete.value;
	var croppedCanvas = null;
	var imgdata = null;
	localStorage.setItem("openoutpaint/upscaler", upscaler);

	if (aCanvas == null) {
		console.log("Upscaling main canvas.");
		croppedCanvas = cropCanvas(
			uil.getVisible({
				x: 0,
				y: 0,
				w: imageCollection.size.w,
				h: imageCollection.size.h,
			})
		);
		imgdata = croppedCanvas.canvas.toDataURL("image/png");
	} else {
		console.log("Upscaling resource canvas.");
		imgdata = aCanvas.toDataURL("image/png");
	}

	if (imgdata != null) {
		var url =
			document.getElementById("host").value + "/sdapi/v1/extra-single-image/";

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

				if (add_resource == true) {
					console.log("Add upscaled to resource");
					const img = new Image();
					img.src = link.href;
					tools.stamp.state.addResource(guid() + " (upscaled)", img);
				}
				if (download == true) {
					console.log("Download upscaled");
					link.click();
				}
			});
	}
}

function loadSettings() {
	// set default values if not set
	var _mask_blur =
		localStorage.getItem("openoutpaint/mask_blur") == null
			? 0
			: localStorage.getItem("openoutpaint/mask_blur");
	var _seed =
		localStorage.getItem("openoutpaint/seed") == null
			? -1
			: localStorage.getItem("openoutpaint/seed");
	let _enable_hr =
		localStorage.getItem("openoutpaint/enable_hr") === null
			? false
			: localStorage.getItem("openoutpaint/enable_hr") === "true";
	let _restore_faces =
		localStorage.getItem("openoutpaint/restore_faces") === null
			? false
			: localStorage.getItem("openoutpaint/restore_faces") === "true";

	let _sync_cursor_size =
		localStorage.getItem("openoutpaint/sync_cursor_size") === null
			? true
			: localStorage.getItem("openoutpaint/sync_cursor_size") === "true";

	let _hrfix_scale =
		localStorage.getItem("openoutpaint/hr_scale") === null
			? 2.0
			: localStorage.getItem("openoutpaint/hr_scale");

	let _hrfix_denoising =
		localStorage.getItem("openoutpaint/hr_denoising_strength") === null
			? 0.7
			: localStorage.getItem("openoutpaint/hr_denoising_strength");
	let _hrfix_lock_px =
		localStorage.getItem("openoutpaint/hr_fix_lock_px") === null
			? 0
			: localStorage.getItem("openoutpaint/hr_fix_lock_px");

	// set the values into the UI
	document.getElementById("maskBlur").value = Number(_mask_blur);
	document.getElementById("seed").value = Number(_seed);
	document.getElementById("cbxHRFix").checked = Boolean(_enable_hr);
	// document.getElementById("cbxRestoreFaces").checked = Boolean(_restore_faces);
	document.getElementById("cbxSyncCursorSize").checked =
		Boolean(_sync_cursor_size);
	document.getElementById("hrFixScale").value = Number(_hrfix_scale);
	document.getElementById("hrDenoising").value = Number(_hrfix_denoising);
	document.getElementById("hrFixLockPx").value = Number(_hrfix_lock_px);
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

async function resetToDefaults() {
	if (
		await notifications.dialog(
			"Clear Settings",
			"Are you sure you want to clear your settings?"
		)
	) {
		localStorage.clear();
	}
}

document.addEventListener("visibilitychange", () => {
	checkFocus();
});

window.addEventListener("blur", () => {
	checkFocus();
});

window.addEventListener("focus", () => {
	checkFocus();
});

function checkFocus() {
	let hasFocus = document.hasFocus();
	if (document.hidden || !hasFocus) {
		focused = false;
	} else {
		focused = true;
	}
}

function refreshScripts() {
	selector = document.getElementById("script-selector");
	selector.innerHTML = "";
	createBaseScriptOptions();
	loadDefaultScripts();
	// loadUserScripts();
}

function createBaseScriptOptions() {
	selector = document.getElementById("script-selector");
	var noScript = document.createElement("option");
	noScript.id = "no_selected_script";
	noScript.value = "";
	noScript.innerHTML = "(disabled)";
	selector.appendChild(noScript);
	var customScript = document.createElement("option");
	customScript.id = "custom";
	customScript.value = "custom";
	customScript.innerHTML = "Custom";
	selector.appendChild(customScript);
}

async function loadDefaultScripts() {
	selector = document.getElementById("script-selector");
	const response = await fetch("./defaultscripts.json");
	const json = await response.json();
	for (const key in json.defaultScripts) {
		var opt = document.createElement("option");
		opt.value = opt.innerHTML = key;
		selector.appendChild(opt);
	}
	defaultScripts = json;
}

// async function loadUserScripts() {
// 	selector = document.getElementById("script-selector");
// 	const response = await fetch("./userdefinedscripts.json");
// 	const json = await response.json();
// 	for (const key in json.userScripts) {
// 		var opt = document.createElement("option");
// 		opt.value = opt.innerHTML = key;
// 		selector.appendChild(opt);
// 	}
// 	userScripts = json;
// }

function changeScript(event) {
	let enable = () => {
		scriptName.disabled = false;
		// saveScriptButton.disabled = false;
	};
	let disable = () => {
		scriptName.disabled = true;
		// saveScriptButton.disabled = true;
	};
	let selected = event.target.value;
	let scriptName = document.getElementById("script-name-input");
	let scriptArgs = document.getElementById("script-args-input");
	// let saveScriptButton = document.getElementById("save-custom-script");
	scriptName.value = selected;
	scriptArgs.title = "";
	disable();
	switch (selected) {
		case "custom": {
			let _script_name_input =
				localStorage.getItem("openoutpaint/script_name_input") === null
					? ""
					: localStorage.getItem("openoutpaint/script_name_input");
			let _script_args_input =
				localStorage.getItem("openoutpaint/script_args_input") === null
					? "[]"
					: localStorage.getItem("openoutpaint/script_args_input");
			scriptName.value = _script_name_input;
			scriptArgs.value = _script_args_input;
			scriptArgs.title = "";
			enable();
			break;
		}
		case "": {
			// specifically no selected script
			scriptArgs.value = "";
			break;
		}
		default: {
			scriptName.value = selected;
			// check default scripts for selected script
			if (selected in defaultScripts.defaultScripts) {
				scriptArgs.value = defaultScripts.defaultScripts[selected].scriptValues;
				scriptArgs.title = defaultScripts.defaultScripts[selected].titleText;
			}
			// FURTHER TODO see if this is even plausible as i don't think JS can arbitrarily save data to files without downloading

			// if not found, check user scripts
			// TODO yknow what check userscripts first; if customizations have been made load those instead of defaults, i'm too stupid to do that right now
			// else if (selected in userScripts.userScripts) {
			// 	scriptArgs.value = userScripts.userScripts[selected].scriptValues;
			// 	enable();
			// }
			// if not found, wtf
		}
	}
}

// async function saveCustomScript() {
// 	let selector = document.getElementById("script-name-input");
// 	let selected = selector.value;
// 	let args = document.getElementById("script-args-input").value;
// 	if (selected.trim() != "") {
// 		if (selected in userScripts.userScripts) {
// 			userScripts.userScripts[selected].scriptValues = args;
// 		} else {
// 		}
// 	}
// }

function togglePix2PixImgCfg(value) {
	// super hacky
	// actually doesn't work at all yet so i'm leaving it here to taunt and remind me of my failures
	// try {
	// 	if (value.toLowerCase().includes("pix2pix")) {
	// 		document
	// 			.querySelector(".instruct-pix2pix-img-cfg")
	// 			.classList.remove("invisible");
	// 	} else {
	// 		document
	// 			.querySelector(".instruct-pix2pix-img-cfg")
	// 			.classList.add("invisible");
	// 	}
	// } catch (e) {
	// 	// highly likely not currently using img2img tool, do nothing
	// }
}

function storeUserscriptVal(evt, type) {
	let currentScript = document.getElementById("script-selector").value;
	if (currentScript === "custom") {
		console.log(type);
		console.log(evt);
		let val = (currentScript = document.getElementById(
			"script-" + type + "-input"
		).value);

		localStorage.setItem("openoutpaint/script_" + type + "_input", val);
	}
}

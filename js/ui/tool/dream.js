let blockNewImages = false;
let generationQueue = [];
let generationAreas = new Set();
let generating = false;

/**
 * Starts progress monitoring bar
 *
 * @param {BoundingBox} bb Bouding Box to draw progress to
 * @param {(data: object) => void} [oncheck] Callback function for when a progress check returns
 * @returns {() => void}
 */
const _monitorProgress = (bb, oncheck = null) => {
	const minDelay = 1000;

	const apiURL = `${host}${url}progress?skip_current_image=true`;

	const expanded = {...bb};
	expanded.x--;
	expanded.y--;
	expanded.w += 2;
	expanded.h += 2;

	// Get temporary layer to draw progress bar
	const layer = imageCollection.registerLayer(null, {
		bb: expanded,
	});
	layer.canvas.style.opacity = "70%";

	let running = true;

	const _checkProgress = async () => {
		const init = performance.now();

		try {
			const response = await fetch(apiURL);
			/** @type {StableDiffusionProgressResponse} */
			const data = await response.json();

			oncheck && oncheck(data);

			layer.clear();

			// Draw Progress Bar
			layer.ctx.fillStyle = "#5F5";
			layer.ctx.fillRect(1, 1, bb.w * data.progress, 10);

			// Draw Progress Text
			layer.ctx.fillStyle = "#FFF";

			layer.ctx.fillRect(0, 15, 60, 25);
			layer.ctx.fillRect(bb.w - 58, 15, 60, 25);

			layer.ctx.font = "20px Open Sans";
			layer.ctx.fillStyle = "#000";
			layer.ctx.textAlign = "right";
			layer.ctx.fillText(`${Math.round(data.progress * 100)}%`, 55, 35);

			// Draw ETA Text
			layer.ctx.fillText(`${Math.round(data.eta_relative)}s`, bb.w - 5, 35);
		} finally {
		}

		const timeSpent = performance.now() - init;
		setTimeout(() => {
			if (running) _checkProgress();
		}, Math.max(0, minDelay - timeSpent));
	};

	_checkProgress();

	return () => {
		imageCollection.deleteLayer(layer);
		running = false;
	};
};

/**
 * Starts a dream
 *
 * @param {"txt2img" | "img2img"} endpoint Endpoint to send the request to
 * @param {StableDiffusionRequest} request Stable diffusion request
 * @returns {Promise<string[]>}
 */
const _dream = async (endpoint, request) => {
	const apiURL = `${host}${url}${endpoint}`;

	/** @type {StableDiffusionResponse} */
	let data = null;
	try {
		generating = true;
		const response = await fetch(apiURL, {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify(request),
		});

		data = await response.json();
	} finally {
		generating = false;
	}
	var responseSubdata = JSON.parse(data.info);
	var returnData = {
		images: data.images,
		seeds: responseSubdata.all_seeds,
	};
	return returnData;
};

/**
 * Generate and pick an image for placement
 *
 * @param {"txt2img" | "img2img"} endpoint Endpoint to send the request to
 * @param {StableDiffusionRequest} request Stable diffusion request
 * @param {BoundingBox} bb Generated image placement location
 * @param {object} options Options
 * @param {number} [options.drawEvery=0.2 / request.n_iter] Percentage delta to draw progress at (by default 20% of each iteration)
 * @param {HTMLCanvasElement} [options.keepUnmask=null] Whether to force keep image under fully opaque mask
 * @param {number} [options.keepUnmaskBlur=0] Blur when applying full resolution back to the image
 * @returns {Promise<HTMLImageElement | null>}
 */
const _generate = async (endpoint, request, bb, options = {}) => {
	defaultOpt(options, {
		drawEvery: 0.2 / request.n_iter,
		keepUnmask: null,
		keepUnmaskBlur: 0,
	});

	events.tool.dream.emit({event: "generate", request});

	const requestCopy = JSON.parse(JSON.stringify(request));

	// Block requests to identical areas
	const areaid = `${bb.x}-${bb.y}-${bb.w}-${bb.h}`;
	if (generationAreas.has(areaid)) return;
	generationAreas.add(areaid);

	// Await for queue
	let cancelled = false;
	const waitQueue = async () => {
		const stopQueueMarchingAnts = march(bb, {style: "#AAF"});

		// Add cancel Button
		const cancelButton = makeElement("button", bb.x + bb.w - 100, bb.y + bb.h);
		cancelButton.classList.add("dream-stop-btn");
		cancelButton.textContent = "Cancel";
		cancelButton.addEventListener("click", () => {
			cancelled = true;
			imageCollection.inputElement.removeChild(cancelButton);
			stopQueueMarchingAnts();
		});
		imageCollection.inputElement.appendChild(cancelButton);

		let qPromise = null;
		let qResolve = null;
		await new Promise((finish) => {
			// Will be this request's (kind of) semaphore
			qPromise = new Promise((r) => (qResolve = r));
			generationQueue.push(qPromise);

			// Wait for last generation to end
			if (generationQueue.length > 1) {
				(async () => {
					await generationQueue[generationQueue.length - 2];
					finish();
				})();
			} else {
				// If this is the first, just continue
				finish();
			}
		});
		if (!cancelled) {
			imageCollection.inputElement.removeChild(cancelButton);
			stopQueueMarchingAnts();
		}

		return {promise: qPromise, resolve: qResolve};
	};

	const nextQueue = (queueEntry) => {
		const generationIndex = generationQueue.findIndex(
			(v) => v === queueEntry.promise
		);
		generationQueue.splice(generationIndex, 1);
		queueEntry.resolve();
	};

	const initialQ = await waitQueue();

	if (cancelled) {
		nextQueue(initialQ);
		return;
	}

	// Save masked content
	let keepUnmaskCanvas = null;
	let keepUnmaskCtx = null;

	if (options.keepUnmask) {
		const visibleCanvas = uil.getVisible({
			x: bb.x - options.keepUnmaskBlur,
			y: bb.y - options.keepUnmaskBlur,
			w: bb.w + 2 * options.keepUnmaskBlur,
			h: bb.h + 2 * options.keepUnmaskBlur,
		});
		const visibleCtx = visibleCanvas.getContext("2d");

		const ctx = options.keepUnmask.getContext("2d", {willReadFrequently: true});

		// Save current image
		keepUnmaskCanvas = document.createElement("canvas");
		keepUnmaskCanvas.width = options.keepUnmask.width;
		keepUnmaskCanvas.height = options.keepUnmask.height;

		keepUnmaskCtx = keepUnmaskCanvas.getContext("2d", {
			willReadFrequently: true,
		});

		if (
			visibleCanvas.width !==
				keepUnmaskCanvas.width + 2 * options.keepUnmaskBlur ||
			visibleCanvas.height !==
				keepUnmaskCanvas.height + 2 * options.keepUnmaskBlur
		) {
			throw new Error(
				"[dream] Provided mask is not the same size as the bounding box"
			);
		}

		// Cut out changing elements
		const blurMaskCanvas = document.createElement("canvas");
		// A bit bigger to handle literal corner cases
		blurMaskCanvas.width = bb.w + options.keepUnmaskBlur * 2;
		blurMaskCanvas.height = bb.h + options.keepUnmaskBlur * 2;
		const blurMaskCtx = blurMaskCanvas.getContext("2d");

		const blurMaskData = blurMaskCtx.getImageData(
			options.keepUnmaskBlur,
			options.keepUnmaskBlur,
			keepUnmaskCanvas.width,
			keepUnmaskCanvas.height
		);

		const image = blurMaskData.data;

		const maskData = ctx.getImageData(
			0,
			0,
			options.keepUnmask.width,
			options.keepUnmask.height
		);

		const mask = maskData.data;

		for (let i = 0; i < mask.length; i += 4) {
			if (mask[i] !== 0 || mask[i + 1] !== 0 || mask[i + 2] !== 0) {
				// If pixel is fully black
				// Set pixel as fully black here as well
				image[i] = 0;
				image[i + 1] = 0;
				image[i + 2] = 0;
				image[i + 3] = 255;
			}
		}

		blurMaskCtx.putImageData(
			blurMaskData,
			options.keepUnmaskBlur,
			options.keepUnmaskBlur
		);

		visibleCtx.filter = `blur(${options.keepUnmaskBlur}px)`;
		visibleCtx.globalCompositeOperation = "destination-out";
		visibleCtx.drawImage(blurMaskCanvas, 0, 0);

		keepUnmaskCtx.drawImage(
			visibleCanvas,
			-options.keepUnmaskBlur,
			-options.keepUnmaskBlur
		);
	}

	// Images to select through
	let at = 0;
	/** @type {Array<string|null>} */
	const images = [null];
	const seeds = [-1];
	/** @type {HTMLDivElement} */
	let imageSelectMenu = null;
	// Layer for the images
	const layer = imageCollection.registerLayer(null, {
		after: maskPaintLayer,
	});

	const redraw = (url = images[at]) => {
		if (url === null) layer.clear();
		if (!url) return;

		const img = new Image();
		img.src = "data:image/png;base64," + url;
		img.addEventListener("load", () => {
			const canvas = document.createElement("canvas");
			canvas.width = bb.w;
			canvas.height = bb.h;

			// Creates new canvas for blurred mask
			const blurMaskCanvas = document.createElement("canvas");
			blurMaskCanvas.width = bb.w + options.keepUnmaskBlur * 2;
			blurMaskCanvas.height = bb.h + options.keepUnmaskBlur * 2;

			const ctx = canvas.getContext("2d");
			ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, bb.w, bb.h);

			if (keepUnmaskCanvas) {
				ctx.drawImage(keepUnmaskCanvas, 0, 0);
			}

			layer.clear();
			layer.ctx.drawImage(
				canvas,
				0,
				0,
				canvas.width,
				canvas.height,
				bb.x,
				bb.y,
				bb.w,
				bb.h
			);
		});
	};

	// Add Interrupt Button
	const interruptButton = makeElement("button", bb.x + bb.w - 100, bb.y + bb.h);
	interruptButton.classList.add("dream-stop-btn");
	interruptButton.textContent = "Interrupt";
	interruptButton.addEventListener("click", () => {
		fetch(`${host}${url}interrupt`, {method: "POST"});
		interruptButton.disabled = true;
	});
	const marchingOptions = {};
	const stopMarchingAnts = march(bb, marchingOptions);

	// First Dream Run
	console.info(`[dream] Generating images for prompt '${request.prompt}'`);
	console.debug(request);

	let stopProgress = null;
	try {
		let stopDrawingStatus = false;
		let lastProgress = 0;
		let nextCP = options.drawEvery;
		stopProgress = _monitorProgress(bb, (data) => {
			if (stopDrawingStatus) return;

			if (lastProgress < nextCP && data.progress >= nextCP) {
				nextCP += options.drawEvery;
				fetch(`${host}${url}progress?skip_current_image=false`).then(
					async (response) => {
						if (stopDrawingStatus) return;
						const imagedata = await response.json();
						redraw(imagedata.current_image);
					}
				);
			}
			lastProgress = data.progress;
		});

		imageCollection.inputElement.appendChild(interruptButton);
		var dreamData = await _dream(endpoint, requestCopy);
		images.push(...dreamData.images);
		seeds.push(...dreamData.seeds);
		stopDrawingStatus = true;
		at = 1;
	} catch (e) {
		alert(
			`Error generating images. Please try again or see console for more details`
		);
		console.warn(`[dream] Error generating images:`);
		console.warn(e);
	} finally {
		stopProgress();
		imageCollection.inputElement.removeChild(interruptButton);
	}

	// Image navigation
	const prevImg = () => {
		at--;
		if (at < 0) at = images.length - 1;

		imageindextxt.textContent = `${at}/${images.length - 1}`;
		var seed = seeds[at];
		seedbtn.title = "Use seed " + seed;
		redraw();
	};

	const nextImg = () => {
		at++;
		if (at >= images.length) at = 0;

		imageindextxt.textContent = `${at}/${images.length - 1}`;
		var seed = seeds[at];
		seedbtn.title = "Use seed " + seed;
		redraw();
	};

	const applyImg = async () => {
		if (!images[at]) return;

		const img = new Image();
		// load the image data after defining the closure
		img.src = "data:image/png;base64," + images[at];
		img.addEventListener("load", () => {
			const canvas = document.createElement("canvas");
			canvas.width = bb.w;
			canvas.height = bb.h;
			const ctx = canvas.getContext("2d");
			ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, bb.w, bb.h);

			if (keepUnmaskCanvas) {
				ctx.drawImage(keepUnmaskCanvas, 0, 0);
			}

			commands.runCommand("drawImage", "Image Dream", {
				x: bb.x,
				y: bb.y,
				w: bb.w,
				h: bb.h,
				image: canvas,
			});
			clean(true);
		});
	};

	const makeMore = async () => {
		const moreQ = await waitQueue();
		try {
			stopProgress = _monitorProgress(bb);
			interruptButton.disabled = false;
			imageCollection.inputElement.appendChild(interruptButton);
			if (requestCopy.seed != -1) {
				requestCopy.seed =
					parseInt(requestCopy.seed) +
					requestCopy.batch_size * requestCopy.n_iter;
			}
			dreamData = await _dream(endpoint, requestCopy);
			images.push(...dreamData.images);
			seeds.push(...dreamData.seeds);
			imageindextxt.textContent = `${at}/${images.length - 1}`;
		} catch (e) {
			alert(
				`Error generating images. Please try again or see console for more details`
			);
			console.warn(`[dream] Error generating images:`);
			console.warn(e);
		} finally {
			stopProgress();
			imageCollection.inputElement.removeChild(interruptButton);
		}

		nextQueue(moreQ);
	};

	const discardImg = async () => {
		clean();
	};

	const saveImg = async () => {
		if (!images[at]) return;

		const img = new Image();
		// load the image data after defining the closure
		img.src = "data:image/png;base64," + images[at];
		img.addEventListener("load", () => {
			const canvas = document.createElement("canvas");
			canvas.width = img.width;
			canvas.height = img.height;
			canvas.getContext("2d").drawImage(img, 0, 0);

			downloadCanvas({
				canvas,
				filename: `openOutpaint - dream - ${request.prompt} - ${at}.png`,
			});
		});
	};

	// Listen for keyboard arrows
	const onarrow = (evn) => {
		switch (evn.target.tagName.toLowerCase()) {
			case "input":
			case "textarea":
			case "select":
			case "button":
				return; // If in an input field, do not process arrow input
			default:
				// Do nothing
				break;
		}

		switch (evn.key) {
			case "+":
				makeMore();
				break;
			default:
				switch (evn.code) {
					case "ArrowRight":
						nextImg();
						break;
					case "ArrowLeft":
						prevImg();
						break;
					case "Enter":
						applyImg();
						break;
					case "Escape":
						discardImg();
						break;
					default:
						break;
				}
				break;
		}
	};

	keyboard.listen.onkeyclick.on(onarrow);

	// For handling mouse events for navigation
	const onmovehandler = mouse.listen.world.onmousemove.on(
		(evn, state) => {
			const contains = bb.contains(evn.x, evn.y);

			if (!contains && !state.dream_processed)
				imageCollection.inputElement.style.cursor = "auto";
			if (!contains || state.dream_processed) marchingOptions.style = "#FFF";

			if (!state.dream_processed && contains) {
				marchingOptions.style = "#F55";

				imageCollection.inputElement.style.cursor = "pointer";

				state.dream_processed = true;
			}
		},
		0,
		true
	);

	const onclickhandler = mouse.listen.world.btn.left.onclick.on(
		(evn, state) => {
			if (!state.dream_processed && bb.contains(evn.x, evn.y)) {
				applyImg();
				imageCollection.inputElement.style.cursor = "auto";
				state.dream_processed = true;
			}
		},
		1,
		true
	);
	const oncancelhandler = mouse.listen.world.btn.right.onclick.on(
		(evn, state) => {
			if (!state.dream_processed && bb.contains(evn.x, evn.y)) {
				discardImg();
				imageCollection.inputElement.style.cursor = "auto";
				state.dream_processed = true;
			}
		},
		1,
		true
	);
	const onmorehandler = mouse.listen.world.btn.middle.onclick.on(
		(evn, state) => {
			if (
				!state.dream_processed &&
				bb.contains(evn.x, evn.y) &&
				!evn.evn.ctrlKey
			) {
				makeMore();
				state.dream_processed = true;
			}
		},
		1,
		true
	);
	const onwheelhandler = mouse.listen.world.onwheel.on(
		(evn, state) => {
			if (evn.evn.ctrlKey) return;
			if (!state.dream_processed && bb.contains(evn.x, evn.y)) {
				if (evn.delta < 0) nextImg();
				else prevImg();
				state.dream_processed = true;
			}
		},
		1,
		true
	);

	// Cleans up
	const clean = (removeBrushMask = false) => {
		if (removeBrushMask) {
			maskPaintCtx.clearRect(bb.x, bb.y, bb.w, bb.h);
		}
		stopMarchingAnts();
		imageCollection.inputElement.removeChild(imageSelectMenu);
		imageCollection.deleteLayer(layer);
		keyboard.listen.onkeyclick.clear(onarrow);
		// Remove area from no-generate list
		generationAreas.delete(areaid);

		// Stop handling inputs
		mouse.listen.world.onmousemove.clear(onmovehandler);
		mouse.listen.world.btn.left.onclick.clear(onclickhandler);
		mouse.listen.world.btn.right.onclick.clear(oncancelhandler);
		mouse.listen.world.btn.middle.onclick.clear(onmorehandler);
		mouse.listen.world.onwheel.clear(onwheelhandler);
	};

	redraw();

	imageSelectMenu = makeElement("div", bb.x, bb.y + bb.h);

	const imageindextxt = document.createElement("button");
	imageindextxt.textContent = `${at}/${images.length - 1}`;
	imageindextxt.addEventListener("click", () => {
		at = 0;

		imageindextxt.textContent = `${at}/${images.length - 1}`;
		redraw();
	});

	const backbtn = document.createElement("button");
	backbtn.textContent = "<";
	backbtn.title = "Previous Image";
	backbtn.addEventListener("click", prevImg);
	imageSelectMenu.appendChild(backbtn);
	imageSelectMenu.appendChild(imageindextxt);

	const nextbtn = document.createElement("button");
	nextbtn.textContent = ">";
	nextbtn.title = "Next Image";
	nextbtn.addEventListener("click", nextImg);
	imageSelectMenu.appendChild(nextbtn);

	const morebtn = document.createElement("button");
	morebtn.textContent = "+";
	morebtn.title = "Generate More";
	morebtn.addEventListener("click", makeMore);
	imageSelectMenu.appendChild(morebtn);

	const acceptbtn = document.createElement("button");
	acceptbtn.textContent = "Y";
	acceptbtn.title = "Apply Current";
	acceptbtn.addEventListener("click", applyImg);
	imageSelectMenu.appendChild(acceptbtn);

	const discardbtn = document.createElement("button");
	discardbtn.textContent = "N";
	discardbtn.title = "Cancel";
	discardbtn.addEventListener("click", discardImg);
	imageSelectMenu.appendChild(discardbtn);

	const resourcebtn = document.createElement("button");
	resourcebtn.textContent = "R";
	resourcebtn.title = "Save to Resources";
	resourcebtn.addEventListener("click", async () => {
		const img = new Image();
		// load the image data after defining the closure
		img.src = "data:image/png;base64," + images[at];
		img.addEventListener("load", () => {
			const response = prompt(
				"Enter new resource name",
				"Dream Resource " + seeds[at]
			);
			if (response) {
				tools.stamp.state.addResource(response, img);
				redraw(); // Redraw to avoid strange cursor behavior
			}
		});
	});
	imageSelectMenu.appendChild(resourcebtn);

	const savebtn = document.createElement("button");
	savebtn.textContent = "S";
	savebtn.title = "Download image to computer";
	savebtn.addEventListener("click", async () => {
		saveImg();
	});
	imageSelectMenu.appendChild(savebtn);

	const seedbtn = document.createElement("button");
	seedbtn.textContent = "U";
	seedbtn.title = "Use seed " + `${seeds[at]}`;
	seedbtn.addEventListener("click", () => {
		sendSeed(seeds[at]);
	});
	imageSelectMenu.appendChild(seedbtn);

	nextQueue(initialQ);
};

/**
 * Callback for generating a image (dream tool)
 *
 * @param {*} evn
 * @param {*} state
 */
const dream_generate_callback = async (bb, resolution, state) => {
	// Build request to the API
	const request = {};
	Object.assign(request, stableDiffusionData);

	request.width = resolution.w;
	request.height = resolution.h;

	// Load prompt (maybe we should add some events so we don't have to do this)
	request.prompt = document.getElementById("prompt").value;
	request.negative_prompt = document.getElementById("negPrompt").value;

	// Get visible pixels
	const visibleCanvas = uil.getVisible(bb);

	// Use txt2img if canvas is blank
	if (isCanvasBlank(0, 0, bb.w, bb.h, visibleCanvas)) {
		// Dream
		_generate("txt2img", request, bb);
	} else {
		// Use img2img if not

		// Temporary canvas for init image and mask generation
		const bbCanvas = document.createElement("canvas");
		bbCanvas.width = bb.w;
		bbCanvas.height = bb.h;
		const bbCtx = bbCanvas.getContext("2d");

		const reqCanvas = document.createElement("canvas");
		reqCanvas.width = request.width;
		reqCanvas.height = request.height;
		const reqCtx = reqCanvas.getContext("2d");

		bbCtx.fillStyle = "#000F";

		// Get init image
		reqCtx.fillRect(0, 0, request.width, request.height);
		reqCtx.drawImage(
			visibleCanvas,
			0,
			0,
			bb.w,
			bb.h,
			0,
			0,
			request.width,
			request.height
		);
		request.init_images = [reqCanvas.toDataURL()];

		// Get mask image
		bbCtx.fillStyle = "#000F";
		bbCtx.fillRect(0, 0, bb.w, bb.h);
		if (state.invertMask) {
			// overmasking by definition is entirely pointless with an inverted mask outpaint
			// since it should explicitly avoid brushed masks too, we just won't even bother
			bbCtx.globalCompositeOperation = "destination-in";
			bbCtx.drawImage(
				maskPaintCanvas,
				bb.x + maskPaintLayer.origin.x,
				bb.y + maskPaintLayer.origin.y,
				bb.w,
				bb.h,
				0,
				0,
				bb.w,
				bb.h
			);

			bbCtx.globalCompositeOperation = "destination-in";
			bbCtx.drawImage(visibleCanvas, 0, 0);
		} else {
			bbCtx.globalCompositeOperation = "destination-in";
			bbCtx.drawImage(visibleCanvas, 0, 0);
			// here's where to overmask to avoid including the brushed mask
			// 99% of my issues were from failing to set source-over for the overmask blotches
			if (state.overMaskPx > 0) {
				// transparent to white first
				bbCtx.globalCompositeOperation = "destination-atop";
				bbCtx.fillStyle = "#FFFF";
				bbCtx.fillRect(0, 0, bb.w, bb.h);
				applyOvermask(bbCanvas, bbCtx, state.overMaskPx);
			}

			bbCtx.globalCompositeOperation = "destination-out"; // ???
			bbCtx.drawImage(
				maskPaintCanvas,
				bb.x + maskPaintLayer.origin.x,
				bb.y + maskPaintLayer.origin.y,
				bb.w,
				bb.h,
				0,
				0,
				bb.w,
				bb.h
			);
		}

		bbCtx.globalCompositeOperation = "destination-atop";
		bbCtx.fillStyle = "#FFFF";
		bbCtx.fillRect(0, 0, bb.w, bb.h);

		reqCtx.clearRect(0, 0, reqCanvas.width, reqCanvas.height);
		reqCtx.drawImage(
			bbCanvas,
			0,
			0,
			bb.w,
			bb.h,
			0,
			0,
			request.width,
			request.height
		);
		request.mask = reqCanvas.toDataURL();

		// Dream
		_generate("img2img", request, bb, {
			keepUnmask: state.keepUnmasked ? bbCanvas : null,
			keepUnmaskBlur: state.keepUnmaskedBlur,
		});
	}
};
const dream_erase_callback = (bb) => {
	commands.runCommand("eraseImage", "Erase Area", bb);
};

function applyOvermask(canvas, ctx, px) {
	// :badpokerface: look it might be all placebo but i like overmask lol
	// yes it's crushingly inefficient i knooow :( must fix
	// https://stackoverflow.com/a/30204783 was instrumental to this working or completely to blame for this disaster depending on your interpretation
	ctx.globalCompositeOperation = "source-over";
	var ctxImgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	for (i = 0; i < ctxImgData.data.length; i += 4) {
		if (ctxImgData.data[i] == 255) {
			// white pixel?
			// just blotch all over the thing
			/**
			 * This should probably have a better randomness profile for the overmasking
			 *
			 * Essentially, we want to have much more smaller values for randomness than big ones,
			 * because big values overshadow smaller circles and kinda ignores their randomness.
			 *
			 * And also, we want the profile to become more extreme the bigger the overmask size,
			 * because bigger px values also make bigger circles ocuppy more horizontal space.
			 */
			let lowRandom =
				Math.atan(Math.random() * 10 - 10) / Math.abs(Math.atan(-10)) + 1;
			lowRandom = Math.pow(lowRandom, px / 8);

			var rando = Math.floor(lowRandom * px);
			ctx.beginPath();
			ctx.arc(
				(i / 4) % canvas.width,
				Math.floor(i / 4 / canvas.width),
				rando, // was 4 * sf + rando, too big, but i think i want it more ... random
				0,
				2 * Math.PI,
				true
			);
			ctx.fillStyle = "#FFFF";
			ctx.fill();
		}
	}
}

/**
 * Image to Image
 */
const dream_img2img_callback = (bb, resolution, state) => {
	// Get visible pixels
	const visibleCanvas = uil.getVisible(bb);

	// Do nothing if no image exists
	if (isCanvasBlank(0, 0, bb.w, bb.h, visibleCanvas)) return;

	// Build request to the API
	const request = {};
	Object.assign(request, stableDiffusionData);

	request.width = resolution.w;
	request.height = resolution.h;

	request.denoising_strength = state.denoisingStrength;
	request.inpainting_fill = 1; // For img2img use original

	// Load prompt (maybe we should add some events so we don't have to do this)
	request.prompt = document.getElementById("prompt").value;
	request.negative_prompt = document.getElementById("negPrompt").value;

	// Use img2img

	// Temporary canvas for init image and mask generation
	const bbCanvas = document.createElement("canvas");
	bbCanvas.width = bb.w;
	bbCanvas.height = bb.h;
	const bbCtx = bbCanvas.getContext("2d");

	bbCtx.fillStyle = "#000F";

	// Get init image
	bbCtx.fillRect(0, 0, bb.w, bb.h);
	bbCtx.drawImage(visibleCanvas, 0, 0);
	request.init_images = [bbCanvas.toDataURL()];

	// Get mask image
	bbCtx.fillStyle = state.invertMask ? "#FFFF" : "#000F";
	bbCtx.fillRect(0, 0, bb.w, bb.h);
	bbCtx.globalCompositeOperation = "destination-out";
	bbCtx.drawImage(
		maskPaintCanvas,
		bb.x + maskPaintLayer.origin.x,
		bb.y + maskPaintLayer.origin.y,
		bb.w,
		bb.h,
		0,
		0,
		bb.w,
		bb.h
	);

	bbCtx.globalCompositeOperation = "destination-atop";
	bbCtx.fillStyle = state.invertMask ? "#000F" : "#FFFF";
	bbCtx.fillRect(0, 0, bb.w, bb.h);

	// Border Mask
	if (state.keepBorderSize > 0) {
		const keepBorderCanvas = document.createElement("canvas");
		keepBorderCanvas.width = request.width;
		keepBorderCanvas.height = request.height;
		const keepBorderCtx = keepBorderCanvas.getContext("2d");
		keepBorderCtx.fillStyle = "#000F";

		if (state.gradient) {
			const lg = keepBorderCtx.createLinearGradient(
				0,
				0,
				state.keepBorderSize,
				0
			);
			lg.addColorStop(0, "#000F");
			lg.addColorStop(1, "#0000");
			keepBorderCtx.fillStyle = lg;
		}
		keepBorderCtx.fillRect(0, 0, state.keepBorderSize, request.height);
		if (state.gradient) {
			const tg = keepBorderCtx.createLinearGradient(
				0,
				0,
				0,
				state.keepBorderSize
			);
			tg.addColorStop(0, "#000F");
			tg.addColorStop(1, "#0000");
			keepBorderCtx.fillStyle = tg;
		}
		keepBorderCtx.fillRect(0, 0, request.width, state.keepBorderSize);
		if (state.gradient) {
			const rg = keepBorderCtx.createLinearGradient(
				request.width,
				0,
				request.width - state.keepBorderSize,
				0
			);
			rg.addColorStop(0, "#000F");
			rg.addColorStop(1, "#0000");
			keepBorderCtx.fillStyle = rg;
		}
		keepBorderCtx.fillRect(
			request.width - state.keepBorderSize,
			0,
			state.keepBorderSize,
			request.height
		);
		if (state.gradient) {
			const bg = keepBorderCtx.createLinearGradient(
				0,
				request.height,
				0,
				request.height - state.keepBorderSize
			);
			bg.addColorStop(0, "#000F");
			bg.addColorStop(1, "#0000");
			keepBorderCtx.fillStyle = bg;
		}
		keepBorderCtx.fillRect(
			0,
			request.height - state.keepBorderSize,
			request.width,
			state.keepBorderSize
		);

		bbCtx.globalCompositeOperation = "source-over";
		bbCtx.drawImage(
			keepBorderCanvas,
			0,
			0,
			request.width,
			request.height,
			0,
			0,
			bb.w,
			bb.h
		);
	}

	const reqCanvas = document.createElement("canvas");
	reqCanvas.width = request.width;
	reqCanvas.height = request.height;
	const reqCtx = reqCanvas.getContext("2d");

	reqCtx.drawImage(
		bbCanvas,
		0,
		0,
		bb.w,
		bb.h,
		0,
		0,
		request.width,
		request.height
	);

	request.mask = reqCanvas.toDataURL();
	request.inpaint_full_res = state.fullResolution;

	// Dream
	_generate("img2img", request, bb, {
		keepUnmask: state.keepUnmasked ? bbCanvas : null,
		keepUnmaskBlur: state.keepUnmaskedBlur,
	});
};

/**
 * Dream and img2img tools
 */

/**
 * Generic wheel handler
 */

const _dream_onwheel = (evn, state) => {
	if (!evn.evn.ctrlKey) {
		// Seems mouse wheel scroll is very different between different browsers.
		// Will use scroll as just an event to go to the next cursor snap position instead.
		//
		// TODO: Someone that has a smooth scrolling mouse should verify if this works with them.

		const v = state.cursorSize - 128 * (evn.delta / Math.abs(evn.delta));

		state.cursorSize = state.setCursorSize(v + snap(v, 0, 128));
		state.mousemovecb(evn);
	}
};

/**
 * Registers Tools
 */
const dreamTool = () =>
	toolbar.registerTool(
		"/res/icons/image-plus.svg",
		"Dream",
		(state, opt) => {
			// Draw new cursor immediately
			uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
			state.lastMouseMove = {
				...mouse.coords.world.pos,
			};
			state.redraw();

			// Start Listeners
			mouse.listen.world.onmousemove.on(state.mousemovecb);
			mouse.listen.world.onwheel.on(state.wheelcb);

			mouse.listen.world.btn.left.onclick.on(state.dreamcb);
			mouse.listen.world.btn.right.onclick.on(state.erasecb);

			// Select Region listeners
			mouse.listen.world.btn.left.ondragstart.on(state.dragstartcb);
			mouse.listen.world.btn.left.ondrag.on(state.dragcb);
			mouse.listen.world.btn.left.ondragend.on(state.dragendcb);

			mouse.listen.world.onmousemove.on(state.smousemovecb, 2, true);
			mouse.listen.world.onwheel.on(state.swheelcb, 2, true);
			mouse.listen.world.btn.left.onclick.on(state.sdreamcb, 2, true);
			mouse.listen.world.btn.right.onclick.on(state.serasecb, 2, true);
			mouse.listen.world.btn.middle.onclick.on(state.smiddlecb, 2, true);

			// Clear Selection
			state.selection.deselect();

			// Display Mask
			setMask(state.invertMask ? "hold" : "clear");

			// update cursor size if matching is enabled
			if (stableDiffusionData.sync_cursor_size) {
				state.setCursorSize(stableDiffusionData.width);
			}
		},
		(state, opt) => {
			// Clear Listeners
			mouse.listen.world.onmousemove.clear(state.mousemovecb);
			mouse.listen.world.onwheel.clear(state.wheelcb);

			mouse.listen.world.btn.left.onclick.clear(state.dreamcb);
			mouse.listen.world.btn.right.onclick.clear(state.erasecb);

			// Clear Select Region listeners
			mouse.listen.world.btn.left.ondragstart.clear(state.dragstartcb);
			mouse.listen.world.btn.left.ondrag.clear(state.dragcb);
			mouse.listen.world.btn.left.ondragend.clear(state.dragendcb);

			mouse.listen.world.onmousemove.clear(state.smousemovecb);
			mouse.listen.world.onwheel.clear(state.swheelcb);
			mouse.listen.world.btn.left.onclick.clear(state.sdreamcb);
			mouse.listen.world.btn.right.onclick.clear(state.serasecb);
			mouse.listen.world.btn.middle.onclick.clear(state.smiddlecb);

			// Clear Selection
			state.selection.deselect();

			// Hide Mask
			setMask("none");

			uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
		},
		{
			init: (state) => {
				state.config = {
					cursorSizeScrollSpeed: 1,
				};

				state.cursorSize = 512;
				state.snapToGrid = true;
				state.invertMask = false;
				state.keepUnmasked = true;
				state.keepUnmaskedBlur = 8;
				state.overMaskPx = 0;

				state.erasePrevCursor = () =>
					uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
				state.erasePrevReticle = () =>
					uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);

				state.lastMouseMove = {
					...mouse.coords.world.pos,
				};

				/**
				 * Selection handlers
				 */
				const selection = _tool._draggable_selection(state);
				state.dragstartcb = (evn) => selection.dragstartcb(evn);
				state.dragcb = (evn) => selection.dragcb(evn);
				state.dragendcb = (evn) => selection.dragendcb(evn);
				state.smousemovecb = (evn, estate) => {
					selection.smousemovecb(evn);
					if (selection.inside) {
						imageCollection.inputElement.style.cursor = "pointer";

						estate.dream_processed = true;
					} else {
						imageCollection.inputElement.style.cursor = "auto";
					}
				};
				state.swheelcb = (evn, estate) => {
					if (selection.inside) {
						state.wheelcb(evn, {});
						estate.dream_processed = true;
					}
				};

				state.sdreamcb = (evn, estate) => {
					if (selection.exists && !selection.inside) {
						selection.deselect();
						state.redraw();
						estate.selection_processed = true;
					}
					if (selection.inside) {
						state.dreamcb(evn, {});
						estate.dream_processed = true;
					}
				};

				state.serasecb = (evn, estate) => {
					if (selection.inside) {
						selection.deselect();
						state.redraw();
						estate.dream_processed = true;
					}
				};
				state.smiddlecb = (evn, estate) => {
					if (selection.inside) {
						estate.dream_processed = true;
					}
				};

				state.selection = selection;

				/**
				 * Dream Handlers
				 */
				state.mousemovecb = (evn) => {
					state.lastMouseMove = evn;

					state.erasePrevCursor();
					state.erasePrevReticle();

					let x = evn.x;
					let y = evn.y;
					if (state.snapToGrid) {
						x += snap(evn.x, 0, 64);
						y += snap(evn.y, 0, 64);
					}

					state.erasePrevReticle = _tool._cursor_draw(x, y);

					if (state.selection.exists) {
						const bb = state.selection.bb;

						const style =
							state.cursorSize > stableDiffusionData.width
								? "#FBB5"
								: state.cursorSize < stableDiffusionData.width
								? "#BFB5"
								: "#FFF5";

						state.erasePrevReticle = _tool._reticle_draw(
							bb,
							"Dream",
							{
								w: Math.round(
									bb.w * (stableDiffusionData.width / state.cursorSize)
								),
								h: Math.round(
									bb.h * (stableDiffusionData.height / state.cursorSize)
								),
							},
							{
								reticleStyle: state.selection.inside ? "#F55" : "#FFF",
								sizeTextStyle: style,
							}
						);
						return;
					}

					const style =
						state.cursorSize > stableDiffusionData.width
							? "#FBB5"
							: state.cursorSize < stableDiffusionData.width
							? "#BFB5"
							: "#FFF5";
					state.erasePrevReticle = _tool._reticle_draw(
						getBoundingBox(
							evn.x,
							evn.y,
							state.cursorSize,
							state.cursorSize,
							state.snapToGrid && basePixelCount
						),
						"Dream",
						{
							w: stableDiffusionData.width,
							h: stableDiffusionData.height,
						},
						{
							sizeTextStyle: style,
						}
					);
				};

				state.redraw = () => {
					state.mousemovecb(state.lastMouseMove);
				};

				state.wheelcb = (evn, estate) => {
					if (estate.dream_processed) return;
					_dream_onwheel(evn, state);
				};
				state.dreamcb = (evn, estate) => {
					if (estate.dream_processed || estate.selection_processed) return;
					const bb =
						state.selection.bb ||
						getBoundingBox(
							evn.x,
							evn.y,
							state.cursorSize,
							state.cursorSize,
							state.snapToGrid && basePixelCount
						);
					const resolution = state.selection.bb || {
						w: stableDiffusionData.width,
						h: stableDiffusionData.height,
					};
					dream_generate_callback(bb, resolution, state);
					state.selection.deselect();
				};
				state.erasecb = (evn, estate) => {
					if (state.selection.exists) {
						state.selection.deselect();
						state.redraw();
						return;
					}
					if (estate.dream_processed) return;
					const bb = getBoundingBox(
						evn.x,
						evn.y,
						state.cursorSize,
						state.cursorSize,
						state.snapToGrid && basePixelCount
					);
					dream_erase_callback(bb, state);
				};
			},
			populateContextMenu: (menu, state) => {
				if (!state.ctxmenu) {
					state.ctxmenu = {};

					// Cursor Size Slider
					const cursorSizeSlider = _toolbar_input.slider(
						state,
						"cursorSize",
						"Cursor Size",
						{
							min: 128,
							max: 2048,
							step: 128,
							textStep: 2,
							cb: () => {
								if (stableDiffusionData.sync_cursor_size) {
									state.ignorePrevious = true;
									resSlider.value = state.cursorSize;
								}
							},
						}
					);

					state.setCursorSize = cursorSizeSlider.setValue;
					state.ctxmenu.cursorSizeSlider = cursorSizeSlider.slider;

					// Snap to Grid Checkbox
					state.ctxmenu.snapToGridLabel = _toolbar_input.checkbox(
						state,
						"snapToGrid",
						"Snap To Grid"
					).label;

					// Invert Mask Checkbox
					state.ctxmenu.invertMaskLabel = _toolbar_input.checkbox(
						state,
						"invertMask",
						"Invert Mask",
						() => {
							setMask(state.invertMask ? "hold" : "clear");
						}
					).label;

					// Keep Masked Content Checkbox
					state.ctxmenu.keepUnmaskedLabel = _toolbar_input.checkbox(
						state,
						"keepUnmasked",
						"Keep Unmasked",
						() => {
							if (state.keepUnmasked) {
								state.ctxmenu.keepUnmaskedBlurSlider.classList.remove(
									"invisible"
								);
							} else {
								state.ctxmenu.keepUnmaskedBlurSlider.classList.add("invisible");
							}
						}
					).label;

					// Keep Masked Content Blur Slider
					state.ctxmenu.keepUnmaskedBlurSlider = _toolbar_input.slider(
						state,
						"keepUnmaskedBlur",
						"Keep Unmasked Blur",
						{
							min: 0,
							max: 64,
							step: 4,
							textStep: 1,
						}
					).slider;

					// Overmasking Slider
					state.ctxmenu.overMaskPxLabel = _toolbar_input.slider(
						state,
						"overMaskPx",
						"Overmask px",
						{
							min: 0,
							max: 64,
							step: 4,
							textStep: 1,
						}
					).slider;
				}

				menu.appendChild(state.ctxmenu.cursorSizeSlider);
				menu.appendChild(state.ctxmenu.snapToGridLabel);
				menu.appendChild(document.createElement("br"));
				menu.appendChild(state.ctxmenu.invertMaskLabel);
				menu.appendChild(document.createElement("br"));
				menu.appendChild(state.ctxmenu.keepUnmaskedLabel);
				menu.appendChild(state.ctxmenu.keepUnmaskedBlurSlider);
				menu.appendChild(state.ctxmenu.overMaskPxLabel);
			},
			shortcut: "D",
		}
	);

const img2imgTool = () =>
	toolbar.registerTool(
		"/res/icons/image.svg",
		"Img2Img",
		(state, opt) => {
			// Draw new cursor immediately
			state.lastMouseMove = {
				...mouse.coords.world.pos,
			};
			state.redraw();

			// Start Listeners
			mouse.listen.world.onmousemove.on(state.mousemovecb);
			mouse.listen.world.onwheel.on(state.wheelcb);

			mouse.listen.world.btn.left.onclick.on(state.dreamcb);
			mouse.listen.world.btn.right.onclick.on(state.erasecb);

			// Select Region listeners
			mouse.listen.world.btn.left.ondragstart.on(state.dragstartcb);
			mouse.listen.world.btn.left.ondrag.on(state.dragcb);
			mouse.listen.world.btn.left.ondragend.on(state.dragendcb);

			mouse.listen.world.onmousemove.on(state.smousemovecb, 2, true);
			mouse.listen.world.onwheel.on(state.swheelcb, 2, true);
			mouse.listen.world.btn.left.onclick.on(state.sdreamcb, 2, true);
			mouse.listen.world.btn.right.onclick.on(state.serasecb, 2, true);
			mouse.listen.world.btn.middle.onclick.on(state.smiddlecb, 2, true);

			// Clear Selection
			state.selection.deselect();

			// Display Mask
			setMask(state.invertMask ? "hold" : "clear");

			// update cursor size if matching is enabled
			if (stableDiffusionData.sync_cursor_size) {
				state.setCursorSize(stableDiffusionData.width);
			}
		},
		(state, opt) => {
			// Clear Listeners
			mouse.listen.world.onmousemove.clear(state.mousemovecb);
			mouse.listen.world.onwheel.clear(state.wheelcb);

			mouse.listen.world.btn.left.onclick.clear(state.dreamcb);
			mouse.listen.world.btn.right.onclick.clear(state.erasecb);

			// Clear Select Region listeners
			mouse.listen.world.btn.left.ondragstart.clear(state.dragstartcb);
			mouse.listen.world.btn.left.ondrag.clear(state.dragcb);
			mouse.listen.world.btn.left.ondragend.clear(state.dragendcb);

			mouse.listen.world.onmousemove.clear(state.smousemovecb);
			mouse.listen.world.onwheel.clear(state.swheelcb);
			mouse.listen.world.btn.left.onclick.clear(state.sdreamcb);
			mouse.listen.world.btn.right.onclick.clear(state.serasecb);
			mouse.listen.world.btn.middle.onclick.clear(state.smiddlecb);

			// Clear Selection
			state.selection.deselect();

			// Hide mask
			setMask("none");
			uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
		},
		{
			init: (state) => {
				state.config = {
					cursorSizeScrollSpeed: 1,
				};

				state.cursorSize = 512;
				state.snapToGrid = true;
				state.invertMask = true;
				state.keepUnmasked = true;
				state.keepUnmaskedBlur = 8;
				state.fullResolution = false;

				state.denoisingStrength = 0.7;

				state.keepBorderSize = 64;
				state.gradient = true;

				state.erasePrevCursor = () =>
					uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
				state.erasePrevReticle = () =>
					uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);

				state.lastMouseMove = {
					...mouse.coords.world.pos,
				};

				/**
				 * Selection handlers
				 */
				const selection = _tool._draggable_selection(state);
				state.dragstartcb = (evn) => selection.dragstartcb(evn);
				state.dragcb = (evn) => selection.dragcb(evn);
				state.dragendcb = (evn) => selection.dragendcb(evn);
				state.smousemovecb = (evn, estate) => {
					selection.smousemovecb(evn);
					if (selection.inside) {
						imageCollection.inputElement.style.cursor = "pointer";

						estate.dream_processed = true;
					} else {
						imageCollection.inputElement.style.cursor = "auto";
					}
				};
				state.swheelcb = (evn, estate) => {
					if (selection.inside) {
						state.wheelcb(evn, {});
						estate.dream_processed = true;
					}
				};

				state.sdreamcb = (evn, estate) => {
					if (selection.exists && !selection.inside) {
						selection.deselect();
						state.redraw();
						estate.selection_processed = true;
					}
					if (selection.inside) {
						state.dreamcb(evn, {});
						estate.dream_processed = true;
					}
				};

				state.serasecb = (evn, estate) => {
					if (selection.inside) {
						state.erasecb(evn, {});
						estate.dream_processed = true;
					}
				};

				state.smiddlecb = (evn, estate) => {
					if (selection.inside) {
						estate.dream_processed = true;
					}
				};

				state.selection = selection;

				/**
				 * Dream handlers
				 */
				state.mousemovecb = (evn) => {
					state.lastMouseMove = evn;

					state.erasePrevCursor();
					state.erasePrevReticle();

					let x = evn.x;
					let y = evn.y;
					if (state.snapToGrid) {
						x += snap(evn.x, 0, 64);
						y += snap(evn.y, 0, 64);
					}

					state.erasePrevReticle = _tool._cursor_draw(x, y);

					// Resolution
					let bb = null;
					let request = null;

					if (state.selection.exists) {
						bb = state.selection.bb;

						request = {width: bb.w, height: bb.h};

						const style =
							state.cursorSize > stableDiffusionData.width
								? "#FBB5"
								: state.cursorSize < stableDiffusionData.width
								? "#BFB5"
								: "#FFF5";
						state.erasePrevReticle = _tool._reticle_draw(
							bb,
							"Img2Img",
							{
								w: Math.round(
									bb.w * (stableDiffusionData.width / state.cursorSize)
								),
								h: Math.round(
									bb.h * (stableDiffusionData.height / state.cursorSize)
								),
							},
							{
								reticleStyle: state.selection.inside ? "#F55" : "#FFF",
								sizeTextStyle: style,
							}
						);
					} else {
						bb = getBoundingBox(
							evn.x,
							evn.y,
							state.cursorSize,
							state.cursorSize,
							state.snapToGrid && basePixelCount
						);

						request = {
							width: stableDiffusionData.width,
							height: stableDiffusionData.height,
						};

						const style =
							state.cursorSize > stableDiffusionData.width
								? "#FBB5"
								: state.cursorSize < stableDiffusionData.width
								? "#BFB5"
								: "#FFF5";
						state.erasePrevReticle = _tool._reticle_draw(
							bb,
							"Img2Img",
							{w: request.width, h: request.height},
							{
								sizeTextStyle: style,
							}
						);
					}

					if (
						state.selection.exists &&
						(state.selection.selected.now.x ===
							state.selection.selected.start.x ||
							state.selection.selected.now.y ===
								state.selection.selected.start.y)
					) {
						return;
					}

					const bbvp = {
						...viewport.canvasToView(bb.x, bb.y),
						w: viewport.zoom * bb.w,
						h: viewport.zoom * bb.h,
					};

					// For displaying border mask
					const bbCanvas = document.createElement("canvas");
					bbCanvas.width = request.width;
					bbCanvas.height = request.height;
					const bbCtx = bbCanvas.getContext("2d");

					if (state.keepBorderSize > 0) {
						bbCtx.fillStyle = "#6A6AFF30";
						if (state.gradient) {
							const lg = bbCtx.createLinearGradient(
								0,
								0,
								state.keepBorderSize,
								0
							);
							lg.addColorStop(0, "#6A6AFF30");
							lg.addColorStop(1, "#0000");
							bbCtx.fillStyle = lg;
						}
						bbCtx.fillRect(0, 0, state.keepBorderSize, request.height);
						if (state.gradient) {
							const tg = bbCtx.createLinearGradient(
								0,
								0,
								0,
								state.keepBorderSize
							);
							tg.addColorStop(0, "#6A6AFF30");
							tg.addColorStop(1, "#6A6AFF00");
							bbCtx.fillStyle = tg;
						}
						bbCtx.fillRect(0, 0, request.width, state.keepBorderSize);
						if (state.gradient) {
							const rg = bbCtx.createLinearGradient(
								request.width,
								0,
								request.width - state.keepBorderSize,
								0
							);
							rg.addColorStop(0, "#6A6AFF30");
							rg.addColorStop(1, "#6A6AFF00");
							bbCtx.fillStyle = rg;
						}
						bbCtx.fillRect(
							request.width - state.keepBorderSize,
							0,
							state.keepBorderSize,
							request.height
						);
						if (state.gradient) {
							const bg = bbCtx.createLinearGradient(
								0,
								request.height,
								0,
								request.height - state.keepBorderSize
							);
							bg.addColorStop(0, "#6A6AFF30");
							bg.addColorStop(1, "#6A6AFF00");
							bbCtx.fillStyle = bg;
						}
						bbCtx.fillRect(
							0,
							request.height - state.keepBorderSize,
							request.width,
							state.keepBorderSize
						);
						uiCtx.drawImage(
							bbCanvas,
							0,
							0,
							request.width,
							request.height,
							bbvp.x,
							bbvp.y,
							bbvp.w,
							bbvp.h
						);
					}
				};

				state.redraw = () => {
					state.mousemovecb(state.lastMouseMove);
				};

				state.wheelcb = (evn, estate) => {
					if (estate.dream_processed) return;
					_dream_onwheel(evn, state);
				};
				state.dreamcb = (evn, estate) => {
					if (estate.dream_processed || estate.selection_processed) return;
					const bb =
						state.selection.bb ||
						getBoundingBox(
							evn.x,
							evn.y,
							state.cursorSize,
							state.cursorSize,
							state.snapToGrid && basePixelCount
						);
					const resolution = state.selection.bb || {
						w: stableDiffusionData.width,
						h: stableDiffusionData.height,
					};
					dream_img2img_callback(bb, resolution, state);
					state.selection.deselect();
					state.redraw();
				};
				state.erasecb = (evn, estate) => {
					if (estate.dream_processed) return;
					if (state.selection.exists) {
						state.selection.deselect();
						state.redraw();
						return;
					}
					const bb = getBoundingBox(
						evn.x,
						evn.y,
						state.cursorSize,
						state.cursorSize,
						state.snapToGrid && basePixelCount
					);
					dream_erase_callback(bb, state);
				};
			},
			populateContextMenu: (menu, state) => {
				if (!state.ctxmenu) {
					state.ctxmenu = {};

					// Cursor Size Slider
					const cursorSizeSlider = _toolbar_input.slider(
						state,
						"cursorSize",
						"Cursor Size",
						{
							min: 128,
							max: 2048,
							step: 128,
							textStep: 2,
							cb: () => {
								if (stableDiffusionData.sync_cursor_size) {
									state.ignorePrevious = true;
									resSlider.value = state.cursorSize;
								}
							},
						}
					);

					state.setCursorSize = cursorSizeSlider.setValue;
					state.ctxmenu.cursorSizeSlider = cursorSizeSlider.slider;

					// Snap To Grid Checkbox
					state.ctxmenu.snapToGridLabel = _toolbar_input.checkbox(
						state,
						"snapToGrid",
						"Snap To Grid"
					).label;

					// Invert Mask Checkbox
					state.ctxmenu.invertMaskLabel = _toolbar_input.checkbox(
						state,
						"invertMask",
						"Invert Mask",
						() => {
							setMask(state.invertMask ? "hold" : "clear");
						}
					).label;

					// Keep Masked Content Checkbox
					state.ctxmenu.keepUnmaskedLabel = _toolbar_input.checkbox(
						state,
						"keepUnmasked",
						"Keep Unmasked",
						() => {
							if (state.keepUnmasked) {
								state.ctxmenu.keepUnmaskedBlurSlider.classList.remove(
									"invisible"
								);
								state.ctxmenu.keepUnmaskedBlurSliderLinebreak.classList.add(
									"invisible"
								);
							} else {
								state.ctxmenu.keepUnmaskedBlurSlider.classList.add("invisible");
								state.ctxmenu.keepUnmaskedBlurSliderLinebreak.classList.remove(
									"invisible"
								);
							}
						}
					).label;

					// Keep Masked Content Blur Slider
					state.ctxmenu.keepUnmaskedBlurSlider = _toolbar_input.slider(
						state,
						"keepUnmaskedBlur",
						"Keep Unmasked Blur",
						{
							min: 0,
							max: 64,
							step: 4,
							textStep: 1,
						}
					).slider;

					state.ctxmenu.keepUnmaskedBlurSliderLinebreak =
						document.createElement("br");
					state.ctxmenu.keepUnmaskedBlurSliderLinebreak.classList.add(
						"invisible"
					);

					// Inpaint Full Resolution Checkbox
					state.ctxmenu.fullResolutionLabel = _toolbar_input.checkbox(
						state,
						"fullResolution",
						"Inpaint Full Resolution"
					).label;

					// Denoising Strength Slider
					state.ctxmenu.denoisingStrengthSlider = _toolbar_input.slider(
						state,
						"denoisingStrength",
						"Denoising Strength",
						{
							min: 0,
							max: 1,
							step: 0.05,
							textStep: 0.01,
						}
					).slider;

					// Border Mask Gradient Checkbox
					state.ctxmenu.borderMaskGradientCheckbox = _toolbar_input.checkbox(
						state,
						"gradient",
						"Border Mask Gradient"
					).label;

					// Border Mask Size Slider
					state.ctxmenu.borderMaskSlider = _toolbar_input.slider(
						state,
						"keepBorderSize",
						"Keep Border Size",
						{
							min: 0,
							max: 128,
							step: 8,
							textStep: 1,
						}
					).slider;
				}

				menu.appendChild(state.ctxmenu.cursorSizeSlider);
				menu.appendChild(state.ctxmenu.snapToGridLabel);
				menu.appendChild(document.createElement("br"));
				menu.appendChild(state.ctxmenu.invertMaskLabel);
				menu.appendChild(document.createElement("br"));
				menu.appendChild(state.ctxmenu.keepUnmaskedLabel);
				menu.appendChild(state.ctxmenu.keepUnmaskedBlurSlider);
				menu.appendChild(state.ctxmenu.keepUnmaskedBlurSliderLinebreak);
				menu.appendChild(state.ctxmenu.fullResolutionLabel);
				menu.appendChild(document.createElement("br"));
				menu.appendChild(state.ctxmenu.denoisingStrengthSlider);
				menu.appendChild(state.ctxmenu.borderMaskGradientCheckbox);
				menu.appendChild(state.ctxmenu.borderMaskSlider);
			},
			shortcut: "I",
		}
	);

window.onbeforeunload = async () => {
	// Stop current generation on page close
	if (generating) await fetch(`${host}${url}interrupt`, {method: "POST"});
};

const sendSeed = (seed) => {
	stableDiffusionData.seed = document.getElementById("seed").value = seed;
};

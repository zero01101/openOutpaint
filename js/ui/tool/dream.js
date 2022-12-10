let blockNewImages = false;
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

			// Draw Progress Bar
			layer.ctx.fillStyle = "#5F5";
			layer.ctx.fillRect(1, 1, bb.w * data.progress, 10);

			// Draw Progress Text
			layer.ctx.clearRect(0, 11, expanded.w, 40);
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

	return data.images;
};

/**
 * Generate and pick an image for placement
 *
 * @param {"txt2img" | "img2img"} endpoint Endpoint to send the request to
 * @param {StableDiffusionRequest} request Stable diffusion request
 * @param {BoundingBox} bb Generated image placement location
 * @param {number} [drawEvery=0.2 / request.n_iter] Percentage delta to draw progress at (by default 20% of each iteration)
 * @returns {Promise<HTMLImageElement | null>}
 */
const _generate = async (
	endpoint,
	request,
	bb,
	drawEvery = 0.2 / request.n_iter
) => {
	const requestCopy = {...request};

	// Images to select through
	let at = 0;
	/** @type {Array<string|null>} */
	const images = [null];
	/** @type {HTMLDivElement} */
	let imageSelectMenu = null;

	// Layer for the images
	const layer = imageCollection.registerLayer(null, {
		after: maskPaintLayer,
	});

	const makeElement = (type, x, y) => {
		const el = document.createElement(type);
		el.style.position = "absolute";
		el.style.left = `${x - imageCollection.inputOffset.x}px`;
		el.style.top = `${y - imageCollection.inputOffset.y}px`;

		// We can use the input element to add interactible html elements in the world
		imageCollection.inputElement.appendChild(el);

		return el;
	};

	const redraw = (url = images[at]) => {
		if (url === null)
			layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
		if (!url) return;

		const image = new Image();
		image.src = "data:image/png;base64," + url;
		image.addEventListener("load", () => {
			layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
			layer.ctx.drawImage(
				image,
				0,
				0,
				image.width,
				image.height,
				bb.x,
				bb.y,
				bb.w,
				bb.h
			);
		});
	};

	// Add Interrupt Button
	const interruptButton = makeElement("button", bb.x + bb.w - 100, bb.y + bb.h);
	interruptButton.classList.add("dream-interrupt-btn");
	interruptButton.textContent = "Interrupt";
	interruptButton.addEventListener("click", () => {
		fetch(`${host}${url}interrupt`, {method: "POST"});
		interruptButton.disabled = true;
	});
	const stopMarchingAnts = march(bb);

	// First Dream Run
	console.info(`[dream] Generating images for prompt '${request.prompt}'`);
	console.debug(request);

	let stopProgress = null;
	try {
		let stopDrawingStatus = false;
		let lastProgress = 0;
		let nextCP = drawEvery;
		stopProgress = _monitorProgress(bb, (data) => {
			if (stopDrawingStatus) return;

			if (lastProgress < nextCP && data.progress >= nextCP) {
				nextCP += drawEvery;
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
		images.push(...(await _dream(endpoint, requestCopy)));
		stopDrawingStatus = true;
		at = 1;
	} catch (e) {
		alert(
			`Error generating images. Please try again or see consolde for more details`
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
		redraw();
	};

	const nextImg = () => {
		at++;
		if (at >= images.length) at = 0;

		imageindextxt.textContent = `${at}/${images.length - 1}`;
		redraw();
	};

	const applyImg = async () => {
		const img = new Image();
		// load the image data after defining the closure
		img.src = "data:image/png;base64," + images[at];
		img.addEventListener("load", () => {
			commands.runCommand("drawImage", "Image Dream", {
				x: bb.x,
				y: bb.y,
				w: bb.w,
				h: bb.h,
				image: img,
			});
			clean(true);
		});
	};

	const makeMore = async () => {
		try {
			stopProgress = _monitorProgress(bb);
			interruptButton.disabled = false;
			imageCollection.inputElement.appendChild(interruptButton);
			images.push(...(await _dream(endpoint, requestCopy)));
			imageindextxt.textContent = `${at}/${images.length - 1}`;
		} catch (e) {
			alert(
				`Error generating images. Please try again or see consolde for more details`
			);
			console.warn(`[dream] Error generating images:`);
			console.warn(e);
		} finally {
			stopProgress();
			imageCollection.inputElement.removeChild(interruptButton);
		}
	};

	const discardImg = async () => {
		clean();
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

	// Cleans up
	const clean = (removeBrushMask = false) => {
		if (removeBrushMask) {
			maskPaintCtx.clearRect(bb.x, bb.y, bb.w, bb.h);
		}
		stopMarchingAnts();
		imageCollection.inputElement.removeChild(imageSelectMenu);
		imageCollection.deleteLayer(layer);
		blockNewImages = false;
		keyboard.listen.onkeyclick.clear(onarrow);
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
			const response = prompt("Enter new resource name", "Dream Resource");
			if (response) {
				tools.stamp.state.addResource(response, img);
				redraw(); // Redraw to avoid strange cursor behavior
			}
		});
	});
	imageSelectMenu.appendChild(resourcebtn);
};

/**
 * Callback for generating a image (dream tool)
 *
 * @param {*} evn
 * @param {*} state
 */
const dream_generate_callback = async (evn, state) => {
	if (!blockNewImages) {
		const bb = getBoundingBox(
			evn.x,
			evn.y,
			state.cursorSize,
			state.cursorSize,
			state.snapToGrid && basePixelCount
		);

		// Build request to the API
		const request = {};
		Object.assign(request, stableDiffusionData);

		// Load prompt (maybe we should add some events so we don't have to do this)
		request.prompt = document.getElementById("prompt").value;
		request.negative_prompt = document.getElementById("negPrompt").value;

		// Don't allow another image until is finished
		blockNewImages = true;

		// Get visible pixels
		const visibleCanvas = uil.getVisible(bb);

		// Use txt2img if canvas is blank
		if (isCanvasBlank(0, 0, bb.w, bb.h, visibleCanvas)) {
			// Dream
			_generate("txt2img", request, bb);
		} else {
			// Use img2img if not

			// Temporary canvas for init image and mask generation
			const auxCanvas = document.createElement("canvas");
			auxCanvas.width = request.width;
			auxCanvas.height = request.height;
			const auxCtx = auxCanvas.getContext("2d");

			auxCtx.fillStyle = "#000F";

			// Get init image
			auxCtx.fillRect(0, 0, request.width, request.height);
			auxCtx.drawImage(
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
			request.init_images = [auxCanvas.toDataURL()];

			// Get mask image
			auxCtx.fillStyle = "#000F";
			auxCtx.fillRect(0, 0, request.width, request.height);
			if (state.invertMask) {
				// overmasking by definition is entirely pointless with an inverted mask outpaint
				// since it should explicitly avoid brushed masks too, we just won't even bother
				auxCtx.globalCompositeOperation = "destination-in";
				auxCtx.drawImage(
					maskPaintCanvas,
					bb.x,
					bb.y,
					bb.w,
					bb.h,
					0,
					0,
					request.width,
					request.height
				);

				auxCtx.globalCompositeOperation = "destination-in";
				auxCtx.drawImage(
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
			} else {
				auxCtx.globalCompositeOperation = "destination-in";
				auxCtx.drawImage(
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
				// here's where to overmask to avoid including the brushed mask
				// 99% of my issues were from failing to set source-over for the overmask blotches
				if (state.overMaskPx > 0) {
					// transparent to white first
					auxCtx.globalCompositeOperation = "destination-atop";
					auxCtx.fillStyle = "#FFFF";
					auxCtx.fillRect(0, 0, request.width, request.height);
					applyOvermask(auxCanvas, auxCtx, state.overMaskPx);
				}

				auxCtx.globalCompositeOperation = "destination-out"; // ???
				auxCtx.drawImage(
					maskPaintCanvas,
					bb.x,
					bb.y,
					bb.w,
					bb.h,
					0,
					0,
					request.width,
					request.height
				);
			}
			auxCtx.globalCompositeOperation = "destination-atop";
			auxCtx.fillStyle = "#FFFF";
			auxCtx.fillRect(0, 0, request.width, request.height);
			request.mask = auxCanvas.toDataURL();
			// Dream
			_generate("img2img", request, bb);
		}
	}
};
const dream_erase_callback = (evn, state) => {
	const bb = getBoundingBox(
		evn.x,
		evn.y,
		state.cursorSize,
		state.cursorSize,
		state.snapToGrid && basePixelCount
	);
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
const dream_img2img_callback = (evn, state) => {
	if (!blockNewImages) {
		const bb = getBoundingBox(
			evn.x,
			evn.y,
			state.cursorSize,
			state.cursorSize,
			state.snapToGrid && basePixelCount
		);

		// Get visible pixels
		const visibleCanvas = uil.getVisible(bb);

		// Do nothing if no image exists
		if (isCanvasBlank(0, 0, bb.w, bb.h, visibleCanvas)) return;

		// Build request to the API
		const request = {};
		Object.assign(request, stableDiffusionData);

		request.denoising_strength = state.denoisingStrength;
		request.inpainting_fill = 1; // For img2img use original

		// Load prompt (maybe we should add some events so we don't have to do this)
		request.prompt = document.getElementById("prompt").value;
		request.negative_prompt = document.getElementById("negPrompt").value;

		// Don't allow another image until is finished
		blockNewImages = true;

		// Use img2img

		// Temporary canvas for init image and mask generation
		const auxCanvas = document.createElement("canvas");
		auxCanvas.width = request.width;
		auxCanvas.height = request.height;
		const auxCtx = auxCanvas.getContext("2d");

		auxCtx.fillStyle = "#000F";

		// Get init image
		auxCtx.fillRect(0, 0, request.width, request.height);
		auxCtx.drawImage(
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
		request.init_images = [auxCanvas.toDataURL()];

		// Get mask image
		auxCtx.fillStyle = state.invertMask ? "#FFFF" : "#000F";
		auxCtx.fillRect(0, 0, request.width, request.height);
		auxCtx.globalCompositeOperation = "destination-out";
		auxCtx.drawImage(
			maskPaintCanvas,
			bb.x,
			bb.y,
			bb.w,
			bb.h,
			0,
			0,
			request.width,
			request.height
		);

		auxCtx.globalCompositeOperation = "destination-atop";
		auxCtx.fillStyle = state.invertMask ? "#000F" : "#FFFF";
		auxCtx.fillRect(0, 0, request.width, request.height);

		// Border Mask
		if (state.keepBorderSize > 0) {
			auxCtx.globalCompositeOperation = "source-over";
			auxCtx.fillStyle = "#000F";
			if (state.gradient) {
				const lg = auxCtx.createLinearGradient(0, 0, state.keepBorderSize, 0);
				lg.addColorStop(0, "#000F");
				lg.addColorStop(1, "#0000");
				auxCtx.fillStyle = lg;
			}
			auxCtx.fillRect(0, 0, state.keepBorderSize, request.height);
			if (state.gradient) {
				const tg = auxCtx.createLinearGradient(0, 0, 0, state.keepBorderSize);
				tg.addColorStop(0, "#000F");
				tg.addColorStop(1, "#0000");
				auxCtx.fillStyle = tg;
			}
			auxCtx.fillRect(0, 0, request.width, state.keepBorderSize);
			if (state.gradient) {
				const rg = auxCtx.createLinearGradient(
					request.width,
					0,
					request.width - state.keepBorderSize,
					0
				);
				rg.addColorStop(0, "#000F");
				rg.addColorStop(1, "#0000");
				auxCtx.fillStyle = rg;
			}
			auxCtx.fillRect(
				request.width - state.keepBorderSize,
				0,
				state.keepBorderSize,
				request.height
			);
			if (state.gradient) {
				const bg = auxCtx.createLinearGradient(
					0,
					request.height,
					0,
					request.height - state.keepBorderSize
				);
				bg.addColorStop(0, "#000F");
				bg.addColorStop(1, "#0000");
				auxCtx.fillStyle = bg;
			}
			auxCtx.fillRect(
				0,
				request.height - state.keepBorderSize,
				request.width,
				state.keepBorderSize
			);
		}

		request.mask = auxCanvas.toDataURL();
		request.inpaint_full_res = state.fullResolution;

		// Dream
		_generate("img2img", request, bb);
	}
};

/**
 * Dream and img2img tools
 */
const _reticle_draw = (evn, state, tool, style = {}) => {
	defaultOpt(style, {
		sizeTextStyle: "#FFF5",
		toolTextStyle: "#FFF5",
		reticleWidth: 1,
		reticleStyle: "#FFF",
	});

	const bb = getBoundingBox(
		evn.x,
		evn.y,
		state.cursorSize,
		state.cursorSize,
		state.snapToGrid && basePixelCount
	);
	const bbvp = {
		...viewport.canvasToView(bb.x, bb.y),
		w: viewport.zoom * bb.w,
		h: viewport.zoom * bb.h,
	};

	uiCtx.save();

	// draw targeting square reticle thingy cursor
	uiCtx.lineWidth = style.reticleWidth;
	uiCtx.strokeStyle = style.reticleStyle;
	uiCtx.strokeRect(bbvp.x, bbvp.y, bbvp.w, bbvp.h); //origin is middle of the frame

	uiCtx.font = `bold 20px Open Sans`;

	// Draw Tool Name
	{
		const xshrink = Math.min(1, (bbvp.w - 20) / uiCtx.measureText(tool).width);

		uiCtx.font = `bold ${20 * xshrink}px Open Sans`;

		uiCtx.textAlign = "left";
		uiCtx.fillStyle = style.toolTextStyle;
		uiCtx.fillText(
			tool,
			bbvp.x + 10,
			bbvp.y + 10 + 20 * xshrink,
			state.cursorSize
		);
	}

	// Draw width and height
	{
		uiCtx.textAlign = "center";
		uiCtx.fillStyle = style.sizeTextStyle;
		uiCtx.translate(bbvp.x + bbvp.w / 2, bbvp.y + bbvp.h / 2);
		const xshrink = Math.min(
			1,
			(bbvp.w - 30) / uiCtx.measureText(`${state.cursorSize}px`).width
		);
		const yshrink = Math.min(
			1,
			(bbvp.h - 30) / uiCtx.measureText(`${state.cursorSize}px`).width
		);
		uiCtx.font = `bold ${20 * xshrink}px Open Sans`;
		uiCtx.fillText(
			`${state.cursorSize}px`,
			0,
			bbvp.h / 2 - 10 * xshrink,
			state.cursorSize
		);
		uiCtx.rotate(-Math.PI / 2);
		uiCtx.font = `bold ${20 * yshrink}px Open Sans`;
		uiCtx.fillText(
			`${state.cursorSize}px`,
			0,
			bbvp.h / 2 - 10 * yshrink,
			state.cursorSize
		);

		uiCtx.restore();
	}

	return () => {
		uiCtx.save();

		uiCtx.clearRect(bbvp.x - 10, bbvp.y - 10, bbvp.w + 20, bbvp.h + 20);

		uiCtx.restore();
	};
};

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

			// Display Mask
			setMask(state.invertMask ? "hold" : "clear");
		},
		(state, opt) => {
			// Clear Listeners
			mouse.listen.world.onmousemove.clear(state.mousemovecb);
			mouse.listen.world.onwheel.clear(state.wheelcb);
			mouse.listen.world.btn.left.onclick.clear(state.dreamcb);
			mouse.listen.world.btn.right.onclick.clear(state.erasecb);

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
				state.overMaskPx = 0;

				state.erasePrevReticle = () =>
					uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);

				state.lastMouseMove = {
					...mouse.coords.world.pos,
				};

				state.mousemovecb = (evn) => {
					state.lastMouseMove = evn;
					state.erasePrevReticle();
					const style =
						state.cursorSize > stableDiffusionData.width
							? "#FBB5"
							: state.cursorSize < stableDiffusionData.width
							? "#BFB5"
							: "#FFF5";
					state.erasePrevReticle = _reticle_draw(evn, state, "Dream", {
						sizeTextStyle: style,
					});
				};

				state.redraw = () => {
					state.mousemovecb(state.lastMouseMove);
				};

				state.wheelcb = (evn) => {
					_dream_onwheel(evn, state);
				};
				state.dreamcb = (evn) => {
					dream_generate_callback(evn, state);
				};
				state.erasecb = (evn) => dream_erase_callback(evn, state);
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
							min: 0,
							max: 2048,
							step: 128,
							textStep: 2,
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

			// Display Mask
			setMask(state.invertMask ? "hold" : "clear");
		},
		(state, opt) => {
			// Clear Listeners
			mouse.listen.world.onmousemove.clear(state.mousemovecb);
			mouse.listen.world.onwheel.clear(state.wheelcb);
			mouse.listen.world.btn.left.onclick.clear(state.dreamcb);
			mouse.listen.world.btn.right.onclick.clear(state.erasecb);

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
				state.fullResolution = false;

				state.denoisingStrength = 0.7;

				state.keepBorderSize = 64;
				state.gradient = true;

				state.erasePrevReticle = () =>
					uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);

				state.lastMouseMove = {
					...mouse.coords.world.pos,
				};
				state.mousemovecb = (evn) => {
					state.lastMouseMove = evn;
					state.erasePrevReticle();

					const style =
						state.cursorSize > stableDiffusionData.width
							? "#FBB5"
							: state.cursorSize < stableDiffusionData.width
							? "#BFB5"
							: "#FFF5";
					state.erasePrevReticle = _reticle_draw(evn, state, "Img2Img", {
						sizeTextStyle: style,
					});

					const bb = getBoundingBox(
						evn.x,
						evn.y,
						state.cursorSize,
						state.cursorSize,
						state.snapToGrid && basePixelCount
					);

					// Resolution
					const request = {
						width: stableDiffusionData.width,
						height: stableDiffusionData.height,
					};

					const bbvp = {
						...viewport.canvasToView(bb.x, bb.y),
						w: viewport.zoom * bb.w,
						h: viewport.zoom * bb.h,
					};

					// For displaying border mask
					const auxCanvas = document.createElement("canvas");
					auxCanvas.width = request.width;
					auxCanvas.height = request.height;
					const auxCtx = auxCanvas.getContext("2d");

					if (state.keepBorderSize > 0) {
						auxCtx.fillStyle = "#6A6AFF30";
						if (state.gradient) {
							const lg = auxCtx.createLinearGradient(
								0,
								0,
								state.keepBorderSize,
								0
							);
							lg.addColorStop(0, "#6A6AFF30");
							lg.addColorStop(1, "#0000");
							auxCtx.fillStyle = lg;
						}
						auxCtx.fillRect(0, 0, state.keepBorderSize, request.height);
						if (state.gradient) {
							const tg = auxCtx.createLinearGradient(
								0,
								0,
								0,
								state.keepBorderSize
							);
							tg.addColorStop(0, "#6A6AFF30");
							tg.addColorStop(1, "#6A6AFF00");
							auxCtx.fillStyle = tg;
						}
						auxCtx.fillRect(0, 0, request.width, state.keepBorderSize);
						if (state.gradient) {
							const rg = auxCtx.createLinearGradient(
								request.width,
								0,
								request.width - state.keepBorderSize,
								0
							);
							rg.addColorStop(0, "#6A6AFF30");
							rg.addColorStop(1, "#6A6AFF00");
							auxCtx.fillStyle = rg;
						}
						auxCtx.fillRect(
							request.width - state.keepBorderSize,
							0,
							state.keepBorderSize,
							request.height
						);
						if (state.gradient) {
							const bg = auxCtx.createLinearGradient(
								0,
								request.height,
								0,
								request.height - state.keepBorderSize
							);
							bg.addColorStop(0, "#6A6AFF30");
							bg.addColorStop(1, "#6A6AFF00");
							auxCtx.fillStyle = bg;
						}
						auxCtx.fillRect(
							0,
							request.height - state.keepBorderSize,
							request.width,
							state.keepBorderSize
						);
						uiCtx.drawImage(
							auxCanvas,
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

				state.wheelcb = (evn) => {
					_dream_onwheel(evn, state);
				};
				state.dreamcb = (evn) => {
					dream_img2img_callback(evn, state);
				};
				state.erasecb = (evn) => dream_erase_callback(evn, state);
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
							min: 0,
							max: 2048,
							step: 128,
							textStep: 2,
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

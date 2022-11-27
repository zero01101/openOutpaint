const dream_generate_callback = (evn, state) => {
	if (evn.target.id === "overlayCanvas" && !blockNewImages) {
		const bb = getBoundingBox(
			evn.x,
			evn.y,
			basePixelCount * scaleFactor,
			basePixelCount * scaleFactor,
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

		// Setup marching ants
		stopMarching = march(bb);

		// Setup some basic information for SD
		request.width = bb.w;
		request.height = bb.h;

		request.firstphase_width = bb.w / 2;
		request.firstphase_height = bb.h / 2;

		// Use txt2img if canvas is blank
		if (isCanvasBlank(bb.x, bb.y, bb.w, bb.h, imgCanvas)) {
			// Dream
			dream(bb.x, bb.y, request, {method: "txt2img", stopMarching, bb});
		} else {
			// Use img2img if not

			// Temporary canvas for init image and mask generation
			const auxCanvas = document.createElement("canvas");
			auxCanvas.width = request.width;
			auxCanvas.height = request.height;
			const auxCtx = auxCanvas.getContext("2d");

			auxCtx.fillStyle = "#000F";

			// Get init image
			auxCtx.fillRect(0, 0, bb.w, bb.h);
			auxCtx.drawImage(imgCanvas, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h);
			request.init_images = [auxCanvas.toDataURL()];

			// Get mask image
			auxCtx.fillStyle = "#000F";
			auxCtx.fillRect(0, 0, bb.w, bb.h);
			if (state.invertMask) {
				auxCtx.globalCompositeOperation = "destination-in";
				auxCtx.drawImage(
					maskPaintCanvas,
					bb.x,
					bb.y,
					bb.w,
					bb.h,
					0,
					0,
					bb.w,
					bb.h
				);

				auxCtx.globalCompositeOperation = "destination-in";
				auxCtx.drawImage(imgCanvas, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h);
			} else {
				auxCtx.globalCompositeOperation = "destination-in";
				auxCtx.drawImage(imgCanvas, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h);
				auxCtx.globalCompositeOperation = "destination-out";
				auxCtx.drawImage(
					maskPaintCanvas,
					bb.x,
					bb.y,
					bb.w,
					bb.h,
					0,
					0,
					bb.w,
					bb.h
				);
			}
			auxCtx.globalCompositeOperation = "destination-atop";
			auxCtx.fillStyle = "#FFFF";
			auxCtx.fillRect(0, 0, bb.w, bb.h);
			var currentMask = auxCanvas.toDataURL();
			request.mask =
				state.overMaskPx > 0
					? applyOvermask(auxCanvas, auxCtx, state.overMaskPx, currentMask)
					: currentMask;
			// Dream
			dream(bb.x, bb.y, request, {method: "img2img", stopMarching, bb});
		}
	}
};
const dream_erase_callback = (evn, state) => {
	const bb = getBoundingBox(
		evn.x,
		evn.y,
		basePixelCount * scaleFactor,
		basePixelCount * scaleFactor,
		state.snapToGrid && basePixelCount
	);
	commands.runCommand("eraseImage", "Erase Area", bb);
};

function applyOvermask(canvas, ctx, px) {
	// :badpokerface: look it might be all placebo but i like overmask lol
	// yes it's crushingly inefficient i knooow :( must fix
	// https://stackoverflow.com/a/30204783 was instrumental to this working or completely to blame for this disaster depending on your interpretation
	const tmpOvermaskCanvas = document.createElement("canvas");
	tmpOvermaskCanvas.width = canvas.width;
	tmpOvermaskCanvas.height = canvas.height;
	var ctxImgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const omCtx = tmpOvermaskCanvas.getContext("2d");
	omCtx.putImageData(ctxImgData, 0, 0);
	for (i = 0; i < ctxImgData.data.length; i += 4) {
		if (ctxImgData.data[i] == 255) {
			// white pixel?
			// just blotch all over the thing
			var rando = Math.floor(Math.random() * px);
			omCtx.beginPath();
			omCtx.arc(
				(i / 4) % tmpOvermaskCanvas.width,
				Math.floor(i / 4 / tmpOvermaskCanvas.width),
				scaleFactor +
					rando +
					(rando > scaleFactor ? rando / scaleFactor : scaleFactor / rando), // was 4 * sf + rando, too big, but i think i want it more ... random
				0,
				2 * Math.PI,
				true
			);
			omCtx.fillStyle = "#FFFFFFFF";
			omCtx.fill();
		}
	}
	return tmpOvermaskCanvas.toDataURL();
}

/**
 * Image to Image
 */
const dream_img2img_callback = (evn, state) => {
	if (evn.target.id === "overlayCanvas" && !blockNewImages) {
		const bb = getBoundingBox(
			evn.x,
			evn.y,
			basePixelCount * scaleFactor,
			basePixelCount * scaleFactor,
			state.snapToGrid && basePixelCount
		);

		// Do nothing if no image exists
		if (isCanvasBlank(bb.x, bb.y, bb.w, bb.h, imgCanvas)) return;

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

		// Setup marching ants
		stopMarching = march(bb);

		// Setup some basic information for SD
		request.width = bb.w;
		request.height = bb.h;

		request.firstphase_width = bb.w / 2;
		request.firstphase_height = bb.h / 2;

		// Use img2img

		// Temporary canvas for init image and mask generation
		const auxCanvas = document.createElement("canvas");
		auxCanvas.width = request.width;
		auxCanvas.height = request.height;
		const auxCtx = auxCanvas.getContext("2d");

		auxCtx.fillStyle = "#000F";

		// Get init image
		auxCtx.fillRect(0, 0, bb.w, bb.h);
		auxCtx.drawImage(imgCanvas, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h);
		request.init_images = [auxCanvas.toDataURL()];

		// Get mask image
		auxCtx.fillStyle = state.invertMask ? "#FFFF" : "#000F";
		auxCtx.fillRect(0, 0, bb.w, bb.h);
		auxCtx.globalCompositeOperation = "destination-out";
		auxCtx.drawImage(maskPaintCanvas, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h);

		auxCtx.globalCompositeOperation = "destination-atop";
		auxCtx.fillStyle = state.invertMask ? "#000F" : "#FFFF";
		auxCtx.fillRect(0, 0, bb.w, bb.h);

		// Border Mask
		if (state.keepBorderSize > 0) {
			auxCtx.globalCompositeOperation = "source-over";
			auxCtx.fillStyle = "#000F";
			auxCtx.fillRect(0, 0, state.keepBorderSize, bb.h);
			auxCtx.fillRect(0, 0, bb.w, state.keepBorderSize);
			auxCtx.fillRect(
				bb.w - state.keepBorderSize,
				0,
				state.keepBorderSize,
				bb.h
			);
			auxCtx.fillRect(
				0,
				bb.h - state.keepBorderSize,
				bb.w,
				state.keepBorderSize
			);
		}

		request.mask = auxCanvas.toDataURL();
		request.inpaint_full_res = state.fullResolution;

		// Dream
		dream(bb.x, bb.y, request, {method: "img2img", stopMarching, bb});
	}
};

/**
 * Registers Tools
 */
const dreamTool = () =>
	toolbar.registerTool(
		"res/icons/image-plus.svg",
		"Dream",
		(state, opt) => {
			// Draw new cursor immediately
			ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
			state.mousemovecb({
				...mouse.coords.canvas.pos,
				target: {id: "overlayCanvas"},
			});

			// Start Listeners
			mouse.listen.canvas.onmousemove.on(state.mousemovecb);
			mouse.listen.canvas.left.onclick.on(state.dreamcb);
			mouse.listen.canvas.right.onclick.on(state.erasecb);

			// Display Mask
			setMask(state.invertMask ? "hold" : "clear");
		},
		(state, opt) => {
			// Clear Listeners
			mouse.listen.canvas.onmousemove.clear(state.mousemovecb);
			mouse.listen.canvas.left.onclick.clear(state.dreamcb);
			mouse.listen.canvas.right.onclick.clear(state.erasecb);

			// Hide Mask
			setMask("none");
		},
		{
			init: (state) => {
				state.snapToGrid = true;
				state.invertMask = false;
				state.overMaskPx = 0;
				state.mousemovecb = (evn) => _reticle_draw(evn, state.snapToGrid);
				state.dreamcb = (evn) => {
					dream_generate_callback(evn, state);
				};
				state.erasecb = (evn) => dream_erase_callback(evn, state);
			},
			populateContextMenu: (menu, state) => {
				if (!state.ctxmenu) {
					state.ctxmenu = {};

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
						0,
						128,
						1
					).slider;
				}

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
		"res/icons/image.svg",
		"Img2Img",
		(state, opt) => {
			// Draw new cursor immediately
			ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
			state.mousemovecb({
				...mouse.coords.canvas.pos,
				target: {id: "overlayCanvas"},
			});

			// Start Listeners
			mouse.listen.canvas.onmousemove.on(state.mousemovecb);
			mouse.listen.canvas.left.onclick.on(state.dreamcb);
			mouse.listen.canvas.right.onclick.on(state.erasecb);

			// Display Mask
			setMask(state.invertMask ? "hold" : "clear");
		},
		(state, opt) => {
			// Clear Listeners
			mouse.listen.canvas.onmousemove.clear(state.mousemovecb);
			mouse.listen.canvas.left.onclick.clear(state.dreamcb);
			mouse.listen.canvas.right.onclick.clear(state.erasecb);

			// Hide mask
			setMask("none");
		},
		{
			init: (state) => {
				state.snapToGrid = true;
				state.invertMask = true;
				state.fullResolution = false;

				state.denoisingStrength = 0.7;

				state.keepBorderSize = 64;

				state.mousemovecb = (evn) => {
					_reticle_draw(evn, state.snapToGrid);
					if (evn.target.id === "overlayCanvas") {
						const bb = getBoundingBox(
							evn.x,
							evn.y,
							basePixelCount * scaleFactor,
							basePixelCount * scaleFactor,
							state.snapToGrid && basePixelCount
						);

						// For displaying border mask
						const auxCanvas = document.createElement("canvas");
						auxCanvas.width = bb.w;
						auxCanvas.height = bb.h;
						const auxCtx = auxCanvas.getContext("2d");

						if (state.keepBorderSize > 0) {
							auxCtx.fillStyle = "#6A6AFF7F";
							auxCtx.fillRect(0, 0, state.keepBorderSize, bb.h);
							auxCtx.fillRect(0, 0, bb.w, state.keepBorderSize);
							auxCtx.fillRect(
								bb.w - state.keepBorderSize,
								0,
								state.keepBorderSize,
								bb.h
							);
							auxCtx.fillRect(
								0,
								bb.h - state.keepBorderSize,
								bb.w,
								state.keepBorderSize
							);
						}

						const tmp = ovCtx.globalAlpha;
						ovCtx.globalAlpha = 0.4;
						ovCtx.drawImage(auxCanvas, bb.x, bb.y);
						ovCtx.globalAlpha = tmp;
					}
				};
				state.dreamcb = (evn) => {
					dream_img2img_callback(evn, state);
				};
				state.erasecb = (evn) => dream_erase_callback(evn, state);
			},
			populateContextMenu: (menu, state) => {
				if (!state.ctxmenu) {
					state.ctxmenu = {};
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
						0,
						1,
						0.05
					).slider;

					// Border Mask Size Slider
					state.ctxmenu.borderMaskSlider = _toolbar_input.slider(
						state,
						"keepBorderSize",
						"Keep Border Size",
						0,
						128,
						1
					).slider;
				}

				menu.appendChild(state.ctxmenu.snapToGridLabel);
				menu.appendChild(document.createElement("br"));
				menu.appendChild(state.ctxmenu.invertMaskLabel);
				menu.appendChild(document.createElement("br"));
				menu.appendChild(state.ctxmenu.fullResolutionLabel);
				menu.appendChild(document.createElement("br"));
				menu.appendChild(state.ctxmenu.denoisingStrengthSlider);
				menu.appendChild(state.ctxmenu.borderMaskSlider);
			},
			shortcut: "I",
		}
	);

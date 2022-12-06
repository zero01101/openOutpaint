const interrogateTool = () =>
	toolbar.registerTool(
		"res/icons/microscope.svg",
		"Interrogate",
		(state, opt) => {
			// Draw new cursor immediately
			ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
			state.mousemovecb({
				...mouse.coords.world.pos,
			});

			// Start Listeners
			mouse.listen.world.onmousemove.on(state.mousemovecb);
			mouse.listen.world.onwheel.on(state.wheelcb);
			mouse.listen.world.btn.left.onclick.on(state.interrogatecb);
		},
		(state, opt) => {
			// Clear Listeners
			mouse.listen.world.onmousemove.clear(state.mousemovecb);
			mouse.listen.world.onwheel.clear(state.wheelcb);
			mouse.listen.world.btn.left.onclick.clear(state.interrogatecb);

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
					ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);

				state.mousemovecb = (evn) => {
					state.erasePrevReticle();
					state.erasePrevReticle = _reticle_draw(evn, state, "Interrogate");
				};
				state.wheelcb = (evn) => {
					_interrogate_onwheel(evn, state);
				};

				state.interrogatecb = (evn) => {
					interrogate_callback(evn, state);
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
				}

				menu.appendChild(state.ctxmenu.cursorSizeSlider);
				menu.appendChild(state.ctxmenu.snapToGridLabel);
			},
			shortcut: "N",
		}
	);

/**
 * Generic wheel handler
 */

const _interrogate_onwheel = (evn, state) => {
	if (!evn.evn.ctrlKey) {
		const v =
			state.cursorSize -
			Math.floor(state.config.cursorSizeScrollSpeed * evn.delta);
		state.cursorSize = state.setCursorSize(v + snap(v, 0, 128));
		state.mousemovecb(evn);
	}
};

const interrogate_callback = async (evn, state) => {
	const bb = getBoundingBox(
		evn.x,
		evn.y,
		state.cursorSize,
		state.cursorSize,
		state.snapToGrid && basePixelCount
	);
	// Do nothing if no image exists
	const sectionCanvas = uil.getVisible({x: bb.x, y: bb.y, w: bb.w, h: bb.h});

	if (isCanvasBlank(0, 0, bb.w, bb.h, sectionCanvas)) return;

	// Build request to the API
	const request = {};

	// Temporary canvas for interrogated image
	const auxCanvas = document.createElement("canvas");
	auxCanvas.width = bb.w;
	auxCanvas.height = bb.h;
	const auxCtx = auxCanvas.getContext("2d");

	auxCtx.fillStyle = "#000F";

	// Get init image
	auxCtx.fillRect(0, 0, bb.w, bb.h);
	auxCtx.drawImage(sectionCanvas, 0, 0);
	request.image = auxCanvas.toDataURL();

	request.model = "clip"; //TODO maybe make a selectable option once A1111 supports the new openclip thingy?
	const stopMarching = march(bb, {style: "#AFAF"});
	try {
		const result = await _interrogate(request);
		const text = prompt(
			result +
				"\n\nDo you want to replace your prompt with this? You can change it down below:",
			result
		);
		if (text) {
			document.getElementById("prompt").value = text;
			tools.dream.enable();
		}
	} finally {
		stopMarching();
	}
};

/**
 * our private eye
 *
 * @param {StableDiffusionRequest} request Stable diffusion request
 * @returns {Promise<string[]>}
 */
const _interrogate = async (request) => {
	const apiURL = `${host}${url}` + "interrogate";

	/** @type {StableDiffusionResponse} */
	let data = null;
	try {
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
	}

	return data.caption;
};

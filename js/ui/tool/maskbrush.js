const setMask = (state) => {
	const canvas = imageCollection.layers.mask.canvas;
	switch (state) {
		case "clear":
			canvas.classList.remove("hold");
			canvas.classList.add("display", "clear");
			break;
		case "hold":
			canvas.classList.remove("clear");
			canvas.classList.add("display", "hold");
			break;
		case "neutral":
			canvas.classList.remove("clear", "hold");
			canvas.classList.add("display");
			break;
		case "none":
			canvas.classList.remove("display", "hold", "clear");
			break;
		default:
			console.debug(`[maskbrush.setMask] Invalid mask type: ${state}`);
			break;
	}
};

const _mask_brush_draw_callback = (evn, state, opacity = 100) => {
	maskPaintCtx.globalCompositeOperation = "source-over";
	maskPaintCtx.strokeStyle = "black";

	maskPaintCtx.filter =
		"blur(" + state.brushBlur + "px) opacity(" + opacity + "%)";
	maskPaintCtx.lineWidth = state.brushSize;
	maskPaintCtx.beginPath();
	maskPaintCtx.moveTo(
		evn.px === undefined ? evn.x : evn.px,
		evn.py === undefined ? evn.y : evn.py
	);
	maskPaintCtx.lineTo(evn.x, evn.y);
	maskPaintCtx.lineJoin = maskPaintCtx.lineCap = "round";
	maskPaintCtx.stroke();
	maskPaintCtx.filter = null;
};

const _mask_brush_erase_callback = (evn, state, opacity = 100) => {
	maskPaintCtx.globalCompositeOperation = "destination-out";
	maskPaintCtx.strokeStyle = "black";

	maskPaintCtx.filter = "blur(" + state.brushBlur + "px)";
	maskPaintCtx.filter =
		"blur(" + state.brushBlur + "px) opacity(" + opacity + "%)";
	maskPaintCtx.lineWidth = state.brushSize;
	maskPaintCtx.beginPath();
	maskPaintCtx.moveTo(
		evn.px === undefined ? evn.x : evn.px,
		evn.py === undefined ? evn.y : evn.py
	);
	maskPaintCtx.lineTo(evn.x, evn.y);
	maskPaintCtx.lineJoin = maskPaintCtx.lineCap = "round";
	maskPaintCtx.stroke();
	maskPaintCtx.filter = null;
};

const maskBrushTool = () =>
	thetoolbar.registerTool(
		"./res/icons/paintbrush.svg",
		"Mask Brush",
		(state, opt) => {
			// Draw new cursor immediately
			uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
			state.redraw();

			// Start Listeners
			mouse.listen.world.onmousemove.on(state.movecb);
			mouse.listen.world.onwheel.on(state.wheelcb);
			mouse.listen.world.btn.left.onpaintstart.on(state.drawcb);
			mouse.listen.world.btn.left.onpaint.on(state.drawcb);
			mouse.listen.world.btn.right.onpaintstart.on(state.erasecb);
			mouse.listen.world.btn.right.onpaint.on(state.erasecb);

			// Display Mask
			setMask("neutral");
		},
		(state, opt) => {
			// Clear Listeners
			mouse.listen.world.onmousemove.clear(state.movecb);
			mouse.listen.world.onwheel.clear(state.wheelcb);
			mouse.listen.world.btn.left.onpaintstart.clear(state.drawcb);
			mouse.listen.world.btn.left.onpaint.clear(state.drawcb);
			mouse.listen.world.btn.right.onpaintstart.clear(state.erasecb);
			mouse.listen.world.btn.right.onpaint.clear(state.erasecb);

			// Hide Mask
			setMask("none");
			state.ctxmenu.previewMaskButton.classList.remove("active");
			maskPaintCanvas.classList.remove("opaque");
			state.preview = false;

			uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
		},
		{
			init: (state) => {
				state.config = {
					brushScrollSpeed: 1 / 4,
					minBrushSize: 10,
					maxBrushSize: 500,
					minBlur: 0,
					maxBlur: 30,
				};

				state.brushSize = 64;
				state.brushBlur = 0;
				state.brushOpacity = 1;
				state.block_res_change = true;
				state.setBrushSize = (size) => {
					state.brushSize = size;
					state.ctxmenu.brushSizeRange.value = size;
					state.ctxmenu.brushSizeText.value = size;
				};

				state.preview = false;

				state.clearPrevCursor = () =>
					uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);

				state.redraw = () => {
					state.movecb({
						...mouse.coords.world.pos,
						evn: {
							clientX: mouse.coords.window.pos.x,
							clientY: mouse.coords.window.pos.y,
						},
					});
				};

				state.movecb = (evn) => {
					const vcp = {x: evn.evn.clientX, y: evn.evn.clientY};
					const scp = state.brushSize / viewport.zoom;

					state.clearPrevCursor();
					state;
					clearPrevCursor = () =>
						uiCtx.clearRect(
							vcp.x - scp / 2 - 10,
							vcp.y - scp / 2 - 10,
							vcp.x + scp / 2 + 10,
							vcp.y + scp / 2 + 10
						);

					uiCtx.beginPath();
					uiCtx.arc(vcp.x, vcp.y, scp / 2, 0, 2 * Math.PI, true);
					uiCtx.strokeStyle = "black";
					uiCtx.stroke();

					uiCtx.beginPath();
					uiCtx.arc(vcp.x, vcp.y, scp / 2, 0, 2 * Math.PI, true);
					uiCtx.fillStyle = "#FFFFFF50";
					uiCtx.fill();
				};

				state.redraw = () => {
					state.movecb({
						...mouse.coords.world.pos,
						evn: {
							clientX: mouse.coords.window.pos.x,
							clientY: mouse.coords.window.pos.y,
						},
					});
				};

				state.wheelcb = (evn) => {
					state.brushSize = state.setBrushSize(
						state.brushSize -
							Math.floor(state.config.brushScrollSpeed * evn.delta)
					);
					state.redraw();
				};

				state.drawcb = (evn) =>
					_mask_brush_draw_callback(evn, state, state.brushOpacity * 100);
				state.erasecb = (evn) =>
					_mask_brush_erase_callback(evn, state, state.brushOpacity * 100);
			},
			populateContextMenu: (menu, state) => {
				if (!state.ctxmenu) {
					state.ctxmenu = {};

					// Brush size slider
					const brushSizeSlider = _toolbar_input.slider(
						state,
						"openoutpaint/maskbrush-brushsize",
						"brushSize",
						"Brush Size",
						{
							min: state.config.minBrushSize,
							max: state.config.maxBrushSize,
							step: 5,
							textStep: 1,
							cb: (v) => {
								if (!state.cursorLayer) return;

								state.redraw();
							},
						}
					);
					state.ctxmenu.brushSizeSlider = brushSizeSlider.slider;
					state.setBrushSize = brushSizeSlider.setValue;

					// Brush opacity slider
					const brushOpacitySlider = _toolbar_input.slider(
						state,
						"openoutpaint/maskbrush-brushopacity",
						"brushOpacity",
						"Brush Opacity",
						{
							min: 0,
							max: 1,
							step: 0.05,
							textStep: 0.001,
						}
					);
					state.ctxmenu.brushOpacitySlider = brushOpacitySlider.slider;

					// Brush blur slider
					const brushBlurSlider = _toolbar_input.slider(
						state,
						"openoutpaint/maskbrush-brushblur",
						"brushBlur",
						"Brush Blur",
						{
							min: state.config.minBlur,
							max: state.config.maxBlur,
							step: 1,
						}
					);
					state.ctxmenu.brushBlurSlider = brushBlurSlider.slider;

					// Some mask-related action buttons
					const actionArray = document.createElement("div");
					actionArray.classList.add("button-array");

					const clearMaskButton = document.createElement("button");
					clearMaskButton.classList.add("button", "tool");
					clearMaskButton.textContent = "Clear";
					clearMaskButton.title = "Clears Painted Mask";
					clearMaskButton.onclick = () => {
						maskPaintLayer.clear();
					};

					const previewMaskButton = document.createElement("button");
					previewMaskButton.classList.add("button", "tool");
					previewMaskButton.textContent = "Preview";
					previewMaskButton.title = "Displays Mask with Full Opacity";
					previewMaskButton.onclick = () => {
						if (previewMaskButton.classList.contains("active")) {
							maskPaintCanvas.classList.remove("opaque");
							state.preview = false;

							state.redraw();
						} else {
							maskPaintCanvas.classList.add("opaque");
							state.preview = true;
							state.redraw();
						}
						previewMaskButton.classList.toggle("active");
					};

					state.ctxmenu.previewMaskButton = previewMaskButton;

					actionArray.appendChild(clearMaskButton);
					actionArray.appendChild(previewMaskButton);

					state.ctxmenu.actionArray = actionArray;
				}

				menu.appendChild(state.ctxmenu.brushSizeSlider);
				menu.appendChild(state.ctxmenu.brushOpacitySlider);
				menu.appendChild(state.ctxmenu.brushBlurSlider);
				menu.appendChild(state.ctxmenu.actionArray);
			},
			shortcut: "M",
		}
	);

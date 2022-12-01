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
			console.debug(`Invalid mask type: ${state}`);
			break;
	}
};

const _mask_brush_draw_callback = (evn, state) => {
	maskPaintCtx.globalCompositeOperation = "source-over";
	maskPaintCtx.strokeStyle = "black";

	maskPaintCtx.lineWidth = state.brushSize;
	maskPaintCtx.beginPath();
	maskPaintCtx.moveTo(
		evn.px === undefined ? evn.x : evn.px,
		evn.py === undefined ? evn.y : evn.py
	);
	maskPaintCtx.lineTo(evn.x, evn.y);
	maskPaintCtx.lineJoin = maskPaintCtx.lineCap = "round";
	maskPaintCtx.stroke();
};

const _mask_brush_erase_callback = (evn, state) => {
	maskPaintCtx.globalCompositeOperation = "destination-out";
	maskPaintCtx.strokeStyle = "black";

	maskPaintCtx.lineWidth = state.brushSize;
	maskPaintCtx.beginPath();
	maskPaintCtx.moveTo(
		evn.px === undefined ? evn.x : evn.px,
		evn.py === undefined ? evn.y : evn.py
	);
	maskPaintCtx.lineTo(evn.x, evn.y);
	maskPaintCtx.lineJoin = maskPaintCtx.lineCap = "round";
	maskPaintCtx.stroke();
};

const _paint_mb_cursor = (state) => {
	const v = state.brushSize;
	state.cursorLayer.resize(v + 20, v + 20);

	const ctx = state.cursorLayer.ctx;

	ctx.clearRect(0, 0, v + 20, v + 20);
	ctx.beginPath();
	ctx.arc(
		(v + 20) / 2,
		(v + 20) / 2,
		state.brushSize / 2,
		0,
		2 * Math.PI,
		true
	);
	ctx.fillStyle = "#FFFFFF50";

	ctx.fill();

	if (state.preview) {
		ctx.strokeStyle = "#000F";
		ctx.setLineDash([4, 2]);
		ctx.stroke();
		ctx.setLineDash([]);
	}
};

const maskBrushTool = () =>
	toolbar.registerTool(
		"res/icons/paintbrush.svg",
		"Mask Brush",
		(state, opt) => {
			// New layer for the cursor
			state.cursorLayer = imageCollection.registerLayer(null, {
				after: maskPaintLayer,
				bb: {x: 0, y: 0, w: state.brushSize + 20, h: state.brushSize + 20},
			});

			_paint_mb_cursor(state);

			// Draw new cursor immediately
			ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
			state.movecb({...mouse.coords.world.pos});

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
			// Don't want to keep hogging resources
			imageCollection.deleteLayer(state.cursorLayer);
			state.cursorLayer = null;

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
		},
		{
			init: (state) => {
				state.config = {
					brushScrollSpeed: 1 / 4,
					minBrushSize: 10,
					maxBrushSize: 500,
				};

				state.brushSize = 64;
				state.setBrushSize = (size) => {
					state.brushSize = size;
					state.ctxmenu.brushSizeRange.value = size;
					state.ctxmenu.brushSizeText.value = size;
				};

				state.preview = false;

				state.clearPrevCursor = () =>
					ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);

				state.movecb = (evn) => {
					state.cursorLayer.moveTo(
						evn.x - state.brushSize / 2 - 10,
						evn.y - state.brushSize / 2 - 10
					);

					state.clearPrevCursor = () =>
						ovCtx.clearRect(
							evn.x - state.brushSize / 2 - 10,
							evn.y - state.brushSize / 2 - 10,
							evn.x + state.brushSize / 2 + 10,
							evn.y + state.brushSize / 2 + 10
						);
				};

				state.wheelcb = (evn) => {
					if (!evn.evn.ctrlKey) {
						state.brushSize = state.setBrushSize(
							state.brushSize -
								Math.floor(state.config.brushScrollSpeed * evn.delta)
						);
						state.movecb(evn);
					}
				};

				state.drawcb = (evn) => _mask_brush_draw_callback(evn, state);
				state.erasecb = (evn) => _mask_brush_erase_callback(evn, state);
			},
			populateContextMenu: (menu, state) => {
				if (!state.ctxmenu) {
					state.ctxmenu = {};
					const brushSizeSlider = _toolbar_input.slider(
						state,
						"brushSize",
						"Brush Size",
						state.config.minBrushSize,
						state.config.maxBrushSize,
						1,
						(v) => {
							if (!state.cursorLayer) return;
							_paint_mb_cursor(state);
						}
					);
					state.ctxmenu.brushSizeSlider = brushSizeSlider.slider;
					state.setBrushSize = brushSizeSlider.setValue;

					// Some mask-related action buttons
					const actionArray = document.createElement("div");
					actionArray.classList.add("button-array");

					const clearMaskButton = document.createElement("button");
					clearMaskButton.classList.add("button", "tool");
					clearMaskButton.textContent = "Clear";
					clearMaskButton.title = "Clears Painted Mask";
					clearMaskButton.onclick = () => {
						maskPaintCtx.clearRect(
							0,
							0,
							maskPaintCanvas.width,
							maskPaintCanvas.height
						);
					};

					const previewMaskButton = document.createElement("button");
					previewMaskButton.classList.add("button", "tool");
					previewMaskButton.textContent = "Preview";
					previewMaskButton.title = "Displays Mask with Full Opacity";
					previewMaskButton.onclick = () => {
						if (previewMaskButton.classList.contains("active")) {
							maskPaintCanvas.classList.remove("opaque");
							state.preview = false;
							_paint_mb_cursor(state);
						} else {
							maskPaintCanvas.classList.add("opaque");
							state.preview = true;
							_paint_mb_cursor(state);
						}
						previewMaskButton.classList.toggle("active");
					};

					state.ctxmenu.previewMaskButton = previewMaskButton;

					actionArray.appendChild(clearMaskButton);
					actionArray.appendChild(previewMaskButton);

					state.ctxmenu.actionArray = actionArray;
				}

				menu.appendChild(state.ctxmenu.brushSizeSlider);
				menu.appendChild(state.ctxmenu.actionArray);
			},
			shortcut: "M",
		}
	);

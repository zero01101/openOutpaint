const setMask = (state) => {
	const canvas = document.querySelector("#maskPaintCanvas");
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
	if (
		(evn.initialTarget && evn.initialTarget.id === "overlayCanvas") ||
		(!evn.initialTarget && evn.target.id === "overlayCanvas")
	) {
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
	}
};

const _mask_brush_erase_callback = (evn, state) => {
	if (
		(evn.initialTarget && evn.initialTarget.id === "overlayCanvas") ||
		(!evn.initialTarget && evn.target.id === "overlayCanvas")
	) {
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
	}
};

const maskBrushTool = () =>
	toolbar.registerTool(
		"res/icons/paintbrush.svg",
		"Mask Brush",
		(state, opt) => {
			// Draw new cursor immediately
			ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
			state.movecb({...mouse.coords.canvas.pos, target: {id: "overlayCanvas"}});

			// Start Listeners
			mouse.listen.canvas.onmousemove.on(state.movecb);
			mouse.listen.canvas.onwheel.on(state.wheelcb);
			mouse.listen.canvas.left.onpaintstart.on(state.drawcb);
			mouse.listen.canvas.left.onpaint.on(state.drawcb);
			mouse.listen.canvas.right.onpaintstart.on(state.erasecb);
			mouse.listen.canvas.right.onpaint.on(state.erasecb);

			// Display Mask
			setMask("neutral");
		},
		(state, opt) => {
			// Clear Listeners
			mouse.listen.canvas.onmousemove.clear(state.movecb);
			mouse.listen.canvas.onwheel.clear(state.wheelcb);
			mouse.listen.canvas.left.onpaintstart.clear(state.drawcb);
			mouse.listen.canvas.left.onpaint.clear(state.drawcb);
			mouse.listen.canvas.right.onpaintstart.clear(state.erasecb);
			mouse.listen.canvas.right.onpaint.clear(state.erasecb);

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

				state.movecb = (evn) => {
					if (evn.target.id === "overlayCanvas") {
						// draw big translucent white blob cursor
						ovCtx.beginPath();
						ovCtx.arc(evn.x, evn.y, state.brushSize / 2, 0, 2 * Math.PI, true); // for some reason 4x on an arc is === to 8x on a line???
						ovCtx.fillStyle = "#FFFFFF50";

						ovCtx.fill();

						if (state.preview) {
							ovCtx.strokeStyle = "#000F";
							ovCtx.setLineDash([4, 2]);
							ovCtx.stroke();
							ovCtx.setLineDash([]);
						}
					}
				};

				state.wheelcb = (evn) => {
					if (evn.target.id === "overlayCanvas") {
						state.brushSize = state.setBrushSize(
							state.brushSize -
								Math.floor(state.config.brushScrollSpeed * evn.delta)
						);
						ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
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
						1
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
						} else {
							maskPaintCanvas.classList.add("opaque");
							state.preview = true;
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

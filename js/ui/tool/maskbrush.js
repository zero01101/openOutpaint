const _mask_brush_draw_callback = (evn, state) => {
	if (evn.initialTarget.id === "overlayCanvas") {
		maskPaintCtx.globalCompositeOperation = "source-over";
		maskPaintCtx.strokeStyle = "#FF6A6A";

		maskPaintCtx.lineWidth = state.brushSize;
		maskPaintCtx.beginPath();
		maskPaintCtx.moveTo(evn.px, evn.py);
		maskPaintCtx.lineTo(evn.x, evn.y);
		maskPaintCtx.lineJoin = maskPaintCtx.lineCap = "round";
		maskPaintCtx.stroke();
	}
};

const _mask_brush_erase_callback = (evn, state) => {
	if (evn.initialTarget.id === "overlayCanvas") {
		maskPaintCtx.globalCompositeOperation = "destination-out";
		maskPaintCtx.strokeStyle = "#FFFFFFFF";

		maskPaintCtx.lineWidth = state.brushSize;
		maskPaintCtx.beginPath();
		maskPaintCtx.moveTo(evn.px, evn.py);
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
			mouse.listen.canvas.left.onpaint.on(state.drawcb);
			mouse.listen.canvas.right.onpaint.on(state.erasecb);
		},
		(state, opt) => {
			// Clear Listeners
			mouse.listen.canvas.onmousemove.clear(state.movecb);
			mouse.listen.canvas.onwheel.on(state.wheelcb);
			mouse.listen.canvas.left.onpaint.clear(state.drawcb);
			mouse.listen.canvas.right.onpaint.clear(state.erasecb);
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

				state.movecb = (evn) => {
					if (evn.target.id === "overlayCanvas") {
						// draw big translucent red blob cursor
						ovCtx.beginPath();
						ovCtx.arc(evn.x, evn.y, state.brushSize / 2, 0, 2 * Math.PI, true); // for some reason 4x on an arc is === to 8x on a line???
						ovCtx.fillStyle = "#FF6A6A50";
						ovCtx.fill();
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
				}

				menu.appendChild(state.ctxmenu.brushSizeSlider);
			},
			shortcut: "M",
		}
	);

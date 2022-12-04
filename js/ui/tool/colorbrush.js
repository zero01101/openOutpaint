const _color_brush_draw_callback = (evn, state) => {
	const ctx = state.drawLayer.ctx;

	ctx.strokeStyle = state.color;

	ctx.filter = "blur(" + state.brushBlur + "px)";
	ctx.lineWidth = state.brushSize;
	ctx.beginPath();
	ctx.moveTo(
		evn.px === undefined ? evn.x : evn.px,
		evn.py === undefined ? evn.y : evn.py
	);
	ctx.lineTo(evn.x, evn.y);
	ctx.lineJoin = ctx.lineCap = "round";
	ctx.stroke();
};

const _color_brush_erase_callback = (evn, state, ctx) => {
	ctx.strokeStyle = "black";

	ctx.lineWidth = state.brushSize;
	ctx.beginPath();
	ctx.moveTo(
		evn.px === undefined ? evn.x : evn.px,
		evn.py === undefined ? evn.y : evn.py
	);
	ctx.lineTo(evn.x, evn.y);
	ctx.lineJoin = ctx.lineCap = "round";
	ctx.stroke();
};

const colorBrushTool = () =>
	toolbar.registerTool(
		"res/icons/brush.svg",
		"Color Brush",
		(state, opt) => {
			// Draw new cursor immediately
			uiCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
			state.movecb({
				...mouse.coords.world.pos,
				evn: {
					clientX: mouse.coords.window.pos.x,
					clientY: mouse.coords.window.pos.y,
				},
			});

			// Layer for eyedropper magnifiying glass
			state.glassLayer = imageCollection.registerLayer(null, {
				bb: {x: 0, y: 0, w: 100, h: 100},
				resolution: {w: 7, h: 7},
				after: maskPaintLayer,
			});
			state.glassLayer.hide();
			state.glassLayer.canvas.style.imageRendering = "pixelated";
			state.glassLayer.canvas.style.borderRadius = "50%";

			state.drawLayer = imageCollection.registerLayer(null, {
				after: imgLayer,
				ctxOptions: {willReadFrequently: true},
			});
			state.eraseLayer = imageCollection.registerLayer(null, {
				after: imgLayer,
				ctxOptions: {willReadFrequently: true},
			});
			state.eraseLayer.canvas.style.display = "none";
			state.eraseLayer.hide();
			state.eraseBackup = imageCollection.registerLayer(null, {
				after: imgLayer,
			});
			state.eraseBackup.hide();

			// Start Listeners
			mouse.listen.world.onmousemove.on(state.movecb);
			mouse.listen.world.onwheel.on(state.wheelcb);

			keyboard.listen.onkeydown.on(state.keydowncb);
			keyboard.listen.onkeyup.on(state.keyupcb);
			mouse.listen.world.btn.left.onclick.on(state.leftclickcb);

			mouse.listen.world.btn.left.onpaintstart.on(state.drawstartcb);
			mouse.listen.world.btn.left.onpaint.on(state.drawcb);
			mouse.listen.world.btn.left.onpaintend.on(state.drawendcb);

			mouse.listen.world.btn.right.onpaintstart.on(state.erasestartcb);
			mouse.listen.world.btn.right.onpaint.on(state.erasecb);
			mouse.listen.world.btn.right.onpaintend.on(state.eraseendcb);

			// Display Color
			setMask("none");
		},
		(state, opt) => {
			// Clear Listeners
			mouse.listen.world.onmousemove.clear(state.movecb);
			mouse.listen.world.onwheel.clear(state.wheelcb);

			keyboard.listen.onkeydown.clear(state.keydowncb);
			keyboard.listen.onkeyup.clear(state.keyupcb);
			mouse.listen.world.btn.left.onclick.clear(state.leftclickcb);

			mouse.listen.world.btn.left.onpaintstart.clear(state.drawstartcb);
			mouse.listen.world.btn.left.onpaint.clear(state.drawcb);
			mouse.listen.world.btn.left.onpaintend.clear(state.drawendcb);

			mouse.listen.world.btn.right.onpaintstart.clear(state.erasestartcb);
			mouse.listen.world.btn.right.onpaint.clear(state.erasecb);
			mouse.listen.world.btn.right.onpaintend.clear(state.eraseendcb);

			// Delete layer
			imageCollection.deleteLayer(state.drawLayer);
			imageCollection.deleteLayer(state.eraseBackup);
			imageCollection.deleteLayer(state.eraseLayer);
			imageCollection.deleteLayer(state.glassLayer);

			// Cancel any eyedropping
			state.drawing = false;
			state.disableDropper();

			uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
		},
		{
			init: (state) => {
				state.config = {
					brushScrollSpeed: 1 / 5,
					minBrushSize: 2,
					maxBrushSize: 500,
					minBlur: 0,
					maxBlur: 30,
				};

				state.color = "#FFFFFF";
				state.brushSize = 32;
				state.brushBlur = 0;
				state.affectMask = true;
				state.setBrushSize = (size) => {
					state.brushSize = size;
					state.ctxmenu.brushSizeRange.value = size;
					state.ctxmenu.brushSizeText.value = size;
				};

				state.eyedropper = false;

				state.enableDropper = () => {
					state.eyedropper = true;
					state.movecb(lastMouseMoveEvn);
					state.glassLayer.unhide();
				};

				state.disableDropper = () => {
					state.eyedropper = false;
					state.movecb(lastMouseMoveEvn);
					state.glassLayer.hide();
				};

				let lastMouseMoveEvn = {x: 0, y: 0};

				state.movecb = (evn) => {
					lastMouseMoveEvn = evn;

					const vcp = {x: evn.evn.clientX, y: evn.evn.clientY};

					// draw drawing cursor
					uiCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);

					uiCtx.beginPath();
					uiCtx.arc(
						vcp.x,
						vcp.y,
						state.eyedropper ? 50 : (state.brushSize / 2) * viewport.zoom,
						0,
						2 * Math.PI,
						true
					);
					uiCtx.strokeStyle = "black";
					uiCtx.stroke();

					// Draw eyedropper cursor and magnifiying glass
					if (state.eyedropper) {
						const bb = getBoundingBox(evn.x, evn.y, 7, 7, false);

						const canvas = uil.getVisible(bb, {includeBg: true});
						state.glassLayer.ctx.clearRect(0, 0, 7, 7);
						state.glassLayer.ctx.drawImage(canvas, 0, 0);
						state.glassLayer.moveTo(evn.x - 50, evn.y - 50);
					} else {
						uiCtx.beginPath();
						uiCtx.arc(
							vcp.x,
							vcp.y,
							(state.brushSize / 2) * viewport.zoom,
							0,
							2 * Math.PI,
							true
						);
						uiCtx.fillStyle = state.color + "50";
						uiCtx.fill();
					}
				};

				state.wheelcb = (evn) => {
					if (!evn.evn.ctrlKey) {
						state.brushSize = state.setBrushSize(
							state.brushSize -
								Math.floor(state.config.brushScrollSpeed * evn.delta)
						);
						uiCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
						state.movecb(evn);
					}
				};

				/**
				 * These are basically for eyedropper purposes
				 */

				state.keydowncb = (evn) => {
					if (lastMouseMoveEvn.target === imageCollection.inputElement)
						switch (evn.code) {
							case "ShiftLeft":
							case "ShiftRight":
								state.enableDropper();
								break;
						}
				};

				state.keyupcb = (evn) => {
					switch (evn.code) {
						case "ShiftLeft":
							if (!keyboard.isPressed("ShiftRight")) {
								state.disableDropper();
							}
							break;
						case "ShiftRight":
							if (!keyboard.isPressed("ShiftLeft")) {
								state.disableDropper();
							}
							break;
					}
				};

				state.leftclickcb = (evn) => {
					if (evn.target === imageCollection.inputElement && state.eyedropper) {
						const bb = getBoundingBox(evn.x, evn.y, 1, 1, false);
						const visibleCanvas = getVisible(bb);
						const dat = visibleCanvas
							.getContext("2d")
							.getImageData(0, 0, 1, 1).data;
						state.setColor(
							"#" + ((dat[0] << 16) | (dat[1] << 8) | dat[2]).toString(16)
						);
						state.disableDropper();
					}
				};

				state.rightclickcb = (evn) => {
					if (evn.target === imageCollection.inputElement && state.eyedropper) {
						state.disableDropper();
					}
				};

				/**
				 * Here we actually paint things
				 */
				state.drawstartcb = (evn) => {
					if (state.eyedropper) return;
					state.drawing = true;
					if (state.affectMask) _mask_brush_draw_callback(evn, state);
					_color_brush_draw_callback(evn, state);
				};

				state.drawcb = (evn) => {
					if (state.eyedropper || !state.drawing) return;
					if (state.affectMask) _mask_brush_draw_callback(evn, state);
					_color_brush_draw_callback(evn, state);
				};

				state.drawendcb = (evn) => {
					if (!state.drawing) return;
					state.drawing = false;

					const canvas = state.drawLayer.canvas;
					const ctx = state.drawLayer.ctx;

					const cropped = cropCanvas(canvas, {border: 10});
					const bb = cropped.bb;
					commands.runCommand("drawImage", "Color Brush Draw", {
						image: cropped.canvas,
						...bb,
					});

					ctx.clearRect(bb.x, bb.y, bb.w, bb.h);
				};

				state.erasestartcb = (evn) => {
					if (state.eyedropper) return;
					state.erasing = true;
					if (state.affectMask) _mask_brush_erase_callback(evn, state);

					// Make a backup of the current image to apply erase later
					const bkpcanvas = state.eraseBackup.canvas;
					const bkpctx = state.eraseBackup.ctx;
					bkpctx.clearRect(0, 0, bkpcanvas.width, bkpcanvas.height);
					bkpctx.drawImage(uil.canvas, 0, 0);

					uil.ctx.globalCompositeOperation = "destination-out";
					_color_brush_erase_callback(evn, state, uil.ctx);
					uil.ctx.globalCompositeOperation = "source-over";
					_color_brush_erase_callback(evn, state, state.eraseLayer.ctx);
				};

				state.erasecb = (evn) => {
					if (state.eyedropper || !state.erasing) return;
					if (state.affectMask) _mask_brush_erase_callback(evn, state);
					uil.ctx.globalCompositeOperation = "destination-out";
					_color_brush_erase_callback(evn, state, uil.ctx);
					uil.ctx.globalCompositeOperation = "source-over";
					_color_brush_erase_callback(evn, state, state.eraseLayer.ctx);
				};

				state.eraseendcb = (evn) => {
					if (!state.erasing) return;
					state.erasing = false;

					const canvas = state.eraseLayer.canvas;
					const ctx = state.eraseLayer.ctx;

					const bkpcanvas = state.eraseBackup.canvas;

					const cropped = cropCanvas(canvas, {border: 10});
					const bb = cropped.bb;

					uil.ctx.clearRect(0, 0, uil.canvas.width, uil.canvas.height);
					uil.ctx.drawImage(bkpcanvas, 0, 0);

					commands.runCommand("eraseImage", "Color Brush Erase", {
						mask: cropped.canvas,
						...bb,
					});

					ctx.clearRect(bb.x, bb.y, bb.w, bb.h);
				};
			},
			populateContextMenu: (menu, state) => {
				if (!state.ctxmenu) {
					state.ctxmenu = {};

					// Affects Mask Checkbox
					const affectMaskCheckbox = _toolbar_input.checkbox(
						state,
						"affectMask",
						"Affect Mask"
					).label;

					state.ctxmenu.affectMaskCheckbox = affectMaskCheckbox;

					// Brush size slider
					const brushSizeSlider = _toolbar_input.slider(
						state,
						"brushSize",
						"Brush Size",
						{
							min: state.config.minBrushSize,
							max: state.config.maxBrushSize,
							step: 5,
							textStep: 1,
						}
					);
					state.ctxmenu.brushSizeSlider = brushSizeSlider.slider;
					state.setBrushSize = brushSizeSlider.setValue;

					// Brush size slider
					const brushBlurSlider = _toolbar_input.slider(
						state,
						"brushBlur",
						"Brush Blur",
						{
							min: state.config.minBlur,
							max: state.config.maxBlur,
							step: 1,
						}
					);
					state.ctxmenu.brushBlurSlider = brushBlurSlider.slider;

					// Brush color
					const brushColorPickerWrapper = document.createElement("div");
					brushColorPickerWrapper.classList.add(
						"brush-color-picker",
						"wrapper"
					);

					const brushColorPicker = document.createElement("input");
					brushColorPicker.classList.add("brush-color-picker", "picker");
					brushColorPicker.type = "color";
					brushColorPicker.value = state.color;
					brushColorPicker.addEventListener("input", (evn) => {
						state.color = evn.target.value;
					});

					state.setColor = (color) => {
						brushColorPicker.value = color;
						state.color = brushColorPicker.value;
					};

					const brushColorEyeDropper = document.createElement("button");
					brushColorEyeDropper.classList.add(
						"brush-color-picker",
						"eyedropper"
					);
					brushColorEyeDropper.addEventListener("click", () => {
						if (state.eyedropper) state.disableDropper();
						else state.enableDropper();
					});

					brushColorPickerWrapper.appendChild(brushColorPicker);
					brushColorPickerWrapper.appendChild(brushColorEyeDropper);

					state.ctxmenu.brushColorPicker = brushColorPickerWrapper;
				}

				menu.appendChild(state.ctxmenu.affectMaskCheckbox);
				menu.appendChild(state.ctxmenu.brushSizeSlider);
				menu.appendChild(state.ctxmenu.brushBlurSlider);
				menu.appendChild(state.ctxmenu.brushColorPicker);
			},
			shortcut: "C",
		}
	);

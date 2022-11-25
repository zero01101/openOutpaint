const selectTransformTool = () =>
	toolbar.registerTool(
		"res/icons/box-select.svg",
		"Select Image",
		(state, opt) => {
			// Draw new cursor immediately
			ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
			state.movecb({...mouse.coords.canvas.pos, target: {id: "overlayCanvas"}});

			mouse.listen.canvas.onmousemove.on(state.movecb);
			mouse.listen.canvas.left.onclick.on(state.clickcb);
			mouse.listen.canvas.left.ondragstart.on(state.dragstartcb);
			mouse.listen.canvas.left.ondragend.on(state.dragendcb);

			mouse.listen.canvas.right.onclick.on(state.cancelcb);

			keyboard.listen.onkeyclick.on(state.keyclickcb);
			keyboard.listen.onkeydown.on(state.keydowncb);
			keyboard.onShortcut({ctrl: true, key: "KeyC"}, state.ctrlccb);
			keyboard.onShortcut({ctrl: true, key: "KeyV"}, state.ctrlvcb);
			keyboard.onShortcut({ctrl: true, key: "KeyX"}, state.ctrlxcb);
			keyboard.onShortcut({ctrl: true, key: "KeyS"}, state.ctrlscb);
		},
		(state, opt) => {
			mouse.listen.canvas.onmousemove.clear(state.movecb);
			mouse.listen.canvas.left.onclick.clear(state.clickcb);
			mouse.listen.canvas.left.ondragstart.clear(state.dragstartcb);
			mouse.listen.canvas.left.ondragend.clear(state.dragendcb);

			mouse.listen.canvas.right.onclick.clear(state.cancelcb);

			keyboard.listen.onkeyclick.clear(state.keyclickcb);
			keyboard.listen.onkeydown.clear(state.keydowncb);
			keyboard.deleteShortcut(state.ctrlccb, "KeyC");
			keyboard.deleteShortcut(state.ctrlvcb, "KeyV");
			keyboard.deleteShortcut(state.ctrlxcb, "KeyX");
			keyboard.deleteShortcut(state.ctrlscb, "KeyS");

			state.reset();

			ovCanvas.style.cursor = "auto";
		},
		{
			init: (state) => {
				state.clipboard = {};

				state.snapToGrid = true;
				state.keepAspectRatio = true;
				state.useClipboard = !!navigator.clipboard.write; // Use it by default if supported

				state.original = null;
				state.dragging = null;
				state.selected = null;
				state.moving = null;

				state.lastMouseTarget = null;
				state.lastMouseMove = null;

				const redraw = () => {
					ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
					state.movecb(state.lastMouseMove);
				};

				state.reset = () => {
					if (state.selected)
						imgCtx.drawImage(
							state.selected.image,
							state.selected.original.x,
							state.selected.original.y
						);

					if (state.dragging) state.dragging = null;
					else state.selected = null;

					redraw();
				};

				const selectionBB = (x1, y1, x2, y2) => {
					return {
						original: {
							x: Math.min(x1, x2),
							y: Math.min(y1, y2),
							w: Math.abs(x1 - x2),
							h: Math.abs(y1 - y2),
						},
						x: Math.min(x1, x2),
						y: Math.min(y1, y2),
						w: Math.abs(x1 - x2),
						h: Math.abs(y1 - y2),
						contains(x, y) {
							return (
								this.x <= x &&
								x <= this.x + this.w &&
								this.y <= y &&
								y <= this.y + this.h
							);
						},
						handles() {
							const _createHandle = (x, y, originOffset = null, size = 10) => {
								return {
									x: x - size / 2,
									y: y - size / 2,
									w: size,
									h: size,
									contains(x, y) {
										return (
											this.x <= x &&
											x <= this.x + this.w &&
											this.y <= y &&
											y <= this.y + this.h
										);
									},
									scaleTo: (tx, ty, keepAspectRatio = true) => {
										const origin = {
											x: this.original.x + this.original.w / 2,
											y: this.original.y + this.original.h / 2,
										};
										let nx = tx;
										let ny = ty;

										let xRatio = (nx - origin.x) / (x - origin.x);
										let yRatio = (ny - origin.y) / (y - origin.y);
										if (keepAspectRatio)
											xRatio = yRatio = Math.min(xRatio, yRatio);

										if (Number.isFinite(xRatio)) {
											let left = this.original.x;
											let right = this.original.x + this.original.w;

											left = (left - origin.x) * xRatio + origin.x;
											right = (right - origin.x) * xRatio + origin.x;

											this.x = left;
											this.w = right - left;
										}

										if (Number.isFinite(yRatio)) {
											let top = this.original.y;
											let bottom = this.original.y + this.original.h;

											top = (top - origin.y) * yRatio + origin.y;
											bottom = (bottom - origin.y) * yRatio + origin.y;

											this.y = top;
											this.h = bottom - top;
										}
									},
								};
							};
							return [
								_createHandle(this.x, this.y),
								_createHandle(this.x + this.w, this.y),
								_createHandle(this.x, this.y + this.h),
								_createHandle(this.x + this.w, this.y + this.h),
							];
						},
					};
				};

				state.movecb = (evn) => {
					ovCanvas.style.cursor = "auto";
					state.lastMouseTarget = evn.target;
					state.lastMouseMove = evn;
					if (evn.target.id === "overlayCanvas") {
						let x = evn.x;
						let y = evn.y;
						if (state.snapToGrid) {
							x += snap(evn.x, true, 64);
							y += snap(evn.y, true, 64);
						}

						// Update scale
						if (state.scaling) {
							state.scaling.scaleTo(x, y);
						}

						// Update position
						if (state.moving) {
							state.selected.x = x - state.moving.offset.x;
							state.selected.y = y - state.moving.offset.y;
						}

						// Draw dragging box
						if (state.dragging) {
							ovCtx.setLineDash([2, 2]);
							ovCtx.lineWidth = 1;
							ovCtx.strokeStyle = "#FFF";

							const ix = state.dragging.ix;
							const iy = state.dragging.iy;

							const bb = selectionBB(ix, iy, x, y);

							ovCtx.strokeRect(bb.x, bb.y, bb.w, bb.h);
							ovCtx.setLineDash([]);
						}

						if (state.selected) {
							ovCtx.lineWidth = 1;
							ovCtx.strokeStyle = "#FFF";

							const bb = {
								x: state.selected.x,
								y: state.selected.y,
								w: state.selected.w,
								h: state.selected.h,
							};

							// Draw Image
							ovCtx.drawImage(
								state.selected.image,
								0,
								0,
								state.selected.image.width,
								state.selected.image.height,
								state.selected.x,
								state.selected.y,
								state.selected.w,
								state.selected.h
							);

							// Draw selection box
							ovCtx.setLineDash([4, 2]);
							ovCtx.strokeRect(bb.x, bb.y, bb.w, bb.h);
							ovCtx.setLineDash([]);

							// Draw Scaling/Rotation Origin
							ovCtx.beginPath();
							ovCtx.arc(
								state.selected.x + state.selected.w / 2,
								state.selected.y + state.selected.h / 2,
								5,
								0,
								2 * Math.PI
							);
							ovCtx.stroke();

							// Draw Scaling Handles
							let cursorInHandle = false;
							state.selected.handles().forEach((handle) => {
								if (handle.contains(evn.x, evn.y)) {
									cursorInHandle = true;
									ovCtx.strokeRect(
										handle.x - 1,
										handle.y - 1,
										handle.w + 2,
										handle.h + 2
									);
								} else {
									ovCtx.strokeRect(handle.x, handle.y, handle.w, handle.h);
								}
							});

							// Change cursor
							if (cursorInHandle || state.selected.contains(evn.x, evn.y))
								ovCanvas.style.cursor = "pointer";
						}

						// Draw current cursor location
						ovCtx.lineWidth = 3;
						ovCtx.strokeStyle = "#FFF";

						ovCtx.beginPath();
						ovCtx.moveTo(x, y + 10);
						ovCtx.lineTo(x, y - 10);
						ovCtx.moveTo(x + 10, y);
						ovCtx.lineTo(x - 10, y);
						ovCtx.stroke();
					}
				};

				state.clickcb = (evn) => {
					if (evn.target.id === "overlayCanvas") {
						imgCtx.drawImage(
							state.selected.image,
							state.original.x,
							state.original.y
						);
						commands.runCommand(
							"eraseImage",
							"Image Transform Erase",
							state.original
						);
						commands.runCommand(
							"drawImage",
							"Image Transform Draw",
							state.selected
						);
						state.original = null;
						state.selected = null;

						redraw();
					}
				};
				state.dragstartcb = (evn) => {
					if (evn.target.id === "overlayCanvas") {
						let ix = evn.ix;
						let iy = evn.iy;
						if (state.snapToGrid) {
							ix += snap(evn.ix, true, 64);
							iy += snap(evn.iy, true, 64);
						}

						if (state.selected) {
							const handles = state.selected.handles();

							const activeHandle = handles.find((v) =>
								v.contains(evn.ix, evn.iy)
							);
							if (activeHandle) {
								state.scaling = activeHandle;
							} else if (state.selected.contains(ix, iy)) {
								state.moving = {
									offset: {x: ix - state.selected.x, y: iy - state.selected.y},
								};
							}
						} else {
							state.dragging = {ix, iy};
						}
					}
				};

				state.dragendcb = (evn) => {
					if (evn.target.id === "overlayCanvas") {
						let x = evn.x;
						let y = evn.y;
						if (state.snapToGrid) {
							x += snap(evn.x, true, 64);
							y += snap(evn.y, true, 64);
						}

						if (state.scaling) {
							state.scaling = null;
						} else if (state.moving) {
							state.moving = null;
						} else if (state.dragging) {
							state.original = selectionBB(
								state.dragging.ix,
								state.dragging.iy,
								x,
								y
							);
							state.selected = selectionBB(
								state.dragging.ix,
								state.dragging.iy,
								x,
								y
							);

							// Cut out selected portion of the image for manipulation
							const cvs = document.createElement("canvas");
							cvs.width = state.selected.w;
							cvs.height = state.selected.h;
							const ctx = cvs.getContext("2d");

							ctx.drawImage(
								imgCanvas,
								state.selected.x,
								state.selected.y,
								state.selected.w,
								state.selected.h,
								0,
								0,
								state.selected.w,
								state.selected.h
							);

							imgCtx.clearRect(
								state.selected.x,
								state.selected.y,
								state.selected.w,
								state.selected.h
							);
							state.selected.image = cvs;
							state.original.image = cvs;

							if (state.selected.w === 0 || state.selected.h === 0)
								state.selected = null;

							state.dragging = null;
						}
						redraw();
					}
				};

				state.cancelcb = (evn) => {
					if (evn.target.id === "overlayCanvas") {
						state.reset();
					}
				};

				// Keyboard callbacks
				state.keydowncb = (evn) => {};

				state.keyclickcb = (evn) => {
					if (state.lastMouseTarget.id === "overlayCanvas") {
						switch (evn.code) {
							case "Delete":
								state.selected &&
									commands.runCommand(
										"eraseImage",
										"Erase Area",
										state.selected
									);
								state.selected = null;
								redraw();
						}
					}
				};

				// Register Ctrl-C/V Shortcut
				state.ctrlccb = (evn) => {
					if (state.selected && state.lastMouseTarget.id === "overlayCanvas") {
						state.clipboard.copy = document.createElement("canvas");

						state.clipboard.copy.width = state.selected.w;
						state.clipboard.copy.height = state.selected.h;

						const ctx = state.clipboard.copy.getContext("2d");

						ctx.clearRect(0, 0, state.selected.w, state.selected.h);
						ctx.drawImage(
							imgCanvas,
							state.selected.x,
							state.selected.y,
							state.selected.w,
							state.selected.h,
							0,
							0,
							state.selected.w,
							state.selected.h
						);

						// Because firefox needs manual activation of the feature
						if (state.useClipboard) {
							state.clipboard.copy.toBlob((blob) => {
								const item = new ClipboardItem({"image/png": blob});
								navigator.clipboard.write([item]).catch((e) => {
									console.warn("Error sending to clipboard");
									console.warn(e);
								});
							});
						}
					}
				};
				state.ctrlvcb = (evn) => {
					if (state.useClipboard) {
						navigator.clipboard.read().then((items) => {
							console.info(items[0]);
							for (const item of items) {
								for (const type of item.types) {
									if (type.startsWith("image/")) {
										item.getType(type).then((blob) => {
											// Converts blob to image
											const url = window.URL || window.webkitURL;
											const image = document.createElement("img");
											image.src = url.createObjectURL(file);
											tools.stamp.enable({
												image,
												back: tools.selecttransform.enable,
											});
										});
									}
								}
							}
						});
					} else if (state.clipboard.copy) {
						const image = document.createElement("img");
						image.src = state.clipboard.copy.toDataURL();

						tools.stamp.enable({
							image,
							back: tools.selecttransform.enable,
						});
					}
				};
				state.ctrlxcb = (evn) => {};
				state.ctrlscb = (evn) => {
					evn.evn.preventDefault();
				};
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
					// Keep Aspect Ratio
					state.ctxmenu.keepAspectRatioLabel = _toolbar_input.checkbox(
						state,
						"keepAspectRatio",
						"Keep Aspect Ratio"
					).label;
					// Use Clipboard
					const clipboardCheckbox = _toolbar_input.checkbox(
						state,
						"useClipboard",
						"Use clipboard"
					);
					state.ctxmenu.useClipboardLabel = clipboardCheckbox.label;
					if (!navigator.clipboard.write)
						clipboardCheckbox.checkbox.disabled = true; // Disable if not available
				}
				menu.appendChild(state.ctxmenu.snapToGridLabel);
				menu.appendChild(document.createElement("br"));
				menu.appendChild(state.ctxmenu.keepAspectRatioLabel);
				menu.appendChild(document.createElement("br"));
				menu.appendChild(state.ctxmenu.useClipboardLabel);
			},
			shortcut: "S",
		}
	);

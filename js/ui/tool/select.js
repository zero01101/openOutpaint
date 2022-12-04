const selectTransformTool = () =>
	toolbar.registerTool(
		"res/icons/box-select.svg",
		"Select Image",
		(state, opt) => {
			// Draw new cursor immediately
			ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
			state.movecb(mouse.coords.world.pos);

			// Canvas left mouse handlers
			mouse.listen.world.onmousemove.on(state.movecb);
			mouse.listen.world.btn.left.onclick.on(state.clickcb);
			mouse.listen.world.btn.left.ondragstart.on(state.dragstartcb);
			mouse.listen.world.btn.left.ondragend.on(state.dragendcb);

			// Canvas right mouse handler
			mouse.listen.world.btn.right.onclick.on(state.cancelcb);

			// Keyboard click handlers
			keyboard.listen.onkeyclick.on(state.keyclickcb);
			keyboard.listen.onkeydown.on(state.keydowncb);

			// Registers keyboard shortcuts
			keyboard.onShortcut({ctrl: true, key: "KeyC"}, state.ctrlccb);
			keyboard.onShortcut({ctrl: true, key: "KeyV"}, state.ctrlvcb);
			keyboard.onShortcut({ctrl: true, key: "KeyX"}, state.ctrlxcb);

			state.selected = null;
		},
		(state, opt) => {
			// Clear all those listeners and shortcuts we set up
			mouse.listen.world.onmousemove.clear(state.movecb);
			mouse.listen.world.btn.left.onclick.clear(state.clickcb);
			mouse.listen.world.btn.left.ondragstart.clear(state.dragstartcb);
			mouse.listen.world.btn.left.ondragend.clear(state.dragendcb);

			mouse.listen.world.btn.right.onclick.clear(state.cancelcb);

			keyboard.listen.onkeyclick.clear(state.keyclickcb);
			keyboard.listen.onkeydown.clear(state.keydowncb);
			keyboard.deleteShortcut(state.ctrlccb, "KeyC");
			keyboard.deleteShortcut(state.ctrlvcb, "KeyV");
			keyboard.deleteShortcut(state.ctrlxcb, "KeyX");

			// Clear any selections
			state.reset();

			// Resets cursor
			imageCollection.inputElement.style.cursor = "auto";
		},
		{
			init: (state) => {
				state.clipboard = {};

				state.snapToGrid = true;
				state.keepAspectRatio = true;
				state.useClipboard = !!(
					navigator.clipboard && navigator.clipboard.write
				); // Use it by default if supported

				state.original = null;
				state.dragging = null;
				state._selected = null;
				Object.defineProperty(state, "selected", {
					get: () => state._selected,
					set: (v) => {
						if (v) state.ctxmenu.enableButtons();
						else state.ctxmenu.disableButtons();

						return (state._selected = v);
					},
				});
				state.moving = null;

				// Some things to easy request for a redraw
				state.lastMouseTarget = null;
				state.lastMouseMove = null;

				const redraw = () => {
					ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
					state.movecb(state.lastMouseMove);
				};

				// Clears selection and make things right
				state.reset = () => {
					if (state.selected)
						imgCtx.drawImage(
							state.original.image,
							state.original.x,
							state.original.y
						);

					if (state.dragging) state.dragging = null;
					else state.selected = null;

					redraw();
				};

				// Selection bounding box object. Has some witchery to deal with handles.
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
						updateOriginal() {
							this.original.x = this.x;
							this.original.y = this.y;
							this.original.w = this.w;
							this.original.h = this.h;
						},
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

				// Mouse move handler. As always, also renders cursor
				state.movecb = (evn) => {
					ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
					imageCollection.inputElement.style.cursor = "auto";
					state.lastMouseTarget = evn.target;
					state.lastMouseMove = evn;
					let x = evn.x;
					let y = evn.y;
					if (state.snapToGrid) {
						x += snap(evn.x, 0, 64);
						y += snap(evn.y, 0, 64);
					}

					// Update scale
					if (state.scaling) {
						state.scaling.scaleTo(x, y, state.keepAspectRatio);
					}

					// Update position
					if (state.moving) {
						state.selected.x = x - state.moving.offset.x;
						state.selected.y = y - state.moving.offset.y;
						state.selected.updateOriginal();
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
							imageCollection.inputElement.style.cursor = "pointer";
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
				};

				// Handles left mouse clicks
				state.clickcb = (evn) => {
					if (
						state.original.x === state.selected.x &&
						state.original.y === state.selected.y &&
						state.original.w === state.selected.w &&
						state.original.h === state.selected.h
					) {
						state.reset();
						return;
					}

					// If something is selected, commit changes to the canvas
					if (state.selected) {
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

				// Handles left mouse drag events
				state.dragstartcb = (evn) => {
					let ix = evn.ix;
					let iy = evn.iy;
					if (state.snapToGrid) {
						ix += snap(evn.ix, 0, 64);
						iy += snap(evn.iy, 0, 64);
					}

					// If is selected, check if drag is in handles/body and act accordingly
					if (state.selected) {
						const handles = state.selected.handles();

						const activeHandle = handles.find((v) =>
							v.contains(evn.ix, evn.iy)
						);
						if (activeHandle) {
							state.scaling = activeHandle;
							return;
						} else if (state.selected.contains(ix, iy)) {
							state.moving = {
								offset: {x: ix - state.selected.x, y: iy - state.selected.y},
							};
							return;
						}
					}
					// If it is not, just create new selection
					state.reset();
					state.dragging = {ix, iy};
				};

				// Handles left mouse drag end events
				state.dragendcb = (evn) => {
					let x = evn.x;
					let y = evn.y;
					if (state.snapToGrid) {
						x += snap(evn.x, 0, 64);
						y += snap(evn.y, 0, 64);
					}

					// If we are scaling, stop scaling and do some handler magic
					if (state.scaling) {
						state.selected.updateOriginal();
						state.scaling = null;
						// If we are moving the selection, just... stop
					} else if (state.moving) {
						state.moving = null;
						/**
						 * If we are dragging, create a cutout selection area and save to an auxiliar image
						 * We will be rendering the image to the overlay, so it will not be noticeable
						 */
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
				};

				// Handler for right clicks. Basically resets everything
				state.cancelcb = (evn) => {
					state.reset();
				};

				// Keyboard callbacks (For now, they just handle the "delete" key)
				state.keydowncb = (evn) => {};

				state.keyclickcb = (evn) => {
					switch (evn.code) {
						case "Delete":
							// Deletes selected area
							state.selected &&
								commands.runCommand("eraseImage", "Erase Area", state.selected);
							state.selected = null;
							redraw();
					}
				};

				// Register Ctrl-C/V Shortcut

				// Handles copying
				state.ctrlccb = (evn, cut = false) => {
					// We create a new canvas to store the data
					state.clipboard.copy = document.createElement("canvas");

					state.clipboard.copy.width = state.selected.w;
					state.clipboard.copy.height = state.selected.h;

					const ctx = state.clipboard.copy.getContext("2d");

					ctx.clearRect(0, 0, state.selected.w, state.selected.h);
					ctx.drawImage(
						state.selected.image,
						0,
						0,
						state.selected.image.width,
						state.selected.image.height,
						0,
						0,
						state.selected.w,
						state.selected.h
					);

					// If cutting, we reverse the selection and erase the selection area
					if (cut) {
						const aux = state.original;
						state.reset();

						commands.runCommand("eraseImage", "Cut Image", aux);
					}

					// Because firefox needs manual activation of the feature
					if (state.useClipboard) {
						// Send to clipboard
						state.clipboard.copy.toBlob((blob) => {
							const item = new ClipboardItem({"image/png": blob});
							navigator.clipboard &&
								navigator.clipboard.write([item]).catch((e) => {
									console.warn("Error sending to clipboard");
									console.warn(e);
								});
						});
					}
				};

				// Handles pasting
				state.ctrlvcb = (evn) => {
					if (state.useClipboard) {
						// If we use the clipboard, do some proccessing of clipboard data (ugly but kind of minimum required)
						navigator.clipboard &&
							navigator.clipboard.read().then((items) => {
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
						// Use internal clipboard
						const image = document.createElement("img");
						image.src = state.clipboard.copy.toDataURL();

						// Send to stamp, as clipboard temporary data
						tools.stamp.enable({
							image,
							back: tools.selecttransform.enable,
						});
					}
				};

				// Cut shortcut. Basically, send to copy handler
				state.ctrlxcb = (evn) => {
					state.ctrlccb(evn, true);
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
					if (!(navigator.clipboard && navigator.clipboard.write))
						clipboardCheckbox.checkbox.disabled = true; // Disable if not available

					// Some useful actions to do with selection
					const actionArray = document.createElement("div");
					actionArray.classList.add("button-array");

					// Save button
					const saveSelectionButton = document.createElement("button");
					saveSelectionButton.classList.add("button", "tool");
					saveSelectionButton.textContent = "Save";
					saveSelectionButton.title = "Saves Selection";
					saveSelectionButton.onclick = () => {
						downloadCanvas({
							cropToContent: false,
							canvas: state.selected.image,
						});
					};

					// Save as Resource Button
					const createResourceButton = document.createElement("button");
					createResourceButton.classList.add("button", "tool");
					createResourceButton.textContent = "Resource";
					createResourceButton.title = "Saves Selection as a Resource";
					createResourceButton.onclick = () => {
						const image = document.createElement("img");
						image.src = state.selected.image.toDataURL();
						image.onload = () => {
							tools.stamp.state.addResource("Selection Resource", image);
							tools.stamp.enable();
						};
					};

					actionArray.appendChild(saveSelectionButton);
					actionArray.appendChild(createResourceButton);

					// Disable buttons (if nothing is selected)
					state.ctxmenu.disableButtons = () => {
						saveSelectionButton.disabled = true;
						createResourceButton.disabled = true;
					};

					// Disable buttons (if something is selected)
					state.ctxmenu.enableButtons = () => {
						saveSelectionButton.disabled = "";
						createResourceButton.disabled = "";
					};
					state.ctxmenu.actionArray = actionArray;
				}
				menu.appendChild(state.ctxmenu.snapToGridLabel);
				menu.appendChild(document.createElement("br"));
				menu.appendChild(state.ctxmenu.keepAspectRatioLabel);
				menu.appendChild(document.createElement("br"));
				menu.appendChild(state.ctxmenu.useClipboardLabel);
				menu.appendChild(state.ctxmenu.actionArray);
			},
			shortcut: "S",
		}
	);

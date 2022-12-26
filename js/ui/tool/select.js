const selectTransformTool = () =>
	toolbar.registerTool(
		"./res/icons/box-select.svg",
		"Select Image",
		(state, opt) => {
			// Draw new cursor immediately
			ovLayer.clear();
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

			// Layer system handlers
			uil.onactive.on(state.uilayeractivecb);

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

			uil.onactive.clear(state.uilayeractivecb);

			// Clear any selections
			state.reset();

			// Resets cursor
			ovLayer.clear();

			// Clears overlay
			imageCollection.inputElement.style.cursor = "auto";
		},
		{
			init: (state) => {
				state.clipboard = {};

				state.snapToGrid = true;
				state.keepAspectRatio = true;
				state.block_res_change = true;
				state.useClipboard = !!(
					navigator.clipboard && navigator.clipboard.write
				); // Use it by default if supported
				state.selectionPeekOpacity = 40;

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
				state.lastMouseMove = {x: 0, y: 0};

				state.redraw = () => {
					ovLayer.clear();
					state.movecb(state.lastMouseMove);
				};

				state.uilayeractivecb = ({uilayer}) => {
					if (state.originalDisplayLayer) {
						state.originalDisplayLayer.moveAfter(uilayer.layer);
					}
				};

				// Clears selection and make things right
				state.reset = (erase = false) => {
					if (state.selected && !erase)
						state.originalLayer.ctx.drawImage(
							state.original.image,
							state.original.x,
							state.original.y
						);

					if (state.originalDisplayLayer) {
						imageCollection.deleteLayer(state.originalDisplayLayer);
						state.originalDisplayLayer = null;
					}

					if (state.dragging) state.dragging = null;
					else state.selected = null;

					state.redraw();
				};

				// Selection bounding box object. Has some witchery to deal with handles.
				const selectionBB = (x1, y1, x2, y2) => {
					x1 = Math.round(x1);
					y1 = Math.round(y1);
					x2 = Math.round(x2);
					y2 = Math.round(y2);
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
							const _createHandle = (x, y, originOffset = null) => {
								return {
									x,
									y,
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

							const size = viewport.zoom * 10;
							return [
								_createHandle(this.x, this.y, size),
								_createHandle(this.x + this.w, this.y, size),
								_createHandle(this.x, this.y + this.h, size),
								_createHandle(this.x + this.w, this.y + this.h, size),
							];
						},
					};
				};

				// Mouse move handler. As always, also renders cursor
				state.movecb = (evn) => {
					ovLayer.clear();
					uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
					state.erasePrevCursor && state.erasePrevCursor();
					imageCollection.inputElement.style.cursor = "auto";
					state.lastMouseTarget = evn.target;
					state.lastMouseMove = evn;
					let x = evn.x;
					let y = evn.y;
					if (state.snapToGrid) {
						x += snap(evn.x, 0, 64);
						y += snap(evn.y, 0, 64);
					}

					const vpc = viewport.canvasToView(x, y);

					uiCtx.save();

					// Update scale
					if (state.scaling) {
						state.scaling.scaleTo(x, y, state.keepAspectRatio);
					}

					// Update position
					if (state.moving) {
						state.selected.x = Math.round(x - state.moving.offset.x);
						state.selected.y = Math.round(y - state.moving.offset.y);
						state.selected.updateOriginal();
					}

					// Draw dragging box
					if (state.dragging) {
						uiCtx.setLineDash([2, 2]);
						uiCtx.lineWidth = 1;
						uiCtx.strokeStyle = "#FFF";

						const ix = state.dragging.ix;
						const iy = state.dragging.iy;

						const bb = selectionBB(ix, iy, x, y);

						const bbvp = {
							...viewport.canvasToView(bb.x, bb.y),
							w: viewport.zoom * bb.w,
							h: viewport.zoom * bb.h,
						};

						uiCtx.strokeRect(bbvp.x, bbvp.y, bbvp.w, bbvp.h);
						uiCtx.setLineDash([]);
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

						const bbvp = {
							...viewport.canvasToView(bb.x, bb.y),
							w: viewport.zoom * bb.w,
							h: viewport.zoom * bb.h,
						};

						// Draw Image
						ovCtx.save();
						ovCtx.filter = `opacity(${state.selectionPeekOpacity}%)`;
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
						ovCtx.restore();

						state.originalDisplayLayer.clear();
						state.originalDisplayLayer.ctx.save();
						state.originalDisplayLayer.ctx.drawImage(
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
						state.originalDisplayLayer.ctx.restore();

						// Draw selection box
						uiCtx.strokeStyle = "#FFF";
						uiCtx.setLineDash([4, 2]);
						uiCtx.strokeRect(bbvp.x, bbvp.y, bbvp.w, bbvp.h);
						uiCtx.setLineDash([]);

						// Draw Scaling/Rotation Origin
						uiCtx.beginPath();
						uiCtx.arc(
							bbvp.x + bbvp.w / 2,
							bbvp.y + bbvp.h / 2,
							5,
							0,
							2 * Math.PI
						);
						uiCtx.stroke();

						// Draw Scaling Handles
						let cursorInHandle = false;
						state.selected.handles().forEach((handle) => {
							const bbvph = {
								...viewport.canvasToView(handle.x, handle.y),
								w: 10,
								h: 10,
							};

							bbvph.x -= 5;
							bbvph.y -= 5;

							const inhandle =
								evn.evn.clientX > bbvph.x &&
								evn.evn.clientX < bbvph.x + bbvph.w &&
								evn.evn.clientY > bbvph.y &&
								evn.evn.clientY < bbvph.y + bbvph.h;

							if (inhandle) {
								cursorInHandle = true;
								uiCtx.strokeRect(
									bbvph.x - 1,
									bbvph.y - 1,
									bbvph.w + 2,
									bbvph.h + 2
								);
							} else {
								uiCtx.strokeRect(bbvph.x, bbvph.y, bbvph.w, bbvph.h);
							}
						});

						// Change cursor
						if (cursorInHandle || state.selected.contains(evn.x, evn.y))
							imageCollection.inputElement.style.cursor = "pointer";
					}

					// Draw current cursor location
					state.erasePrevCursor = _tool._cursor_draw(x, y);

					uiCtx.restore();
				};

				// Handles left mouse clicks
				state.clickcb = (evn) => {
					if (
						!state.original ||
						(state.originalLayer === uil.layer &&
							state.original.x === state.selected.x &&
							state.original.y === state.selected.y &&
							state.original.w === state.selected.w &&
							state.original.h === state.selected.h)
					) {
						state.reset();
						return;
					}

					// If something is selected, commit changes to the canvas
					if (state.selected) {
						state.originalLayer.ctx.drawImage(
							state.selected.image,
							state.original.x,
							state.original.y
						);
						commands.runCommand("eraseImage", "Image Transform Erase", {
							...state.original,
							ctx: state.originalLayer.ctx,
						});
						commands.runCommand("drawImage", "Image Transform Draw", {
							image: state.selected.image,
							x: Math.round(state.selected.x),
							y: Math.round(state.selected.y),
							w: Math.round(state.selected.w),
							h: Math.round(state.selected.h),
						});
						state.reset(true);
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

						const activeHandle = handles.find((v) => {
							const vpc = viewport.canvasToView(v.x, v.y);
							const tlc = viewport.viewToCanvas(vpc.x - 5, vpc.y - 5);
							const brc = viewport.viewToCanvas(vpc.x + 5, vpc.y + 5);
							const bb = {
								x: tlc.x,
								y: tlc.y,
								w: brc.x - tlc.x,
								h: brc.y - tlc.y,
							};

							return (
								evn.ix > bb.x &&
								evn.ix < bb.x + bb.w &&
								evn.iy > bb.y &&
								evn.iy < bb.y + bb.h
							);
						});
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
						state.originalLayer = uil.layer;
						state.originalDisplayLayer = imageCollection.registerLayer(null, {
							after: uil.layer,
							category: "select-display",
						});

						// Cut out selected portion of the image for manipulation
						const cvs = document.createElement("canvas");
						cvs.width = state.selected.w;
						cvs.height = state.selected.h;
						const ctx = cvs.getContext("2d");

						ctx.drawImage(
							uil.canvas,
							state.selected.x,
							state.selected.y,
							state.selected.w,
							state.selected.h,
							0,
							0,
							state.selected.w,
							state.selected.h
						);

						uil.ctx.clearRect(
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
					state.redraw();
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
							state.redraw();
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
											item.getType(type).then(async (blob) => {
												// Converts blob to image
												const url = window.URL || window.webkitURL;
												const image = document.createElement("img");
												image.src = url.createObjectURL(blob);
												await image.decode();
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

					// Selection Peek Opacity
					state.ctxmenu.selectionPeekOpacitySlider = _toolbar_input.slider(
						state,
						"selectionPeekOpacity",
						"Peek Opacity",
						{
							min: 0,
							max: 100,
							step: 10,
							textStep: 1,
							cb: () => {
								state.redraw();
							},
						}
					).slider;

					// Some useful actions to do with selection
					const actionArray = document.createElement("div");
					actionArray.classList.add("button-array");

					// Save button
					const saveSelectionButton = document.createElement("button");
					saveSelectionButton.classList.add("button", "tool");
					saveSelectionButton.textContent = "Save Sel.";
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

					// Some useful actions to do with selection
					const visibleActionArray = document.createElement("div");
					visibleActionArray.classList.add("button-array");

					// Save Visible button
					const saveVisibleSelectionButton = document.createElement("button");
					saveVisibleSelectionButton.classList.add("button", "tool");
					saveVisibleSelectionButton.textContent = "Save Vis.";
					saveVisibleSelectionButton.title = "Saves Visible Selection";
					saveVisibleSelectionButton.onclick = () => {
						const canvas = uil.getVisible(state.selected, {
							categories: ["image", "user", "select-display"],
						});
						downloadCanvas({
							cropToContent: false,
							canvas,
						});
					};

					// Save Visible as Resource Button
					const createVisibleResourceButton = document.createElement("button");
					createVisibleResourceButton.classList.add("button", "tool");
					createVisibleResourceButton.textContent = "Vis. to Res.";
					createVisibleResourceButton.title =
						"Saves Visible Selection as a Resource";
					createVisibleResourceButton.onclick = () => {
						const canvas = uil.getVisible(state.selected, {
							categories: ["image", "user", "select-display"],
						});
						const image = document.createElement("img");
						image.src = canvas.toDataURL();
						image.onload = () => {
							tools.stamp.state.addResource("Selection Resource", image);
							tools.stamp.enable();
						};
					};

					visibleActionArray.appendChild(saveVisibleSelectionButton);
					visibleActionArray.appendChild(createVisibleResourceButton);

					// Disable buttons (if nothing is selected)
					state.ctxmenu.disableButtons = () => {
						saveSelectionButton.disabled = true;
						createResourceButton.disabled = true;
						saveVisibleSelectionButton.disabled = true;
						createVisibleResourceButton.disabled = true;
					};

					// Disable buttons (if something is selected)
					state.ctxmenu.enableButtons = () => {
						saveSelectionButton.disabled = "";
						createResourceButton.disabled = "";
						saveVisibleSelectionButton.disabled = "";
						createVisibleResourceButton.disabled = "";
					};
					state.ctxmenu.actionArray = actionArray;
					state.ctxmenu.visibleActionArray = visibleActionArray;
				}
				menu.appendChild(state.ctxmenu.snapToGridLabel);
				menu.appendChild(document.createElement("br"));
				menu.appendChild(state.ctxmenu.keepAspectRatioLabel);
				menu.appendChild(document.createElement("br"));
				menu.appendChild(state.ctxmenu.useClipboardLabel);
				menu.appendChild(state.ctxmenu.selectionPeekOpacitySlider);
				menu.appendChild(state.ctxmenu.actionArray);
				menu.appendChild(state.ctxmenu.visibleActionArray);
			},
			shortcut: "S",
		}
	);

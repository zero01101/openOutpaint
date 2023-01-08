/**
 * TODO: REFACTOR THIS WHOLE THING
 */

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
				state._selected = null;
				Object.defineProperty(state, "selected", {
					get: () => state._selected,
					set: (v) => {
						if (v) state.ctxmenu.enableButtons();
						else state.ctxmenu.disableButtons();

						return (state._selected = v);
					},
				});

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

					state.rotation = 0;
					state.original = null;

					state.redraw();
				};

				// Selection Handlers
				const selection = _tool._draggable_selection(state);
				state.dragstartcb = (evn) => selection.dragstartcb(evn);
				state.dragcb = (evn) => selection.dragcb(evn);
				state.dragendcb = (evn) => selection.dragendcb(evn);

				// Mouse Move Handler
				let eraseCursor = () => null;
				state.movecb = (evn) => {
					// Get cursor positions
					const {x, y, sx, sy} = _tool._process_cursor(evn, state.snapToGrid);

					// Draw cursor
					eraseCursor();
					eraseCursor = _tool._cursor_draw(sx, sy);

					// Draw Box and Selected Image
					if (state.selected) {
						state.selected.drawBox(uiCtx);
					}

					// Draw Selection
					if (selection.exists) {
						uiCtx.setLineDash([2, 2]);
						uiCtx.lineWidth = 1;
						uiCtx.strokeStyle = "#FFF";

						const vpbb = selection.bb.transform(viewport.matrix);
					}
				};

				// Handles left mouse clicks
				state.clickcb = (evn) => {};

				// Handles left mouse drag events
				state.dragstartcb = (evn) => {
					if (state.selected && state.selected.hasCursor()) {
					} else {
						state.selection;
					}
				};

				// Handles left mouse drag end events
				state.dragendcb = (evn) => {};

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
						"Snap To Grid",
						"icon-grid"
					).checkbox;

					// Keep Aspect Ratio
					state.ctxmenu.keepAspectRatioLabel = _toolbar_input.checkbox(
						state,
						"keepAspectRatio",
						"Keep Aspect Ratio",
						"icon-maximize"
					).checkbox;

					// Use Clipboard
					const clipboardCheckbox = _toolbar_input.checkbox(
						state,
						"useClipboard",
						"Use clipboard",
						"icon-clipboard-list"
					);
					state.ctxmenu.useClipboardLabel = clipboardCheckbox.checkbox;
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
				const array = document.createElement("div");
				array.classList.add("checkbox-array");
				array.appendChild(state.ctxmenu.snapToGridLabel);
				array.appendChild(state.ctxmenu.keepAspectRatioLabel);
				array.appendChild(state.ctxmenu.useClipboardLabel);
				menu.appendChild(array);
				menu.appendChild(state.ctxmenu.selectionPeekOpacitySlider);
				menu.appendChild(state.ctxmenu.actionArray);
				menu.appendChild(state.ctxmenu.visibleActionArray);
			},
			shortcut: "S",
		}
	);

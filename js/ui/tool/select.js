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
			mouse.listen.world.btn.left.ondrag.on(state.dragcb);
			mouse.listen.world.btn.left.ondragend.on(state.dragendcb);

			// Canvas right mouse handler
			mouse.listen.world.btn.right.onclick.on(state.cancelcb);

			// Keyboard click handlers
			keyboard.listen.onkeyclick.on(state.keyclickcb);
			keyboard.listen.onkeydown.on(state.keydowncb);

			// Layer system handlers
			uil.onactive.on(state.uilayeractivecb);
			
			commands.onundo.on(state.undocb);
			commands.onredo.on(state.redocb);

			// Registers keyboard shortcuts
			keyboard.onShortcut({ctrl: true, key: "KeyA"}, state.ctrlacb);
			keyboard.onShortcut(
				{ctrl: true, shift: true, key: "KeyA"},
				state.ctrlsacb
			);
			keyboard.onShortcut({ctrl: true, key: "KeyC"}, state.ctrlccb);
			keyboard.onShortcut({ctrl: true, key: "KeyV"}, state.ctrlvcb);
			keyboard.onShortcut({ctrl: true, key: "KeyX"}, state.ctrlxcb);
			keyboard.onShortcut({key: "Equal"}, state.togglemirror);
			
			keyboard.onShortcut({key: "Enter"}, state.entercb);
			keyboard.onShortcut({shift: true, key: "Enter"}, state.sentercb);
			keyboard.onShortcut({ctrl: true, key: "Enter"}, state.ctentercb);
			keyboard.onShortcut({key: "Delete"}, state.delcb);
			keyboard.onShortcut({shift: true, key: "Delete"}, state.sdelcb);
			
			keyboard.onShortcut({key: "Escape"}, state.escapecb);

			state.ctxmenu.mirrorSelectionCheckbox.disabled = true;
			state.selected = null;

			// Register Layer
			state.originalDisplayLayer = imageCollection.registerLayer(null, {
				after: uil.layer,
				category: "select-display",
			});
		},
		(state, opt) => {
			// Clear all those listeners and shortcuts we set up
			mouse.listen.world.onmousemove.clear(state.movecb);
			mouse.listen.world.btn.left.onclick.clear(state.clickcb);
			mouse.listen.world.btn.left.ondragstart.clear(state.dragstartcb);
			mouse.listen.world.btn.left.ondrag.clear(state.dragcb);
			mouse.listen.world.btn.left.ondragend.clear(state.dragendcb);

			mouse.listen.world.btn.right.onclick.clear(state.cancelcb);

			keyboard.listen.onkeyclick.clear(state.keyclickcb);
			keyboard.listen.onkeydown.clear(state.keydowncb);
			keyboard.deleteShortcut(state.ctrlacb, "KeyA");
			keyboard.deleteShortcut(state.ctrlsacb, "KeyA");
			keyboard.deleteShortcut(state.ctrlccb, "KeyC");
			keyboard.deleteShortcut(state.ctrlvcb, "KeyV");
			keyboard.deleteShortcut(state.ctrlxcb, "KeyX");
			keyboard.deleteShortcut(state.togglemirror, "Equal");
			keyboard.deleteShortcut(state.entercb,"Enter");
			keyboard.deleteShortcut(state.sentercb,"Enter");
			keyboard.deleteShortcut(state.ctentercb,"Enter");
			keyboard.deleteShortcut(state.delcb,"Delete");
			keyboard.deleteShortcut(state.sdelcb,"Delete");
			keyboard.deleteShortcut(state.escapecb,"Escape");
			
			uil.onactive.clear(state.uilayeractivecb);

			commands.onundo.clear(state.undocb);
			commands.onredo.clear(state.redocb);
			
			// Clear any selections
			state.reset();

			// Resets cursor
			ovLayer.clear();

			// Clears overlay
			imageCollection.inputElement.style.cursor = "auto";

			// Delete Layer
			imageCollection.deleteLayer(state.originalDisplayLayer);
			state.originalDisplayLayer = null;
		},
		{
			init: (state) => {
				state.clipboard = {};

				state.snapToGrid = true;
				state.keepAspectRatio = true;
				state.block_res_change = true;
				
				state.toNewLayer = false;
				state.preserveOriginal = false;
				
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

				/** @type {{selected: Point, offset: Point} | null} */
				let moving = null;
				/** @type {{handle: Point} | null} */
				let scaling = null;
				let rotating = false;

				// Clears selection and make things right
				state.reset = (erase = false) => {
					if (state.selected && !erase)
						state.original.layer.ctx.drawImage(
							state.selected.canvas,
							state.original.x,
							state.original.y
						);

					if (state.originalDisplayLayer) {
						state.originalDisplayLayer.clear();
					}

					if (state.dragging) state.dragging = null;
					else {
						state.ctxmenu.mirrorSelectionCheckbox.disabled = true;
						state.selected = null;
					}

					state.mirrorSetValue(false);
					state.rotation = 0;
					state.original = null;
					moving = null;
					scaling = null;
					rotating = null;

					state.redraw();
				};

				// Selection Handlers
				const selection = _tool._draggable_selection(state);

				// UI Erasers
				let eraseSelectedBox = () => null;
				let eraseSelectedImage = () => null;
				let eraseCursor = () => null;
				let eraseSelection = () => null;

				// Redraw UI
				state.redrawui = () => {
					// Get cursor positions
					const {x, y, sx, sy} = _tool._process_cursor(
						state.lastMouseMove,
						state.snapToGrid
					);

					eraseSelectedBox();

					if (state.selected) {
						eraseSelectedBox = state.selected.drawBox(
							uiCtx,
							{x, y},
							viewport.c2v
						);
					}
				};
				
				// Undo/Redo Handling, reset state before Undo/Redo
				state.undocb= (undo)=>{
					if (state.selected){
						if (undo.n<=1) undo.cancel();
						state.reset(false);
					}
				}				
				state.redocb= (redo)=>{
					if (state.selected){ state.reset(false); }
				}

				// Mirroring
				state.togglemirror = () => {
					state.mirrorSetValue(!state.mirrorSelection);
				};

				// Mouse Move Handler
				state.movecb = (evn) => {
					state.lastMouseMove = evn;

					// Get cursor positions
					const {x, y, sx, sy} = _tool._process_cursor(evn, state.snapToGrid);

					// Erase Cursor
					eraseSelectedBox();
					eraseSelectedImage();
					eraseSelection();
					eraseCursor();
					imageCollection.inputElement.style.cursor = "default";

					// Draw Box and Selected Image
					if (state.selected) {
						eraseSelectedBox = state.selected.drawBox(
							uiCtx,
							{x, y},
							viewport.c2v
						);

						if (
							state.selected.hoveringBox(x, y) ||
							state.selected.hoveringHandle(x, y, viewport.zoom).onHandle ||
							state.selected.hoveringRotateHandle(x, y, viewport.zoom)
						) {
							imageCollection.inputElement.style.cursor = "pointer";
						}

						eraseSelectedImage = state.selected.drawImage(
							state.originalDisplayLayer.ctx,
							ovCtx,
							{opacity: state.selectionPeekOpacity / 100}
						);
					}

					// Draw Selection
					if (selection.exists) {
						uiCtx.save();
						uiCtx.setLineDash([2, 2]);
						uiCtx.lineWidth = 2;
						uiCtx.strokeStyle = "#FFF";

						const bbvp = selection.bb.transform(viewport.c2v);
						uiCtx.beginPath();
						uiCtx.strokeRect(bbvp.x, bbvp.y, bbvp.w, bbvp.h);
						uiCtx.stroke();

						eraseSelection = () =>
							uiCtx.clearRect(
								bbvp.x - 10,
								bbvp.y - 10,
								bbvp.w + 20,
								bbvp.h + 20
							);

						uiCtx.restore();
					}

					// Draw cursor
					eraseCursor = _tool._cursor_draw(sx, sy);
				};

				// Handles left mouse clicks
				state.clickcb = (evn) => {
					if (
						state.selected &&
						!(
							state.selected.rotation === 0 &&
							state.selected.scale.x === 1 &&
							state.selected.scale.y === 1 &&
							state.selected.position.x === state.original.sx &&
							state.selected.position.y === state.original.sy &&
							!state.mirrorSelection &&
							state.original.layer === uil.layer
						)
					) {
						state.applyTransform();
					} else {
						state.reset();
					}
				};

				// Handles left mouse drag start events
				state.dragstartcb = (evn) => {
					const {
						x: ix,
						y: iy,
						sx: six,
						sy: siy,
					} = _tool._process_cursor({x: evn.ix, y: evn.iy}, state.snapToGrid);
					const {x, y, sx, sy} = _tool._process_cursor(evn, state.snapToGrid);

					if (state.selected) {
						const hoveringBox = state.selected.hoveringBox(ix, iy);
						const hoveringHandle = state.selected.hoveringHandle(
							ix,
							iy,
							viewport.zoom
						);
						const hoveringRotateHandle = state.selected.hoveringRotateHandle(
							ix,
							iy,
							viewport.zoom
						);

						if (hoveringBox) {
							// Start dragging
							moving = {
								selected: state.selected.position,
								offset: {
									x: six - state.selected.position.x,
									y: siy - state.selected.position.y,
								},
							};
							return;
						} else if (hoveringHandle.onHandle) {
							// Start scaling
							let handle = {x: 0, y: 0};

							const lbb = new BoundingBox({
								x: -state.selected.canvas.width / 2,
								y: -state.selected.canvas.height / 2,
								w: state.selected.canvas.width,
								h: state.selected.canvas.height,
							});

							if (hoveringHandle.ontl) {
								handle = lbb.tl;
							} else if (hoveringHandle.ontr) {
								handle = lbb.tr;
							} else if (hoveringHandle.onbl) {
								handle = lbb.bl;
							} else {
								handle = lbb.br;
							}

							scaling = {
								handle,
							};
							return;
						} else if (hoveringRotateHandle) {
							rotating = true;
							return;
						}
					}
					selection.dragstartcb(evn);
				};

				const transform = (evn, x, y, sx, sy) => {
					if (moving) {
						state.selected.position = {
							x: sx - moving.offset.x,
							y: sy - moving.offset.y,
						};
					}

					if (scaling) {
						/** @type {DOMMatrix} */
						const m = state.selected.rtmatrix.invertSelf();
						const lscursor = m.transformPoint({x: sx, y: sy});

						const xs = lscursor.x / scaling.handle.x;
						const ys = lscursor.y / scaling.handle.y;

						let xscale = 1;
						let yscale = 1;

						if (!state.keepAspectRatio) {
							xscale = xs;
							yscale = ys;
						} else {
							xscale = yscale = Math.max(xs, ys);
						}

						state.selected.scale = {x: xscale, y: yscale};
					}

					if (rotating) {
						const center = state.selected.matrix.transformPoint({x: 0, y: 0});
						let angle = Math.atan2(x - center.x, center.y - y);

						if (evn.evn.shiftKey)
							angle =
								config.rotationSnappingAngles.find(
									(v) => Math.abs(v - angle) < config.rotationSnappingDistance
								) ?? angle;

						state.selected.rotation = angle;
					}
				};

				// Handles left mouse drag events
				state.dragcb = (evn) => {
					const {x, y, sx, sy} = _tool._process_cursor(evn, state.snapToGrid);

					if (state.selected) transform(evn, x, y, sx, sy);

					if (selection.exists) selection.dragcb(evn);
				};

				// Handles left mouse drag end events

				/** @type {(bb: BoundingBox) => void} */
				const select = (bb) => {
					const canvas = document.createElement("canvas");
					canvas.width = bb.w;
					canvas.height = bb.h;
					canvas
						.getContext("2d")
						.drawImage(uil.canvas, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h);

					uil.ctx.clearRect(bb.x, bb.y, bb.w, bb.h);

					state.original = {
						...bb,
						sx: bb.center.x,
						sy: bb.center.y,
						layer: uil.layer,
					};
					state.selected = new _tool.MarqueeSelection(canvas, bb.center);

					state.ctxmenu.mirrorSelectionCheckbox.disabled = false;

					state.redraw();
				};

				state.dragendcb = (evn) => {
					const {x, y, sx, sy} = _tool._process_cursor(evn, state.snapToGrid);

					if (selection.exists) {
						selection.dragendcb(evn);

						const bb = selection.bb;
						state.backupBB = bb;

						state.reset();

						if (selection.exists && bb.w !== 0 && bb.h !== 0) select(bb);

						selection.deselect();
					}

					if (state.selected) transform(evn, x, y, sx, sy);

					moving = null;
					scaling = null;
					rotating = false;

					state.redraw();
				};

				// Handler for right clicks. Basically resets everything
				state.cancelcb = (evn) => {
					state.reset();
				};
				
				state.keydowncb = (evn) => { };
				
				// Keyboard callbacks (For now, they just handle the "delete" key)
				state.keyclickcb = async(evn) => { };				
				
				// Register Delete Shortcut
				state.delcb = async(evn) => { state.applyTransform(true,false,false,false); };
				
				// Register Escape Shortcut
				state.escapecb = async(evn) => { state.reset(false); };
				
				// Register Shift-Delete Shortcut
				state.sdelcb = async(evn) => { state.applyTransform(false,true,false,false); };
								
				// Register Enter Shortcut (Delegates to clickcb)
				state.entercb = async(evn) => { clickcb(evn); };
								
				// Register Ctrl-Enter Shortcut
				state.ctentercb = async(evn) => { state.applyTransform(false,false,true,true); };
								
				// Register Shift-Enter Shortcut
				state.sentercb = async(evn) => { state.applyTransform(false,false,true,false); };
								

				// Register Ctrl-A Shortcut
				state.ctrlacb = () => {
					state.reset(false); // Reset to preserve selected content
					try {
						const {bb} = cropCanvas(uil.canvas);
						select(bb);
					} catch (e) {
						// Ignore errors
					}
				};

				state.ctrlsacb = () => {
					state.reset(false); // Reset to preserve selected content

					// Shift Key selects based on all visible layer information
					const tl = {x: Infinity, y: Infinity};
					const br = {x: -Infinity, y: -Infinity};

					uil.layers.forEach(({layer}) => {
						try {
							const {bb} = cropCanvas(layer.canvas);

							tl.x = Math.min(bb.tl.x, tl.x);
							tl.y = Math.min(bb.tl.y, tl.y);

							br.x = Math.max(bb.br.x, br.x);
							br.y = Math.max(bb.br.y, br.y);
						} catch (e) {
							// Ignore errors
						}
					});

					if (Number.isFinite(br.x - tl.y)) {
						select(BoundingBox.fromStartEnd(tl, br));
					}
				};

				// Register Ctrl-C/V Shortcut

				// Handles copying
				state.ctrlccb = (evn, cut = false) => {
					if (!state.selected) return;

					if (
						isCanvasBlank(
							0,
							0,
							state.selected.canvas.width,
							state.selected.canvas.height,
							state.selected.canvas
						)
					)
						return;
					// We create a new canvas to store the data
					state.clipboard.copy = document.createElement("canvas");

					state.clipboard.copy.width = state.selected.canvas.width;
					state.clipboard.copy.height = state.selected.canvas.height;

					const ctx = state.clipboard.copy.getContext("2d");

					ctx.clearRect(0, 0, state.selected.w, state.selected.h);
					ctx.drawImage(state.selected.canvas, 0, 0);

					// If cutting, we reverse the selection and erase the selection area
					if (cut) {
						const aux = state.original;
						state.reset();

						commands.runCommand("eraseImage", "Cut Image", aux, {
							extra: {
								log: `Cut to clipboard a selected area at x: ${aux.x}, y: ${aux.y}, width: ${aux.w}, height: ${aux.h} from layer ${state.original.layer.id}`,
							},
						});
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
				state.ctrlvcb = async (evn) => {
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
						await image.decode();

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
				
				// Apply Transform and Reset State, optionally erase Selection or Clear Original Layer				
				// newLayer and keepOriginal default to null, overriding the forced variants if explicitly set to false
				// Only checks if Selection exists and content has been selected
				// Does not check if content has been transformed, eg for deletion/applying to new layer
				state.applyTransform = (eraseSelected = false, clearLayer = false, newLayer = null, keepOriginal = null) => {
						// Just reset state if nothing is selected, unless Clearing layer
						if (!state.selected || state.original.layer.hidden ||
								!clearLayer && 
								isCanvasBlank(
									0,
									0,
									state.selected.canvas.width,
									state.selected.canvas.height,
									state.selected.canvas
								)
							){								
							state.reset(false);
							return;
						}
						
						// Put original image back
						state.original.layer.ctx.drawImage(
							state.selected.canvas,
							state.original.x,
							state.original.y
						);
						
						// Erase Entire Layer
						if (clearLayer) commands.runCommand(
							"eraseImage",
							"Transform Tool Erase",
							{
								...state.original.layer.bb,
								layer: state.original.layer,
							},
							{
								extra: {
									log: `Erased layer ${state.original.layer.id}`,
								},
							}
						);						
						// Erase Original Selection Area
						else if (eraseSelected || !state.preserveOriginal && (keepOriginal==null || !keepOriginal) ) commands.runCommand(
							"eraseImage",
							"Transform Tool Erase",
							{
								layer: state.original.layer,
								x: state.original.x,
								y: state.original.y,
								w: state.selected.canvas.width,
								h: state.selected.canvas.height,
							},
							{
								extra: {
									log: `Erased original selection area at x: ${state.original.x}, y: ${state.original.y}, width: ${state.selected.canvas.width}, height: ${state.selected.canvas.height} from layer ${state.original.layer.id}`,
								},
							}
						);
						
						// Selection erased, no need to draw anything
						if (eraseSelected){
							 state.reset(true);
							 return;
						}
						
						// Draw Image
						const {canvas, bb} = cropCanvas(state.originalDisplayLayer.canvas, {
							border: 10,
						});
						
						if ( (newLayer || state.toNewLayer && newLayer==null) && !clearLayer)
							commands.runCommand("addLayer", "Added Layer", {name: "Copy-"+state.original.layer.name});

						let commandLog = "";
						const addline = (v, newline = true) => {
							commandLog += v;
							if (newline) commandLog += "\n";
						};

						addline(
							`Draw selected area to x: ${bb.x}, y: ${bb.y}, width: ${bb.w}, height: ${bb.h} to layer ${state.original.layer.id}`
						);
						addline(
							`    - translation: (x: ${state.selected.position.x}, y: ${state.selected.position.y})`
						);
						addline(
							`    - rotation   : ${
								Math.round(1000 * ((180 * state.selected.rotation) / Math.PI)) /
								1000
							} degrees`,
							false
						);

						commands.runCommand(
							"drawImage",
							"Transform Tool Apply",
							{
								image: canvas,
								...bb,
							},
							{
								extra: {
									log: commandLog,
								},
							}
						);

						state.reset(true);
				}
				
			},
			populateContextMenu: (menu, state) => {
				if (!state.ctxmenu) {
					state.ctxmenu = {};

					// Snap To Grid Checkbox
					state.ctxmenu.snapToGridLabel = _toolbar_input.checkbox(
						state,
						"openoutpaint/select-snaptogrid",
						"snapToGrid",
						"Snap To Grid",
						"icon-grid"
					).checkbox;

					// Keep Aspect Ratio
					state.ctxmenu.keepAspectRatioLabel = _toolbar_input.checkbox(
						state,
						"openoutpaint/select-keepaspectratio",
						"keepAspectRatio",
						"Keep Aspect Ratio",
						"icon-maximize"
					).checkbox;

					// Mirroring
					state.onMirror = () => {
						if (state.selected) {
							const scale = state.selected.scale;
							scale.x *= -1;
							state.selected.scale = scale;

							state.redraw();
						}
					};
					const {checkbox: mirrorCheckbox, setValue: _mirrorSetValue} =
						_toolbar_input.checkbox(
							state,
							"openoutpaint/select-mirror",
							"mirrorSelection",
							"Mirror Selection",
							"icon-flip-horizontal",
							(v) => {
								state.onMirror();
							}
						);
					state.ctxmenu.mirrorSelectionCheckbox = mirrorCheckbox;
					state.ctxmenu.mirrorSelectionCheckbox.disabled = true;
					_mirrorSetValue(false);
					state.mirrorSetValue = (v) => {
						_mirrorSetValue(v);
						if (v !== state.mirrorSelection) {
							state.onMirror();
						}
					};

					// Use Clipboard
					const clipboardCheckbox = _toolbar_input.checkbox(
						state,
						"openoutpaint/select-useclipboard",
						"useClipboard",
						"Use clipboard",
						"icon-clipboard-list"
					);
					state.ctxmenu.useClipboardLabel = clipboardCheckbox.checkbox;
					if (!(navigator.clipboard && navigator.clipboard.write))
						clipboardCheckbox.checkbox.disabled = true; // Disable if not available
					
					// toNewLayer
					state.ctxmenu.toNewLayerLabel = _toolbar_input.checkbox(
						state,
						"openoutpaint/select-toNewLayer",
						"toNewLayer",
						"Always Create New Layer",
						"icon-file-plus"
					).checkbox;
					
					// preserveOriginal
					state.ctxmenu.preserveOriginalLabel = _toolbar_input.checkbox(
						state,
						"openoutpaint/select-preserveOriginal",
						"preserveOriginal",
						"Preserve Original Image - Restore original content after transforming selection",
						"icon-lock"
					).checkbox;

					// Selection Peek Opacity
					state.ctxmenu.selectionPeekOpacitySlider = _toolbar_input.slider(
						state,
						"openoutpaint/select-peekopacity",
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
							canvas: state.selected.canvas,
						});
					};

					// Save as Resource Button
					const createResourceButton = document.createElement("button");
					createResourceButton.classList.add("button", "tool");
					createResourceButton.textContent = "Resource";
					createResourceButton.title = "Saves Selection as a Resource";
					createResourceButton.onclick = () => {
						const image = document.createElement("img");
						image.src = state.selected.canvas.toDataURL();
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
						console.debug(state.selected);
						console.debug(state.selected.bb);
						var selectBB =
							state.selected.bb != undefined
								? state.selected.bb
								: state.backupBB;
						const canvas = uil.getVisible(selectBB, {
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
						var selectBB =
							state.selected.bb != undefined
								? state.selected.bb
								: state.backupBB;
						const canvas = uil.getVisible(selectBB, {
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


					// Some useful actions to do with selection
					const actionArrayRow3 = document.createElement("div");
					actionArrayRow3.classList.add("button-array");

					// Apply To New Layer button
					const applyNewLayerButton = document.createElement("button");
					applyNewLayerButton.classList.add("button", "tool");
					applyNewLayerButton.textContent = "Move to Layer";
					applyNewLayerButton.title = "Moves Selection to a New Layer (Shift+Enter)";
					applyNewLayerButton.onclick = () => { state.applyTransform(false,false,true,false); };

					// Copy To Layer Buttons
					const copyNewLayerButton = document.createElement("button");
					copyNewLayerButton.classList.add("button", "tool");
					copyNewLayerButton.textContent = "Copy to Layer";
					copyNewLayerButton.title = "Copies selection to a new Layer (Ctrl+Enter)";
					copyNewLayerButton.onclick = () => { state.applyTransform(false,false,true,true); };
					
					actionArrayRow3.appendChild(applyNewLayerButton);
					actionArrayRow3.appendChild(copyNewLayerButton);

					const actionArrayRow4 = document.createElement("div");
					actionArrayRow4.classList.add("button-array");
					
					// Clear Button
					const applyClearButton = document.createElement("button");
					applyClearButton.classList.add("button", "tool");
					applyClearButton.textContent = "Clear and Apply";
					applyClearButton.title = "Erases everything in the current layer other than the selection (Shift+Delete)";
					applyClearButton.onclick = () => { state.applyTransform(false,true,false,false); };
					
					// Erase Button
					const eraseSelectionButton = document.createElement("button");					
					eraseSelectionButton.classList.add("button", "tool");
					eraseSelectionButton.textContent = "Erase";
					eraseSelectionButton.title = "Erases current selection (Delete)";
					eraseSelectionButton.onclick = () => { state.applyTransform(true,false,false,false); };
					
					actionArrayRow4.appendChild(applyClearButton);
					actionArrayRow4.appendChild(eraseSelectionButton);


					// Disable buttons (if nothing is selected)
					state.ctxmenu.disableButtons = () => {
						saveSelectionButton.disabled = true;
						createResourceButton.disabled = true;
						saveVisibleSelectionButton.disabled = true;
						createVisibleResourceButton.disabled = true;
						applyNewLayerButton.disabled = true;
						copyNewLayerButton.disabled = true;
						applyClearButton.disabled = true;
						eraseSelectionButton.disabled = true;
					};

					// Enable buttons (if something is selected)
					state.ctxmenu.enableButtons = () => {
						saveSelectionButton.disabled = "";
						createResourceButton.disabled = "";
						saveVisibleSelectionButton.disabled = "";
						createVisibleResourceButton.disabled = "";
						applyNewLayerButton.disabled = "";
						copyNewLayerButton.disabled = "";
						applyClearButton.disabled = "";
						eraseSelectionButton.disabled = "";
					};
					
					state.ctxmenu.actionArray = actionArray;
					state.ctxmenu.visibleActionArray = visibleActionArray;
					
					state.ctxmenu.actionArrayRow3 = actionArrayRow3;
					state.ctxmenu.actionArrayRow4 = actionArrayRow4;

					// Send Selection to Destination
					state.ctxmenu.sendSelected = document.createElement("select");
					state.ctxmenu.sendSelected.style.width = "100%";
					state.ctxmenu.sendSelected.addEventListener("change", (evn) => {
						const v = evn.target.value;
						if (state.selected && v !== "None")
							global.webui && global.webui.sendTo(state.selected.canvas, v);
						evn.target.value = "None";
					});

					let opt = document.createElement("option");
					opt.textContent = "Send To...";
					opt.value = "None";
					state.ctxmenu.sendSelected.appendChild(opt);
				}
				const array = document.createElement("div");
				array.classList.add("checkbox-array");
				array.appendChild(state.ctxmenu.snapToGridLabel);
				array.appendChild(state.ctxmenu.keepAspectRatioLabel);
				array.appendChild(state.ctxmenu.mirrorSelectionCheckbox);
				array.appendChild(state.ctxmenu.useClipboardLabel);
				
				array.appendChild(state.ctxmenu.toNewLayerLabel);
				array.appendChild(state.ctxmenu.preserveOriginalLabel);
				 
				menu.appendChild(array);
				menu.appendChild(state.ctxmenu.selectionPeekOpacitySlider);
				menu.appendChild(state.ctxmenu.actionArray);
				menu.appendChild(state.ctxmenu.visibleActionArray);
				menu.appendChild(state.ctxmenu.actionArrayRow3);
				menu.appendChild(state.ctxmenu.actionArrayRow4);
				
				if (global.webui && global.webui.destinations) {
					while (state.ctxmenu.sendSelected.lastChild.value !== "None") {
						state.ctxmenu.sendSelected.removeChild(
							state.ctxmenu.sendSelected.lastChild
						);
					}

					global.webui.destinations.forEach((dst) => {
						const opt = document.createElement("option");
						opt.textContent = dst.name;
						opt.value = dst.id;

						state.ctxmenu.sendSelected.appendChild(opt);
					});

					menu.appendChild(state.ctxmenu.sendSelected);
				}
			},
			shortcut: "S",
		}
	);

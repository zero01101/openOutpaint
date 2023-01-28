/**
 * Generic wheel handler
 */
let _stamp_wheel_accum = 0;

const _stamp_onwheel = (evn, state) => {
	if (evn.mode !== WheelEvent.DOM_DELTA_PIXEL) {
		// We don't really handle non-pixel scrolling
		return;
	}

	let delta = evn.delta;
	if (evn.evn.shiftKey) delta *= 0.01;

	// A simple but (I hope) effective fix for mouse wheel behavior
	_stamp_wheel_accum += delta;

	if (
		!evn.evn.shiftKey &&
		Math.abs(_stamp_wheel_accum) > config.wheelTickSize
	) {
		// Snap to next or previous position
		const v =
			state.scale - 0.1 * (_stamp_wheel_accum / Math.abs(_stamp_wheel_accum));

		state.setScale(v + snap(v, 0, 0.1));
		state.redraw(evn);

		_stamp_wheel_accum = 0; // Zero accumulation
	} else if (evn.evn.shiftKey && Math.abs(_stamp_wheel_accum) >= 1) {
		const v = state.scale - _stamp_wheel_accum * 0.01;
		state.setScale(v);
		state.redraw(evn);

		_stamp_wheel_accum = 0; // Zero accumulation
	}
};

const stampTool = () =>
	toolbar.registerTool(
		"./res/icons/file-up.svg",
		"Stamp Image",
		(state, opt) => {
			state.loaded = true;

			// Draw new cursor immediately
			ovLayer.clear();
			state.movecb({...mouse.coords.world.pos});

			// Start Listeners
			mouse.listen.world.onmousemove.on(state.movecb);
			mouse.listen.world.btn.left.onclick.on(state.drawcb);
			mouse.listen.world.btn.right.onclick.on(state.cancelcb);

			mouse.listen.world.btn.left.ondragstart.on(state.dragstartcb);
			mouse.listen.world.btn.left.ondrag.on(state.dragcb);
			mouse.listen.world.btn.left.ondragend.on(state.dragendcb);

			mouse.listen.world.onwheel.on(state.onwheelcb);

			// For calls from other tools to paste image
			if (opt && opt.image) {
				state.addResource(
					opt.name || "Clipboard",
					opt.image,
					opt.temporary === undefined ? true : opt.temporary,
					false
				);
				state.ctxmenu.uploadButton.disabled = true;
				state.back = opt.back || null;
				toolbar.lock();
			} else if (opt) {
				throw Error(
					"Pasting from other tools must be in format {image, name?, temporary?, back?}"
				);
			} else {
				state.ctxmenu.uploadButton.disabled = "";
			}
		},
		(state, opt) => {
			state.loaded = false;

			// Clear Listeners
			mouse.listen.world.onmousemove.clear(state.movecb);
			mouse.listen.world.btn.left.onclick.clear(state.drawcb);
			mouse.listen.world.btn.right.onclick.clear(state.cancelcb);

			mouse.listen.world.btn.left.ondragstart.clear(state.dragstartcb);
			mouse.listen.world.btn.left.ondrag.clear(state.dragcb);
			mouse.listen.world.btn.left.ondragend.clear(state.dragendcb);

			mouse.listen.world.onwheel.clear(state.onwheelcb);

			ovLayer.clear();
		},
		{
			init: (state) => {
				state.loaded = false;
				state.snapToGrid = true;
				state.resources = [];
				state.selected = null;
				state.back = null;

				state.lastMouseMove = {x: 0, y: 0};
				state.block_res_change = true;

				// Current Rotation
				let rotation = 0;
				let rotating = null;
				// Current Scale
				state.scale = 1;

				state.selectResource = (resource, nolock = true, deselect = true) => {
					rotation = 0;
					state.setScale(1);
					if (nolock && state.ctxmenu.uploadButton.disabled) return;

					console.debug(
						`[stamp] Selecting Resource '${resource && resource.name}'[${
							resource && resource.id
						}]`
					);

					const resourceWrapper = resource && resource.dom.wrapper;

					const wasSelected =
						resourceWrapper && resourceWrapper.classList.contains("active");

					Array.from(state.ctxmenu.resourceList.children).forEach((child) => {
						child.classList.remove("active");
					});

					// Select
					if (!wasSelected) {
						resourceWrapper && resourceWrapper.classList.add("active");
						state.selected = resource;
					}
					// If already selected, clear selection (if deselection is enabled)
					else if (deselect) {
						resourceWrapper.classList.remove("active");
						state.selected = null;
					}

					ovLayer.clear();
					if (state.loaded) state.redraw();
				};

				// Open IndexedDB connection
				// Synchronizes resources array with the DOM and Local Storage
				const syncResources = () => {
					// Saves to IndexedDB
					const resources = db
						.transaction("resources", "readwrite")
						.objectStore("resources");
					try {
						const FetchKeysQuery = resources.getAllKeys();
						FetchKeysQuery.onsuccess = () => {
							const keys = FetchKeysQuery.result;
							keys.forEach((key) => {
								if (!state.resources.find((resource) => resource.id === key))
									resources.delete(key);
							});
						};

						state.resources
							.filter((resource) => !resource.temporary && resource.dirty)
							.forEach((resource) => {
								const canvas = document.createElement("canvas");
								canvas.width = resource.image.width;
								canvas.height = resource.image.height;

								const ctx = canvas.getContext("2d");
								ctx.drawImage(resource.image, 0, 0);

								resources.put({
									id: resource.id,
									name: resource.name,
									src: canvas.toDataURL(),
								});

								resource.dirty = false;
							});
					} catch (e) {
						console.warn(
							"[stamp] Failed to synchronize resources with IndexedDB"
						);
						console.warn(e);
					}

					// Creates DOM elements when needed
					state.resources.forEach((resource) => {
						if (
							!state.ctxmenu.resourceList.querySelector(
								`#resource-${resource.id}`
							)
						) {
							console.debug(
								`[stamp] Creating Resource Element [resource-${resource.id}]`
							);
							const resourceWrapper = document.createElement("div");
							resourceWrapper.id = `resource-${resource.id}`;
							resourceWrapper.title = resource.name;
							resourceWrapper.classList.add("resource", "list-item");
							const resourceTitle = document.createElement("input");
							resourceTitle.value = resource.name;
							resourceTitle.style.pointerEvents = "none";
							resourceTitle.addEventListener("change", () => {
								resource.name = resourceTitle.value;
								resource.dirty = true;
								resourceWrapper.title = resourceTitle.value;

								syncResources();
							});
							resourceTitle.addEventListener("keyup", function (event) {
								if (event.key === "Enter") {
									resourceTitle.blur();
								}
							});

							resourceTitle.addEventListener("blur", () => {
								resourceTitle.style.pointerEvents = "none";
							});
							resourceTitle.classList.add("resource-title", "title");

							resourceWrapper.appendChild(resourceTitle);

							resourceWrapper.addEventListener("click", () =>
								state.selectResource(resource)
							);

							resourceWrapper.addEventListener("dblclick", () => {
								resourceTitle.style.pointerEvents = "auto";
								resourceTitle.focus();
								resourceTitle.select();
							});

							resourceWrapper.addEventListener("mouseover", () => {
								state.ctxmenu.previewPane.style.display = "block";
								state.ctxmenu.previewPane.style.backgroundImage = `url(${resource.image.src})`;
							});
							resourceWrapper.addEventListener("mouseleave", () => {
								state.ctxmenu.previewPane.style.display = "none";
							});

							// Add action buttons
							const actionArray = document.createElement("div");
							actionArray.classList.add("actions");

							const saveButton = document.createElement("button");
							saveButton.addEventListener(
								"click",
								(evn) => {
									evn.stopPropagation();
									const canvas = document.createElement("canvas");
									canvas.width = resource.image.width;
									canvas.height = resource.image.height;
									canvas.getContext("2d").drawImage(resource.image, 0, 0);

									downloadCanvas({
										canvas,
										filename: `openOutpaint - resource '${resource.name}'.png`,
									});
								},
								{passive: false}
							);
							saveButton.title = "Download Resource";
							saveButton.appendChild(document.createElement("div"));
							saveButton.classList.add("download-btn");

							const trashButton = document.createElement("button");
							trashButton.addEventListener(
								"click",
								(evn) => {
									evn.stopPropagation();
									state.ctxmenu.previewPane.style.display = "none";
									state.deleteResource(resource.id);
								},
								{passive: false}
							);
							trashButton.title = "Delete Resource";
							trashButton.appendChild(document.createElement("div"));
							trashButton.classList.add("delete-btn");

							actionArray.appendChild(saveButton);
							actionArray.appendChild(trashButton);
							resourceWrapper.appendChild(actionArray);
							state.ctxmenu.resourceList.appendChild(resourceWrapper);
							resource.dom = {wrapper: resourceWrapper};
						}
					});

					// Removes DOM elements when needed
					const elements = Array.from(state.ctxmenu.resourceList.children);

					if (elements.length > state.resources.length)
						elements.forEach((element) => {
							let remove = true;
							state.resources.some((resource) => {
								if (element.id.endsWith(resource.id)) {
									remove = false;
								}
							});

							if (remove) {
								console.debug(`[stamp] Sync Removing Element [${element.id}]`);
								state.ctxmenu.resourceList.removeChild(element);
							}
						});
				};

				// Adds a image resource (temporary allows only one draw, used for pasting)
				state.addResource = (name, image, temporary = false, nolock = true) => {
					const id = guid();
					const resource = {
						id,
						name,
						image,
						dirty: true,
						temporary,
					};

					console.info(`[stamp] Adding Resource '${name}'[${id}]`);

					state.resources.push(resource);
					syncResources();

					// Select this resource
					state.selectResource(resource, nolock, false);

					return resource;
				};

				// Used for temporary images too
				state.deleteResource = (id) => {
					const resourceIndex = state.resources.findIndex((v) => v.id === id);
					const resource = state.resources[resourceIndex];
					if (state.selected === resource) state.selected = null;
					console.info(
						`[stamp] Deleting Resource '${resource.name}'[${resource.id}]`
					);

					state.resources.splice(resourceIndex, 1);

					syncResources();
				};

				state.onwheelcb = (evn) => {
					_stamp_onwheel(evn, state);
				};

				state.dragstartcb = (evn) => {
					const {x, y, sx, sy} = _tool._process_cursor(evn, state.snapToGrid);
					rotating = {x: sx, y: sy};
				};

				state.dragcb = (evn) => {
					if (rotating) {
						rotation = Math.atan2(rotating.x - evn.x, evn.y - rotating.y);

						if (evn.evn.shiftKey)
							rotation =
								config.rotationSnappingAngles.find(
									(v) =>
										Math.abs(v - rotation) < config.rotationSnappingDistance
								) ?? rotation;
					}
				};

				state.dragendcb = (evn) => {
					rotating = null;
				};

				let erasePrevCursor = () => null;

				state.movecb = (evn) => {
					const {x, y, sx, sy} = _tool._process_cursor(evn, state.snapToGrid);

					// Erase Previous Cursors
					erasePrevCursor();

					state.lastMouseMove = evn;

					ovLayer.clear();

					let px = sx;
					let py = sy;

					if (rotating) {
						px = rotating.x;
						py = rotating.y;
					}

					// Draw selected image
					if (state.selected) {
						ovCtx.save();
						ovCtx.translate(px, py);
						ovCtx.scale(state.scale, state.scale);
						ovCtx.rotate(rotation);

						ovCtx.drawImage(state.selected.image, 0, 0);
						ovCtx.restore();
					}

					// Draw current cursor location
					erasePrevCursor = _tool._cursor_draw(px, py);
				};

				state.redraw = () => {
					state.movecb(state.lastMouseMove);
				};

				state.drawcb = (evn) => {
					const {x, y, sx, sy} = _tool._process_cursor(evn, state.snapToGrid);

					const resource = state.selected;

					if (resource) {
						if (
							localStorage.getItem("openoutpaint/settings.autolayer") == "true"
						) {
							commands.runCommand("addLayer", "Added Layer", {});
						}
						const {canvas, bb} = cropCanvas(ovCanvas, {border: 10});

						let commandLog = "";

						const addline = (v, newline = true) => {
							commandLog += v;
							if (newline) commandLog += "\n";
						};
						addline(
							`Stamped image '${resource.name}' to x: ${bb.x} and y: ${bb.y}`
						);
						addline(`    - scaling : ${state.scale}`);
						addline(
							`    - rotation: ${
								Math.round(1000 * ((180 * rotation) / Math.PI)) / 1000
							} degrees`,
							false
						);

						commands.runCommand(
							"drawImage",
							"Image Stamp",
							{
								image: canvas,
								x: bb.x,
								y: bb.y,
							},
							{
								extra: {
									log: commandLog,
								},
							}
						);

						if (resource.temporary) {
							state.deleteResource(resource.id);
						}
					}

					if (state.back) {
						toolbar.unlock();
						const backfn = state.back;
						state.back = null;
						backfn({message: "Returning from stamp", pasted: true});
					}
				};
				state.cancelcb = (evn) => {
					state.selectResource(null);

					if (state.back) {
						toolbar.unlock();
						const backfn = state.back;
						state.back = null;
						backfn({message: "Returning from stamp", pasted: false});
					}
				};

				/**
				 * Creates context menu
				 */
				if (!state.ctxmenu) {
					state.ctxmenu = {};
					// Snap To Grid Checkbox
					const array = document.createElement("div");
					array.classList.add("checkbox-array");
					array.appendChild(
						_toolbar_input.checkbox(
							state,
							"snapToGrid",
							"Snap To Grid",
							"icon-grid"
						).checkbox
					);
					state.ctxmenu.snapToGridLabel = array;

					// Scale Slider
					const scaleSlider = _toolbar_input.slider(state, "scale", "Scale", {
						min: 0.01,
						max: 10,
						step: 0.1,
						textStep: 0.001,
					});
					state.ctxmenu.scaleSlider = scaleSlider.slider;
					state.setScale = scaleSlider.setValue;

					// Create resource list
					const uploadButtonId = `upload-btn-${guid()}`;

					const resourceManager = document.createElement("div");
					resourceManager.classList.add("resource-manager");
					const resourceList = document.createElement("div");
					resourceList.classList.add("list");

					const previewPane = document.createElement("div");
					previewPane.classList.add("preview-pane");

					const uploadLabel = document.createElement("label");
					uploadLabel.classList.add("upload-button");
					uploadLabel.classList.add("button");
					uploadLabel.classList.add("tool");
					uploadLabel.textContent = "Upload Image";
					uploadLabel.htmlFor = uploadButtonId;
					const uploadButton = document.createElement("input");
					uploadButton.id = uploadButtonId;
					uploadButton.type = "file";
					uploadButton.accept = "image/*";
					uploadButton.multiple = true;
					uploadButton.style.display = "none";

					uploadButton.addEventListener("change", (evn) => {
						[...uploadButton.files].forEach((file) => {
							if (file.type.startsWith("image/")) {
								console.info("Uploading Image " + file.name);
								const url = window.URL || window.webkitURL;
								const image = document.createElement("img");
								image.src = url.createObjectURL(file);

								image.onload = () => state.addResource(file.name, image, false);
							}
						});
						uploadButton.value = null;
					});

					uploadLabel.appendChild(uploadButton);
					resourceManager.appendChild(resourceList);
					resourceManager.appendChild(uploadLabel);
					resourceManager.appendChild(previewPane);

					resourceManager.addEventListener(
						"drop",
						(evn) => {
							evn.preventDefault();
							resourceManager.classList.remove("dragging");

							if (evn.dataTransfer.items) {
								Array.from(evn.dataTransfer.items).forEach((item) => {
									if (item.kind === "file" && item.type.startsWith("image/")) {
										const file = item.getAsFile();
										const url = window.URL || window.webkitURL;
										const image = document.createElement("img");
										image.src = url.createObjectURL(file);

										state.addResource(file.name, image, false);
									}
								});
							}
						},
						{passive: false}
					);
					resourceManager.addEventListener(
						"dragover",
						(evn) => {
							evn.preventDefault();
						},
						{passive: false}
					);

					resourceManager.addEventListener("dragover", (evn) => {
						resourceManager.classList.add("dragging");
					});

					resourceManager.addEventListener("dragover", (evn) => {
						resourceManager.classList.remove("dragging");
					});

					state.ctxmenu.uploadButton = uploadButton;
					state.ctxmenu.previewPane = previewPane;
					state.ctxmenu.resourceManager = resourceManager;
					state.ctxmenu.resourceList = resourceList;

					// Performs resource fetch from IndexedDB
					const loadResources = async () => {
						console.debug("[stamp] Connected to IndexedDB");

						/** @type {IDBRequest<{id: string, name: string, src: string}[]>} */
						const FetchAllTransaction = db
							.transaction("resources")
							.objectStore("resources")
							.getAll();

						FetchAllTransaction.onsuccess = async () => {
							const data = FetchAllTransaction.result;

							state.resources.push(
								...(await Promise.all(
									data.map((resource) => {
										const image = document.createElement("img");
										image.src = resource.src;

										return new Promise((resolve, reject) => {
											image.onload = () =>
												resolve({
													id: resource.id,
													name: resource.name,
													image,
												});
										});
									})
								))
							);
							syncResources();
						};
					};

					if (db) loadResources();
					else ondatabaseload.on(loadResources);
				}
			},
			populateContextMenu: (menu, state) => {
				menu.appendChild(state.ctxmenu.snapToGridLabel);
				menu.appendChild(state.ctxmenu.scaleSlider);
				menu.appendChild(state.ctxmenu.resourceManager);
			},
			shortcut: "U",
		}
	);

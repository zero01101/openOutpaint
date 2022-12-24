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

				state.selectResource = (resource, nolock = true, deselect = true) => {
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
				const IDBOpenRequest = window.indexedDB.open("stamp", 1);

				// Synchronizes resources array with the DOM and Local Storage
				const syncResources = () => {
					// Saves to IndexedDB
					/** @type {IDBDatabase} */
					const db = state.stampDB;
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

				state.movecb = (evn) => {
					let x = evn.x;
					let y = evn.y;
					if (state.snapToGrid) {
						x += snap(evn.x, 0, 64);
						y += snap(evn.y, 0, 64);
					}

					const vpc = viewport.canvasToView(x, y);
					uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
					state.erasePrevCursor && state.erasePrevCursor();

					uiCtx.save();

					state.lastMouseMove = evn;

					ovLayer.clear();

					// Draw selected image
					if (state.selected) {
						ovCtx.drawImage(state.selected.image, x, y);
					}

					// Draw current cursor location
					state.erasePrevCursor = _tool._cursor_draw(x, y);
					uiCtx.restore();
				};

				state.redraw = () => {
					state.movecb(state.lastMouseMove);
				};

				state.drawcb = (evn) => {
					let x = evn.x;
					let y = evn.y;
					if (state.snapToGrid) {
						x += snap(evn.x, 0, 64);
						y += snap(evn.y, 0, 64);
					}

					const resource = state.selected;

					if (resource) {
						commands.runCommand("drawImage", "Image Stamp", {
							image: resource.image,
							x,
							y,
						});

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
					state.ctxmenu.snapToGridLabel = _toolbar_input.checkbox(
						state,
						"snapToGrid",
						"Snap To Grid"
					).label;

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

					IDBOpenRequest.onerror = (e) => {
						console.warn("[stamp] Failed to connect to IndexedDB");
						console.warn(e);
					};

					IDBOpenRequest.onupgradeneeded = (e) => {
						const db = e.target.result;

						console.debug(`[stamp] Setting up database version ${db.version}`);

						const resourcesStore = db.createObjectStore("resources", {
							keyPath: "id",
						});
						resourcesStore.createIndex("name", "name", {unique: false});
					};

					IDBOpenRequest.onsuccess = async (e) => {
						console.debug("[stamp] Connected to IndexedDB");

						state.stampDB = e.target.result;

						state.stampDB.onerror = (evn) => {
							console.warn(`[stamp] Database Error:`);
							console.warn(evn.target.errorCode);
						};

						/** @type {IDBDatabase} */
						const db = state.stampDB;
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
				}
			},
			populateContextMenu: (menu, state) => {
				menu.appendChild(state.ctxmenu.snapToGridLabel);
				menu.appendChild(state.ctxmenu.resourceManager);
			},
			shortcut: "U",
		}
	);

const stampTool = () =>
	toolbar.registerTool(
		"res/icons/file-up.svg",
		"Stamp Image",
		(state, opt) => {
			state.loaded = true;

			// Draw new cursor immediately
			ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
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

			// Deselect
			state.selected = null;
			Array.from(state.ctxmenu.resourceList.children).forEach((child) => {
				child.classList.remove("selected");
			});
		},
		{
			init: (state) => {
				state.loaded = false;
				state.snapToGrid = true;
				state.resources = [];
				state.selected = null;
				state.back = null;

				state.lastMouseMove = {x: 0, y: 0};

				state.selectResource = (resource, nolock = true) => {
					if (nolock && state.ctxmenu.uploadButton.disabled) return;

					console.debug(
						`[stamp] Selecting Resource '${resource && resource.name}'[${
							resource && resource.id
						}]`
					);

					const resourceWrapper = resource && resource.dom.wrapper;

					const wasSelected =
						resourceWrapper && resourceWrapper.classList.contains("selected");

					Array.from(state.ctxmenu.resourceList.children).forEach((child) => {
						child.classList.remove("selected");
					});

					// Select
					if (!wasSelected) {
						resourceWrapper && resourceWrapper.classList.add("selected");
						state.selected = resource;
					}
					// If already selected, clear selection
					else {
						resourceWrapper.classList.remove("selected");
						state.selected = null;
					}

					ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
					if (state.loaded) state.movecb(state.lastMouseMove);
				};

				// Synchronizes resources array with the DOM
				const syncResources = () => {
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
							resourceWrapper.textContent = resource.name;
							resourceWrapper.classList.add("resource");

							resourceWrapper.addEventListener("click", () =>
								state.selectResource(resource)
							);

							resourceWrapper.addEventListener("mouseover", () => {
								state.ctxmenu.previewPane.style.display = "block";
								state.ctxmenu.previewPane.style.backgroundImage = `url(${resource.image.src})`;
							});
							resourceWrapper.addEventListener("mouseleave", () => {
								state.ctxmenu.previewPane.style.display = "none";
							});

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
						temporary,
					};

					console.info(`[stamp] Adding Resource '${name}'[${id}]`);

					state.resources.push(resource);
					syncResources();

					// Select this resource
					state.selectResource(resource, nolock);

					return resource;
				};

				// Deletes a resource (Yes, functionality is here, but we don't have an UI for this yet)
				// Used for temporary images too
				state.deleteResource = (id) => {
					const resourceIndex = state.resources.findIndex((v) => v.id === id);
					const resource = state.resources[resourceIndex];
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
						x += snap(evn.x, true, 64);
						y += snap(evn.y, true, 64);
					}

					state.lastMouseMove = evn;

					ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);

					// Draw selected image
					if (state.selected) {
						ovCtx.drawImage(state.selected.image, x, y);
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

				state.drawcb = (evn) => {
					let x = evn.x;
					let y = evn.y;
					if (state.snapToGrid) {
						x += snap(evn.x, true, 64);
						y += snap(evn.y, true, 64);
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
					resourceList.classList.add("resource-list");

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

								state.addResource(file.name, image, false);
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
				}
			},
			populateContextMenu: (menu, state) => {
				menu.appendChild(state.ctxmenu.snapToGridLabel);
				menu.appendChild(state.ctxmenu.resourceManager);
			},
			shortcut: "U",
		}
	);

const stampTool = () =>
	toolbar.registerTool(
		"res/icons/file-up.svg",
		"Stamp Image",
		(state, opt) => {
			// Draw new cursor immediately
			ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
			state.movecb({...mouse.coords.canvas.pos, target: {id: "overlayCanvas"}});

			// Start Listeners
			mouse.listen.canvas.onmousemove.on(state.movecb);
			mouse.listen.canvas.left.onclick.on(state.drawcb);

			// For calls from other tools to paste image
			if (opt && opt.image) {
				state.selected = state.addResource(
					opt.name || "Clipboard",
					opt.image,
					opt.temporary === undefined ? true : opt.temporary
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
			// Clear Listeners
			mouse.listen.canvas.onmousemove.clear(state.movecb);
			mouse.listen.canvas.left.onclick.clear(state.drawcb);
		},
		{
			init: (state) => {
				state.snapToGrid = true;
				state.resources = [];
				state.selected = null;
				state.back = null;

				const syncResources = () => {
					state.resources.forEach((resource) => {
						if (!document.getElementById(`resource-${resource.id}`)) {
							const resourceWrapper = document.createElement("div");
							resourceWrapper.id = `resource-${resource.id}`;
							resourceWrapper.textContent = resource.name;
							resourceWrapper.classList.add("resource");

							resourceWrapper.addEventListener("click", () => {
								state.selected = resource;
								Array.from(state.ctxmenu.resourceList.children).forEach(
									(child) => {
										child.classList.remove("selected");
									}
								);

								resourceWrapper.classList.add("selected");
							});

							resourceWrapper.addEventListener("mouseover", () => {
								state.ctxmenu.previewPane.style.display = "block";
								state.ctxmenu.previewPane.style.backgroundImage = `url(${resource.image.src})`;
							});
							resourceWrapper.addEventListener("mouseleave", () => {
								state.ctxmenu.previewPane.style.display = "none";
							});

							state.ctxmenu.resourceList.appendChild(resourceWrapper);
						}
					});

					const elements = Array.from(state.ctxmenu.resourceList.children);

					if (elements.length > state.resources.length)
						elements.forEach((element) => {
							for (let resource in state.resources) {
								if (element.id.endsWith(resource.id)) return;
							}
							state.ctxmenu.resourceList.removeChild(element);
						});
				};

				state.addResource = (name, image, temporary = false) => {
					const id = guid();
					const resource = {
						id,
						name,
						image,
						temporary,
					};
					state.resources.push(resource);
					syncResources();
					return resource;
				};
				state.deleteResource = (id) => {
					state.resources = state.resources.filter((v) => v.id !== id);

					syncResources();
				};

				state.movecb = (evn) => {
					if (evn.target.id === "overlayCanvas") {
						let x = evn.x;
						let y = evn.y;
						if (state.snapToGrid) {
							x += snap(evn.x, true, 64);
							y += snap(evn.y, true, 64);
						}

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
					}
				};

				state.drawcb = (evn) => {
					if (evn.target.id === "overlayCanvas") {
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

							if (resource.temporary) state.deleteResource(resource.id);
						}

						if (state.back) {
							toolbar.unlock();
							state.back({message: "Returning from stamp", pasted: true});
						}
					}
				};
				state.cancelcb = (evn) => {
					if (evn.target.id === "overlayCanvas") {
						if (state.back) {
							toolbar.unlock();
							state.back({message: "Returning from stamp", pasted: false});
						}
					}
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

								state.selected = state.addResource(file.name, image, false);
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

				menu.appendChild(state.ctxmenu.snapToGridLabel);
				menu.appendChild(state.ctxmenu.resourceManager);
			},
			shortcut: "U",
		}
	);

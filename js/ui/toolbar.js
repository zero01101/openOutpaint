/**
 * Toolbar
 */

const toolbar = {
	_toolbar: document.getElementById("ui-toolbar"),

	tools: [],

	_makeToolbarEntry: (tool) => {
		const toolTitle = document.createElement("img");
		toolTitle.classList.add("tool-icon");
		toolTitle.src = tool.icon;

		const toolEl = document.createElement("div");
		toolEl.id = `tool-${tool.id}`;
		toolEl.classList.add("tool");
		toolEl.title = tool.name;
		if (tool.options.shortcut) toolEl.title += ` (${tool.options.shortcut})`;
		toolEl.onclick = () => tool.enable();

		toolEl.appendChild(toolTitle);

		return toolEl;
	},

	registerTool(
		icon,
		toolname,
		enable,
		disable,
		options = {
			/**
			 * Runs on tool creation. It receives the tool state.
			 *
			 * Can be used to setup callback functions, for example.
			 */
			init: null,
			/**
			 * Function to populate the state menu.
			 *
			 * It receives a div element (that is the menu) and the current tool state.
			 */
			populateContextMenu: null,
			/**
			 * Help description of the tool; for now used for nothing
			 */
			description: "",
			/**
			 * Shortcut; Text describing this tool's shortcut access
			 */
			shortcut: "",
		}
	) {
		// Set some defaults
		if (!options.init)
			options.init = (state) => console.debug(`Initialized tool '${toolname}'`);

		if (!options.populateContextMenu)
			options.populateContextMenu = (menu, state) => {
				const span = document.createElement("span");
				span.textContent = "Tool has no context menu";
				menu.appendChild(span);
				return;
			};

		// Create tool
		const id = guid();

		const contextMenuEl = document.getElementById("tool-context");

		const tool = {
			id,
			icon,
			name: toolname,
			enabled: false,
			_element: null,
			state: {},
			options,
			enable: (opt = null) => {
				this.tools.filter((t) => t.enabled).forEach((t) => t.disable());

				while (contextMenuEl.lastChild) {
					contextMenuEl.removeChild(contextMenuEl.lastChild);
				}
				options.populateContextMenu(contextMenuEl, tool.state);

				tool._element && tool._element.classList.add("using");
				tool.enabled = true;
				enable(tool.state, opt);
			},
			disable: (opt = null) => {
				tool._element && tool._element.classList.remove("using");
				disable(tool.state, opt);
				tool.enabled = false;
			},
		};

		// Initalize
		options.init && options.init(tool.state);

		this.tools.push(tool);

		// Add tool to toolbar
		tool._element = this._makeToolbarEntry(tool);
		this._toolbar.appendChild(tool._element);

		return tool;
	},

	addSeparator() {
		const separator = document.createElement("div");
		separator.classList.add("separator");
		this._toolbar.appendChild(separator);
	},
};

/**
 * Premade inputs for populating the context menus
 */
const _toolbar_input = {
	checkbox: (state, dataKey, text) => {
		if (state[dataKey] === undefined) state[dataKey] = false;

		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.checked = state[dataKey];
		checkbox.onchange = () => (state[dataKey] = checkbox.checked);

		const label = document.createElement("label");
		label.appendChild(checkbox);
		label.appendChild(new Text(text));

		return {checkbox, label};
	},

	slider: (state, dataKey, text, min = 0, max = 1, step = 0.1) => {
		const slider = document.createElement("input");
		slider.type = "range";
		slider.max = max;
		slider.step = step;
		slider.min = min;
		slider.value = state[dataKey];

		const textEl = document.createElement("input");
		textEl.type = "number";
		textEl.value = state[dataKey];

		console.log(state[dataKey]);

		sliderChangeHandlerFactoryEl(
			slider,
			textEl,
			dataKey,
			state[dataKey],
			false,
			(k, v) => (state[dataKey] = v),
			(k) => state[dataKey]
		);

		const label = document.createElement("label");
		label.appendChild(new Text(text));
		label.appendChild(textEl);
		label.appendChild(slider);

		return {
			slider,
			text: textEl,
			label,
			setValue(v) {
				slider.value = v;
				textEl.value = slider.value;
				return parseInt(slider.value);
			},
		};
	},
};

/**
 * Dream and img2img tools
 */
const _reticle_draw = (evn, snapToGrid = true) => {
	if (evn.target.id === "overlayCanvas") {
		const bb = getBoundingBox(
			evn.x,
			evn.y,
			basePixelCount * scaleFactor,
			basePixelCount * scaleFactor,
			snapToGrid && basePixelCount
		);

		// draw targeting square reticle thingy cursor
		ovCtx.strokeStyle = "#FFF";
		ovCtx.strokeRect(bb.x, bb.y, bb.w, bb.h); //origin is middle of the frame
	}
};

const tools = {};

/**
 * Dream tool
 */
tools.dream = toolbar.registerTool(
	"res/icons/image-plus.svg",
	"Dream",
	(state, opt) => {
		// Draw new cursor immediately
		ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
		state.mousemovecb({...mouse.canvas.pos, target: {id: "overlayCanvas"}});

		// Start Listeners
		mouse.listen.canvas.onmousemove.on(state.mousemovecb);
		mouse.listen.canvas.left.onclick.on(state.dreamcb);
		mouse.listen.canvas.right.onclick.on(state.erasecb);
	},
	(state, opt) => {
		// Clear Listeners
		mouse.listen.canvas.onmousemove.clear(state.mousemovecb);
		mouse.listen.canvas.left.onclick.clear(state.dreamcb);
		mouse.listen.canvas.right.onclick.clear(state.erasecb);
	},
	{
		init: (state) => {
			state.snapToGrid = true;
			state.overMaskPx = 0;
			state.mousemovecb = (evn) => _reticle_draw(evn, state.snapToGrid);
			state.dreamcb = (evn) => {
				dream_generate_callback(evn, state);
			};
			state.erasecb = (evn) => dream_erase_callback(evn, state);
		},
		populateContextMenu: (menu, state) => {
			if (!state.ctxmenu) {
				state.ctxmenu = {};
				state.ctxmenu.snapToGridLabel = _toolbar_input.checkbox(
					state,
					"snapToGrid",
					"Snap To Grid"
				).label;
				state.ctxmenu.overMaskPxLabel = _toolbar_input.slider(
					state,
					"overMaskPx",
					"Overmask px (0 to disable):",
					0,
					128,
					1
				).label;
			}

			menu.appendChild(state.ctxmenu.snapToGridLabel);
			menu.appendChild(document.createElement("br"));
			menu.appendChild(state.ctxmenu.overMaskPxLabel);
		},
		shortcut: "D",
	}
);

tools.img2img = toolbar.registerTool(
	"res/icons/image.svg",
	"Img2Img",
	(state, opt) => {
		// Draw new cursor immediately
		ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
		state.mousemovecb({...mouse.canvas.pos, target: {id: "overlayCanvas"}});

		// Start Listeners
		mouse.listen.canvas.onmousemove.on(state.mousemovecb);
		mouse.listen.canvas.left.onclick.on(state.dreamcb);
		mouse.listen.canvas.right.onclick.on(state.erasecb);
	},
	(state, opt) => {
		// Clear Listeners
		mouse.listen.canvas.onmousemove.clear(state.mousemovecb);
		mouse.listen.canvas.left.onclick.clear(state.dreamcb);
		mouse.listen.canvas.right.onclick.clear(state.erasecb);
	},
	{
		init: (state) => {
			state.snapToGrid = true;
			state.denoisingStrength = 0.7;

			state.useBorderMask = true;
			state.borderMaskSize = 64;

			state.mousemovecb = (evn) => {
				_reticle_draw(evn, state.snapToGrid);
				const bb = getBoundingBox(
					evn.x,
					evn.y,
					basePixelCount * scaleFactor,
					basePixelCount * scaleFactor,
					state.snapToGrid && basePixelCount
				);

				// For displaying border mask
				const auxCanvas = document.createElement("canvas");
				auxCanvas.width = bb.w;
				auxCanvas.height = bb.h;
				const auxCtx = auxCanvas.getContext("2d");

				if (state.useBorderMask) {
					auxCtx.fillStyle = "#FF6A6A50";
					auxCtx.fillRect(0, 0, state.borderMaskSize, bb.h);
					auxCtx.fillRect(0, 0, bb.w, state.borderMaskSize);
					auxCtx.fillRect(
						bb.w - state.borderMaskSize,
						0,
						state.borderMaskSize,
						bb.h
					);
					auxCtx.fillRect(
						0,
						bb.h - state.borderMaskSize,
						bb.w,
						state.borderMaskSize
					);
				}

				const tmp = ovCtx.globalAlpha;
				ovCtx.globalAlpha = 0.4;
				ovCtx.drawImage(auxCanvas, bb.x, bb.y);
				ovCtx.globalAlpha = tmp;
			};
			state.dreamcb = (evn) => {
				dream_img2img_callback(evn, state);
			};
			state.erasecb = (evn) => dream_erase_callback(evn, state);
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

				// Denoising Strength Slider
				state.ctxmenu.denoisingStrengthLabel = _toolbar_input.slider(
					state,
					"denoisingStrength",
					"Denoising Strength",
					0,
					1,
					0.05
				).label;

				// Use Border Mask Checkbox
				state.ctxmenu.useBorderMaskLabel = _toolbar_input.checkbox(
					state,
					"useBorderMask",
					"Use Border Mask"
				).label;
				// Border Mask Size Slider
				state.ctxmenu.borderMaskSize = _toolbar_input.slider(
					state,
					"borderMaskSize",
					"Border Mask Size",
					0,
					128,
					1
				).label;
			}

			menu.appendChild(state.ctxmenu.snapToGridLabel);
			menu.appendChild(document.createElement("br"));
			menu.appendChild(state.ctxmenu.denoisingStrengthLabel);
			menu.appendChild(document.createElement("br"));
			menu.appendChild(state.ctxmenu.useBorderMaskLabel);
			menu.appendChild(document.createElement("br"));
			menu.appendChild(state.ctxmenu.borderMaskSize);
		},
		shortcut: "I",
	}
);

/**
 * Mask Editing tools
 */
toolbar.addSeparator();

/**
 * Mask Brush tool
 */
tools.maskbrush = toolbar.registerTool(
	"res/icons/paintbrush.svg",
	"Mask Brush",
	(state, opt) => {
		// Draw new cursor immediately
		ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
		state.movecb({...mouse.canvas.pos, target: {id: "overlayCanvas"}});

		// Start Listeners
		mouse.listen.canvas.onmousemove.on(state.movecb);
		mouse.listen.canvas.onwheel.on(state.wheelcb);
		mouse.listen.canvas.left.onpaint.on(state.drawcb);
		mouse.listen.canvas.right.onpaint.on(state.erasecb);
	},
	(state, opt) => {
		// Clear Listeners
		mouse.listen.canvas.onmousemove.clear(state.movecb);
		mouse.listen.canvas.onwheel.on(state.wheelcb);
		mouse.listen.canvas.left.onpaint.clear(state.drawcb);
		mouse.listen.canvas.right.onpaint.clear(state.erasecb);
	},
	{
		init: (state) => {
			state.config = {
				brushScrollSpeed: 1 / 4,
				minBrushSize: 10,
				maxBrushSize: 500,
			};

			state.brushSize = 64;
			state.setBrushSize = (size) => {
				state.brushSize = size;
				state.ctxmenu.brushSizeRange.value = size;
				state.ctxmenu.brushSizeText.value = size;
			};

			state.movecb = (evn) => {
				if (evn.target.id === "overlayCanvas") {
					// draw big translucent red blob cursor
					ovCtx.beginPath();
					ovCtx.arc(evn.x, evn.y, state.brushSize / 2, 0, 2 * Math.PI, true); // for some reason 4x on an arc is === to 8x on a line???
					ovCtx.fillStyle = "#FF6A6A50";
					ovCtx.fill();
				}
			};

			state.wheelcb = (evn) => {
				if (evn.target.id === "overlayCanvas") {
					state.brushSize = state.setBrushSize(
						state.brushSize -
							Math.floor(state.config.brushScrollSpeed * evn.delta)
					);
					ovCtx.clearRect(0, 0, ovCanvas.width, ovCanvas.height);
					state.movecb(evn);
				}
			};

			state.drawcb = (evn) => mask_brush_draw_callback(evn, state);
			state.erasecb = (evn) => mask_brush_erase_callback(evn, state);
		},
		populateContextMenu: (menu, state) => {
			if (!state.ctxmenu) {
				state.ctxmenu = {};
				const brushSizeSlider = _toolbar_input.slider(
					state,
					"brushSize",
					"Brush Size",
					state.config.minBrushSize,
					state.config.maxBrushSize,
					1
				);
				state.ctxmenu.brushSizeLabel = brushSizeSlider.label;
				state.setBrushSize = brushSizeSlider.setValue;
			}

			menu.appendChild(state.ctxmenu.brushSizeLabel);
		},
		shortcut: "M",
	}
);

toolbar.tools[0].enable();

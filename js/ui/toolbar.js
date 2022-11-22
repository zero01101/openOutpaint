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
		_reticle_draw({...mouse.canvas.pos, target: {id: "overlayCanvas"}});

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
			state.mousemovecb = (evn) => _reticle_draw(evn, state.snapToGrid);
			state.dreamcb = (evn) => {
				dream_generate_callback(evn, state);
			};
			state.erasecb = (evn) => dream_erase_callback(evn, state);
		},
		populateContextMenu: (menu, state) => {
			if (!state.ctxmenu) {
				state.ctxmenu = {};
				// Snap To Grid Checkbox
				const snapToGridCheckbox = document.createElement("input");
				snapToGridCheckbox.type = "checkbox";
				snapToGridCheckbox.checked = state.snapToGrid;
				snapToGridCheckbox.onchange = () =>
					(state.snapToGrid = snapToGridCheckbox.checked);
				state.ctxmenu.snapToGridCheckbox = snapToGridCheckbox;

				const snapToGridLabel = document.createElement("label");
				snapToGridLabel.appendChild(snapToGridCheckbox);
				snapToGridLabel.appendChild(new Text("Snap to Grid"));
				state.ctxmenu.snapToGridLabel = snapToGridLabel;
			}

			menu.appendChild(state.ctxmenu.snapToGridLabel);
		},
		shortcut: "D",
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
					state.setBrushSize(
						Math.max(
							state.config.minBrushSize,
							Math.min(
								state.config.maxBrushSize,
								state.brushSize -
									Math.floor(state.config.brushScrollSpeed * evn.delta)
							)
						)
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
				// Brush Size slider
				const brushSizeRange = document.createElement("input");
				brushSizeRange.type = "range";
				brushSizeRange.value = state.brushSize;
				brushSizeRange.max = state.config.maxBrushSize;
				brushSizeRange.step = 8;
				brushSizeRange.min = state.config.minBrushSize;
				brushSizeRange.oninput = () =>
					(state.brushSize = parseInt(brushSizeRange.value));
				state.ctxmenu.brushSizeRange = brushSizeRange;
				const brushSizeText = document.createElement("input");
				brushSizeText.type = "number";
				brushSizeText.value = state.brushSize;
				brushSizeText.oninput = () =>
					(state.brushSize = parseInt(brushSizeText.value));
				state.ctxmenu.brushSizeText = brushSizeText;

				const brushSizeLabel = document.createElement("label");
				brushSizeLabel.appendChild(new Text("Brush Size"));
				brushSizeLabel.appendChild(brushSizeText);
				brushSizeLabel.appendChild(brushSizeRange);
				state.ctxmenu.brushSizeLabel = brushSizeLabel;
			}

			menu.appendChild(state.ctxmenu.brushSizeLabel);
		},
		shortcut: "M",
	}
);

toolbar.tools[0].enable();

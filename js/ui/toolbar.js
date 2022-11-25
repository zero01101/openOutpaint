/**
 * Toolbar
 */

const toolbar = {
	_locked: false,
	_toolbar: document.getElementById("ui-toolbar"),
	_toolbar_lock_indicator: document.getElementById("toolbar-lock-indicator"),

	tools: [],

	lock() {
		toolbar._locked = true;
		toolbar._toolbar_lock_indicator.style.display = "block";
	},
	unlock() {
		toolbar._locked = false;
		toolbar._toolbar_lock_indicator.style.display = "none";
	},

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
				if (toolbar._locked) return;

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
		const slider = document.createElement("div");

		const value = createSlider(text, slider, {
			min,
			max,
			step,
			valuecb: (v) => {
				state[dataKey] = v;
			},
			defaultValue: state[dataKey],
		});

		return {
			slider,
			setValue(v) {
				value.value = v;
				return value.value;
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
		ovCtx.lineWidth = 1;
		ovCtx.strokeStyle = "#FFF";
		ovCtx.strokeRect(bb.x, bb.y, bb.w, bb.h); //origin is middle of the frame
	}
};

const tools = {};

/**
 * Dream tool
 */
tools.dream = dreamTool();
tools.img2img = img2imgTool();

/**
 * Mask Editing tools
 */
toolbar.addSeparator();

/**
 * Mask Brush tool
 */
tools.maskbrush = maskBrushTool();

/**
 * Image Editing tools
 */
toolbar.addSeparator();

tools.selecttransform = selectTransformTool();
tools.stamp = stampTool();

toolbar.tools[toolbar.tools.length - 1].enable();

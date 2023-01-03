/**
 * Toolbar
 */

const toolbar = {
	_locked: false,
	_toolbar: document.getElementById("ui-toolbar"),
	_toolbar_lock_indicator: document.getElementById("toolbar-lock-indicator"),

	tools: [],
	_current_tool: null,
	get currentTool() {
		return this._current_tool;
	},

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
			/**
			 * If the tool has a redraw() function in its state, then run it
			 */
			redraw: () => {
				tool.state.redraw && tool.state.redraw();
			},
			enable: (opt = null) => {
				if (toolbar._locked) return;

				this.tools.filter((t) => t.enabled).forEach((t) => t.disable());

				while (contextMenuEl.lastChild) {
					contextMenuEl.removeChild(contextMenuEl.lastChild);
				}
				options.populateContextMenu(contextMenuEl, tool.state);

				tool._element && tool._element.classList.add("using");
				tool.enabled = true;

				this._current_tool = tool;
				enable(tool.state, opt);
			},
			disable: (opt = null) => {
				tool._element && tool._element.classList.remove("using");
				this._current_tool = null;
				tool.enabled = false;
				disable(tool.state, opt);
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
	checkbox: (state, dataKey, text, classes, cb = null) => {
		if (state[dataKey] === undefined) state[dataKey] = false;

		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.classList.add("oo-checkbox", "ui", "inline-icon");

		if (typeof classes === "string") classes = [classes];

		if (classes) checkbox.classList.add(...classes);
		checkbox.checked = state[dataKey];
		checkbox.onchange = () => {
			state[dataKey] = checkbox.checked;
			cb && cb();
		};

		checkbox.title = text;

		const label = document.createElement("label");
		label.appendChild(checkbox);
		label.appendChild(new Text(text));

		return {checkbox, label};
	},

	slider: (state, dataKey, text, options = {}) => {
		defaultOpt(options, {min: 0, max: 1, step: 0.1, textStep: null, cb: null});
		const slider = document.createElement("div");

		const value = createSlider(text, slider, {
			min: options.min,
			max: options.max,
			step: options.step,
			valuecb: (v) => {
				state[dataKey] = v;
				options.cb && options.cb(v);
			},
			defaultValue: state[dataKey],
			textStep: options.textStep,
		});

		return {
			slider,
			rawSlider: value,
			setValue(v) {
				value.value = v;
				return value.value;
			},
		};
	},

	selectlist: (
		state,
		dataKey,
		text,
		options = {value, text},
		defaultOptionValue,
		cb = null
	) => {
		const selectlist = document.createElement("select");
		selectlist.classList.add("bareselector");
		Object.entries(options).forEach((opt) => {
			var option = document.createElement("option");
			option.value = opt[0];
			option.text = opt[1];
			selectlist.options.add(option);
		});
		selectlist.selectedIndex = defaultOptionValue;
		selectlist.onchange = () => {
			state[dataKey] = selectlist.selectedIndex;
			cb && cb();
		};
		const label = document.createElement("label");
		label.appendChild(new Text(text));
		label.appendChild(selectlist);
		return {selectlist, label};
	},
};

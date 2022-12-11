/**
 * This is a function that makes an HTMLElement draggable.
 *
 * The element must contain at least one child element with the class
 * 'draggable', which will make it the handle for dragging the element
 *
 * @param {HTMLElement} element Element to make Draggable
 */
function makeDraggable(element) {
	let dragging = false;
	let offset = {x: 0, y: 0};

	const margin = 10;

	// Keeps the draggable element inside the window
	const fixPos = () => {
		const dbb = element.getBoundingClientRect();
		if (dbb.left < margin) element.style.left = margin + "px";
		else if (dbb.right > window.innerWidth - margin)
			element.style.left =
				dbb.left + (window.innerWidth - margin - dbb.right) + "px";

		if (dbb.top < margin) element.style.top = margin + "px";
		else if (dbb.bottom > window.innerHeight - margin)
			element.style.top =
				dbb.top + (window.innerHeight - margin - dbb.bottom) + "px";
	};

	// Detects the start of the mouse dragging event
	mouse.listen.window.btn.left.onpaintstart.on((evn) => {
		if (
			element.contains(evn.target) &&
			evn.target.classList.contains("draggable")
		) {
			const bb = element.getBoundingClientRect();
			offset.x = evn.x - bb.x;
			offset.y = evn.y - bb.y;
			dragging = true;
		}
	});

	// Runs when mouse moves
	mouse.listen.window.btn.left.onpaint.on((evn) => {
		if (dragging) {
			element.style.right = null;
			element.style.bottom = null;
			element.style.top = evn.y - offset.y + "px";
			element.style.left = evn.x - offset.x + "px";

			fixPos();
		}
	});

	// Stops dragging the element
	mouse.listen.window.btn.left.onpaintend.on((evn) => {
		dragging = false;
	});

	// Redraw after window resize
	window.addEventListener("resize", () => {
		fixPos();
	});
}

/**
 *	Creates a custom slider element from a given div element
 *
 * @param {string} name The display name of the sliders
 * @param {HTMLElement} wrapper The element to transform into a slider
 * @param {object} options Extra options
 * @param {number} options.min The minimum value of the slider
 * @param {number} options.max The maximum value of the slider
 * @param {number} options.step The step size for the slider
 * @param {number} option.defaultValue The default value of the slider
 * @param {number} [options.textStep=step] The step size for the slider text and setvalue \
 * (usually finer, and an integer divisor of step size)
 * @returns {{value: number}} A reference to the value of the slider
 */
function createSlider(name, wrapper, options = {}) {
	defaultOpt(options, {
		valuecb: null,
		min: 0,
		max: 1,
		step: 0.1,
		defaultValue: 0.7,
		textStep: null,
	});

	let value = options.defaultValue;

	// Use phantom range element for rounding
	const phantomRange = document.createElement("input");
	phantomRange.type = "range";
	phantomRange.min = options.min;
	phantomRange.max = options.max;
	phantomRange.step = options.step;

	let phantomTextRange = phantomRange;
	if (options.textStep) {
		phantomTextRange = document.createElement("input");
		phantomTextRange.type = "range";
		phantomTextRange.min = options.min;
		phantomTextRange.max = options.max;
		phantomTextRange.step = options.textStep;
	}

	// Build slider element
	const underEl = document.createElement("div");
	underEl.classList.add("under");
	const textEl = document.createElement("input");
	textEl.type = "text";
	textEl.classList.add("text");

	const overEl = document.createElement("div");
	overEl.classList.add("over");

	wrapper.classList.add("slider-wrapper");
	wrapper.appendChild(underEl);
	wrapper.appendChild(textEl);
	wrapper.appendChild(overEl);

	const bar = document.createElement("div");
	bar.classList.add("slider-bar");
	underEl.appendChild(bar);
	underEl.appendChild(document.createElement("div"));

	// Set value
	const setValue = (val) => {
		phantomTextRange.value = val;
		value = parseFloat(phantomTextRange.value);
		bar.style.width = `${
			100 * ((value - options.min) / (options.max - options.min))
		}%`;
		textEl.value = `${name}: ${value}`;
		options.valuecb && options.valuecb(value);
	};

	setValue(options.defaultValue);

	// Events
	textEl.addEventListener("blur", () => {
		overEl.style.pointerEvents = "auto";
		textEl.value = `${name}: ${value}`;
	});
	textEl.addEventListener("focus", () => {
		overEl.style.pointerEvents = "none";
		textEl.value = value;
	});

	textEl.addEventListener("change", () => {
		try {
			if (Number.isNaN(parseFloat(textEl.value))) setValue(value);
			else setValue(parseFloat(textEl.value));
		} catch (e) {}
	});

	keyboard.listen.onkeyclick.on((evn) => {
		if (evn.target === textEl && evn.code === "Enter") {
			textEl.blur();
		}
	});

	mouse.listen.window.btn.left.onclick.on((evn) => {
		if (evn.target === overEl) {
			textEl.select();
		}
	});

	mouse.listen.window.btn.left.ondrag.on((evn) => {
		if (evn.initialTarget === overEl) {
			const newv = Math.max(
				options.min,
				Math.min(
					options.max,
					((evn.evn.clientX - evn.initialTarget.getBoundingClientRect().left) /
						wrapper.offsetWidth) *
						(options.max - options.min) +
						options.min
				)
			);
			phantomRange.value = newv;
			setValue(parseFloat(phantomRange.value));
		}
	});

	return {
		set value(val) {
			setValue(val);
		},
		get value() {
			return value;
		},
	};
}

/**
 * A function to transform a div into a autocompletable select element
 *
 * @param {string} name Name of the AutoComplete Select Element
 * @param {HTMLDivElement} wrapper The div element that will wrap the input elements
 * @param {object} options Extra options
 * @param {boolean} options.multiple Whether multiple options can be selected
 * @param {{name: string, value: string}[]} options.options Options to add to the selector
 * @returns {AutoCompleteElement}
 */
function createAutoComplete(name, wrapper, options = {}) {
	defaultOpt(options, {
		multiple: false,
		options: [],
	});

	wrapper.classList.add("autocomplete");

	const inputEl = document.createElement("input");
	inputEl.type = "text";
	inputEl.classList.add("autocomplete-text");

	const autocompleteEl = document.createElement("div");
	autocompleteEl.classList.add("autocomplete-list", "display-none");

	let timeout = null;
	let ontext = false;
	let onlist = false;

	wrapper.appendChild(inputEl);
	wrapper.appendChild(autocompleteEl);

	const acobj = {
		name,
		wrapper,
		_selectedOptions: new Set(),
		_options: [],

		/** @type {Observer<{name:string, value: string}>} */
		onchange: new Observer(),

		get value() {
			const v = this._selectedOptions.map((opt) => opt.value);
			return options.multiple ? v : v[0];
		},
		set value(values) {
			this._selectedOptions.clear();

			for (const val of options.multiple ? values : [values]) {
				const opt = this.options.find((option) => option.value === val);

				if (!opt) continue; // Ignore invalid options

				this._selectedOptions.add(opt);
			}

			this._sync();
		},

		_sync() {
			const val = Array.from(this._selectedOptions).map((opt) => opt.value);
			const name = Array.from(this._selectedOptions).map((opt) => opt.name);

			for (const opt of this._options) {
				if (acobj._selectedOptions.has(opt))
					opt.optionElement.classList.add("selected");
				else opt.optionElement.classList.remove("selected");
			}

			updateInputField();

			this.onchange.emit({
				name: options.multiple ? name : name[0],
				value: options.multiple ? val : val[0],
			});
		},

		get options() {
			return this._options;
		},
		set options(val) {
			this._options = [];

			while (autocompleteEl.lastChild) {
				autocompleteEl.removeChild(autocompleteEl.lastChild);
			}

			// Add options
			val.forEach((opt) => {
				const {name, value, title} = opt;

				const optionEl = document.createElement("option");
				optionEl.classList.add("autocomplete-option");
				optionEl.title = title || name;

				const option = {name, value, optionElement: optionEl};

				this._options.push(option);

				optionEl.addEventListener("click", () => select(option));

				autocompleteEl.appendChild(optionEl);
			});

			updateOptions();
		},
	};

	function updateInputField() {
		inputEl.value = Array.from(acobj._selectedOptions)
			.map((o) => o.name)
			.join(", ");
		inputEl.title = Array.from(acobj._selectedOptions)
			.map((o) => o.name)
			.join(", ");
	}

	function updateOptions() {
		const text = inputEl.value.toLowerCase().trim();

		acobj._options.forEach((opt) => {
			const textLocation = opt.name.toLowerCase().indexOf(text);

			while (opt.optionElement.lastChild) {
				opt.optionElement.removeChild(opt.optionElement.lastChild);
			}

			opt.optionElement.append(
				document.createTextNode(opt.name.substring(0, textLocation))
			);
			const span = document.createElement("span");
			span.style.fontWeight = "bold";
			span.textContent = opt.name.substring(
				textLocation,
				textLocation + text.length
			);
			opt.optionElement.appendChild(span);
			opt.optionElement.appendChild(
				document.createTextNode(
					opt.name.substring(textLocation + text.length, opt.name.length)
				)
			);

			if (textLocation !== -1) {
				opt.optionElement.classList.remove("display-none");
			} else opt.optionElement.classList.add("display-none");
		});
	}

	function select(opt) {
		ontext = false;
		if (!options.multiple) {
			onlist = false;
			acobj._selectedOptions.clear();
			autocompleteEl.classList.add("display-none");
			for (const child of autocompleteEl.children) {
				child.classList.remove("selected");
			}
		}

		if (options.multiple && acobj._selectedOptions.has(opt)) {
			acobj._selectedOptions.delete(opt);
			opt.optionElement.classList.remove("selected");
		} else {
			acobj._selectedOptions.add(opt);
			opt.optionElement.classList.add("selected");
		}

		acobj._sync();
	}

	inputEl.addEventListener("focus", () => {
		ontext = true;

		autocompleteEl.classList.remove("display-none");
		inputEl.select();
	});
	inputEl.addEventListener("blur", () => {
		ontext = false;

		if (!onlist && !ontext) {
			updateInputField();

			autocompleteEl.classList.add("display-none");
		}
	});

	autocompleteEl.addEventListener("mouseenter", () => {
		onlist = true;
	});

	autocompleteEl.addEventListener("mouseleave", () => {
		onlist = false;

		if (!onlist && !ontext) {
			updateInputField();

			autocompleteEl.classList.add("display-none");
		}
	});

	// Filter
	inputEl.addEventListener("input", () => {
		updateOptions();
	});

	acobj.options = options.options;

	return acobj;
}

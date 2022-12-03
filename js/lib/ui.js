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
			phantomRange.value = Math.max(
				options.min,
				Math.min(
					options.max,
					(evn.evn.layerX / wrapper.offsetWidth) * (options.max - options.min) +
						options.min
				)
			);
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

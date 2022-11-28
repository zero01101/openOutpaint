function makeDraggable(element) {
	const startbb = element.getBoundingClientRect();
	let dragging = false;
	let offset = {x: 0, y: 0};

	element.style.top = startbb.y + "px";
	element.style.left = startbb.x + "px";

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

	mouse.listen.window.btn.left.onpaint.on((evn) => {
		if (dragging) {
			element.style.top = evn.y - offset.y + "px";
			element.style.left = evn.x - offset.x + "px";
		}
	});

	mouse.listen.window.btn.left.onpaintend.on((evn) => {
		dragging = false;
	});
}

document.querySelectorAll(".floating-window").forEach((w) => {
	makeDraggable(w);
});

var coll = document.getElementsByClassName("collapsible");
for (var i = 0; i < coll.length; i++) {
	let active = false;
	coll[i].addEventListener("click", function () {
		var content = this.nextElementSibling;

		if (!active) {
			this.classList.add("active");
			content.classList.add("active");
		} else {
			this.classList.remove("active");
			content.classList.remove("active");
		}

		const observer = new ResizeObserver(() => {
			if (active) content.style.maxHeight = content.scrollHeight + "px";
		});

		Array.from(content.children).forEach((child) => {
			observer.observe(child);
		});

		if (active) {
			content.style.maxHeight = null;
			active = false;
		} else {
			content.style.maxHeight = content.scrollHeight + "px";
			active = true;
		}
	});
}

/**
 * Slider Inputs
 */
function createSlider(name, wrapper, options = {}) {
	defaultOpt(options, {
		valuecb: null,
		min: 0,
		max: 1,
		step: 0.1,
		defaultValue: 0.7,
	});

	let value = options.defaultValue;

	// Use phantom range element for rounding
	const phantomRange = document.createElement("input");
	phantomRange.type = "range";
	phantomRange.min = options.min;
	phantomRange.max = options.max;
	phantomRange.step = options.step;

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
		phantomRange.value = val;
		value = parseFloat(phantomRange.value);
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
		if (evn.target === overEl) {
			setValue(
				Math.max(
					options.min,
					Math.min(
						options.max,
						(evn.evn.layerX / wrapper.offsetWidth) *
							(options.max - options.min) +
							options.min
					)
				)
			);
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

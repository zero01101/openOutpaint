// Layering
const imageCollection = layers.registerCollection(
	"image",
	{
		w: parseInt(
			(localStorage &&
				localStorage.getItem("openoutpaint/settings.canvas-width")) ||
				2048
		),
		h: parseInt(
			(localStorage &&
				localStorage.getItem("openoutpaint/settings.canvas-height")) ||
				2048
		),
	},
	{
		name: "Image Layers",
	}
);

const bgLayer = imageCollection.registerLayer("bg", {
	name: "Background",
	category: "background",
});
const imgLayer = imageCollection.registerLayer("image", {
	name: "Image",
	category: "image",
	ctxOptions: {desynchronized: true},
});
const maskPaintLayer = imageCollection.registerLayer("mask", {
	name: "Mask Paint",
	category: "mask",
	ctxOptions: {desynchronized: true},
});
const ovLayer = imageCollection.registerLayer("overlay", {
	name: "Overlay",
	category: "display",
});
const debugLayer = imageCollection.registerLayer("debug", {
	name: "Debug Layer",
	category: "display",
});

const imgCanvas = imgLayer.canvas; // where dreams go
const imgCtx = imgLayer.ctx;

const maskPaintCanvas = maskPaintLayer.canvas; // where mouse cursor renders
const maskPaintCtx = maskPaintLayer.ctx;

maskPaintCanvas.classList.add("mask-canvas");

const ovCanvas = ovLayer.canvas; // where mouse cursor renders
const ovCtx = ovLayer.ctx;

const debugCanvas = debugLayer.canvas; // where mouse cursor renders
const debugCtx = debugLayer.ctx;

/* WIP: Most cursors shouldn't need a zoomable canvas */
/** @type {HTMLCanvasElement} */
const uiCanvas = document.getElementById("layer-overlay"); // where mouse cursor renders
uiCanvas.width = uiCanvas.clientWidth;
uiCanvas.height = uiCanvas.clientHeight;
const uiCtx = uiCanvas.getContext("2d", {desynchronized: true});

/**
 * Here we setup canvas dynamic scaling
 */
(() => {
	let expandSize = localStorage.getItem("openoutpaint/expand-size") || 1024;
	expandSize = parseInt(expandSize, 10);

	const askSize = () => {
		const by = prompt("How much do you want to expand by?", expandSize);

		if (!by) return null;
		else {
			const len = parseInt(by, 10);
			localStorage.setItem("openoutpaint/expand-size", len);
			expandSize = len;
			return len;
		}
	};

	const leftButton = makeElement("button", -64, 0);
	leftButton.classList.add("expand-button", "left");
	leftButton.style.width = "64px";
	leftButton.style.height = `${imageCollection.size.h}px`;
	leftButton.addEventListener("click", () => {
		let size = null;
		if ((size = askSize())) {
			imageCollection.expand(size, 0, 0, 0);
			drawBackground();
			const newLeft = -imageCollection.inputOffset.x - imageCollection.origin.x;
			leftButton.style.left = newLeft - 64 + "px";
			topButton.style.left = newLeft + "px";
			bottomButton.style.left = newLeft + "px";
			topButton.style.width = imageCollection.size.w + "px";
			bottomButton.style.width = imageCollection.size.w + "px";
		}
	});

	const rightButton = makeElement("button", imageCollection.size.w, 0);
	rightButton.classList.add("expand-button", "right");
	rightButton.style.width = "64px";
	rightButton.style.height = `${imageCollection.size.h}px`;
	rightButton.addEventListener("click", () => {
		let size = null;
		if ((size = askSize())) {
			imageCollection.expand(0, 0, size, 0);
			drawBackground();
			rightButton.style.left =
				parseInt(rightButton.style.left, 10) + size + "px";
			topButton.style.width = imageCollection.size.w + "px";
			bottomButton.style.width = imageCollection.size.w + "px";
		}
	});

	const topButton = makeElement("button", 0, -64);
	topButton.classList.add("expand-button", "top");
	topButton.style.height = "64px";
	topButton.style.width = `${imageCollection.size.w}px`;
	topButton.addEventListener("click", () => {
		let size = null;
		if ((size = askSize())) {
			imageCollection.expand(0, size, 0, 0);
			drawBackground();
			const newTop = -imageCollection.inputOffset.y - imageCollection.origin.y;
			topButton.style.top = newTop - 64 + "px";
			leftButton.style.top = newTop + "px";
			rightButton.style.top = newTop + "px";
			leftButton.style.height = imageCollection.size.h + "px";
			rightButton.style.height = imageCollection.size.h + "px";
		}
	});

	const bottomButton = makeElement("button", 0, imageCollection.size.h);
	bottomButton.classList.add("expand-button", "bottom");
	bottomButton.style.height = "64px";
	bottomButton.style.width = `${imageCollection.size.w}px`;
	bottomButton.addEventListener("click", () => {
		let size = null;
		if ((size = askSize())) {
			imageCollection.expand(0, 0, 0, size);
			drawBackground();
			bottomButton.style.top =
				parseInt(bottomButton.style.top, 10) + size + "px";
			leftButton.style.height = imageCollection.size.h + "px";
			rightButton.style.height = imageCollection.size.h + "px";
		}
	});
})();

debugLayer.hide(); // Hidden by default

// Where CSS and javascript magic happens to make the canvas viewport work
/**
 * The global viewport object (may be modularized in the future). All
 * coordinates given are of the center of the viewport
 *
 * cx and cy are the viewport's world coordinates, scaled to zoom level.
 * _x and _y are actual coordinates in the DOM space
 *
 * The transform() function does some transforms and writes them to the
 * provided element.
 */
const viewport = {
	get cx() {
		return this._x * this.zoom;
	},

	set cx(v) {
		return (this._x = v / this.zoom);
	},
	_x: 0,
	get cy() {
		return this._y * this.zoom;
	},
	set cy(v) {
		return (this._y = v / this.zoom);
	},
	_y: 0,
	zoom: 1,
	rotation: 0,
	get w() {
		return (window.innerWidth * 1) / this.zoom;
	},
	get h() {
		return (window.innerHeight * 1) / this.zoom;
	},
	viewToCanvas(x, y) {
		return {
			x: this.cx + this.w * (x / window.innerWidth - 0.5),
			y: this.cy + this.h * (y / window.innerHeight - 0.5),
		};
	},
	canvasToView(x, y) {
		return {
			x: window.innerWidth * ((x - this.cx) / this.w) + window.innerWidth / 2,
			y: window.innerHeight * ((y - this.cy) / this.h) + window.innerHeight / 2,
		};
	},
	/**
	 * Apply transformation
	 *
	 * @param {HTMLElement} el Element to apply CSS transform to
	 */
	transform(el) {
		el.style.transformOrigin = `${this.cx}px ${this.cy}px`;
		el.style.transform = `scale(${this.zoom}) translate(${-(
			this._x -
			this.w / 2
		)}px, ${-(this._y - this.h / 2)}px)`;
	},
};

viewport.cx = imageCollection.size.w / 2;
viewport.cy = imageCollection.size.h / 2;

let worldInit = null;

viewport.transform(imageCollection.element);

/**
 * Ended up using a CSS transforms approach due to more flexibility on transformations
 * and capability to automagically translate input coordinates to layer space.
 */
mouse.registerContext(
	"world",
	(evn, ctx) => {
		// Fix because in chrome layerX and layerY simply doesnt work
		ctx.coords.prev.x = ctx.coords.pos.x;
		ctx.coords.prev.y = ctx.coords.pos.y;

		// Get cursor position
		const x = evn.clientX;
		const y = evn.clientY;

		// Map to layer space
		const layerCoords = viewport.viewToCanvas(x, y);

		// Set coords
		ctx.coords.pos.x = Math.round(layerCoords.x);
		ctx.coords.pos.y = Math.round(layerCoords.y);
	},
	{
		target: imageCollection.inputElement,
		validate: (evn) => {
			if (!global.hasActiveInput || evn.type === "mousemove") return true;
			return false;
		},
	}
);

// Redraw on active input state change
(() => {
	mouse.listen.window.onany.on((evn) => {
		const activeInput = DOM.hasActiveInput();
		if (global.hasActiveInput !== activeInput) {
			global.hasActiveInput = activeInput;
			toolbar.currentTool &&
				toolbar.currentTool.state.redraw &&
				toolbar.currentTool.state.redraw();
		}
	});
})();

mouse.listen.window.onwheel.on((evn) => {
	if (evn.evn.ctrlKey) {
		evn.evn.preventDefault();

		const pcx = viewport.cx;
		const pcy = viewport.cy;
		if (evn.delta < 0) {
			viewport.zoom *= 1 + Math.abs(evn.delta * 0.0002);
		} else {
			viewport.zoom *= 1 - Math.abs(evn.delta * 0.0002);
		}

		viewport.cx = pcx;
		viewport.cy = pcy;

		viewport.transform(imageCollection.element);

		toolbar.currentTool.redraw();
	}
});

mouse.listen.window.btn.middle.onpaintstart.on((evn) => {
	if (evn.evn.ctrlKey) worldInit = {x: viewport.cx, y: viewport.cy};
});

mouse.listen.window.btn.middle.onpaint.on((evn) => {
	if (worldInit) {
		viewport.cx = worldInit.x + (evn.ix - evn.x) / viewport.zoom;
		viewport.cy = worldInit.y + (evn.iy - evn.y) / viewport.zoom;

		// Limits
		viewport.cx = Math.max(
			Math.min(viewport.cx, imageCollection.size.w - imageCollection.origin.x),
			-imageCollection.origin.x
		);
		viewport.cy = Math.max(
			Math.min(viewport.cy, imageCollection.size.h - imageCollection.origin.y),
			-imageCollection.origin.y
		);

		// Draw Viewport location
	}

	viewport.transform(imageCollection.element);
	if (global.debug) {
		debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
		debugCtx.fillStyle = "#F0F";
		debugCtx.beginPath();
		debugCtx.arc(viewport.cx, viewport.cy, 5, 0, Math.PI * 2);
		debugCtx.fill();
	}
});

mouse.listen.window.btn.middle.onpaintend.on((evn) => {
	worldInit = null;
});

window.addEventListener("resize", () => {
	viewport.transform(imageCollection.element);
	uiCanvas.width = uiCanvas.clientWidth;
	uiCanvas.height = uiCanvas.clientHeight;
});

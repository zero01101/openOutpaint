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

bgLayer.canvas.classList.add("pixelated");

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

	const askSize = (e) => {
		if (e.ctrlKey ) return expandSize;
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
	leftButton.addEventListener("click", (e) => {
		let size = null;
		if ((size = askSize(e))) {
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
	rightButton.addEventListener("click", (e) => {
		let size = null;
		if ((size = askSize(e))) {
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
	topButton.addEventListener("click", (e) => {
		let size = null;
		if ((size = askSize(e))) {
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
	bottomButton.addEventListener("click", (e) => {
		let size = null;
		if ((size = askSize(e))) {
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
 * cx and cy are the viewport's world coordinates.
 *
 * The transform() function does some transforms and writes them to the
 * provided element.
 */
class Viewport {
	cx = 0;
	cy = 0;

	zoom = 1;

	/**
	 * Gets viewport width in canvas coordinates
	 */
	get w() {
		return window.innerWidth * this.zoom;
	}

	/**
	 * Gets viewport height in canvas coordinates
	 */
	get h() {
		return window.innerHeight * this.zoom;
	}

	constructor(x, y) {
		this.x = x;
		this.y = y;
	}

	get v2c() {
		const m = new DOMMatrix();

		m.translateSelf(-this.w / 2, -this.h / 2);
		m.translateSelf(this.cx, this.cy);
		m.scaleSelf(this.zoom);

		return m;
	}

	get c2v() {
		return this.v2c.invertSelf();
	}

	viewToCanvas(x, y) {
		if (x.x !== undefined) return this.v2c.transformPoint(x);
		return this.v2c.transformPoint({x, y});
	}

	canvasToView(x, y) {
		if (x.x !== undefined) return this.c2v.transformPoint(x);
		return this.c2v.transformPoint({x, y});
	}

	/**
	 * Apply transformation
	 *
	 * @param {HTMLElement} el Element to apply CSS transform to
	 */
	transform(el) {
		el.style.transformOrigin = "0px 0px";
		el.style.transform = this.c2v;
	}
}

const viewport = new Viewport(0, 0);

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
			if ((!global.hasActiveInput && !evn.ctrlKey) || evn.type === "mousemove")
				return true;
			return false;
		},
	}
);

mouse.registerContext(
	"camera",
	(evn, ctx) => {
		ctx.coords.prev.x = ctx.coords.pos.x;
		ctx.coords.prev.y = ctx.coords.pos.y;

		// Set coords
		ctx.coords.pos.x = evn.x;
		ctx.coords.pos.y = evn.y;
	},
	{
		validate: (evn) => {
			return !!evn.ctrlKey;
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

mouse.listen.camera.onwheel.on((evn) => {
	evn.evn.preventDefault();

	// Get cursor world position
	const cursorPosition = viewport.viewToCanvas(evn.x, evn.y);

	// Get viewport center
	const pcx = viewport.cx;
	const pcy = viewport.cy;

	// Apply zoom
	viewport.zoom *= 1 + evn.delta * 0.0002;

	// Apply normal zoom (center of viewport)
	viewport.cx = pcx;
	viewport.cy = pcy;

	viewport.transform(imageCollection.element);

	// Calculate new viewport center and move
	//const newCursorPosition = viewport.viewToCanvas(evn.x, evn.y);
	//viewport.cx = pcx - (newCursorPosition.x - cursorPosition.x);
	//viewport.cy = pcy - (newCursorPosition.y - cursorPosition.y);

	//viewport.transform(imageCollection.element);

	toolbar._current_tool.redrawui && toolbar._current_tool.redrawui();
});

const cameraPaintStart = (evn) => {
	worldInit = {x: viewport.cx, y: viewport.cy};
};

const cameraPaint = (evn) => {
	if (worldInit) {
		viewport.cx = worldInit.x + (evn.ix - evn.x) * viewport.zoom;
		viewport.cy = worldInit.y + (evn.iy - evn.y) * viewport.zoom;

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
	toolbar._current_tool.state.redrawui &&
		toolbar._current_tool.state.redrawui();

	if (global.debug) {
		debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
		debugCtx.fillStyle = "#F0F";
		debugCtx.beginPath();
		debugCtx.arc(viewport.cx, viewport.cy, 5, 0, Math.PI * 2);
		debugCtx.fill();
	}
};

const cameraPaintEnd = (evn) => {
	worldInit = null;
};

mouse.listen.camera.btn.middle.onpaintstart.on(cameraPaintStart);
mouse.listen.camera.btn.left.onpaintstart.on(cameraPaintStart);

mouse.listen.camera.btn.middle.onpaint.on(cameraPaint);
mouse.listen.camera.btn.left.onpaint.on(cameraPaint);

mouse.listen.window.btn.middle.onpaintend.on(cameraPaintEnd);
mouse.listen.window.btn.left.onpaintend.on(cameraPaintEnd);

window.addEventListener("resize", () => {
	viewport.transform(imageCollection.element);
	uiCanvas.width = uiCanvas.clientWidth;
	uiCanvas.height = uiCanvas.clientHeight;
});

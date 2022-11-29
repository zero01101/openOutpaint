// Layering
const imageCollection = layers.registerCollection(
	"image",
	{w: 2560, h: 1472},
	{
		name: "Image Layers",
	}
);

const bgLayer = imageCollection.registerLayer("bg", {
	name: "Background",
});
const imgLayer = imageCollection.registerLayer("image", {
	name: "Image",
});
const maskPaintLayer = imageCollection.registerLayer("mask", {
	name: "Mask Paint",
});
const ovLayer = imageCollection.registerLayer("overlay", {
	name: "Overlay",
});
const debugLayer = imageCollection.registerLayer("debug", {
	name: "Debug Layer",
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

debugLayer.hide(); // Hidden by default

layers.registerCollection("mask", {name: "Mask Layers", requiresActive: true});

// Where CSS and javascript magic happens to make the canvas viewport work
/**
 * Ended up using a CSS transforms approach due to more flexibility on transformations
 * and capability to automagically translate input coordinates to layer space.
 */
mouse.registerContext(
	"world",
	(evn, ctx) => {
		ctx.coords.prev.x = ctx.coords.pos.x;
		ctx.coords.prev.y = ctx.coords.pos.y;
		ctx.coords.pos.x = evn.layerX;
		ctx.coords.pos.y = evn.layerY;
	},
	{target: imageCollection.inputElement}
);

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

let rotation = 0;
let lastTime = performance.now();

const onframe = () => {
	const nowTime = performance.now();
	const dt = nowTime - lastTime;
	rotation += (10 * dt) / 1000.0;

	lastTime = nowTime;

	viewport.transform(imageCollection.element);

	requestAnimationFrame(onframe);
};

onframe();

viewport.cx = viewport.w / 2;
viewport.cy = viewport.h / 2;

let worldInit = null;

imageCollection.element.style.transformOrigin = `${viewport.cx}px ${viewport.cy}px`;
viewport.transform(imageCollection.element);

mouse.listen.window.onwheel.on((evn) => {
	if (evn.evn.ctrlKey) {
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

		debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
		debugCtx.fillStyle = "#F0F";
		debugCtx.beginPath();
		debugCtx.arc(viewport.cx, viewport.cy, 5, 0, Math.PI * 2);
		debugCtx.fill();
	}
});

mouse.listen.window.btn.middle.onpaintstart.on((evn) => {
	worldInit = {x: viewport.cx, y: viewport.cy};
});

mouse.listen.window.btn.middle.onpaint.on((evn) => {
	if (worldInit) {
		viewport.cx = worldInit.x + (evn.ix - evn.x) / viewport.zoom;
		viewport.cy = worldInit.y + (evn.iy - evn.y) / viewport.zoom;

		// Limits
		viewport.cx = Math.max(Math.min(viewport.cx, imageCollection.size.w), 0);
		viewport.cy = Math.max(Math.min(viewport.cy, imageCollection.size.h), 0);

		// Draw Viewport location
	}

	viewport.transform(imageCollection.element);
	debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
	debugCtx.fillStyle = "#F0F";
	debugCtx.beginPath();
	debugCtx.arc(viewport.cx, viewport.cy, 5, 0, Math.PI * 2);
	debugCtx.fill();
});

mouse.listen.window.btn.middle.onpaintend.on((evn) => {
	worldInit = null;
});

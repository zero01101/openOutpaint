/**
 * Some type definitions before the actual code
 */

/**
 * Simple Point Coordinate
 *
 * @typedef Point
 * @property {number} x - x coordinate
 * @property {number} y - y coordinate
 */

/**
 * Represents a size
 */
class Size {
	w = 0;
	h = 0;

	constructor({w, h} = {w: 0, h: 0}) {
		this.w = w;
		this.h = h;
	}
}

/**
 * Represents a simple bouding box
 */
class BoundingBox {
	x = 0;
	y = 0;
	w = 0;
	h = 0;

	/** @type {Point} */
	get tl() {
		return {x: this.x, y: this.y};
	}

	/** @type {Point} */
	get tr() {
		return {x: this.x + this.w, y: this.y};
	}

	/** @type {Point} */
	get bl() {
		return {x: this.x, y: this.y + this.h};
	}

	/** @type {Point} */
	get br() {
		return {x: this.x + this.w, y: this.y + this.h};
	}

	/** @type {Point} */
	get center() {
		return {x: this.x + this.w / 2, y: this.y + this.h / 2};
	}

	constructor({x, y, w, h} = {x: 0, y: 0, w: 0, h: 0}) {
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;
	}

	contains(x, y) {
		return (
			this.x < x && this.y < y && x < this.x + this.w && y < this.y + this.h
		);
	}

	/**
	 *	Gets bounding box from two points
	 *
	 * @param {Point} start Coordinate
	 * @param {Point} end
	 */
	static fromStartEnd(start, end) {
		const minx = Math.min(start.x, end.x);
		const miny = Math.min(start.y, end.y);
		const maxx = Math.max(start.x, end.x);
		const maxy = Math.max(start.y, end.y);

		return new BoundingBox({
			x: minx,
			y: miny,
			w: maxx - minx,
			h: maxy - miny,
		});
	}

	/**
	 * Returns a transformed bounding box (using top-left, bottom-right points)
	 *
	 * @param {DOMMatrix} transform Transformation matrix to transform points
	 */
	transform(transform) {
		return BoundingBox.fromStartEnd(
			transform.transformPoint({x: this.x, y: this.y}),
			transform.transformPoint({x: this.x + this.w, y: this.y + this.h})
		);
	}
}

/**
 * A simple implementation of the Observer programming pattern
 * @template [T=any] Message type
 */
class Observer {
	/**
	 * List of handlers
	 * @type {Array<{handler: (msg: T) => void | Promise<void>, priority: number}>}
	 */
	_handlers = [];

	/**
	 * Adds a observer to the events
	 *
	 * @param {(msg: T, state?: any) => void | Promise<void>} callback The function to run when receiving a message
	 * @param {number} priority The priority level of the observer
	 * @param {boolean} wait If the handler must be waited for before continuing
	 * @returns {(msg:T, state?: any) => void | Promise<void>} The callback we received
	 */
	on(callback, priority = 0, wait = false) {
		this._handlers.push({handler: callback, priority, wait});
		this._handlers.sort((a, b) => b.priority - a.priority);
		return callback;
	}
	/**
	 *	Removes a observer
	 *
	 * @param {(msg: T, state?: any) => void | Promise<void>} callback The function used to register the callback
	 * @returns {boolean} Whether the handler existed
	 */
	clear(callback) {
		const index = this._handlers.findIndex((v) => v.handler === callback);
		if (index === -1) return false;
		this._handlers.splice(index, 1);
		return true;
	}
	/**
	 * Sends a message to all observers
	 *
	 * @param {T} msg The message to send to the observers
	 * @param {any} state The initial state
	 */
	async emit(msg, state = {}) {
		const promises = [];
		for (const {handler, wait} of this._handlers) {
			const run = async () => {
				try {
					await handler(msg, state);
				} catch (e) {
					console.warn("Observer failed to run handler");
					console.warn(e);
				}
			};

			if (wait) await run();
			else promises.push(run());
		}

		return Promise.all(promises);
	}
}

/**
 * Static DOM utility functions
 */
class DOM {
	static inputTags = new Set(["input", "textarea"]);

	/**
	 * Checks if there is an active input
	 *
	 * @returns Whether there is currently an active input
	 */
	static hasActiveInput() {
		const active = document.activeElement;
		const tag = active.tagName.toLowerCase();

		const checkTag = this.inputTags.has(tag);
		if (!checkTag) return false;

		return tag !== "input" || active.type === "text";
	}
}

/**
 * Generates a simple UID in the format xxxx-xxxx-...-xxxx, with x being [0-9a-f]
 *
 * @param {number} [size] Number of quartets of characters to generate
 * @returns {string} The new UID
 */
const guid = (size = 3) => {
	const s4 = () => {
		return Math.floor((1 + Math.random()) * 0x10000)
			.toString(16)
			.substring(1);
	};
	// returns id of format 'aaaa'-'aaaa'-'aaaa' by default
	let id = "";
	for (var i = 0; i < size - 1; i++) id += s4() + "-";
	id += s4();
	return id;
};

/**
 * Returns a hash code from a string
 *
 * From https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
 *
 * @param  {String} str The string to hash
 * @return {Number} A 32bit integer
 */
const hashCode = (str, seed = 0) => {
	let h1 = 0xdeadbeef ^ seed,
		h2 = 0x41c6ce57 ^ seed;
	for (let i = 0, ch; i < str.length; i++) {
		ch = str.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}

	h1 =
		Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
		Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 =
		Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
		Math.imul(h1 ^ (h1 >>> 13), 3266489909);

	return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

/**
 *	Assigns defaults to an option object passed to the function.
 *
 * @template T Object Type
 *
 * @param {T} options Original options object
 * @param {T} defaults Default values to assign
 */
function defaultOpt(options, defaults) {
	Object.keys(defaults).forEach((key) => {
		if (options[key] === undefined) options[key] = defaults[key];
	});
}

/** Custom error for attempt to set read-only objects */
class ProxyReadOnlySetError extends Error {}
/**
 * Makes a given object read-only; throws a ProxyReadOnlySetError exception if modification is attempted
 *
 * @template T Object Type
 *
 * @param {T} obj Object to be proxied
 * @param {string} name Name for logging purposes
 * @param {string[]} exceptions Parameters excepted from this restriction
 * @returns {T} Proxied object, intercepting write attempts
 */
function makeReadOnly(obj, name = "read-only object", exceptions = []) {
	return new Proxy(obj, {
		set: (obj, prop, value) => {
			if (!exceptions.some((v) => v === prop))
				throw new ProxyReadOnlySetError(
					`Tried setting the '${prop}' property on '${name}'`
				);
			obj[prop] = value;
		},
	});
}

/** Custom error for attempt to set write-once objects a second time */
class ProxyWriteOnceSetError extends Error {}
/**
 * Makes a given object write-once; Attempts to overwrite an existing prop in the object will throw a ProxyWriteOnceSetError exception
 *
 * @template T Object Type
 * @param {T} obj Object to be proxied
 * @param {string} [name] Name for logging purposes
 * @param {string[]} [exceptions] Parameters excepted from this restriction
 * @returns {T} Proxied object, intercepting write attempts
 */
function makeWriteOnce(obj, name = "write-once object", exceptions = []) {
	return new Proxy(obj, {
		set: (obj, prop, value) => {
			if (obj[prop] !== undefined && !exceptions.some((v) => v === prop))
				throw new ProxyWriteOnceSetError(
					`Tried setting the '${prop}' property on '${name}' after it was already set`
				);
			obj[prop] = value;
		},
	});
}

/**
 * Snaps a single value to an infinite grid
 *
 * @param {number} i Original value to be snapped
 * @param {number} [offset=0] Value to offset the grid. Should be in the rande [0, gridSize[
 * @param {number} [gridSize=64] Size of the grid
 * @returns	an offset, in which [i + offset = (a location snapped to the grid)]
 */
function snap(i, offset = 0, gridSize = config.gridSize) {
	let diff = i - offset;
	if (diff < 0) {
		diff += gridSize * Math.ceil(Math.abs(diff / gridSize));
	}

	const modulus = diff % gridSize;
	var snapOffset = modulus;

	if (modulus > gridSize / 2) snapOffset = modulus - gridSize;

	if (snapOffset == 0) {
		return snapOffset;
	}
	return -snapOffset;
}

/**
 * Gets a bounding box centered on a given set of coordinates. Supports grid snapping
 *
 * @param {number} cx - x-coordinate of the center of the box
 * @param {number} cy - y-coordinate of the center of the box
 * @param {number} w - the width of the box
 * @param {height} h - the height of the box
 * @param {?number} gridSnap - The size of the grid to snap to
 * @param {number} [offset=0] - How much to offset the grid by
 * @returns {BoundingBox} - A bounding box object centered at (cx, cy)
 */
function getBoundingBox(cx, cy, w, h, gridSnap = null, offset = 0) {
	const offs = {x: 0, y: 0};
	const box = {x: 0, y: 0};

	if (gridSnap) {
		offs.x = snap(cx, offset, gridSnap);
		offs.y = snap(cy, offset, gridSnap);
	}

	box.x = Math.round(offs.x + cx);
	box.y = Math.round(offs.y + cy);

	return new BoundingBox({
		x: Math.floor(box.x - w / 2),
		y: Math.floor(box.y - h / 2),
		w: Math.round(w),
		h: Math.round(h),
	});
}

class NoContentError extends Error {}

/**
 * Crops a given canvas to content, returning a new canvas object with the content in it.
 *
 * @param {HTMLCanvasElement} sourceCanvas Canvas to get a content crop from
 * @param {object} options Extra options
 * @param {number} [options.border=0] Extra border around the content
 * @returns {{canvas: HTMLCanvasElement, bb: BoundingBox}} A new canvas with the cropped part of the image
 */
function cropCanvas(sourceCanvas, options = {}) {
	defaultOpt(options, {border: 0});
	var bb = findContentBorders(sourceCanvas, options);
	var cutCanvas = document.createElement("canvas");
	cutCanvas.width = bb.w;
	cutCanvas.height = bb.h;
	cutCanvas
		.getContext("2d")
		.drawImage(sourceCanvas, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h);
	return {canvas: cutCanvas, bb};
}

function findContentBorders(sourceCanvas, options = {}, maxvals = false) {
	defaultOpt(options, {border: 0});

	const w = sourceCanvas.width;
	const h = sourceCanvas.height;
	const srcCtx = sourceCanvas.getContext("2d");
	const offset = {
		x: (srcCtx.origin && -srcCtx.origin.x) || 0,
		y: (srcCtx.origin && -srcCtx.origin.y) || 0,
	};
	var imageData = srcCtx.getImageDataRoot(0, 0, w, h);
	/** @type {BoundingBox} */
	const bb = new BoundingBox();

	let minx = Infinity;
	let maxx = -Infinity;
	let miny = Infinity;
	let maxy = -Infinity;

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			// lol i need to learn what this part does
			const index = (y * w + x) * 4; // OHHH OK this is setting the imagedata.data uint8clampeddataarray index for the specified x/y coords
			//this part i get, this is checking that 4th RGBA byte for opacity
			if (imageData.data[index + 3] > 0) {
				minx = Math.min(minx, x + offset.x);
				maxx = Math.max(maxx, x + offset.x);
				miny = Math.min(miny, y + offset.y);
				maxy = Math.max(maxy, y + offset.y);
			}
		}
	}

	// THIS IS WHAT I NEED TO USE TO FIND THE FUCKING BORDERS FOR MOSAICING
	bb.x = minx - options.border;
	bb.y = miny - options.border;
	bb.w = maxx - minx + 1 + 2 * options.border;
	bb.h = maxy - miny + 1 + 2 * options.border;

	if (!Number.isFinite(maxx)) throw new NoContentError("Canvas has no content");
	if (maxvals) {
		let outputs = {};
		outputs.minx = minx;
		outputs.miny = miny;
		outputs.maxx = maxx; // keep in mind maxes are 0-indexed and are the last pixel, not the transparency/mask
		outputs.maxy = maxy;
		outputs.bb = bb;

		return outputs;
	}

	return bb;
}

/**
 * Downloads the content of a canvas to the disk, or opens it
 *
 * @param {Object} options - Optional Information
 * @param {boolean} [options.cropToContent] - If we wish to crop to content first (default: true)
 * @param {HTMLCanvasElement} [options.canvas] - The source canvas (default: visible)
 * @param {string} [options.filename] - The filename to save as (default: '[ISO date] [Hours] [Minutes] [Seconds] openOutpaint image.png').\
 * If null, opens image in new tab.
 */
function downloadCanvas(options = {}) {
	defaultOpt(options, {
		cropToContent: true,
		canvas: uil.getVisible(imageCollection.bb),
		filename:
			new Date()
				.toISOString()
				.slice(0, 19)
				.replace("T", " ")
				.replace(":", " ") + " openOutpaint image.png",
	});

	var link = document.createElement("a");
	link.target = "_blank";
	if (options.filename) link.download = options.filename;

	var croppedCanvas = options.cropToContent
		? cropCanvas(options.canvas).canvas
		: options.canvas;

	if (croppedCanvas != null) {
		croppedCanvas.toBlob((blob) => {
			link.href = URL.createObjectURL(blob);
			link.click();
		});
	}
}

/**
 * Makes an element in a location
 * @param {string} type Element Tag
 * @param {number} x X coordinate of the element
 * @param {number} y Y coordinate of the element
 * @param {{x: number y: offset}} offset Offset to apply to the element
 * @returns
 */
const makeElement = (
	type,
	x,
	y,
	offset = {
		x: -imageCollection.inputOffset.x,
		y: -imageCollection.inputOffset.y,
	}
) => {
	const el = document.createElement(type);
	el.style.position = "absolute";
	el.style.left = `${x + offset.x}px`;
	el.style.top = `${y + offset.y}px`;

	// We can use the input element to add interactible html elements in the world
	imageCollection.inputElement.appendChild(el);

	return el;
};

/**
 * Subtracts identical (or damn close) pixels from new dreams
 * @param {HTMLCanvasElement} canvas
 * @param {BoundingBox} bb
 * @param {HTMLImageElement} bgImg
 * @param {number}} blur
 * @returns {HTMLCanvasElement}
 */
const subtractBackground = (canvas, bb, bgImg, blur = 0, threshold = 10) => {
	// set up temp canvases
	const bgCanvas = document.createElement("canvas");
	const fgCanvas = document.createElement("canvas");
	const returnCanvas = document.createElement("canvas");
	bgCanvas.width = fgCanvas.width = returnCanvas.width = bb.w;
	bgCanvas.height = fgCanvas.height = returnCanvas.height = bb.h;
	const bgCtx = bgCanvas.getContext("2d");
	const fgCtx = fgCanvas.getContext("2d");
	const returnCtx = returnCanvas.getContext("2d");
	returnCtx.rect(0, 0, bb.w, bb.h);
	returnCtx.fill();
	// draw previous "background" image
	bgCtx.drawImage(bgImg, 0, 0, bb.w, bb.h);
	bgCtx.filter = "blur(" + blur + "px)";
	// ... turn that into base64
	const bgImgData = bgCtx.getImageData(0, 0, bb.w, bb.h);
	// draw new image
	fgCtx.drawImage(canvas, 0, 0);
	const fgImgData = fgCtx.getImageData(0, 0, bb.w, bb.h);
	for (var i = 0; i < bgImgData.data.length; i += 4) {
		// one of these days i'm gonna learn how to use map reduce or whatever and stop iterating in for loops :(
		// a la https://adamwathan.me/refactoring-to-collections/

		// background rgb
		var bgr = bgImgData.data[i];
		var bgg = bgImgData.data[i + 1];
		var bgb = bgImgData.data[i + 2];
		// foreground rgb
		var fgr = fgImgData.data[i];
		var fgb = fgImgData.data[i + 1];
		var fgd = fgImgData.data[i + 2];
		// delta rgb
		const dr = Math.abs(bgr - fgr) > threshold ? fgr : 0;
		const dg = Math.abs(bgg - fgb) > threshold ? fgb : 0;
		const db = Math.abs(bgb - fgd) > threshold ? fgd : 0;

		const pxChanged = dr > 0 && dg > 0 && db > 0;

		fgImgData.data[i + 3] = pxChanged ? 255 : 0;
	}
	returnCtx.putImageData(fgImgData, 0, 0);

	return returnCanvas;
};

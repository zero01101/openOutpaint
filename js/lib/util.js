/**
 * Some type definitions before the actual code
 */
/**
 * Represents a simple bounding box
 *
 * @typedef BoundingBox
 * @type {Object}
 * @property {number} x - Leftmost coordinate of the box
 * @property {number} y - Topmost coordinate of the box
 * @property {number} w - The bounding box Width
 * @property {number} h - The bounding box Height
 */

/**
 * A simple implementation of the Observer programming pattern
 * @template [T=any] Message type
 */
class Observer {
	/**
	 * List of handlers
	 * @type {Set<(msg: T) => void | Promise<void>>}
	 */
	_handlers = new Set();

	/**
	 * Adds a observer to the events
	 *
	 * @param {(msg: T) => void | Promise<void>} callback The function to run when receiving a message
	 * @returns {(msg:T) => void | Promise<void>} The callback we received
	 */
	on(callback) {
		this._handlers.add(callback);
		return callback;
	}
	/**
	 *	Removes a observer
	 *
	 * @param {(msg: T) => void | Promise<void>} callback The function used to register the callback
	 * @returns {boolean} Whether the handler existed
	 */
	clear(callback) {
		return this._handlers.delete(callback);
	}
	/**
	 * Sends a message to all observers
	 *
	 * @param {T} msg The message to send to the observers
	 */
	async emit(msg) {
		return Promise.all(
			Array.from(this._handlers).map(async (handler) => {
				try {
					await handler(msg);
				} catch (e) {
					console.warn("Observer failed to run handler");
					console.warn(e);
				}
			})
		);
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
function snap(i, offset = 0, gridSize = 64) {
	const modulus = (i - offset) % gridSize;
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

	return {
		x: Math.floor(box.x - w / 2),
		y: Math.floor(box.y - h / 2),
		w: Math.round(w),
		h: Math.round(h),
	};
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

	const w = sourceCanvas.width;
	const h = sourceCanvas.height;
	var imageData = sourceCanvas.getContext("2d").getImageData(0, 0, w, h);
	/** @type {BoundingBox} */
	const bb = {x: 0, y: 0, w: 0, h: 0};

	let minx = w;
	let maxx = -1;
	let miny = h;
	let maxy = -1;

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			// lol i need to learn what this part does
			const index = (y * w + x) * 4; // OHHH OK this is setting the imagedata.data uint8clampeddataarray index for the specified x/y coords
			//this part i get, this is checking that 4th RGBA byte for opacity
			if (imageData.data[index + 3] > 0) {
				minx = Math.min(minx, x);
				maxx = Math.max(maxx, x);
				miny = Math.min(miny, y);
				maxy = Math.max(maxy, y);
			}
		}
	}

	bb.x = minx - options.border;
	bb.y = miny - options.border;
	bb.w = maxx - minx + 1 + 2 * options.border;
	bb.h = maxy - miny + 1 + 2 * options.border;

	if (maxx < 0) throw new NoContentError("Canvas has no content to crop");

	var cutCanvas = document.createElement("canvas");
	cutCanvas.width = bb.w;
	cutCanvas.height = bb.h;
	cutCanvas
		.getContext("2d")
		.drawImage(sourceCanvas, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h);
	return {canvas: cutCanvas, bb};
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
		canvas: uil.getVisible({
			x: 0,
			y: 0,
			w: imageCollection.size.w,
			h: imageCollection.size.h,
		}),
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
		link.href = croppedCanvas.toDataURL("image/png");
		link.click();
	}
}

/**
 * Observer class
 */
class Observer {
	/**
	 * List of handlers
	 * @type {Set<(msg: any) => void | Promise<void>>}
	 */
	_handlers = new Set();

	/**
	 * Adds a observer to the events
	 *
	 * @param {(msg: any) => void | Promise<void>} callback The function to run when receiving a message
	 * @returns {(msg:any) => void | Promise<void>} The callback we received
	 */
	on(callback) {
		this._handlers.add(callback);
		return callback;
	}
	/**
	 *	Removes a observer
	 *
	 * @param {(msg: any) => void | Promise<void>} callback The function used to register the callback
	 * @returns {boolean} Whether the handler existed
	 */
	clear(callback) {
		return this._handlers.delete(callback);
	}
	/**
	 * Send a message to all observers
	 *
	 * @param {any} msg The message to send to the observers
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
 * @param {number} size Number of quartets of characters to generate
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
 * @param {{[key: string]: any}} options Original options object
 * @param {{[key: string]: any}} defaults Default values to assign
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
 * @param {string} name Name for logging purposes
 * @param {string[]} exceptions Parameters excepted from this restriction
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
 * @param {boolean} scaled If grid will change alignment for odd scaleFactor values (default: true)
 * @param {number} gridSize Size of the grid
 * @returns	an offset, in which [i + offset = (a location snapped to the grid)]
 */
function snap(i, scaled = true, gridSize = 64) {
	// very cheap test proof of concept but it works surprisingly well
	var scaleOffset = 0;
	if (scaled) {
		if (scaleFactor % 2 != 0) {
			// odd number, snaps to center of cell, oops
			scaleOffset = gridSize / 2;
		}
	}
	const modulus = i % gridSize;
	var snapOffset = modulus - scaleOffset;
	if (modulus > gridSize / 2) snapOffset = modulus - gridSize;

	if (snapOffset == 0) {
		return snapOffset;
	}
	return -snapOffset;
}

/**
 * Gets a bounding box centered on a given set of coordinates. Supports grid snapping
 *
 * @param {number} cx x-coordinate of the center of the box
 * @param {number} cy y-coordinate of the center of the box
 * @param {number} w the width of the box
 * @param {height} h the height of the box
 * @param {number | null} gridSnap The size of the grid to snap to
 * @returns {BoundingBox} A bounding box object centered at (cx, cy)
 */
function getBoundingBox(cx, cy, w, h, gridSnap = null) {
	const offset = {x: 0, y: 0};
	const box = {x: 0, y: 0};

	if (gridSnap) {
		offset.x = snap(cx, true, gridSnap);
		offset.y = snap(cy, true, gridSnap);
	}
	box.x = offset.x + cx;
	box.y = offset.y + cy;

	return {
		x: Math.floor(box.x - w / 2),
		y: Math.floor(box.y - h / 2),
		w,
		h,
	};
}

/**
 * Triggers Canvas Download
 */
/**
 * Crops a given canvas to content, returning a new canvas object with the content in it.
 *
 * @param {HTMLCanvasElement} sourceCanvas Canvas to get a content crop from
 * @returns {HTMLCanvasElement} A new canvas with the cropped part of the image
 */
function cropCanvas(sourceCanvas) {
	var w = sourceCanvas.width;
	var h = sourceCanvas.height;
	var pix = {x: [], y: []};
	var imageData = sourceCanvas.getContext("2d").getImageData(0, 0, w, h);
	var x, y, index;

	for (y = 0; y < h; y++) {
		for (x = 0; x < w; x++) {
			// lol i need to learn what this part does
			index = (y * w + x) * 4; // OHHH OK this is setting the imagedata.data uint8clampeddataarray index for the specified x/y coords
			//this part i get, this is checking that 4th RGBA byte for opacity
			if (imageData.data[index + 3] > 0) {
				pix.x.push(x);
				pix.y.push(y);
			}
		}
	}
	// ...need to learn what this part does too :badpokerface:
	// is this just determining the boundaries of non-transparent pixel data?
	pix.x.sort(function (a, b) {
		return a - b;
	});
	pix.y.sort(function (a, b) {
		return a - b;
	});
	var n = pix.x.length - 1;
	w = pix.x[n] - pix.x[0] + 1;
	h = pix.y[n] - pix.y[0] + 1;
	// yup sure looks like it

	try {
		var cut = sourceCanvas
			.getContext("2d")
			.getImageData(pix.x[0], pix.y[0], w, h);
		var cutCanvas = document.createElement("canvas");
		cutCanvas.width = w;
		cutCanvas.height = h;
		cutCanvas.getContext("2d").putImageData(cut, 0, 0);
	} catch (ex) {
		// probably empty image
		//TODO confirm edge cases?
		cutCanvas = null;
	}
	return cutCanvas;
}

/**
 * Downloads the content of a canvas to the disk, or opens it
 *
 * @param {{cropToContent: boolean, canvas: HTMLCanvasElement, filename: string}} options A options array with the following:\
 * cropToContent: If we wish to crop to content first (default: true)
 * canvas: The source canvas (default: imgCanvas)
 * filename: The filename to save as (default: '[ISO date] [Hours] [Minutes] [Seconds] openOutpaint image.png').\
 * If null, opens image in new tab.
 */
function downloadCanvas(options = {}) {
	defaultOpt(options, {
		cropToContent: true,
		canvas: imgCanvas,
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
		? cropCanvas(options.canvas)
		: options.canvas;
	if (croppedCanvas != null) {
		link.href = croppedCanvas.toDataURL("image/png");
		link.click();
	}
}

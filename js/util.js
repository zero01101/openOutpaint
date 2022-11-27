/**
 * Implementation of a simple Oberver Pattern for custom event handling
 */
function Observer() {
	this.handlers = new Set();
}

Observer.prototype = {
	// Adds handler for this message
	on(callback) {
		this.handlers.add(callback);
		return callback;
	},
	clear(callback) {
		return this.handlers.delete(callback);
	},
	emit(msg) {
		this.handlers.forEach(async (handler) => {
			try {
				await handler(msg);
			} catch (e) {
				console.warn("Observer failed to run handler");
				console.warn(e);
			}
		});
	},
};

/**
 * Generates unique id
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
 * Default option set
 */

function defaultOpt(options, defaults) {
	Object.keys(defaults).forEach((key) => {
		if (options[key] === undefined) options[key] = defaults[key];
	});
}

/**
 * Make object read-only
 */
function makeReadOnly(obj, name = "read-only object") {
	return new Proxy(obj, {
		set: (obj, prop, value) => {
			throw new ProxyReadOnlySetError(
				`Tried setting the '${prop}' property on '${name}'`
			);
		},
	});
}

// Makes an object so you can't rewrite already written values
function makeWriteOnce(obj, name = "write-once object") {
	return new Proxy(obj, {
		set: (obj, prop, value) => {
			if (obj[prop] !== undefined)
				throw new ProxyWriteOnceSetError(
					`Tried setting the '${prop}' property on '${name}' after it was already set`
				);
			obj[prop] = value;
		},
	});
}

/**
 * Bounding box Calculation
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
	link.download = options.filename;

	var croppedCanvas = options.cropToContent
		? cropCanvas(options.canvas)
		: options.canvas;
	if (croppedCanvas != null) {
		link.href = croppedCanvas.toDataURL("image/png");
		link.click();
	}
}

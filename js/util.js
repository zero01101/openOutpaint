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
	// returns id of format 'aaaaaaaa'-'aaaa'-'aaaa'-'aaaa'-'aaaaaaaaaaaa'
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

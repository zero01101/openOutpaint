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

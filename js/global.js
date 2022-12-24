/**
 * Stores global variables without polluting the global namespace.
 */

const global = {
	// Connection
	_connection: "offline",
	set connection(v) {
		this._connection = v;

		toolbar &&
			toolbar.currentTool &&
			toolbar.currentTool.state.redraw &&
			toolbar.currentTool.state.redraw();
	},
	get connection() {
		return this._connection;
	},

	// If there is a selected input
	hasActiveInput: false,

	// If debugging is enabled
	_debug: false,
	set debug(v) {
		if (debugLayer) {
			if (v) {
				debugLayer.unhide();
			} else {
				debugLayer.hide();
			}
		}

		this._debug = v;
	},
	get debug() {
		return this._debug;
	},
	/**
	 * Toggles debugging.
	 */
	toggledebug() {
		this.debug = !this.debug;
	},
};

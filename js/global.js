/**
 * Stores global variables without polluting the global namespace.
 */

const global = {
	// If this is the first run of openOutpaint
	get firstRun() {
		return this._firstRun;
	},

	// Connection
	_connection: "offline",
	set connection(v) {
		this._connection = v;

		thetoolbar &&
			thetoolbar.currentTool &&
			thetoolbar.currentTool.state.redraw &&
			thetoolbar.currentTool.state.redraw();
	},
	get connection() {
		return this._connection;
	},

	// If there is a selected input
	hasActiveInput: false,

	// If cursor size sync is enabled
	syncCursorSize: false,

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

	// HRFix compatibility shenanigans
	isOldHRFix: false,

	// WebUI object to communitate with parent window
	webui: null,
};

global._firstRun = !localStorage.getItem("openoutpaint/host");

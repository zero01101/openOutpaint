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
};

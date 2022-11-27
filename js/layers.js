/**
 * This is a manager for the many canvas and content layers that compose the application
 *
 * It manages canvases and their locations and sizes according to current viewport views
 */

const layers = {
	_layers: [],
	layers: {},

	// Registers a new layer
	registerLayer: (name) => {
		const layer = {
			id: guid(),
			name: layer,
			// This is where black magic starts
			// A proxy for the canvas object
			canvas: new Proxy(document.createElement("canvas"), {}),
		};
	},

	// Deletes a layer
	deleteLayer: (layer) => {
		if (typeof layer === "object") {
			layers._layers = layers._layers.filter((l) => l.id === layer.id);
			delete layers[layer.id];
		} else if (typeof layer === "string") {
			layers._layers = layers._layers.filter((l) => l.id === layer);
			delete layers[layer];
		}
	},
};

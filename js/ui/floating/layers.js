/**
 * The layering UI window
 */

const uiLayers = {
	layers: [],
	active: null,

	_syncLayers() {
		const layersEl = document.getElementById("layer-list");

		const children = Array.from(layersEl.children);

		this.layers.forEach((uiLayer) => {
			if (!uiLayer.entry) {
				uiLayer.entry = document.createElement("div");
				uiLayer.entry.textContent = uiLayer.name;

				uiLayer.entry.id = `ui-layer-${uiLayer.id}`;
				uiLayer.entry.classList.add("ui-layer");
				uiLayer.entry.addEventListener(
					"click",
					() => (this.active = uiLayer.layer)
				);

				if (true || children.length === 0) layersEl.appendChild(uiLayer.entry);
			}
		});
	},

	addLayer(group, name) {
		const layer = imageCollection.registerLayer(null, {
			name,
			after:
				(this.layers.length > 0 && this.layers[this.layers.length - 1].layer) ||
				bgLayer,
		});

		const uiLayer = {
			id: layer.id,
			group,
			name,
			entry: null,
			layer,
		};
		this.layers.push(uiLayer);

		this.active = uiLayer.layer;

		this._syncLayers();

		return uiLayer;
	},
};
uiLayers.addLayer(null, "Default Image Layer");
uiLayers.addLayer(null, "Test Extra Layer");

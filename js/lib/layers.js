/**
 * This is a manager for the many canvas and content layers that compose the application
 *
 * It manages canvases and their locations and sizes according to current viewport views
 */
const layers = {
	_collections: [],
	collections: makeWriteOnce({}, "layers.collections"),

	listen: {
		oncollectioncreate: new Observer(),
		oncollectiondelete: new Observer(),

		onlayercreate: new Observer(),
		onlayerdelete: new Observer(),
	},

	// Registers a new collection
	// Layer collections are a group of layers (canvases) that are rendered in tandem. (same width, height, position, transform, etc)
	registerCollection: (key, size, options = {}) => {
		defaultOpt(options, {
			// Display name for the collection
			name: key,

			// Initial layer
			initLayer: {
				key: "default",
				options: {},
			},

			// Target
			targetElement: document.getElementById("layer-render"),

			// Resolution of the image
			resolution: size,
		});

		// Path used for logging purposes
		const _logpath = "layers.collections." + key;

		// Collection ID
		const id = guid();

		// Collection element
		const element = document.createElement("div");
		element.id = `collection-${id}`;
		element.style.width = `${size.w}px`;
		element.style.height = `${size.h}px`;
		element.classList.add("collection");

		// Input element (overlay element for input handling)
		const inputel = document.createElement("div");
		inputel.id = `collection-input-${id}`;
		inputel.style.width = `${size.w}px`;
		inputel.style.height = `${size.h}px`;
		inputel.addEventListener("mouseover", (evn) => {
			document.activeElement.blur();
		});
		inputel.classList.add("collection-input-overlay");
		element.appendChild(inputel);

		options.targetElement.appendChild(element);

		const collection = makeWriteOnce(
			{
				id,

				_logpath,

				_layers: [],
				layers: {},

				name: options.name,
				element,
				inputElement: inputel,

				size,
				resolution: options.resolution,

				active: null,

				/**
				 * Registers a new layer
				 *
				 * @param {string | null} key Name and key to use to access layer. If null, it is a temporary layer.
				 * @param {object} options
				 * @param {string} options.name
				 * @param {?BoundingBox} options.bb
				 * @param {{w: number, h: number}} options.resolution
				 * @param {object} options.after
				 * @returns
				 */
				registerLayer: (key = null, options = {}) => {
					// Make ID
					const id = guid();

					defaultOpt(options, {
						// Display name for the layer
						name: key || `Temporary ${id}`,

						// Bounding box for layer
						bb: {x: 0, y: 0, w: collection.size.w, h: collection.size.h},

						// Bounding box for layer
						resolution: null,

						// If set, will insert the layer after the given one
						after: null,
					});

					// Calculate resolution
					if (!options.resolution)
						options.resolution = {
							w: (collection.resolution.w / collection.size.w) * options.bb.w,
							h: (collection.resolution.h / collection.size.h) * options.bb.h,
						};

					// This layer's canvas
					// This is where black magic will take place in the future
					/**
					 * @todo Use the canvas black arts to auto-scale canvas
					 */
					const canvas = document.createElement("canvas");
					canvas.id = `layer-${id}`;

					canvas.style.left = `${options.bb.x}px`;
					canvas.style.top = `${options.bb.y}px`;
					canvas.style.width = `${options.bb.w}px`;
					canvas.style.height = `${options.bb.h}px`;
					canvas.width = options.resolution.w;
					canvas.height = options.resolution.h;

					if (!options.after) collection.element.appendChild(canvas);
					else {
						options.after.canvas.after(canvas);
					}

					const ctx = canvas.getContext("2d");

					// Path used for logging purposes
					const _layerlogpath = key
						? _logpath + ".layers." + key
						: _logpath + ".layers[" + id + "]";
					const layer = makeWriteOnce(
						{
							_logpath: _layerlogpath,
							_collection: collection,

							id,
							key,
							name: options.name,

							state: new Proxy(
								{visible: true},
								{
									set(obj, opt, val) {
										switch (opt) {
											case "visible":
												layer.canvas.style.display = val ? "block" : "none";
												break;
										}
										obj[opt] = val;
									},
								}
							),

							/** Our canvas */
							canvas,
							ctx,

							/**
							 * Moves this layer to another location
							 *
							 * @param {number} x X coordinate of the top left of the canvas
							 * @param {number} y X coordinate of the top left of the canvas
							 */
							moveTo(x, y) {
								canvas.style.left = `${x}px`;
								canvas.style.top = `${y}px`;
							},

							// Hides this layer (don't draw)
							hide() {
								this.canvas.style.display = "none";
							},
							// Hides this layer (don't draw)
							unhide() {
								this.canvas.style.display = "block";
							},

							// Activates this layer
							activate() {
								collection.active = this;
							},
						},
						_layerlogpath,
						["active"]
					);

					// Add to indexers
					if (!options.after) collection._layers.push(layer);
					else {
						const index = collection._layers.findIndex(
							(l) => l === options.after
						);
						collection._layers.splice(index, 0, layer);
					}
					if (key) collection.layers[key] = layer;

					if (key === null)
						console.debug(
							`[layers] Anonymous layer '${layer.name}' registered`
						);
					else
						console.info(
							`[layers] Layer '${layer.name}' at ${layer._logpath} registered`
						);

					layers.listen.onlayercreate.emit({
						layer,
					});
					return layer;
				},

				// Deletes a layer
				deleteLayer: (layer) => {
					const lobj = collection._layers.splice(
						collection._layers.findIndex(
							(l) => l.id === layer || l.id === layer.id
						),
						1
					)[0];
					if (!lobj) return;

					layers.listen.onlayerdelete.emit({
						layer: lobj,
					});
					if (lobj.key) delete collection.layers[lobj.key];

					collection.element.removeChild(lobj.canvas);

					if (lobj.key) console.info(`[layers] Layer '${lobj.key}' deleted`);
					else console.debug(`[layers] Anonymous layer '${lobj.id}' deleted`);
				},
			},
			_logpath,
			["active"]
		);

		layers._collections.push(collection);
		layers.collections[key] = collection;

		console.info(
			`[layers] Collection '${options.name}' at ${_logpath} registered`
		);

		// We must create a layer to select
		collection
			.registerLayer(options.initLayer.key, options.initLayer.options)
			.activate();

		return collection;
	},
};

/**
 * This is a manager for the many canvas and content layers that compose the application
 *
 * It manages canvases and their locations and sizes according to current viewport views
 */

// Errors
class LayerNestedScopesError extends Error {
	// For when a scope is created in another scope
}
class LayerNoScopeError extends Error {
	// For when an action that requires a scope is attempted
	// in a collection with no scope.
}

const layers = {
	collections: makeWriteOnce({}, "layers.collections"),

	// Registers a new collection
	registerCollection: (key, options = {}) => {
		defaultOpt(options, {
			// If collection is visible on the Layer View Toolbar
			visible: true,
			// Display name for the collection
			name: key,
			/**
			 * If layer creates a layer scope
			 *
			 * A layer scope is a context where one, and only one layer inside it or its
			 * subscopes can be active at a time. Nested scopes are not supported.
			 * It receives an object of type:
			 *
			 * {
			 *     // If there must be a selected layer, pass information to create the first
			 *     always: {
			 *         key,
			 *         options
			 *     }
			 * }
			 */
			scope: null,
			// Parent collection
			parent: null,
		});

		// Finds the closest parent with a defined scope
		const findScope = (collection = options.parent) => {
			if (!collection) return null;

			if (collection.scope) return collection;
			return findScope(collection._parent);
		};

		// Path used for logging purposes
		const _logpath = options.parent
			? options.parent + "." + key
			: "layers.collections." + key;

		// If we have a scope already, we can't add a new scope
		if (options.scope && findScope())
			throw new LayerNestedScopesError(`Layer scopes must not be nested`);

		const collection = makeWriteOnce(
			{
				_parent: options.parent,
				_logpath,
				_layers: [],
				layers: {},

				name: options.name,

				scope: options.scope,
				// Registers a new layer
				registerLayer: (key, options = {}) => {
					defaultOpt(options, {
						// Display name for the layer
						name: key,
					});

					// Path used for logging purposes
					const _layerlogpath = _logpath + ".layers." + key;
					const layer = makeWriteOnce(
						{
							_logpath: _layerlogpath,
							id: guid(),
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

							// This is where black magic will take place in the future
							// A proxy for the canvas object
							canvas: new Proxy(document.createElement("canvas"), {}),

							// Activates this layer in the scope
							activate: () => {
								const scope = findScope(collection);
								if (scope) {
									scope.active = layer;
									console.debug(
										`[layers] Layer ${layer._logpath} now active in scope ${scope._logpath}`
									);
								}
							},

							// Deactivates this layer in the scope
							deactivate: () => {
								const scope = findScope(collection);
								if (scope && scope.active === layer) scope.active = null;
								console.debug();
							},
						},
						_layerlogpath
					);

					// Add to indexers
					collection._layers.push(layer);
					collection.layers[key] = layer;

					console.info(
						`[layers] Layer '${layer.name}' at ${layer._logpath} registered`
					);
					return layer;
				},

				// Deletes a layer
				deleteLayer: (layer) => {
					collection._layers.splice(
						collection._layers.findIndex(
							(l) => l.id === layer || l.id === layer.id
						),
						1
					);
					if (typeof layer === "object") {
						delete collection.layers[layer.id];
					} else if (typeof layer === "string") {
						delete collection.layers[layer];
					}

					console.info(`[layers] Layer '${layer}' deleted`);
				},
			},
			_logpath
		);

		if (parent) parent[key] = collection;
		else layers.collections[key] = collection;

		console.info(
			`[layers] Collection '${options.name}' at ${_logpath} registered`
		);

		// If always, we must create a layer to select
		if (options.scope && options.scope.always)
			collection
				.registerLayer(options.scope.always.key, options.scope.always.options)
				.activate();

		return collection;
	},
};

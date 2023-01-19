/**
 * A layer
 *
 * @typedef {object} Layer
 * @property {string} id The id of the layer
 * @property {string} key A identifier for the layer
 * @property {string} name The display name of the layer
 * @property {BoundingBox} bb The current bounding box of the layer, in layer coordinates
 * @property {Size} resolution The resolution of the layer (canvas)
 * @property {boolean} full If the layer is a full layer (occupies the full collection)
 * @property {number} x The x coordinate of the layer
 * @property {number} y The y coordinate of the layer
 * @property {number} width The width of the layer
 * @property {number} w The width of the layer
 * @property {number} height The height of the layer
 * @property {number} h The height of the layer
 * @property {Point} origin The location of the origin ((0, 0) point) of the layer (If canvas goes from -64, -32 to 128, 512, it's (64, 32))
 * @property {HTMLCanvasElement} canvas The canvas element of the layers
 * @property {CanvasRenderingContext2D} ctx The context of the canvas of the layer
 * @property {function} clear Clears the layer contents
 * @property {function} moveAfter Moves this layer to another level (after given layer)
 * @property {function} moveBefore Moves this layer to another level (before given layer)
 * @property {function} moveTo Moves this layer to another location
 * @property {function} resize Resizes the layer in place
 * @property {function} hide Hides the layer
 * @property {function} unhide Unhides the layer
 */

/**
 * A layer collection
 *
 * @typedef {object} LayerCollection
 * @property {string} id The id of the collection
 * @property {string} key A identifier for the collection
 * @property {string} name The display name of the collection
 * @property {HTMLDivElement} element The base element of the collection
 * @property {HTMLDivElement} inputElement The element used for input handling for the collection
 * @property {Point} divOffset The offset for calculating layer coordinates from input element input information
 * @property {Point} origin The location of the origin ((0, 0) point) of the collection (If canvas goes from -64, -32 to 128, 512, it's (64, 32))
 * @property {BoundingBox} bb The current bounding box of the collection, in layer coordinates
 * @property {{[key: string]: Layer}} layers An object for quick access to named layers of the collection
 * @property {Size} size The size of the collection (CSS)
 * @property {Size} resolution The resolution of the collection (canvas)
 * @property {function} expand Expands the collection and its full layers by the specified amounts
 * @property {function} registerLayer Registers a new layer
 * @property {function} deleteLayer Deletes a layer from the collection
 */

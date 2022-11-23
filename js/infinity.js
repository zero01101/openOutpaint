const infinity = {
	_init() {
		console.info("[infinity] Loading infinity lib");
		infinity._canvas_update_size();

		// Add event handlers
		window.onresize = infinity._canvas_update_size;

		// Add draw loop
		infinity._draw();
	},
	_canvas_update_size() {
		// TEMPORARY
		// TODO: Remove this for dynamic canvas sizing
		Array.from(document.getElementsByClassName("content-canvas")).forEach(
			(canvas) => {
				canvas.width = 2560;
				canvas.height = 1440;
			}
		);

		// Update canvas size
		Array.from(document.getElementsByClassName("display-canvas")).forEach(
			(canvas) => {
				canvas.width = window.innerWidth;
				canvas.height = window.innerHeight;
			}
		);
	},

	// Content Canvas Information

	// Viewport information
	viewports: [],

	registerViewport: (el, options = {}) => {
		defaultOpt(options, {
			x: 0,
			y: 0,
			zoom: 1,
			input: true,
		});

		// Registers a canvas as a viewport
		const viewport = {
			id: guid(),
			canvas: el,
			ctx: el.getContext("2d"),
			x: options.x,
			y: options.y,
			zoom: options.zoom,
		};

		viewport.getBoundingBox = () => {
			const w = viewport.canvas.width * viewport.zoom;
			const h = viewport.canvas.height * viewport.zoom;

			return {
				x: viewport.x - w / 2,
				y: viewport.y - h / 2,
				w,
				h,
			};
		};

		infinity.viewports.push(viewport);

		// Register mouse input
		const offset = {x: 0, y: 0};
		const oviewport = {x: 0, y: 0};
		mouse.listen.world.middle.onpaintstart = (evn) => {
			offset.x = evn.x;
			offset.y = evn.y;
			oviewport.x = viewport.x;
			oviewport.y = viewport.y;
		};
		mouse.listen.world.middle.onpaint = (evn) => {
			viewport.x = oviewport.x - (evn.x - offset.x);
			viewport.y = oviewport.y - (evn.y - offset.y);
		};

		return viewport;
	},

	// Draw loop
	_draw: () => {
		infinity.viewports.forEach((viewport) => {
			try {
				const bb = viewport.getBoundingBox();

				viewport.ctx.drawImage(
					bgCanvas,
					bb.x,
					bb.y,
					bb.w,
					bb.h,
					0,
					0,
					bb.w,
					bb.h
				);
			} catch (e) {}
		});

		requestAnimationFrame(infinity._draw);
	},
};

infinity._init();
Array.from(document.getElementsByClassName("display-canvas")).forEach(
	(canvas) => infinity.registerViewport(canvas)
);

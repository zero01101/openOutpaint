const dream_generate_callback = (evn, state) => {
	if (evn.target.id === "overlayCanvas" && !blockNewImages) {
		const bb = getBoundingBox(
			evn.x,
			evn.y,
			basePixelCount * scaleFactor,
			basePixelCount * scaleFactor,
			state.snapToGrid && basePixelCount
		);

		// Build request to the API
		const request = {};
		Object.assign(request, stableDiffusionData);

		// Load prompt (maybe we should add some events so we don't have to do this)
		request.prompt = document.getElementById("prompt").value;
		request.negative_prompt = document.getElementById("negPrompt").value;

		// Don't allow another image until is finished
		blockNewImages = true;

		// Setup marching ants
		stopMarching = march(bb);

		// Setup some basic information for SD
		request.width = bb.w;
		request.height = bb.h;

		request.firstphase_width = bb.w / 2;
		request.firstphase_height = bb.h / 2;

		// Use txt2img if canvas is blank
		if (isCanvasBlank(bb.x, bb.y, bb.w, bb.h, imgCanvas)) {
			// Dream
			dream(bb.x, bb.y, request, {method: "txt2img", stopMarching, bb});
		} else {
			// Use img2img if not

			// Temporary canvas for init image and mask generation
			const auxCanvas = document.createElement("canvas");
			auxCanvas.width = request.width;
			auxCanvas.height = request.height;
			const auxCtx = auxCanvas.getContext("2d");

			auxCtx.fillStyle = "#000F";

			// Get init image
			auxCtx.fillRect(0, 0, bb.w, bb.h);
			auxCtx.drawImage(imgCanvas, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h);
			request.init_images = [auxCanvas.toDataURL()];

			// Get mask image
			auxCtx.fillRect(0, 0, bb.w, bb.h);
			auxCtx.globalCompositeOperation = "destination-in";
			auxCtx.drawImage(imgCanvas, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h);
			auxCtx.globalCompositeOperation = "destination-out";
			auxCtx.drawImage(
				maskPaintCanvas,
				bb.x,
				bb.y,
				bb.w,
				bb.h,
				0,
				0,
				bb.w,
				bb.h
			);
			auxCtx.globalCompositeOperation = "destination-atop";
			auxCtx.fillStyle = "#FFFF";
			auxCtx.fillRect(0, 0, bb.w, bb.h);
			request.mask = auxCanvas.toDataURL();

			// Dream
			dream(bb.x, bb.y, request, {method: "img2img", stopMarching, bb});
		}
	}
};
const dream_erase_callback = (evn, state) => {
	const bb = getBoundingBox(
		evn.x,
		evn.y,
		basePixelCount * scaleFactor,
		basePixelCount * scaleFactor,
		state.snapToGrid && basePixelCount
	);
	commands.runCommand("eraseImage", "Erase Area", bb);
};

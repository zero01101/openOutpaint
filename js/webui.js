/**
 * This file should only be actually loaded if we are in a trusted environment.
 */
(async () => {
	// Check if key file exists
	const response = await fetch("key.json");

	/** @type {{host?: string, trusted?: boolean, key: string}} */
	let data = null;
	if (response.status === 200) {
		data = await response.json();
		console.info("[webui] key.json loaded successfully");
	}
	if (response.status !== 200 || (!data.key && !data.trusted)) {
		console.warn(
			"[webui] An accessible key.json file with a 'key' or 'trusted' should be provided to allow for messaging"
		);
		console.warn(data);
		return;
	}

	const key = data.key;

	// Check if we are running inside an iframe or embed
	try {
		const frame = window.frameElement;

		if (frame === null) {
			console.info("[webui] Not running inside a frame");
		} else {
			console.info(
				`[webui] Window is child of '${window.parent.document.URL}'`
			);
			if (data.host && !window.parent.document.URL.startsWith(data.host)) {
				console.warn(
					`[webui] Window does not trust parent '${window.parent.document.URL}'`
				);
				console.warn("[webui] Will NOT setup message listeners");
				return;
			}
		}
	} catch (e) {
		console.warn(
			`[webui] Running in a third party iframe or embed, and blocked by CORS`
		);
		console.warn(e);
		return;
	}

	if (data) {
		let parentWindow = null;

		if (!data.trusted) console.debug(`[webui] Loaded key`);

		window.addEventListener("message", ({data, origin, source}) => {
			if (!data.trusted && data.key !== key) {
				console.warn(
					`[webui] Message with incorrect key was received from '${origin}'`
				);
				console.warn(data);
				return;
			}

			if (!parentWindow && !data.type === "openoutpaint/init") {
				console.warn(`[webui] Communication has not been initialized`);
			}

			try {
				switch (data.type) {
					case "openoutpaint/init":
						parentWindow = source;
						console.debug(
							`[webui] Communication with '${origin}' has been initialized`
						);
						if (data.host)
							setFixedHost(
								data.host,
								`Are you sure you want to modify the host?\nThis configuration was provided by the hosting page\n - ${parentWindow.document.title} (${origin})`
							);

						break;
					case "openoutpaint/add-resource":
						{
							const image = document.createElement("img");
							image.src = data.image.dataURL;
							image.onload = async () => {
								await tools.stamp.state.addResource(
									data.image.resourceName || "External Resource",
									image
								);
								tools.stamp.enable();
							};
						}
						break;
					default:
						console.warn(`[webui] Unsupported message type: ${data.type}`);
						break;
				}

				// Send acknowledgement
				parentWindow &&
					parentWindow.postMessage({
						type: "openoutpaint/ack",
						message: data,
					});
			} catch (e) {
				console.warn(
					`[webui] Message of type '${data.type}' has invalid format`
				);
				console.warn(e);
				console.warn(data);
			}
		});
	}
})();

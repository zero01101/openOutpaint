/**
 * Extensions helper thing or class or whatever
 */

const extensions = {
	// alwaysOnScriptsData: {},
	alwaysOnScripts: false,
	controlNetEnabled: false,
	controlNetActive: false,
	selectedControlNetModel: null,
	selectedControlNetModule: null,
	dynamicPromptsEnabled: false,
	dynamicPromptsActive: false,
	dynamicPromptsAlwaysonScriptName: null, //GRUMBLE GRUMBLE
	enabledExtensions: [],
	controlNetModels: null,
	controlNetModules: null,

	async getExtensions(
		controlNetModelAutoComplete,
		controlNetModuleAutoComplete
	) {
		const allowedExtensions = [
			"controlnet",
			// "none",
			// "adetailer", // no API, can't verify available models
			"dynamic prompts", //seriously >:( why put version in the name, now i have to fuzzy match it - just simply enabled or not? no API but so so good
			//"segment anything", // ... API lets me get model but not processor?!?!?!
			//"self attention guidance", // no API but useful, just enabled button, scale and threshold sliders?
		];
		// check http://127.0.0.1:7860/sdapi/v1/scripts for extensions
		// if any of the allowed extensions are found, add them to the list
		var url = document.getElementById("host").value + "/sdapi/v1/scripts";
		try {
			const response = await fetch(url);
			const data = await response.json();
			// enable checkboxes for extensions based on existence in data
			data.img2img
				.filter((extension) => {
					return allowedExtensions.some((allowedExtension) => {
						return extension.toLowerCase().includes(allowedExtension);
					});
				})
				.forEach((extension) => {
					this.enabledExtensions.push(extension);
				});
		} catch (e) {
			console.warn("[index] Failed to fetch extensions");
			console.warn(e);
		}
		this.checkForDynamicPrompts();
		this.checkForControlNet(
			controlNetModelAutoComplete,
			controlNetModuleAutoComplete
		);
		//checkForSAM(); //or inpaintAnything or something i dunno
		//checkForADetailer(); //? this one seems iffy
		//checkForSAG(); //??
	},

	async checkForDynamicPrompts() {
		if (
			this.enabledExtensions.filter((e) => e.includes("dynamic prompts"))
				.length > 0
		) {
			// Dynamic Prompts found, enable checkbox
			this.alwaysOnScripts = true;
			this.dynamicPromptsAlwaysonScriptName =
				this.enabledExtensions[
					this.enabledExtensions.findIndex((e) => e.includes("dynamic prompts"))
				];
			// this.alwaysOnScriptsData[this.dynamicPromptsAlwaysonScriptName] = {};
			this.dynamicPromptsEnabled = true;
			document.getElementById("cbxDynPrompts").disabled = false;
		}
		// basically param 0 is true for on, false for off, that's it
	},

	async checkForControlNet(
		controlNetModelAutoComplete,
		controlNetModuleAutoComplete
	) {
		var url = document.getElementById("host").value + "/controlnet/version";

		try {
			const response = await fetch(url);
			const data = await response.json();

			if (
				data.version > 0 &&
				this.enabledExtensions.filter((e) => e.includes("controlnet")).length >
					0
			) {
				// ControlNet found
				this.alwaysOnScripts = true;
				this.controlNetEnabled = true;
				document.getElementById("cbxControlNet").disabled = false;
				// ok cool so now we can get the models and modules
				this.getModels(controlNetModelAutoComplete);
				this.getModules(controlNetModuleAutoComplete);
			}
		} catch (e) {
			// ??
			global.controlnetAPI = false;
		}
	},
	async getModels(controlNetModelAutoComplete) {
		// only worry about inpaint models for now
		var url = document.getElementById("host").value + "/controlnet/model_list";

		try {
			const response = await fetch(url);
			const data = await response.json();

			this.controlNetModels = data.model_list;
		} catch (e) {
			console.warn("[extensions] Failed to fetch controlnet models");
			console.warn(e);
		}

		let opt = null;
		opt = this.controlNetModels
			.filter((m) => m.includes("inpaint"))
			.map((option) => ({
				name: option,
				value: option,
			}));

		controlNetModelAutoComplete.options = opt;
	},
	async getModules(controlNetModuleAutoComplete) {
		const allowedModules = ["reference", "inpaint"];
		var url = document.getElementById("host").value + "/controlnet/module_list";

		try {
			const response = await fetch(url);
			const data = await response.json();

			this.controlNetModules = data;
		} catch (e) {
			console.warn("[extensions] Failed to fetch controlnet modules");
			console.warn(e);
		}

		let opt = null;
		opt = this.controlNetModules.module_list
			.filter((m) => m.includes("inpaint")) // why is there just "inpaint" in the modules if it's not in the ui
			.map((option) => ({
				name: option,
				value: option,
			}));

		opt.push({
			name: "inpaint_global_harmonious",
			value: "inpaint_global_harmonious", // WTF WHY IS THIS ONE NOT LISTED IN MODULES BUT DISTINCT IN THE API CALL?!?!?!??!??! it is slightly different from "inpaint" from what i can tell
		});

		controlNetModuleAutoComplete.options = opt;
	},
};

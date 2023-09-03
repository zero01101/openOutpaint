/**
 * Extensions helper thing or class or whatever
 */

const extensions = {
	// alwaysOnScriptsData: {},
	alwaysOnScripts: false,
	controlNetEnabled: false,
	controlNetActive: false,
	controlNetReferenceActive: false,
	controlNetReferenceFidelity: 0.5,
	selectedControlNetModel: null,
	selectedControlNetModule: null,
	selectedCNReferenceModule: null,
	controlNetModelCount: 0,
	dynamicPromptsEnabled: false,
	dynamicPromptsActive: false,
	dynamicPromptsAlwaysonScriptName: null, //GRUMBLE GRUMBLE
	enabledExtensions: [],
	controlNetModels: null,
	controlNetModules: null,

	async getExtensions(
		controlNetModelAutoComplete,
		controlNetModuleAutoComplete,
		controlNetReferenceModuleAutoComplete
	) {
		const allowedExtensions = [
			"controlnet",
			// "none",
			// "adetailer", // no API, can't verify available models
			"dynamic prompts", //seriously >:( why put version in the name, now i have to fuzzy match it - just simply enabled or not? no API but so so good
			//"segment anything", // ... API lets me get model but not processor?!?!?!
			//"self attention guidance", // no API but useful, just enabled button, scale and threshold sliders?
			"cfg rescale extension",
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
			controlNetModuleAutoComplete,
			controlNetReferenceModuleAutoComplete
		);
		this.checkForCFGRescale();
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
		controlNetModuleAutoComplete,
		controlNetReferenceModuleAutoComplete
	) {
		var url = document.getElementById("host").value + "/controlnet/version";

		if (
			this.enabledExtensions.filter((e) => e.includes("controlnet")).length > 0
		) {
			try {
				const response = await fetch(url);
				const data = await response.json();

				if (data.version > 0) {
					// ControlNet found
					this.alwaysOnScripts = true;
					this.controlNetEnabled = true;
					document.getElementById("cbxControlNet").disabled = false;
					// ok cool so now we can get the models and modules
					this.getModels(controlNetModelAutoComplete);
					this.getModules(
						controlNetModuleAutoComplete,
						controlNetReferenceModuleAutoComplete
					);
				}
				url = document.getElementById("host").value + "/controlnet/settings";
				try {
					const response2 = await fetch(url);
					const data2 = await response2.json();
					if (data2.control_net_max_models_num < 2) {
						document.getElementById("cbxControlNetReferenceLayer").disabled =
							"disabled";
						console.warn(
							"[extensions] ControlNet reference layer disabled due to insufficient units enabled in settings - cannot be enabled via API, please increase to at least 2 units manually"
						);
					}
				} catch (ex) {}
			} catch (e) {
				// ??
				global.controlnetAPI = false;
			}
		} else {
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
	async getModules(
		controlNetModuleAutoComplete,
		controlNetReferenceModuleAutoComplete
	) {
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

		opt = this.controlNetModules.module_list
			.filter((m) => m.includes("reference"))
			.map((option) => ({
				name: option,
				value: option,
			}));

		controlNetReferenceModuleAutoComplete.options = opt;
	},

	async checkForCFGRescale() {
		if (
			this.enabledExtensions.filter((e) => e.includes("cfg rescale extension"))
				.length > 0
		) {
			// CFG Rescale found, enable checkbox
			this.alwaysOnScripts = true;
			this.CFGRescaleAlwaysonScriptName =
				this.enabledExtensions[
					this.enabledExtensions.findIndex((e) => e.includes("cfg rescale extension"))
				];
			// this.alwaysOnScriptsData[this.CFGRescaleAlwaysonScriptName] = {};
			this.CFGRescaleEnabled = true;
			document.getElementById("cbxCFGRescale").disabled = false;
		}
		// basically param 0 is true for on, false for off, that's it
	},
};

/**
 * Workspaces (or sessions) are settings and canvas state storage structures that can be changed at will, saved, and restored.
 */

/**
 * Represents a workspace
 *
 * @template [S] Settings type
 */
class Workspace {
	/**
	 * The name of the workspace
	 * @type {string}
	 */
	name = "Workspace Name";

	/**
	 * Workspace default settings.
	 *
	 * @type {S}
	 */
	defaults = {};

	/**
	 * Storage for workspace settings.
	 *
	 * @type {S}
	 */
	settings = new Proxy(
		{},
		{
			get: (t, name) => {
				if (t[name] === undefined)
					t[name] =
						JSON.parse(localStorage.getItem(`openoutpaint/${name}`)) ??
						this.defaults[name];
				return t[name];
			},
			set: (t, name, value) => {
				localStorage.setItem(`openoutpaint/${name}`, JSON.stringify(value));
				t[name] = value;
			},
		}
	);

	/**
	 * Storage for other data
	 *
	 * @type {Record<string, any>}
	 */
	data = new Proxy({}, {});

	/**
	 * Saves the data to the workspace
	 *
	 * @param {string} key The key of the data to be saved (eg. history or layers)
	 * @param {any} data The data to be saved on this key. MUST BE SERIALIZABLE.
	 */
	save(key, data) {
		this.data[key] = data;
	}

	/**
	 * Gets saved data from the workspace
	 *
	 * @param {string} key The key of the data to be saved (eg. history or layers)
	 * @param {any} data The data to be saved on this key. MUST BE SERIALIZABLE.
	 */
	load(key) {
		return this.data[key];
	}

	/**
	 * @param {string} name The name of the workspace
	 * @param {Object} options
	 * @param {S} options.defaults Default workspace settings
	 */
	constructor(name, options = {}) {
		defaultOpt(options, {
			defaults: {
				/** Default Prompt - REQ */
				prompt: "ocean floor scientific expedition, underwater wildlife",
				/** Default Negative Prompt - REQ */
				neg_prompt:
					"people, person, humans, human, divers, diver, glitch, error, text, watermark, bad quality, blurry",
				/** Default Stable Diffusion Seed - REQ */
				seed: -1,
				/** Default CFG Scale - REQ */
				cfg_scale: 7.0,
				/** Default steps - REQ */
				steps: 30,
				/** Default Resolution */
				resolution: 512,
			},
		});

		this.name = name;
		this.defaults = options.defaults;
	}
}

const workspaces = {
	/**
	 * Loaded workspace
	 *
	 * @type {Workspace<workspaceDefaults>}
	 */
	_workspace: null,

	get current() {
		return this._workspace;
	},

	/**
	 * On Workspace Changed
	 *
	 * @type {Observer<{workspace: Workspace<workspaceDefaults>}>}
	 */
	onchange: new Observer(),

	/**
	 * Loads a workspace
	 *
	 * @param {Workspace<workspaceDefaults>} workspace Workspace to load
	 */
	loadWorkspace(workspace) {
		console.info(`[workspaces] Loading workspace: ${workspace.name}`);

		// Set current workspace
		this._workspace = workspace;

		// Notify observers that the workspace has changed
		this.onchange.emit({workspace});
	},
};

// Creates a new workspace instance
workspaces.loadWorkspace(
	new Workspace("Default", {
		workspaceDefaults,
	})
);

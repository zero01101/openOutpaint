/**
 * Default settings for local configurations
 */
const localDefaults = {
	/** Default Host */
	host: "http://127.0.0.1:7860",
};

/**
 * Default settings for workspace configurations
 */
const workspaceDefaults = {
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
};

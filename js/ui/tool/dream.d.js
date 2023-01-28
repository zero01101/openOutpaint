/**
 * Stable Diffusion Request
 *
 * @typedef StableDiffusionRequest
 * @property {string} prompt Stable Diffusion prompt
 * @property {string} negative_prompt Stable Diffusion negative prompt
 *
 * @property {number} width Stable Diffusion render width
 * @property {number} height Stable Diffusion render height
 *
 * @property {number} n_iter Stable Diffusion number of iterations
 * @property {number} batch_size Stable Diffusion images per batches
 *
 * @property {number} seed Stable Diffusion seed
 * @property {number} steps Stable Diffusion step count
 * @property {number} cfg_scale Stable Diffusion CFG scale
 * @property {string} sampler_index Stable Diffusion sampler name
 *
 * @property {boolean} restore_faces WebUI face restoration
 * @property {boolean} tiling WebUI tiling
 * @property {string[]} styles WebUI styles
 * @property {string} script_name WebUI script name
 * @property {Array} script_args WebUI script args
 *
 * @property {string} mask Stable Diffusion mask (img2img)
 * @property {number} mask_blur Stable Diffusion mask blur (img2img)
 *
 * @property {number} inpainting_fill Stable Diffusion inpainting fill (img2img)
 * @property {boolean} inpaint_full_res Stable Diffusion full resolution (img2img)
 */

/**
 * Stable Diffusion Response
 *
 * @typedef StableDiffusionResponse
 * @property {string[]} images Response images
 */

/**
 * Stable Diffusion Progress Response
 *
 * @typedef StableDiffusionProgressResponse
 * @property {number} progress Progress (from 0 to 1)
 * @property {number} eta_relative Estimated finish time
 * @property {?string} current_image Progress image
 */

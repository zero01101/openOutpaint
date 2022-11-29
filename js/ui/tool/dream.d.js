/**
 * Stable Diffusion Request
 *
 * @typedef StableDiffusionRequest
 * @property {string} prompt Stable Diffusion prompt
 * @property {string} negative_prompt Stable Diffusion negative prompt
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

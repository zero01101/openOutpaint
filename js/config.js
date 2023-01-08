/**
 * This is a file for static unchanging global configurations.
 *
 * Do NOT confuse with settings, which are modifiable by either the settings menu, or in the application itself.
 */
const config = makeReadOnly(
	{
		// Grid Size
		gridSize: 64,

		// Scroll Tick Limit (How much must scroll to reach next tick)
		wheelTickSize: 50,

		/** Select Tool */
		// Handle Draw Size
		handleDrawSize: 12,
		// Handle Draw Hover Scale
		handleDrawHoverScale: 1.3,
		// Handle Detect Size
		handleDetectSize: 20,
		// Rotate Handle Distance (from selection)
		rotateHandleDistance: 32,

		// Endpoint
		api: makeReadOnly({path: "/sdapi/v1/"}),
	},
	"config"
);

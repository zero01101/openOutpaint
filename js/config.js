/**
 * This is a file for static unchanging global configurations.
 *
 * Do NOT confuse with settings, which are modifiable by either the settings menu, or in the application itself.
 */
const config = makeReadOnly(
	{
		// Scroll Tick Limit (How much must scroll to reach next tick)
		wheelTickSize: 50,

		// Endpoint
		api: makeReadOnly({path: "/sdapi/v1/"}),
	},
	"config"
);

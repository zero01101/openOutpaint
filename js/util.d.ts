/**
 * Generates a random string in the following format:
 *
 * xxxx-xxxx-xxxx-...-xxxx
 *
 * @param size number of character quartets to generate
 * @return Generated ID
 */
declare function guid(size: number): string;

/**
 * Sets default values for options parameters
 *
 * @param options An object received as a parameter
 * @param defaults An object with default values for each expected key
 * @return The original options parameter
 */
declare function defaultOpt(
	options: {[key: string]: any},
	defaults: {[key: string]: any}
): {[key: string]: any};

/**
 * Sets default values for options parameters
 *
 * @param options An object received as a parameter
 * @param defaults An object with default values for each expected key
 * @return The original options parameter
 */
declare function makeReadOnly(
	options: {[key: string]: any},
	defaults: {[key: string]: any}
): {[key: string]: any};

/**
 * Makes an object read-only, throwing an exception when attempting to set
 *
 * @param obj Object to be proxied
 * @param name Name of the object, for logging purposes
 * @return The proxied object
 */
declare function makeReadOnly(obj: object, name?: string): object;

/**
 * Makes an object have each key be writeable only once, throwing an exception when
 * attempting to set an existing parameter
 *
 * @param obj Object to be proxied
 * @param name Name of the object, for logging purposes
 * @return The proxied object
 */
declare function makeWriteOnce(obj: object, name?: string): object;

/**
 * An object that represents an entry of the command in the history
 *
 * @typedef CommandEntry
 * @property {string} id A unique ID generated for this entry
 * @property {string} title The title passed to the command being run
 * @property {() => void | Promise<void>} undo A method to undo whatever the command did
 * @property {() => void | Promise<void>} redo A method to redo whatever undo did
 * @property {() => any | Promise<any>} export A method to export the command
 * @property {{[key: string]: any}} state The state of the current command instance
 * @property {{[key: string]: any}} extra Extra information saved with the command
 */

/**
 * Extra command information
 *
 * @typedef CommandExtraParams
 * @property {boolean} recordHistory The title passed to the command being run
 * @property {any} importData Data to restore the command from
 * @property {Record<string, any>} extra Extra information to be stored in the history entry
 */

/**
 * A command, which is run, then returns a CommandEntry object that can be used to manually undo/redo it
 *
 * @callback Command
 * @param {string} title The title passed to the command being run
 * @param {any} options A options object for the command
 * @param {CommandExtraParams} extra A options object for the command
 * @returns {Promise<CommandEntry>}
 */

/**
 * A method for running a command (or redoing it)
 *
 * @callback CommandDoCallback
 * @param {string} title The title passed to the command being run
 * @param {*} options A options object for the command
 * @param {{[key: string]: any}} state The state of the current command instance
 * @returns {void | Promise<void>}
 */

/**
 * A method for undoing a command
 *
 * @callback CommandUndoCallback
 * @param {string} title The title passed to the command when it was run
 * @param {{[key: string]: any}} state The state of the current command instance
 * @returns {void | Promise<void>}
 */

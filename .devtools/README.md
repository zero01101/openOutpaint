# openOutpaint DevTools

This is a folder containing some handy scripts to help developers to automate workflows and write code in openOutpaint's standards.
All scripts must be run from the root of the project.

## `sethooks.sh` script

This script will setup git hooks for this project. Hooks are mainly for cache busting purposes for now. It is recommended to run this script and setup hooks before any commits are made.

## `lint.sh` script

Uses `npm` to install prettier and lint javascript, html and css files according to `.prettierrc.json`. This script will install node modules locally, so editors with prettier support are recommended over this script.

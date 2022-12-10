# Contributing to OpenOutpaint

We love your input! We want to make contributing to this project as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## We Develop with Github

We use github to host code, to track issues and feature requests, as well as accept pull requests.

## We Use [Github Flow](https://guides.github.com/introduction/flow/index.html), So All Code Changes Happen Through Pull Requests

Pull requests are the best way to propose changes to the codebase (we use [Github Flow](https://guides.github.com/introduction/flow/index.html)). We actively welcome your pull requests:

1. Fork the repo and create your branch from `main` or `testing`.
2. Please add comments when reasonable, and when possible, use [JSDoc](https://jsdoc.app/) for documenting types. Lack of this will not prevent your pull being merged, but it would be nice to have.
3. If you've added code that should be tested please pull into `testing`. For documentation and smaller fixes, a pull request directly to `main` should be okay, unless it pertains to changes only present in `testing`.
4. Create a pull request with a short description of what you did. Thanks for your contribution!

## Any contributions you make will be under the MIT Software License

In short, when you submit code changes, your submissions are understood to be under the same [MIT License](http://choosealicense.com/licenses/mit/) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report bugs using Github's [issues](https://github.com/briandk/transcriptase-atom/issues)

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/zero01101/openOutpaint/issues); it's that easy!

## Write bug reports with detail, background, and sample code

If possible, bug reports should have the most detail it is reasonable to have for the bug in question. If you are more versed in javascript, pointing out the issue in code, or even creating a pull request is also appreciated!

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code or screenshots if you can!
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

We have some issue templates that are, admittedly, basically github's default templates. You can and should use that as a guide. Sometimes some fields may not be applicable to your particular report. In this case, things such as _alternative solutions_ don't need to be included.

People _love_ thorough bug reports. I'm not even kidding.

## Use a Consistent Coding Style

For styling, we are currently using prettier for linting. And that's basically it. We are currently using tabs and some other defaults defined in the [.prettierrc.json](https://github.com/zero01101/openOutpaint/blob/main/.prettierrc.json) file. We don't use npm on our project, so you would have to install prettier and prettier-eslint locally. We have a handy [lint.sh](https://github.com/zero01101/openOutpaint/blob/main/lint.sh) script you can run, but it is recommended to use an IDE with prettier support for more practical use.

Any suggestions regarding change of styles or style guides (Airbnb, Google, or whatnot) are welcome, as the current file is quite simplistic.

## License

By contributing, you agree that your contributions will be licensed under its MIT License.

## References

This document was adapted from the open-source contribution guidelines for [Facebook's Draft](https://github.com/facebook/draft-js/blob/a9316a723f9e918afde44dea68b5f9f39b7d9b00/CONTRIBUTING.md) and based on [this template from briandk](https://gist.github.com/briandk/3d2e8b3ec8daf5a27a62).

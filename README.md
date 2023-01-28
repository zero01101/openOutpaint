# hello there 🐠

[openOutpaint creating some undersea... well, stuff](https://user-images.githubusercontent.com/1649724/205455599-7817812e-5b50-4c96-807e-268b40fa2fd7.mp4)

_silly demo example current as of [9b174d6](https://github.com/zero01101/openOutpaint/commit/9b174d66c9b9d83ce8657128c97f917b473b13a9) / v0.0.8 / 2022-12-03_ //TODO UPDATE SRSLY

this is a completely vanilla javascript and html canvas outpainting convenience doodad built for the API optionally exposed by [AUTOMATIC1111's stable diffusion webUI](https://github.com/AUTOMATIC1111/stable-diffusion-webui), operating similarly to a few others that are probably more well-known. this simply offers an alternative for my following vain desires:

- avoiding the overhead of an additional virtual python environment or impacting a pre-existing one
- operates against the API exposed by A1111's webUI
- no external dependencies, extremely boring vanilla
- no external connectivity, self-hosted and offline
- unobfuscated (cough cough)
- <a name="terrible"></a>i am terrible at javascript and should probably correct that
- i have never used html canvas for anything before and should try it out

## features

- [now available as an extension for webUI!](https://github.com/zero01101/openOutpaint-webUI-extension) you can find it under the default "available" section in the webUI _extensions_ tab
  - **_NOTE: extension still requires `--api` flag in webui-user launch script_**
- intuitive, convenient outpainting - that's like the whole point right
- queueable, cancelable dreams - just start a'clickin' all over the place
- arbitrary dream reticle size - draw the rectangle of your dreams
- an [effectively infinite](https://github.com/zero01101/openOutpaint/pull/108), resizable, scalable canvas for you to paint all over
  - **_NOTE: v0.0.10 introduces a new "camera control" modifier key - hold [`CTRL`] and use the scrollwheel to zoom (scroll the wheel or use the two-finger vertical gesture on, uh, modern touchpads) and pan (hold the scrollwheel button, or if you don't have one, left-click button) around the canvas_**
- a very nicely functional and familiar layer system
- save, load, import, and export workspaces - includes all your layers, history, canvas size, you name it!
- inpainting/touchup mask brush
- prompt history panel
- optional (visibly) inverted mask mode - red masks get mutated, blue masks stay the same, but you can't take both pills at once
- inpainting color brush to bring out your inner vincent van bob ross
- dedicated img2img tool with optional border masking for enhanced output coherence with existing subject matter
- marquee select tool to select regions and arbitrarily scale, rotate, create stamps, move chunks, peek at lower layers, do all sorts of damage
- optionally decoupled cursor size and output resolution
- interrogate tool
- floating control panel to easily change models/samplers/steps/prompts/CFG/etc options for each dream summoned from the latent void _(NOTE: model switching requires A1111 webUI to be on commit [5a6387e](https://github.com/AUTOMATIC1111/stable-diffusion-webui/commit/5a6387e189dc365c47a7979b9040d5b6fdd7ba43) or more recent)_
- floating toolbox with handy keyboard shortcuts
- optional grid snapping for precision
- optional hi-res fix for blank/txt2img dreams
  - **_NOTE: as of v0.0.12.5/webUI commit [ef27a18](https://github.com/AUTOMATIC1111/stable-diffusion-webui/commit/ef27a18b6b7cb1a8eebdc9b2e88d25baf2c2414d), HRfix has been COMPLETELY reworked and no longer works remotely the same, thus openOutpaint's implementation is no longer compatible with versions of A1111 predating that. You will be alerted to the outdated webUI and the HRfix option will become limited to simply using [reticle dimensions / 2] in this event. Please see the [manual entry](https://github.com/zero01101/openOutpaint/wiki/Manual#hrfix) regarding HRfix and its available options._**
- optional overmasking for potentially better seams between outpaints - set overmask px value to 0 to disable the feature
- import arbitrary images and rotate/scale/stamp on the canvas whenever, wherever you'd like
- upscaler support for final output images
- saves your preferences/imported images to browser localstorage for maximum convenience
- reset to defaults button to unsave your preferences if things go squirrely
- floating navigable undo/redo palette with ctrl+z/y keyboard shortcuts for additional maximum convenience and desquirreliness
- optional generate-ahead function to keep crankin' out the dreams while you look through the ones that already exist
- _all this and much more for the low, low price of simply already owning an expensive GPU!_

## operation

**_NOTE: [PLEASE SEE DOCUMENTATION REGARDING NEW HRfix FEATURES](https://github.com/zero01101/openOutpaint/wiki/Manual#hrfix) IMPLEMENTED AS OF webUI COMMIT [ef27a18](https://github.com/AUTOMATIC1111/stable-diffusion-webui/commit/ef27a18b6b7cb1a8eebdc9b2e88d25baf2c2414d)_**

### prerequisities

you'll obviously need A1111's webUI installed before you can use this, thus you're presumed to have an operational python install up and running to boot.

A1111 webUI must be launched with the `--api` flag enabled, and the `--cors-allow-origins=` flag set with the host where openOutpaint will be running.

**_NOTE: the commandline flag `--gradio-debug` disables custom API routes and completely breaks openOutpaint. please remove it from your COMMANDLINE_ARGS before running openOutpaint._**

### surprising incompatibilities

**_COLAB USERS: you may experience issues installing openOutpaint (and other webUI extensions) - there is a workaround that has been discovered and tested against [TheLastBen's fast-stable-diffusion](https://github.com/TheLastBen/fast-stable-diffusion). Please see [this discussion](https://github.com/TheLastBen/fast-stable-diffusion/discussions/1161) containing the workaround, which requires adding a command into the final cell of the colab, as well as setting `Enable_API` to `True`._**

If anything goes wrong with openOutpaint, try running it on another browser and disable all extensions and try again. If a new incompatible extension is found, please open an issue so we can notify other users of extension incompatibilities.

- [microsoft editor extension for chrome/edge seems to disable the overmask slider](https://github.com/zero01101/openOutpaint/discussions/88#discussioncomment-4498341)
- ~~[duckduckgo privacy extension for firefox breaks outpainting, resulting in pure black output](https://github.com/zero01101/openOutpaint-webUI-extension/issues/3#issuecomment-1367694000) - add an exception for your openOutpaint host (likely localhost or 127.0.0.1)~~ should be fixed as of [b128943](https://github.com/zero01101/openOutpaint/commit/b128943f0c94970600fdc1c98bfec22de619866f)
- ~~[same for dark reader](https://github.com/zero01101/openOutpaint-webUI-extension/issues/3#issuecomment-1367838766)~~ same for dark reader

### quickstart speedrun

1. edit your `cors-allow-origins` to include https://zero01101.github.io and run webUI
2. go to https://zero01101.github.io/openOutpaint/ and fill in the host value with your webUI API address
3. click things and do stuff

### step-by-step actually useful instructions

please see the [quickstart wiki article](https://github.com/zero01101/openOutpaint/wiki/SBS-Guided-Example) and comprehensive [manual](https://github.com/zero01101/openOutpaint/wiki/Manual).

## pull requests/bug reports

please do! see [contributing](https://github.com/zero01101/openOutpaint/blob/main/CONTRIBUTING.md) for details!

## warranty

[lmao](https://github.com/moyix/fauxpilot#support-and-warranty)

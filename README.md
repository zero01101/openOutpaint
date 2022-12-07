# hello there 🐠

[openOutpaint creating some undersea... well, stuff](https://user-images.githubusercontent.com/1649724/205455599-7817812e-5b50-4c96-807e-268b40fa2fd7.mp4)

_silly demo example current as of [9b174d6](https://github.com/zero01101/openOutpaint/commit/9b174d66c9b9d83ce8657128c97f917b473b13a9) / v0.0.8 / 2022-12-03_

this is a completely vanilla javascript and html canvas outpainting convenience doodad built for the API optionally exposed by [AUTOMATIC1111's stable diffusion webUI](https://github.com/AUTOMATIC1111/stable-diffusion-webui), operating similarly to a few others that are probably more well-known. this simply offers an alternative for my following vain desires:

- avoiding the overhead of an additional virtual python evnironment or impacting a pre-existing one
- operates against the API exposed by A1111's webUI
- no external dependencies, extremely boring vanilla
- no external connectivity, self-hosted and offline
- unobfuscated (cough cough)
- <a name="terrible"></a>i am terrible at javascript and should probably correct that
- i have never used html canvas for anything before and should try it out

## features

- intuitive, convenient outpainting - that's like the whole point right
- a big ol' 2560x1440 scalable canvas for you to paint all over _(infinite canvas area planned, in //todo already)_
- a very nicely functional and familiar layer system
- inpainting/touchup mask brush
- optional (visibly) inverted mask mode - red masks get mutated, blue masks stay the same, but you can't take both pills at once
- inpainting color brush to bring out your inner vincent van bob ross
- dedicated img2img tool with optional border masking for enhanced output coherence with existing subject matter
- marquee select tool to select regions and arbitrarily scale, create stamps, move chunks, do all sorts of damage
- decoupled cursor size and output resolution
- interrogate tool
- floating control panel to easily change models/samplers/steps/prompts/CFG/etc options for each dream summoned from the latent void _(NOTE: model switching requires A1111 webUI to be on commit [5a6387e](https://github.com/AUTOMATIC1111/stable-diffusion-webui/commit/5a6387e189dc365c47a7979b9040d5b6fdd7ba43) or more recent)_
- floating toolbox with handy keyboard shortcuts
- optional grid snapping for precision
- optional hi-res fix for blank/txt2img dreams which, if enabled, uses image width/height / 2 as firstpass size
- optional overmasking for potentially better seams between outpaints - set overmask px value to 0 to disable the feature
- import arbitrary images and scale/stamp on the canvas whenever, wherever you'd like ([extra fun with transparent .pngs!](#arbitrary_transparent))
- upscaler support for final output images
- saves your preferences/imported images to browser localstorage for maximum convenience
- reset to defaults button to unsave your preferences if things go squirrely
- floating navigable undo/redo palette with ctrl+z/y keyboard shortcuts for additional maximum convenience and desquirreliness

## collaborator credits 👑

- [@seijihariki](https://github.com/seijihariki) - effectively (and mathematically) lead developer; [realtime slider value updates, gracious code cleanup](https://github.com/zero01101/openOutpaint/pull/14), [blessed undo/redo](https://github.com/zero01101/openOutpaint/pull/21), [even more wildly massive rework of loads of my miserable of JS holy crap](https://github.com/zero01101/openOutpaint/pull/22), [undo/redo keyboard shortcuts and keyboard input support](https://github.com/zero01101/openOutpaint/pull/30), [scrumptious photography-shoppe-style history palette](https://github.com/zero01101/openOutpaint/pull/31), [dedicated img2img tool/floating toolbar/general code modularization and future-proofing](https://github.com/zero01101/openOutpaint/pull/37), [enormous revamp to image importing, supports copy/pasting, scaling, multiple stampable images holy crap](https://github.com/zero01101/openOutpaint/pull/49), [mask inversion](https://github.com/zero01101/openOutpaint/pull/56), [jsdocs and extensibility](https://github.com/zero01101/openOutpaint/pull/58), [support for layers like your favorite image editor, beginnings of infinite canvas, UI/UX sugar](https://github.com/zero01101/openOutpaint/pull/60), [inpaint sketch tools that are so incredibly fun, stamp resource management and persistence, styles selector, server status indicator fanciness buff, decoupled dream/output resolution, error handling for dream failures](https://github.com/zero01101/openOutpaint/pull/64), [management of those aforementioned layers, tool UI visual spiffing, optional output smoothing](https://github.com/zero01101/openOutpaint/pull/67)
- [@Kalekki](https://github.com/Kalekki) - [what i was calling "smart crop"](https://github.com/zero01101/openOutpaint/pull/2), [localstorage](https://github.com/zero01101/openOutpaint/pull/5), [right-click erase](https://github.com/zero01101/openOutpaint/pull/7), [delightful floating UI](https://github.com/zero01101/openOutpaint/pull/11), [mask erase fix](https://github.com/zero01101/openOutpaint/pull/17), [checkerboard background and non bonkers canvas borders](https://github.com/zero01101/openOutpaint/pull/24), [upscaling output image](https://github.com/zero01101/openOutpaint/pull/35), [switch models from UI, API call to get samplers instead of hardcoded list haha whoops](https://github.com/zero01101/openOutpaint/pull/39)
- [@lifeh2o](https://www.reddit.com/user/lifeh2o/overview) - overmasking concept ([a](https://www.reddit.com/r/StableDiffusion/comments/ywf8np/i_made_a_completely_local_offline_opensource/iwl6s06/),[b](https://www.reddit.com/r/StableDiffusion/comments/ys9lhq/kollai_an_infinite_multiuser_canvas_running_on/ivzygwk/?context=3)) [implementation](https://github.com/zero01101/openOutpaint/commit/5600d360fbf78350ff1ced70a7d85f9a8624d2d0)
- [@jasonmhead](https://github.com/jasonmhead) - [the most minimal launch script](https://github.com/zero01101/openOutpaint/pull/1)

## operation

### prerequisities

you'll obviously need A1111's webUI installed before you can use this, thus you're presumed to have an operational python install up and running to boot.

### notes

- technically you can run it directly in browser as a bare `file://` protocol webpage but that's _really_ not recommended as you'll have to add `null` as an accepted domain to your `--cors-allow-origins` option which just seems like it's a visibly poor decision
- a deliciously simple launch script is included to pop up a teensy tiny python-based local webserver, however you may have to manually `chmod +x openOutpaint.sh` on mac/linux
- the address http://127.0.0.1:3456 will be used as the host address for openOutpaint in the below quickstart; your local setup may use a different IP address or port. you can of course modify the included launch script to point at a different port than 3456 if desired, as well
- if your resolution is > 512, try the "auto txt2img HR fix" option

### quickstart speedrun

1. edit your `cors-allow-origins` to include https://zero01101.github.io and run webUI
2. go to https://zero01101.github.io/openOutpaint/ and fill in the host value with your webUI API address
3. click things and do stuff

### quickstart normal edition

_keyboard shortcuts are listed as code blocks in brackets, i.e. enter/return is_ [`<CR>`]

1.  clone this repo to your homelab's webserver (i mean who doesn't have a couple of those lying around?) or somewhere on your local pc
2.  edit the `webui-user.sh` or `webui-user.bat` in your local A1111's webUI installation directory and set the `COMMANDLINE_ARGS` variable to contain ` --api --cors-allow-origins=http://127.0.0.1:3456`
3.  execute your webui-user script and wait for it to be ready
4.  **APPLY THE FOLLOWING SETTINGS IN A1111 WEBUI ONCE IT IS READY:**

- set your `Inpainting conditioning mask strength` to `1`
- disable the `Apply color correction to img2img results to match original colors.` option (those 2 options are found under the stable diffusion category in the settings tab by default unless you've already moved it to your quicksettings list, and if so, you know where to set them already)
- select an inpainting checkpoint/model - ([runwayml/stable-diffusion-inpainting](https://huggingface.co/runwayml/stable-diffusion-inpainting) [3e16efc8] is recommended) (**OR** you can select a model from openOutpaint's stable diffusion settings panel - it'll pop up an alert once the model has loaded)

5.  configure your local webhost in your homelab to serve the newly cloned repo like the technological bastion you are, or simply run the included `openOutpaint.bat` on windows or `openOutpaint.sh` on mac/linux.
6.  open your locally-hosted web server at http://127.0.0.1:3456 (or wherever, i'm not your boss)
7.  update the host field if necessary to point at your stable diffusion API address, change my stupid prompts with whatever you want, click somewhere in the canvas using the dream [`d`] tool, and wait (**OR** you can load as many existing images from your computer as you'd like using the "stamp image" tool [`U`]). If you've requested a batch of generated images and one of them sparks you as something you might want to use later, you can click the "res" button to add the image to the stampable dream resources as well. _(NOTE: you can select or deselect imported images/added resources freely simply by clicking on them)_
8.  once an image appears\*, click the `<` [`←`] and `>` [`→`] buttons at the bottom-left corner of the image to cycle through the others in the batch if you requested multiple (it defaults to 2 batch size, 2 batch count) - click `y` [`<CR>`] to choose one you like, or `n` [`<ESC>`] to cancel that image generation batch outright, or press `+` [`+`] to generate another batch and add them to the options. you can also click `r` to save a specific image as a stampable resource.
9.  now that you've got a starter, click somewhere near it to outpaint - try and include as much of the "context" as possible in the reticle for the best result convergence, or you can right-click to remove some of it if you want to completely retry a chunk but leave the rest alone. you can also add a new layer and outpaint directly onto that - it will sample any existing layers automatically
10. select the mask tool [`m`] to prepare previously rendered imagery for touchups/inpainting, then paint over the objectionable region; once your masked region is drawn, select the txt2img dream tool and change your prompt if necessary, then click over the canvas containing the mask you just painted to request the refined image(s)
11. choose the img2img tool and write a new prompt and click over a section of your image to mutate the contents to your tastes, or try leaving the prompt blank and see what kind of "alternatives" are summoned
12. _(it's recommended to do this on a new layer)_ try drawing something with the color brush [`c`] and change your prompt to reflect what you've created, choose img2img tool and ensure "invert mask" is **not** enabled, and click over your masterpiece to (hopefully) magically transform it into your request
13. just play around with the available options!

- hold CTRL and scroll the mousewheel to zoom in/out
- scroll the mousewheel with the color and mask brushes to change the brush size
- scroll the mousewheel with the dream and img2img tools to change the cursor size (this does _not_ change the SD resolution)
- snap to grid, uh, snaps to the grid
- auto txt2img hrfix applies A1111's option of the same name but uses `resolution / 2` as firstpass dimensions, and is really only applicable to resolutions above 512 for SD1.x models, but feel free to turn it on for lower values i guess
- select image [`s`] is a marquee selector, use it to define a section of image you'd like to turn into a stamp resource or freely scale or move somewhere else
- mask brush [`m`] is practically identical to A1111's inpainting mask
- color brush [`c`] is for drawing pretty pictures for feeding into img2img, change the color with the giant color button at the bottom of the context menu
- overmask and related px value expands the area masked in outpaint requests, so as to attempt to minimize the seam between images
- border mask (applicable only to img2img tool [`i`]) and related value compresses the area masked in img2img towards the image section being "replaced" to maximize possible coherence
- interrogate tool [`n`] asks what CLIP thinks is in the bounding box you just clicked on
- layers are very similar to how they operate in any traditional image editor fancier than mspaint - feel free to rearrange them, delete them, merge them down
- ...everything else is pretty much just a regular stable diffusion option so i presume you know how you use those

14. open the "save/upscaling" menu and click "save canvas" (or choose an upscaler and click "upscale", but heed its warning) to save the cropped region of outpainted canvas
15. click "clear canvas" to blank the canvas and start all over only to discover that it's like 2 AM and you have to go to sleep because you have work in about 4 hours

\*if it _doesn't_ create an image, check your console output to see if you've got CORS errors

## //todo

### in order of "priority"/likelihood of me doing it

- [ ] lots and lots of readme updates (ongoing)
- [ ] comment basically everything that isn't self documenting (ongoing)
- [ ] CHORE: refactor all the duplicated JS code (ongoing, guaranteed to get worse before it gets better)
- [x] move overmask px control to base context menu
- [x] ~~keyboard shortcuts for approve/reject (<>YN) [a mighty convenient workaround to prevent soft-lock if approve/reject controls are offscreen]~~
- [x] make it so approve/reject controls cannot live offscreen, they must stay here
- [x] overmask seam of img2img ~~BUG: it kinda sucks currently, just moves the seam instead of fixing it, i want to try to gradient-fade the edge but filter = 'blur(Ypx)' is awful for this and my remedial per-pixel loops crash the browser because i am the embodiment of inefficiency~~
- [x] split out CSS to its own file (remedial cleanup task)
- [x] ability to blank/new canvas without making the user refresh the page because that's pretty janky
- [x] ~~add error handling for async/XHR POST in case of, yknow, errors~~
- [x] image erase region in case you decide later that you're not too happy with earlier results (technically i guess you could just mask over the entire region you dislike but that's... bad)
- [ ] controls for the rest of API-available options (e.g. ~~hires fix~~, inpaint fill modes, etc)
- [x] ~~save user-set option values to browser localstorage to persist your preferred, uh, preferences~~
- [x] render progress spinner/bar
- [x] ~~make render progress bar prettier~~
- [x] ~~smart crop downloaded image~~
- [x] import external image and ~~scale/~~ superimpose at will on canvas for in/outpainting
- [x] ~~scaling of imported arbitrary image before superimposition~~
- [ ] "numpad" selector for determining how reticle is anchored against actual mouse cursor (currently works like a "5" [center] on the "numpad" paradigm) // is this even useful? sounds more like a solution in search of a problem
- [ ] ~~discrete size control for mask and target reticle~~, discrete x/y axes for reticle
- [x] ~~floating/togglable menu leftnav bar with categorized/sensibly laid-out options~~
- [ ] infinite canvas
- [x] ~~global undo/redo~~
- [x] ~~inpainting sketch tools~~
- [ ] split out JS to separation-of-concerns individual files (oh no)
- [x] ~~something actually similar to a "user interface", preferably visually pleasant and would make my mom say "well that makes sense" if she looked at it~~
- [x] ~~eventually delete the generated mask display canvases at the bottom of the page, but they're useful for debugging canvas pixel offsets sometimes~~
- [ ] see if i can use fewer canvases overall; seems wasteful, canvas isn't free yknow
- [x] upscaling output canvas??? sure let's make 16k wallpapers that'll be neat
- [ ] honestly probably refactor literally everything

## pull requests

**PLEASE SEND PULL REQUESTS**  
i am begging you, yes you personally reading this, please fix my horrible code and feel free to insult it, but i absolutely refuse to budge on no 3rd party libraries or dependencies, not even jquery, nothing. vanilla is a very complex and layered flavor if you give it a chance.

## bug reports

please do! kindly indicate your OS, browser, versions of both, any errors in devtools/console output, what you were trying to do, what you expected, what happened unexpectedly or incorrectly, if something caught fire (please call the fire department first), the usual

## known bugs :(

- generated images display +1px on x/y during approve/reject state, doesn't affect output, just annoying - less obvious now with checkerboard background
- ~~erase mask is like entirely broken~~
- ~~odd-numbered scale factors don't snap correctly~~
- ~~arbitrary "pasted" images require clicking twice to place them and i _don't know why_ [(yes i do)](#terrible), just getting them to be arbitrarily placable was a giant pain because i'm not got the smarts~~
- ~~selecting an aribtrary image by double-clicking it in the file picker can sometimes trigger a dream request that errors out if your file picker is "above" the canvas; i tried to alleviate that by temporarily removing the mouse(move/down/up) handlers for the canvas context on selection of a file, but i'm POSITIVE it's an improper solution and not quite sure if it's even fully effective~~ [fixed via pr 49](<(https://github.com/zero01101/openOutpaint/pull/49)>)
- not sure if "bug" since it occurs in stable diffusion and not openOutpaint, but auto txt2img HRfix + odd number scale factors returns an "Exception in ASGI application" in SD console output; for example using scale factor of 9 results in "RuntimeError: Sizes of tensors must match except in dimension 1. Expected size 10 but got size 9 for tensor number 1 in the list."
- similarly, seems to be an issue with stable diffusion more than anything, but if GPU memory becomes too scarce, the 3d rendering hardware starts to spike to 100% if you're looking at the tab (happens in both openOutpaint OR A1111 webUI, happens if image generation is occurring in background and i'm watching youtube, etc) - this manifests as the seconds remaining counter increasing around 100 seconds each time it's checked while completion percentage stays unchanged. simply opening an empty new tab usually kicks some sense back into things in my experience but your mileage may vary
- ~~if you request a dream beyond the left border of the canvas you can kinda end up in a softlock state~~
- not exactly a bug but kind of a gotcha; if you undo a color brush sketch that was made with the affect mask option enabled, the mask persists - masks aren't a history item, so you'll need to remove it manually - this doesn't happen if you manually erase the sketch however, so making the sketch on its own layer prevents erasure from affecting the original dreamed image. tl;dr masks don't undo, paint does

## warranty

[lmao](https://github.com/moyix/fauxpilot#support-and-warranty)

## samples

generated using 100% openOutpaint UI defaults except for switching to/from mask mode and changing scale factor to adjust the size of the mask blob, there's some neat stuff down there even if it disregarded the `people, humans, divers` negative prompt but in its defense there is only one singular person, human, diver in there, so according to the no homers club treatise of 1995 it's technically correct

_(see https://github.com/zero01101/openOutpaint/commit/92ab9d231542ea5f7a3c85563acf5cd3cb16a928 for attempted counterattack)_
![fishies n stuff](docs/02-sample.png)

<a name="arbitrary_transparent"></a>simple transparent PNGs slapped on the canvas twice and default UI settings used on the southern half

![imported images that have been _changed_](docs/03-arbimg.png)

imported a transparent clip of a [relatively famous happy lil kitty](https://commons.wikimedia.org/wiki/File:So_happy_smiling_cat.jpg), used default openOutpaint settings except changing the prompt to "a cat on a space station", eventually received this magnificent vision

![many cats on a space station](docs/04-catsonaspacestation.png)

requested "a desert" and drew Fine Art on top of it, then requested "a cabin" and unleashed the img2img tool with invert mask disabled:

![suddenly a nice place to have a quiet vacation](docs/06-desert.png)

## version history

- 0.0.1 - txt2img proof of concept
- 0.0.2 - img2img outpainting proof of concept
- 0.0.3 - image masking/img2img inpainting proof of concept
- 0.0.4 - batch size/batch count, approve/reject system implementations, snap-to-grid, other people are now allowed to see this thing [01f8c6a](https://github.com/zero01101/openOutpaint/commit/01f8c6ab3f49739439a0990d6f5f0967a9a0bf12)
- 0.0.4.1 - extremely minor revisions [02cb01a](https://github.com/zero01101/openOutpaint/commit/02cb01ac062ef93878ff4161eabcedfa8e125be6)
- 0.0.4.2 - pull requests (&lt;3), downloaded images now have a timestamped name, css breakout because hopefully this will become halfway attractive enough to benefit from non-inline stylesheets [70ad4fe](https://github.com/zero01101/openOutpaint/commit/70ad4fe081bdbd507afc5af3cc2a4435924b66e3)
- 0.0.4.3 - overmasking, settings saved to localstorage [fca2e01](https://github.com/zero01101/openOutpaint/commit/fca2e01b8a4ecfe3d062c4090d5886e1033e8f38)
- 0.0.5 - import arbitrary image from user's machine, "auto" txt2img hires fix, Very Important "new image" button [3b7f4e3](https://github.com/zero01101/openOutpaint/commit/3b7f4e3759d0d1f3b38eba7249e5b58bc8162c75)
- 0.0.5.1 - erase rendered imagery with right click, ensure webUI is running [54577d4](https://github.com/zero01101/openOutpaint/commit/54577d4f15fd7d014aaf2471e0042b3c48735e9c)
- 0.0.5.5 - highly attractive and functional floating control panel which will be extremely useful for infinite canvas [dac188d](https://github.com/zero01101/openOutpaint/commit/dac188dbfb086d3063f14b1a6a6a5b3add1aa5f5)
- 0.0.5.6 - _FINALLY_ the sliders update their values in realtime, a nice overall start on cleaning up my mess [d9fb87a](https://github.com/zero01101/openOutpaint/commit/d9fb87acec6653f19a9dac7777bd866782303ebc)
- 0.0.5.7 - the majestic return of mask erasing, removed unnecessary overmask toggle [a96fd11](https://github.com/zero01101/openOutpaint/commit/a96fd116d750e38ce8982104ae5e5c966746fdc4)
- 0.0.6 - absolutely brilliant undo/redo system, logical and straightforward enough to the point where even i can understand what it's doing [25681b3](https://github.com/zero01101/openOutpaint/commit/25681b3a83bbd7a1d1b3e675f26f141692d77c79)
- 0.0.6.1 - finally think i've got overmasking working better with a bit of "humanization" to the automated masks, please play around with it and see if it's any better or just sucks in general [8002772](https://github.com/zero01101/openOutpaint/commit/8002772ee6aa4b2f5b544af82cb6d545cf81368f)
- 0.0.6.5 - checkerboard background, far more attractive painted masking, HUGE code cleanup omg [74d5f13](https://github.com/zero01101/openOutpaint/commit/74d5f13aa582695e3e359ad46f7e629a25fb0091)
- 0.0.6.9 - upscaler support for final output image [3b91a89](https://github.com/zero01101/openOutpaint/commit/3b91a89214e22930ad75fdc2d9e6e79a5f40ee82)
- 0.0.7 - floating toolbar, img2img tool, border masking, change model from UI, general _very needed_ code cleanup and modernization [9916ee8](https://github.com/zero01101/openOutpaint/commit/9916ee891738a56cb827e67f9fbe0cffab27fc60)
- 0.0.7.5 - giant arbitary image handling and marquee select tool update [bbdfef9](https://github.com/zero01101/openOutpaint/commit/bbdfef937d28f607b601013c75de0f9049739488)
- 0.0.8 - inpaint color brush, stamp resource management, error handling, style selector, big ol' QOL shine [9b174d6](https://github.com/zero01101/openOutpaint/commit/9b174d66c9b9d83ce8657128c97f917b473b13a9)
- 0.0.8.1 - interrogate tool [083f481](https://github.com/zero01101/openOutpaint/commit/083f481e17e0d63baddae3a735412e622119b640)
- 0.0.9 - layer functionality and management, tool spitshine, interrogate tool [de05a1e](https://github.com/zero01101/openOutpaint/commit/de05a1ecbac2e527ed9cf65c966542da0a8bed7a)

## hey what's with the fish

deep aquatic life is _fascinating_ so i went with something underwater for a default prompt which led to making an _"illustration of a bright orange fish, plain blue solid background"_ favicon which led to "ok then, fish is mascot"

![fullres fishy favicon](docs/05-openOutpaintFish.png)

~~the end~~ _𝒻𝒾𝓃_ 🐠

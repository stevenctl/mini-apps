# mini-apps

I really love local-first software. Local-only software is even better. Even
though these apps can be accessed online via github pages, you can run them
locally with minimal or no setup. The data backing them should load very very
fast.

The code is 70-90% AI generated. I just had some stuff that I wanted to use
and iterating on this with Claude Code was a fun thing to do while I waited
for my actual work/projects to compile, run tests, etc.

I really love the idea of [ generative UI
](https://research.google/blog/generative-ui-a-rich-custom-visual-interactive-user-experience-for-any-prompt/),
but I think the on-demand stuff isn't going to be very pleasant to use most of
the time. Theres a reason a lot of designers are not the programmers, and even
programmers who are designers don't one-shot it on their first implementation
of the app, going straight to writing code.

Eventually, I'd like to have a more sophisticated approach to building these
apps. There should be some kind of shared component library, and maybe some
standards so styling can be adjusted while re-using those building blocks. This
[blog post by tambo](https://tambo.co/blog/posts/what-is-generative-ui) touches
on that a bit. The "on-demand" UIs would be much more pleasant if the
components they're built from where designed and iterated by huamans
(regardless of LLM assistance in implementation).

Even without on-demand generation, having building blocks would probably speed
up the iteration process, but I wanted to see how well things worked with zero
dependencies or build step.

Data is the source of truth, and the UI organizes itself around that.


### weidu reader

This one is an RSS feed aggregator. It just lists articles and caches the XMLs
in local storage. It's fully UI-driven, no textual config for now.
Unfortuantely, because it uses ECMAScript, you can't just `file://` open it in
a browser, you need run a webserver of some kind (e.g. `python3 -m
http.server`).

Also, because of CORS, some feeds may not work unless you enable the CORS proxy
option for that feed. The proxy is a public one, so use at your own risk.

### TODO App

Everyon's first starter project, right? This was made out of necessity
actually. I wanted a kanban board, but I wanted the info to be stored in text
files, and wanted persistence to live in git. I already did this with my text
editor and a few folders. As the side project grew, I wanted a visualizaiton
and easy way to filter without just grep. Honestly, I might just make a TUI,
Neovim plugin or CLI down the line.

The app opens a folder (and has write access!) and it assumes your tasks are
markdown files sorted into arbitrarily named directories. Each markdown file
has some specific frontmatter that the app uses to display and filter stuff:

```markdown
---
title: 'Auth Screen avoid Overflow'
priority: 0
category: Bug
size: S
tags: [UI Jank, Flutter]
---

On the auth screen, pulling up the on screen keyboard
causes the login/sign-up buttons to be obscured.

```

I'd love to add vim bindings to the in-browser editor. Tbh, I almost never
write the body by hand. Just a title and maybe paste some notes or links
or an error message.

This one _does_ work with just `file://` as it's plain HTML/JS/CSS.

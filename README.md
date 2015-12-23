# Advanced Filter File

This is a fork of advanced-open-file that is meant to be a
<kbd>Cmd</kbd>+<kbd>P</kbd> replacement for enormous repositories. Although it
works on any project with a project root, it has been tailored to work with
sandboxes at The MathWorks.

It works by running `find` and invoking `fuzzaldrinPlus` on the result.

## Usage

Just open your favorite project and <kbd>Cmd</kbd>+<kbd>P</kbd> away! Currently
filters for C/C++ source and headers (will make this configurable in the
future).

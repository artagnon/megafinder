"use babel";

import fs from 'fs';
import stdPath from 'path';

import mkdirp from 'mkdirp';
import touch from 'touch';

import {DEFAULT_ACTIVE_FILE_DIR, DEFAULT_PROJECT_ROOT} from './config';
import {
    absolutify,
    cachedProperty,
    defineImmutable,
    getProjectPath,
    preferredSeparatorFor
} from './utils';

import {BufferedProcess} from 'atom';
import fuzzaldrin from 'fuzzaldrin';

export let fuzzyMatcher = {
    match(path, filenames) {
        atom.notifications.addInfo(`${path.fragment}::${filenames[0]}`);
        if (path.fragment) {
            filenames = fuzzaldrin.filter(filenames, path.fragment);
        }
        return filenames.map((filename) => new Path(filename));
    },
}

/**
 * Wrapper for dealing with filesystem paths.
 */
export class Path {
    constructor(path = '') {
        // The last path segment is the "fragment". Paths that end in a
        // separator have a blank fragment.
        let sep = preferredSeparatorFor(path);
        let parts = path.split(sep);
        let fragment = parts[parts.length - 1];
        let directory = path.substring(0, path.length - fragment.length);
        let lastSpawnedProcess = null;

        // Set non-writable properties.
        defineImmutable(this, 'directory', directory);
        defineImmutable(this, 'fragment', fragment);
        defineImmutable(this, 'full', path);
        defineImmutable(this, 'sep', sep);
    }

    @cachedProperty
    get absolute() {
        return absolutify(this.full);
    }

    @cachedProperty
    get stat() {
        try {
            return fs.statSync(this.absolute);
        } catch (err) {
            return null;
        }
    }

    isDirectory() {
        return this.stat ? this.stat.isDirectory() : null;
    }

    isFile() {
        return this.stat ? !this.stat.isDirectory() : null;
    }

    isProjectDirectory() {
        return atom.project.getPaths().indexOf(this.absolute) !== -1;
    }

    isRoot() {
        return stdPath.dirname(this.absolute) === this.absolute;
    }

    hasCaseSensitiveFragment() {
        return this.fragment !== '' && this.fragment !== this.fragment.toLowerCase();
    }

    exists() {
        return this.stat !== null;
    }

    asDirectory() {
        return new Path(this.full + (this.fragment ? this.sep : ''));
    }

    parent() {
        if (this.isRoot()) {
            return this;
        } else if (this.fragment) {
            return new Path(this.directory);
        } else {
            return new Path(stdPath.dirname(this.directory) + this.sep);
        }
    }

    /**
     * Return path for the root directory for the drive this path is on.
     */
    root() {
        let last = null;
        let current = this.absolute;
        while (current !== last) {
            last = current;
            current = stdPath.dirname(current);
        }

        return new Path(current);
    }

    /**
     * Create an empty file at the given path if it doesn't already exist.
     */
    createFile() {
        touch.sync(this.absolute);
    }

    /**
     * Create directories for the file this path points to, or do nothing
     * if they already exist.
     */
    createDirectories() {
        try {
            mkdirp.sync(absolutify(this.directory));
        } catch (err) {
            if (err.code !== 'ENOENT') {
                throw err;
            }
        }
    }

    directoryFilenames() {
        return new Promise(function(resolve, reject) {
            let dirName = getProjectPath();
            let stdoutOutput = "";
            let stderrOutput = "";
            if (dirName == null) {
              return resolve([]);
            }
            let parameters = {
              command: "find",
              args: [dirName, "-name", "*.cpp", "-or", "-name", "*.hpp",
              "-or", "-name", "*.c", "-or", "-name", "*.h"],
              stdout: function(output) {
                  stdoutOutput = output;
              },
              stderr: function(output) {
                  stderrOutput = output;
              },
              exit: function(status) {
                if (status == 1) {
                    atom.notifications.addError("find returned non-zero");
                    atom.notifications.addInfo(`stdErr: ${stderrOutput}`)
                    resolve([]);
                } else if (stdoutOutput.indexOf("\n") < 0) {
                    resolve([stdoutOutput]);
                } else {
                    resolve(stdoutOutput.match(/[^\r\n]+/g));
                }
              }
            };
            if (this.lastSpawnedProcess) {
              this.lastSpawnedProcess.kill();
            }
            this.lastSpawnedProcess = new BufferedProcess(parameters);
            this.lastSpawnedProcess.onWillThrowError(function({error, handle}) {
              atom.notifications.addError("BufferedProcess died unexpectedly");
              reject(error);
            });
        });
    }

    matchingPaths() {
      return this.directoryFilenames().then(function(fileArray) {
        return fuzzyMatcher.match(this, fileArray);
      });
    }

    equals(otherPath) {
        return this.full === otherPath.full;
    }

    /**
     * Return the path to show initially in the path input.
     */
    static initial() {
        switch (atom.config.get('advanced-filter-file.defaultInputValue')) {
            case DEFAULT_ACTIVE_FILE_DIR:
                let editor = atom.workspace.getActiveTextEditor();
                if (editor && editor.getPath()) {
                    return new Path(stdPath.dirname(editor.getPath()) + stdPath.sep);
                }
                break;
            case DEFAULT_PROJECT_ROOT:
                let projectPath = getProjectPath();
                if (projectPath) {
                    return new Path(projectPath + stdPath.sep);
                }
                break;
        }

        return new Path('');
    }

    /**
     * Compare two paths lexicographically.
     */
    static compare(path1, path2) {
        return path1.full.localeCompare(path2.full);
    }
}

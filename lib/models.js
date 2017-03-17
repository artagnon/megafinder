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
    defineMutable,
    getProjectPath,
    preferredSeparatorFor
} from './utils';

import {BufferedProcess} from 'atom';
import fuzzaldrin from 'fuzzaldrin-plus';

export let fuzzyMatcher = {
    match(pattern, filenames) {
        if (!pattern) {
            return filenames.map(n => new Path(n));
        }
        if (filenames.length/pattern.length > 1500) {
            // fuzzaldrin cannot handle tiny strings on massive results
            filenames = filenames.filter(
                n => fuzzyMatcher.matchFragment(n, pattern));
            filenames = filenames.sort(fuzzyMatcher.lengthCompare);
        } else {
            filenames = filenames.map(n => n.slice(getProjectPath().length + 1));
            filenames = fuzzaldrin.filter(filenames, pattern);
            filenames = filenames.map(n => getProjectPath() + '/' + n);
        }
        return filenames.map(n => new Path(n));
    },
    matchFragment(filename, pattern) {
        filename = filename.slice(getProjectPath().length + 1);
        filename = filename.toLowerCase();
        pattern = pattern.toLowerCase();
        return filename.startsWith(pattern);
    },
    lengthCompare(path1, path2) {
        path1.length < path2.length;
    }
}

/**
 * The workhorse
 */
export class Finder {
    constructor() {
        this.projectPath = getProjectPath();
        var sep = preferredSeparatorFor(this.projectPath);
        this.dirNarrowing = [this.projectPath];
        var configStr = 'megafinder.patternNarrowing';
        var patternNarrowing = atom.config.get(configStr).split(' ');
        var mwAnchor = new Path(this.projectPath + sep + 'mw_anchor');
        if (mwAnchor.exists()) {
            configStr = 'megafinder.MWspecifics.dirNarrowing';
            this.dirNarrowing = atom.config.get(configStr).split(' ');
            this.dirNarrowing = this.dirNarrowing.map((name) => this.projectPath + sep + name);
            configStr = 'megafinder.MWspecifics.patternNarrowing';
            this.patternNarrowing = atom.config.get(configStr).split(' ');
        }
        this.stdoutOutput = '';
        this.stderrOutput = '';
        this.patternNarrowing0 = ['-name', patternNarrowing[0]];
        patternNarrowing.slice(1).map(
                pat => this.patternNarrowing0 =
                  this.patternNarrowing0.concat(['-or', '-name', pat]));
    }

    filenames() {
        var that = this;
        return new Promise((resolve, reject) => {
            if (that.projectPath == null) {
                atom.notifications.addError("null projectPath");
                return resolve([]);
            }
            let parameters = {
              command: 'find',
              args: that.dirNarrowing
                .concat(['-type', 'f'])
                .concat(that.patternNarrowing0),
              stdout: function(output) {
                  that.stdoutOutput += output;
              },
              stderr: function(output) {
                  that.stderrOutput += output;
              },
              exit: function(status) {
                if (status == 1) {
                    atom.notifications.addError("find returned non-zero");
                    atom.notifications.addInfo(`stdErr: ${that.stderrOutput}`)
                    reject(that.stdoutOutput);
                } else {
                    that.stdoutOutput = that.stdoutOutput.match(/[^\r\n]+/g);
                    resolve(that.stdoutOutput);
                }
              }
            };
            let pro = new BufferedProcess(parameters);
            pro.onWillThrowError(function({error, handle}) {
              atom.notifications.addError("BufferedProcess died unexpectedly");
              reject(error);
            });
        });
    }
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

    matchingPaths() {
        let finder = new Finder(this.sep);
        return finder.filenames().then(fileArray => {
            return fuzzyMatcher.match(this.fragment, fileArray);
        });
    }

    equals(otherPath) {
        return this.full === otherPath.full;
    }

    /**
     * Compare two paths lexicographically.
     */
    static compare(path1, path2) {
        return path1.full.localeCompare(path2.full);
    }
}

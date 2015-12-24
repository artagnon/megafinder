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
        return new Promise((resolve, reject) => {
            let projectPath = getProjectPath();
            let dirNarrowing = [projectPath];
            let patternNarrowing = atom.config.get('megafinder.patternNarrowing').split(' ');
            let battreePath = new Path(projectPath + this.sep + 'battree');
            if (battreePath.exists()) {
                configStr = 'megafinder.MWspecifics.dirNarrowing';
                dirNarrowing = atom.config.get(configStr).split(' ');
                dirNarrowing = dirNarrowing.map((name) => projectPath + this.sep + name);
                configStr = 'megafinder.MWspecifics.MWpatternNarrowing';
                patternNarrowing = atom.config.get(configStr).split(' ');
            }
            let stdoutOutput = "";
            let stderrOutput = "";
            if (projectPath == null) {
              return resolve([]);
            }
            patternNarrowing = ['-name', patternNarrowing[0]].concat(
                patternNarrowing.slice(1).map(pat => ['-or', '-name', pat]));
            let parameters = {
              command: "find",
              args: dirNarrowing
                .concat(['-type', 'f'])
                .concat(patternNarrowing),
              stdout: function(output) {
                  stdoutOutput += output;
              },
              stderr: function(output) {
                  stderrOutput += output;
              },
              exit: function(status) {
                if (status == 1) {
                    atom.notifications.addError("find returned non-zero");
                    atom.notifications.addInfo(`stdErr: ${stderrOutput}`)
                    resolve([]);
                } else {
                    let items = stdoutOutput.match(/[^\r\n]+/g);
                    resolve(items);
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
        return this.directoryFilenames().then(fileArray => {
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

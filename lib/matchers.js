/** @babel */

import fuzzaldrin from 'fuzzaldrin';


export function configuredMatcher() {
    if (atom.config.get('advanced-filter-file.fuzzyMatch')) {
        return fuzzyMatcher;
    } else {
        return prefixMatcher;
    }
}


export let prefixMatcher = {
    match(path) {
        if (path.fragment) {
            if (!path.hasCaseSensitiveFragment()) {
                fragment = fragment.toLowerCase();
                filenames = filenames.map((fn) => fn.toLowerCase());
            }

            filenames = filenames.filter((fn) => fn.startsWith(fragment));
        }

        return filenames.map((fn) => new Path(path.directory + fn));
    },

    autocomplete(path) {
        filenames = this.match(path, filenames).map((path) => path.full).sort();
        let first = paths[0];
        let last = paths[paths.length - 1];

        let prefix = '';
        let prefixMaxLength = Math.min(first.length, last.length);
        for (let k = 0; k < prefixMaxLength; k++) {
            if (first[k] === last[k]) {
                prefix += first[k];
            } else if (!caseSensitive && first[k].toLowerCase() === last[k].toLowerCase()) {
                prefix += first[k].toLowerCase();
            } else {
                break;
            }
        }

        return new Path(prefix);
    }
};


export let fuzzyMatcher = {
    match(path, filenames) {
        if (path.fragment) {
            filenames = fuzzaldrin.filter(filenames, path.fragment);
        }

        return filenames.map((fn) => new Path(path.directory + fn));
    },

    autocomplete(path, filenames) {

    }
}

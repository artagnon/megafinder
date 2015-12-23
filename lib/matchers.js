"use babel";

import fuzzaldrin from 'fuzzaldrin';
import Path from './models'

export function configuredMatcher() {
    return fuzzyMatcher;
}

export let fuzzyMatcher = {
    match(path, filenames) {
        if (path.fragment) {
            filenames = fuzzaldrin.filter(filenames, path.fragment);
        }
        return filenames.map((fn) => new Path(fn));
    },

    autocomplete(path, filenames) {
    }
}

"use babel";

export const DEFAULT_ACTIVE_FILE_DIR = 'Active file\'s directory';
export const DEFAULT_PROJECT_ROOT = 'Project root';
export const DEFAULT_EMPTY = 'Empty';


export let config = {
    patternNarrowing: {
        title: 'Pattern narrowing',
        description: 'What kind of files should I narrow my search to?',
        type: 'string',
        default: '*'
    },
    MWspecifics: {
        title: 'MathWorks-specific settings',
        type: 'object',
        properties: {
            patternNarrowing: {
                title: 'Pattern narrowing for The MathWorks codebase',
                description: 'What kind of files should I narrow my search to?',
                type: 'string',
                default: '*.cpp *.hpp *.c *.h'
            },
            dirNarrowing: {
                title: 'Directory narrowing for The MathWorks codebase',
                description: 'What paths should I search in within your sandbox?',
                type: 'string',
                default: ['matlab/src/cg_ir', 'matlab/src/cgir_xform',
                'matlab/src/cgir_support', 'matlab/src/cgir_cgel',
                'matlab/src/cgir_vm', 'matlab/src/cgir_vm_rt',
                'matlab/src/emlcoder'].join(' ')
            }
        }
    }
};

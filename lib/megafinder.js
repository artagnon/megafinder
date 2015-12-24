"use babel";

import {MegafindFilterFileController, emitter} from './controller';


// Instance of the controller, constructed on activation.
let controller = null

export {config} from './config';

export function activate(state) {
    controller = new MegafindFilterFileController();
}

export function deactivate() {
    controller.detach();
}

/**
 * Provide a service object allowing other packages to subscribe to our
 * events.
 */
export function provideEventService() {
    return {
        onDidOpenPath(callback) {
            return emitter.on('did-open-path', callback);
        },

        onDidCreatePath(callback) {
            return emitter.on('did-create-path', callback);
        },
    };
}

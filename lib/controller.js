"use babel";

import stdPath from 'path';

import {Emitter} from 'event-kit';
import osenv from 'osenv';

import MegafindView from './view';
import {Path} from './models';
import {getProjectPath} from './utils';


// Emitter for outside packages to subscribe to. Subscription functions
// are exponsed in ./megafinder
export let emitter = new Emitter();


export class MegafindController {
    constructor() {
        this.view = new MegafindView();
        this.panel = null;

        this.currentPath = null;
        this.pathHistory = [];

        atom.commands.add('atom-workspace', {
            'megafinder:toggle': ::this.toggle
        });
        atom.commands.add('.megafinder', {
            'core:confirm': ::this.confirm,
            'core:cancel': ::this.detach,
            'application:add-project-folder': ::this.addSelectedProjectFolder,
            'megafinder:autocomplete': ::this.autocomplete,
            'megafinder:undo': ::this.undo,
            'megafinder:move-cursor-down': ::this.moveCursorDown,
            'megafinder:move-cursor-up': ::this.moveCursorUp,
            'megafinder:confirm-selected-or-first': ::this.confirmSelectedOrFirst,
            'megafinder:delete-path-component': ::this.deletePathComponent,
        });

        this.view.onDidClickFile(::this.clickFile);
        this.view.onDidClickAddProjectFolder(::this.addProjectFolder);
        this.view.onDidClickOutside(::this.detach);
        this.view.onDidPathChange(::this.pathChange);
    }

    clickFile(fileName) {
        this.selectPath(new Path(fileName));
    }

    pathChange(newPath)  {
        this.updatePath(newPath);
    }

    selectPath(newPath) {
        if (newPath.isDirectory()) {
            this.updatePath(newPath.asDirectory());
        } else {
            this.openPath(newPath);
        }
    }

    updatePath(newPath, {saveHistory=true}={}) {
        if (saveHistory) {
            this.pathHistory.push(this.currentPath);
        }

        this.currentPath = newPath;
        this.view.setPath(newPath);
    }

    openPath(path) {
        if (path.exists()) {
            if (path.isFile()) {
                atom.workspace.open(path.absolute);
                emitter.emit('did-open-path', path.absolute);
                this.detach();
            } else {
                atom.beep();
            }
        } else {
            atom.beep();
        }
    }

    deletePathComponent() {
        if (this.currentPath.isRoot()) {
            atom.beep();
        } else {
            this.updatePath(this.currentPath.parent());
        }
    }

    addProjectFolder(fileName) {
        let folderPath = new Path(fileName);
        if (folderPath.isDirectory() && !folderPath.isProjectDirectory()) {
            atom.project.addPath(folderPath.absolute);
            this.detach();
        } else {
            atom.beep();
        }
    }

    addSelectedProjectFolder(event) {
        event.stopPropagation();

        let selectedPath = this.view.selectedPath();
        if (selectedPath !== null && !selectedPath.equals(this.currentPath.parent())) {
            this.addProjectFolder(selectedPath.full);
        } else {
            atom.beep();
        }
    }

    /**
     * Autocomplete the current input to the longest common prefix among
     * paths matching the current input. If no change is made to the
     * current path, beep.
     */
    autocomplete() {
        let newPath = configuredMatcher().autocomplete(this.currentPath);
        if (newPath === null || newPath.equals(this.currentPath)) {
            atom.beep();
        } else if (newPath.isDirectory()) {

        }

        let matchingPaths = this.currentPath.matchingPaths();
        if (matchingPaths.length === 0) {
            atom.beep();
        } else if (matchingPaths.length === 1) {
            let newPath = matchingPaths[0];
            if (newPath.isDirectory()) {
                this.updatePath(newPath.asDirectory());
            } else {
                this.updatePath(newPath);
            }
        } else {
            let newPath = Path.commonPrefix(matchingPaths);
            if (newPath.equals(this.currentPath)) {
                atom.beep();
            } else {
                this.updatePath(newPath);
            }
        }
    }

    toggle() {
        if (this.panel) {
            this.detach();
        } else {
            this.attach();
        }
    }

    confirm() {
        let selectedPath = this.view.selectedPath();
        if (selectedPath !== null) {
            this.selectPath(selectedPath);
        } else {
            this.selectPath(this.currentPath);
        }
    }

    confirmSelectedOrFirst() {
        let selectedPath = this.view.selectedPath();
        if (selectedPath !== null) {
            this.selectPath(selectedPath);
        } else {
            let firstPath = this.view.firstPath();
            if (firstPath !== null) {
                this.selectPath(firstPath);
            } else {
                this.selectPath(this.currentPath)
            }
        }
    }

    undo() {
        if (this.pathHistory.length > 0) {
            this.updatePath(this.pathHistory.pop(), {saveHistory: false});
        } else {
            let initialPath = "";
            if (!this.currentPath.equals(initialPath)) {
                this.updatePath(initialPath, {saveHistory: false});
            } else {
                atom.beep();
            }
        }
    }

    moveCursorDown() {
        let index = this.view.cursorIndex;
        if (index === null || index === this.view.pathListLength() - 1) {
            index = 0;
        } else {
            index++;
        }

        this.view.setCursorIndex(index);
    }

    moveCursorUp() {
        let index = this.view.cursorIndex;
        if (index === null || index === 0) {
            index = this.view.pathListLength() - 1;
        } else {
            index--;
        }

        this.view.setCursorIndex(index);
    }

    detach() {
        if (this.panel === null) {
            return;
        }

        this.panel.destroy();
        this.panel = null;
        atom.workspace.getActivePane().activate();
    }

    attach() {
        if (this.panel !== null) {
            return;
        }

        this.pathHistory = [];
        this.updatePath(new Path(""), {saveHistory: false});
        this.panel = this.view.createModalPanel();
    }
}

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { decode } from './utils';
import { EventEmitter } from 'vscode';

class Note extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        private content: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}-${this.content}`;
        this.description = this.content;
    }

    iconPath = {
        light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
        dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
    };
}

export class NodeDependenciesProvider implements vscode.TreeDataProvider<Note> {

    private _onDidChangeTreeData: EventEmitter<Note | undefined> = new EventEmitter<Note | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Note | undefined> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    constructor(logger: vscode.OutputChannel) {

        let config = vscode.workspace.getConfiguration('syncedNotes');

        for (const note in config.notes) {
            console.log(decode(note));
            logger.appendLine(decode(note));
            // config = config;
        }
    }

    getTreeItem(element: Note): vscode.TreeItem {
        return element;
    }

    // THIS SHOULD BE THE MAIN COLLECTOR
    // if element == undefined, we are at root level
    // return child elements for this Note
    getChildren(element?: Note): Thenable<Note[]> {
        return Promise.resolve([]);
    }
}

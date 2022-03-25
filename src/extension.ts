/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import * as vscode from 'vscode';
import { decode, encode } from './utils';


class NoteItem extends vscode.TreeItem {
    children: NoteItem[] | undefined;
    content: string | undefined;

    constructor(label: string, content?: string, children?: NoteItem[]) {
        super(label, children === undefined ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Expanded);
        this.children = children;
        this.content = content;
        this.contextValue = children === undefined ? 'note' : 'folder';
    }
}

class TreeDataProvider implements vscode.TreeDataProvider<NoteItem> {

    // onDidChangeTreeData?: vscode.Event<NoteItem | null | undefined> | undefined;

    // private _onDidChangeTreeData: vscode.EventEmitter<NoteItem | undefined | null | void> = new vscode.EventEmitter<NoteItem | undefined | null | void>();
    // readonly onDidChangeTreeData: vscode.Event<NoteItem | undefined | null> = this._onDidChangeTreeData.event;

    _onDidChangeTreeData: vscode.EventEmitter<NoteItem> = new vscode.EventEmitter<NoteItem>();
    onDidChangeTreeData: vscode.Event<NoteItem> = this._onDidChangeTreeData.event;

    // refresh(): void {
    //     this._onDidChangeTreeData.fire();
    // }

    data: NoteItem[] = [];
    logger: vscode.OutputChannel;

    constructor(logger: vscode.OutputChannel) {
        this.logger = logger;
        this.loadFromConfig();
    }

    loadFromConfig(): void {

        this.logger.appendLine('Loading from config...');

        const tempArray = new Array<NoteItem>();
        const config = vscode.workspace.getConfiguration('syncedNotes');

        for (const folderName in config.notes) {

            this.logger.appendLine(`=== ${folderName}`);

            const folderItem = new NoteItem(folderName, "", new Array<NoteItem>());
            tempArray.push(folderItem);

            Object.entries(config.notes[folderName]).forEach(([noteName, value]) => {

                this.logger.appendLine(`---===> ${noteName}`);
                const content = decode(value as string);
                folderItem.children?.push(new NoteItem(noteName, content));
            });
        }

        this.data = tempArray;
    }

    getTreeItem(element: NoteItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: NoteItem | undefined): vscode.ProviderResult<NoteItem[]> {
        if (element === undefined) {
            this.loadFromConfig();
            return this.data;
        }
        return element.children;
    }
}

export function activate(context: vscode.ExtensionContext) {

    //Create output channel
    const logger = vscode.window.createOutputChannel("synced notes");
    logger.show();
    logger.appendLine("I am a banana.");

    const provider = new TreeDataProvider(logger)

    // add in a subscription to workspace config changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('syncedNotes')) {

            if (!vscode.workspace.getConfiguration('syncedNotes').autorefresh)
                return;

            // provider.loadFromConfig();
            provider._onDidChangeTreeData.fire();
        }
    }));

    vscode.commands.registerCommand('syncedNotes.refreshNotes', () => provider.loadFromConfig());
    vscode.window.registerTreeDataProvider('syncednotes-explorer', provider);
}


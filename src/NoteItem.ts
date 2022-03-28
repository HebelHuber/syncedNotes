import * as vscode from 'vscode';
import { decode, encode } from './utils';

export class NoteItem extends vscode.TreeItem {
    children: NoteItem[] | undefined;
    content: string | undefined;
    fullPath: string;

    // command = {
    //     "title": "show",
    //     "command": "syncedNotes.showNote",
    // }

    constructor(label: string, fullPath: string, content?: string, children?: NoteItem[]) {
        super(label, children === undefined ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Expanded);
        this.children = children;
        this.content = content;
        this.fullPath = fullPath;
        this.contextValue = children === undefined ? 'note' : 'folder';
    }

    addChild(child: NoteItem): void {
        if (this.children === undefined)
            this.children = [];

        this.children.push(child);
        this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        this.contextValue = this.children.length > 0 ? 'folder' : 'note';
    }
}
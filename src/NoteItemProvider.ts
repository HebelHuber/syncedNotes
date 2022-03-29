import * as vscode from 'vscode';
import { decode, encode } from './utils';
import { NoteItem } from './NoteItem';

interface ParsedNote {
    content: string;
    name: string;
    folder: string;
}

class QuickPickNote implements vscode.QuickPickItem {

    label: string;
    description: string;
    note: NoteItem;

    constructor(item: NoteItem, desc?: string) {
        this.label = item.label as string;
        this.note = item;
        if (desc) this.description = desc;
        else this.description = "";
    }
}

export class NoteItemProvider implements vscode.TreeDataProvider<NoteItem> {

    _onDidChangeTreeData: vscode.EventEmitter<NoteItem> = new vscode.EventEmitter<NoteItem>();
    onDidChangeTreeData: vscode.Event<NoteItem> = this._onDidChangeTreeData.event;

    data: NoteItem[] = [];
    logger: vscode.OutputChannel;
    debugMode = false;

    constructor(logger: vscode.OutputChannel) {
        this.logger = logger;
        this.loadFromConfig();
    }

    getHierarchyRecursive(obj: any[], path: string, rootNodesArray: Array<NoteItem>, parentNode?: NoteItem): Array<NoteItem> {

        for (const value of Object.values(obj)) {
            Object.keys(value).forEach(key => {
                const content = value[key];

                const name = key;
                const currentPath = path + "/" + name;

                if (this.debugMode) this.logger.appendLine(`${currentPath}`);

                if (Array.isArray(content)) {
                    const folderNode = new NoteItem(name, currentPath, this, undefined);
                    if (parentNode) parentNode.addChild(folderNode);
                    else rootNodesArray.push(folderNode);
                    rootNodesArray.concat(this.getHierarchyRecursive(content, currentPath, rootNodesArray, folderNode));
                } else {
                    const self = new NoteItem(name, currentPath, this, content, undefined);

                    if (parentNode) parentNode.addChild(self);
                    else rootNodesArray.push(self);
                }
            });
        }

        return rootNodesArray;
    }

    loadFromConfig(): void {
        if (this.debugMode) this.logger.appendLine('========= Loading from config...');
        const config = vscode.workspace.getConfiguration('syncedNotes');
        this.debugMode = config.debugMode;
        this.data = this.getHierarchyRecursive(config.notes, "", new Array<NoteItem>());
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

    async showQuickPick(items: NoteItem[], placeHolder: string): Promise<NoteItem | undefined> {
        const quickPickItems = items.map(item => new QuickPickNote(item));
        const result = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: placeHolder
        });
        return result?.note;
    }

    async selectNoteFromList(): Promise<NoteItem | undefined> {
        let selected = await this.showQuickPick(this.data, 'select note');
        while (selected != undefined && selected.contextValue != "note") {
            selected = await this.showQuickPick(selected.getChildren(true, true), 'select note');
        }
        return selected;
    }

    async getAllNotes(includeNotes: boolean, includeFolders: boolean): Promise<NoteItem[]> {

        let out: NoteItem[] = [];

        this.data.forEach(item => {
            out.push(item);
            out = out.concat(item.getChildrenRecursive(true, true));
        });

        if (!includeFolders)
            out = out.filter(item => item.contextValue != "folder");

        if (!includeNotes)
            out = out.filter(item => item.contextValue != "note");

        return out;
    }

    addNestedArray(obj: any, chunks: string[]): void {

        const returner = Object.assign({}, obj);

        for (let i = 0; i < chunks.length; i++) {

            if (!Object.keys(obj).includes(chunks[0])) {
                obj[chunks[0]] = [];
            }

            obj = obj[chunks[0]];
        }
    }

    async saveToConfig(): Promise<void> {
        const config = await vscode.workspace.getConfiguration('syncedNotes');

        this.logger.appendLine('========= Saving to config...');

        const json = `[${this.data.map(item => item.getJson()).join(',')}]`;
        // this.logger.appendLine(json);
        const json2 = JSON.parse(json);
        // this.logger.appendLine(`${JSON.stringify(json2, null, 4)}`);

        config.update('notes', json2, vscode.ConfigurationTarget.Global);
    }
}
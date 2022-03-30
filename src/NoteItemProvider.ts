import * as vscode from 'vscode';
import { NoteItem } from './NoteItem';
import { QuickPickNote } from './QuickPickNote';

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
                    const folderNode = new NoteItem(name, currentPath, this, undefined, []);
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

    async showQuickPick(items: NoteItem[], title: string, additionalOptionTitle?: string, additionalOptionDesc?: string): Promise<NoteItem | undefined> {
        const quickPickItems = items.map(item => new QuickPickNote(item));

        if (additionalOptionTitle)
            quickPickItems.push(new QuickPickNote(undefined, additionalOptionDesc, additionalOptionTitle));

        const result = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: title,
            // title: title,
            canPickMany: false,
            ignoreFocusOut: true,
        });
        return result?.note;
    }

    async selectNoteFromList(title: string): Promise<NoteItem | undefined> {

        const rootFolders = this.data.filter(note => note.isFolder && !note.isEmptyFolder && note.containsTextNoteRecursive());
        let selected = await this.showQuickPick(rootFolders, title);
        this.logger.appendLine(`selected: ${selected}`);

        while (selected != undefined) {
            const newOptions = selected.getChildren(true, true, false).filter(note => note.containsTextNoteRecursive());

            if (newOptions.length == 0)
                return selected;

            selected = await this.showQuickPick(newOptions, title);
        }

        return selected;
    }

    async selectFolderFromList(title: string, canAddNewFolder: boolean): Promise<NoteItem | undefined> {

        const rootFolders = this.data.filter(note => note.isFolder);
        let selected = await this.showQuickPick(rootFolders, title, canAddNewFolder ? '[NEW FOLDER HERE]' : undefined);

        this.logger.appendLine(`selected: ${selected}`);

        while (selected != undefined) {

            const newOptions = selected.getChildren(false, true, true);
            if (newOptions.length == 0) {
                this.logger.appendLine(`No more folders found.`);
                this.logger.appendLine(`newOptions: ${JSON.stringify(newOptions, null, 2)}`);
                return selected;
            }

            const newSelected = await this.showQuickPick(newOptions, title, canAddNewFolder ? '[NEW FOLDER HERE]' : undefined);

            if (newSelected === undefined)
                return undefined;
            if (!newSelected.hasSubFolders)
                return newSelected;

            selected = newSelected;
        }

        return selected;
    }

    async saveToConfig(): Promise<void> {

        await this.logger.appendLine('========= Saving to config...');

        const json = `[${this.data.map(item => item.getJson()).join(',')}]`;
        // await this.logger.appendLine(json);
        try {
            const json2 = JSON.parse(json);
            // await this.logger.appendLine(`${JSON.stringify(json2, null, 4)}`);
            const config = await vscode.workspace.getConfiguration('syncedNotes');
            await config.update('notes', json2, vscode.ConfigurationTarget.Global);
        }
        catch (e) {
            await this.logger.appendLine(`Error parsing json: ${e}`);
        }

    }
}
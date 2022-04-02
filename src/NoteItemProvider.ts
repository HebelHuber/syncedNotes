import * as vscode from 'vscode';
import { NoteItem } from './NoteItem';
import { QuickPickNote } from './QuickPickNote';

export enum folderSelectMode {
    justSelect = 0,
    selectToAddFolder = 1,
    selectToDelete = 2,
    selectToMoveFolder = 3,
    selectToMoveNote = 4,
    selectToAddNote = 5,
}

export class NoteItemProvider implements vscode.TreeDataProvider<NoteItem> {

    _onDidChangeTreeData: vscode.EventEmitter<NoteItem | undefined> = new vscode.EventEmitter<NoteItem | undefined>();
    onDidChangeTreeData: vscode.Event<NoteItem | undefined> = this._onDidChangeTreeData.event;

    data: NoteItem[] = [];
    logger: vscode.OutputChannel;
    debugMode: boolean;

    public get rootNotes(): NoteItem[] { return this.data; };

    constructor(logger: vscode.OutputChannel, debugMode: boolean) {
        this.logger = logger;
        this.debugMode = debugMode;
        this.loadFromConfig(true);
    }

    async loadFromConfig(triggerListRefresh: boolean): Promise<void> {
        if (this.debugMode) this.logger.appendLine('========= Loading from config...');
        const config = await vscode.workspace.getConfiguration('syncedNotes');
        this.debugMode = config.debugMode;
        this.data = this.getHierarchyRecursive(config.notes, new Array<NoteItem>());

        if (triggerListRefresh)
            this._onDidChangeTreeData.fire(undefined);
    }

    getHierarchyRecursive(obj: any[], rootNodesArray: Array<NoteItem>, parentNode?: NoteItem): NoteItem[] {

        for (const value of Object.values(obj)) {
            Object.keys(value).forEach(key => {

                const name = key;
                const content = value[key];

                if (this.debugMode)
                    this.logger.appendLine(`${name}: ${content}`);

                if (Array.isArray(content)) {
                    const folderNode = NoteItem.NewFolder(name, this);
                    if (parentNode) parentNode.addChild(folderNode);
                    else rootNodesArray.push(folderNode);
                    rootNodesArray.concat(this.getHierarchyRecursive(content, rootNodesArray, folderNode));
                } else {
                    const self = NoteItem.NewNote(name, this, content);
                    if (parentNode) parentNode.addChild(self);
                    else rootNodesArray.push(self);
                }
            });
        }

        return rootNodesArray;
    }

    // TODO implement drag and drop once API allows us to

    // public async handleDrop(target: NoteItem | undefined, sources: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
	// 	const transferItem = sources.get('application/vnd.code.tree.syncednotes-explorer');
	// 	if (!transferItem) {
	// 		return;
	// 	}
	// 	const treeItems: NoteItem[] = transferItem.value;
	// 	let roots = this._getLocalRoots(treeItems);
	// 	// Remove nodes that are already target's parent nodes
	// 	roots = roots.filter(r => !this._isChild(this._getTreeElement(r.key), target));
	// 	if (roots.length > 0) {
	// 		// Reload parents of the moving elements
	// 		const parents = roots.map(r => this.getParent(r));
	// 		roots.forEach(r => this._reparentNode(r, target));
	// 		this._onDidChangeTreeData.fire([...parents, target]);
	// 	}
	// }

	// public async handleDrag(source: NoteItem[], treeDataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
	// 	treeDataTransfer.set('application/vnd.code.tree.testViewDragAndDrop', new vscode.DataTransferItem(source));
	// }

    getTreeItem(element: NoteItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: NoteItem | undefined): vscode.ProviderResult<NoteItem[]> {
        if (element === undefined) {
            this.loadFromConfig(false);
            return this.data;
        }
        return element.children;
    }

    async showQuickPick(items: NoteItem[], title: string): Promise<NoteItem | undefined> {
        const quickPickItems = items.map(item => new QuickPickNote(item));
        const result = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: title,
            // title: title,
            canPickMany: false,
            ignoreFocusOut: true,
        });

        return result?.note;        
    }

    async selectNoteFromList(title: string): Promise<NoteItem | undefined> {

        let rootFolders = this.data.filter(note => note.isFolder && !note.folderIsEmpty && note.containsTextNoteRecursive());
        rootFolders = rootFolders.concat(this.data.filter(note => !note.isFolder));
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

    async AddFolder(parent?: NoteItem): Promise<void> {
        const newFolderName = await vscode.window.showInputBox({ prompt: 'Please enter a folder for your note' });
        if (!newFolderName) return;
        const newFolder = NoteItem.NewFolder(newFolderName, this);
        if (parent) parent.addChild(newFolder);
        else this.data.push(newFolder);
        this.saveToConfig();
    }

    async AddNote(parent?: NoteItem): Promise<void> {
        // if (parent === undefined) {
        //     const addInRoot = await vscode.window.showWarningMessage(`no folder selected. Add note to root??`, { modal: true }, 'Yes', 'No') === 'Yes';
        //     if (!addInRoot) return
        // }

        const newNoteName = await vscode.window.showInputBox({
            prompt: 'Please enter a name for your note',
            placeHolder: 'Note name'
        });
        if (!newNoteName) return;
        const newNote = await NoteItem.NewNote(newNoteName, this, "# This is an empty note");
        if (parent) parent.addChild(newNote);
        else this.data.push(newNote);

        this.saveToConfig();

        newNote.openEditor(this.logger);
    }



    async selectFolderFromList(title: string, mode: folderSelectMode, ignore?: NoteItem): Promise<NoteItem | undefined> {

        let rootFolders = this.data.filter(note => note.isFolder);
        if (ignore) rootFolders = rootFolders.filter(note => note != ignore);

        switch (mode) {
            case folderSelectMode.selectToAddFolder:
                rootFolders.push(NoteItem.NewTempNote('$(add)', this, 'add folder in root directory'));
                break;
            case folderSelectMode.selectToAddNote:
                rootFolders.push(NoteItem.NewTempNote('$(add)', this, 'add note in root directory'));
                break;
            case folderSelectMode.selectToMoveFolder:
            case folderSelectMode.selectToMoveNote:
                rootFolders.push(NoteItem.NewTempNote('$(move)', this, 'move folder to root directory'));
                break;
            default:
                break;
        }

        let selected = await this.showQuickPick(rootFolders, title);

        // selected "ADD FOLDER HERE"
        if (mode == folderSelectMode.selectToAddFolder && selected?.isTempNote) {
            this.AddFolder(undefined);
            return;
        }

        // selected "ADD NOTE HERE"
        if (mode == folderSelectMode.selectToAddNote && selected?.isTempNote) {
            this.AddNote(undefined);
            return;
        }

        // selected "MOVE NOTE TO ROOT"
        if (mode == folderSelectMode.selectToMoveNote && selected?.isTempNote)
            return selected;
        if (mode == folderSelectMode.selectToMoveNote && !selected?.hasSubFolders)
            return selected;

        // selected "MOVE FOLDER TO ROOT"
        if (mode == folderSelectMode.selectToMoveFolder && selected?.isTempNote)
            return selected;

        while (selected != undefined) {

            let newOptions = selected.getChildren(false, true, true);
            if (ignore) newOptions = newOptions.filter(note => note != ignore);

            switch (mode) {
                case folderSelectMode.selectToAddFolder:
                    newOptions.push(NoteItem.NewTempNote('$(add)', this, 'add folder here'));
                    break;
                case folderSelectMode.selectToAddNote:
                    newOptions.push(NoteItem.NewTempNote('$(add)', this, 'add note here'));
                    break;
                case folderSelectMode.selectToMoveNote:
                    newOptions.push(NoteItem.NewTempNote('$(move)', this, 'place note here'));
                    break;
                case folderSelectMode.selectToDelete:
                    newOptions.push(NoteItem.NewTempNote("$(chrome-close)", this, 'delete this folder'));
                    break;
                default:
                    break;
            }

            if (newOptions.length == 0) {
                this.logger.appendLine(`No more folders found.`);
                return selected;
            }

            const newSelected = await this.showQuickPick(newOptions, title);

            // canceled
            if (newSelected === undefined)
                return undefined;

            // selected "ADD HERE"
            if (mode == folderSelectMode.selectToAddFolder && newSelected.isTempNote) {
                this.AddFolder(selected);
                return;
            }

            // selected "ADD NOTE HERE"
            if (mode == folderSelectMode.selectToAddNote && newSelected.isTempNote) {
                this.AddNote(selected);
                return;
            }

            // selected "ADD NOTE" and on last leaf
            if (mode == folderSelectMode.selectToAddNote && !newSelected.hasSubFolders) {
                this.AddNote(newSelected);
                return;
            }

            // selected "MOVE NOTE HERE"
            if (mode == folderSelectMode.selectToMoveNote && newSelected.isTempNote) {
                return selected;
            }

            if (mode == folderSelectMode.selectToMoveNote && !newSelected.hasSubFolders) {
                return newSelected;
            }

            // selected "DELETE HERE"
            if (mode == folderSelectMode.selectToDelete) {
                if (newSelected.isTempNote) {
                    selected.deleteNote();
                    return;
                }
                // selected end of tree in delete mode
                if (!newSelected.hasSubFolders) {
                    newSelected.deleteNote();
                    return;
                }
            }

            if (!newSelected.hasSubFolders)
                return newSelected;

            selected = newSelected;
        }

        return selected;
    }

    saveToConfig(): void {

        this.logger.appendLine('========= Saving to config...');

        // const json2 = this.data;

        // const json = `[${this.data.map(item => item.getJson()).join(',')}]`;
        try {
            // const json2 = JSON.parse(json);
            if (this.debugMode) this.logger.appendLine(`${JSON.stringify(this.data, null, 4)}`);
            const config = vscode.workspace.getConfiguration('syncedNotes');
            config.update('notes', this.data, vscode.ConfigurationTarget.Global);
        }
        catch (e) {
            this.logger.appendLine(`Error parsing json to save: ${e}`);
        }

        this._onDidChangeTreeData.fire(undefined);
    }
}
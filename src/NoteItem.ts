import * as vscode from 'vscode';
import { decodeAsync, encodeAsync, encode, decode } from './encoding';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { NoteItemProvider } from './NoteItemProvider';
// import { inspect } from 'util' 
import * as util from 'util'

export class NoteItem extends vscode.TreeItem {
    command?: vscode.Command | undefined;
    iconPath?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } | vscode.ThemeIcon | undefined;

    owner: NoteItemProvider;
    content?: string | undefined;
    parent?: NoteItem | undefined;
    children?: NoteItem[] | undefined;

    isTempNote = false;
    optionalDescription?: string;
    optionalDetail?: string;

    public get isFolder(): boolean { return this.children !== undefined; }
    public get folderHasChildren(): boolean { return this.children !== undefined && this.children.length > 0 };
    public get folderIsEmpty(): boolean { return this.children !== undefined && this.children.length == 0 };
    public get subFolders(): NoteItem[] { return this.children !== undefined ? this.children.filter(child => child.isFolder) : [] };
    public get hasSubFolders(): boolean { return this.subFolders.length > 0; };
    public get isInRoot(): boolean { return this.parent === undefined; }

    static NewFolder(label: string, owner: NoteItemProvider): NoteItem {
        return new NoteItem(label, owner, undefined, []);
    }

    static NewNote(label: string, owner: NoteItemProvider, content: string): NoteItem {
        return new NoteItem(label, owner, encode(content));
    }

    static NewTempNote(label: string, owner: NoteItemProvider, optionalDescription?: string, optionalDetail?: string): NoteItem {
        const item = new NoteItem(label, owner);
        item.isTempNote = true;
        item.optionalDescription = optionalDescription;
        item.optionalDetail = optionalDetail;
        return item;
    }

    private constructor(label: string, owner: NoteItemProvider, content?: string, children?: NoteItem[]) {
        super(label, children === undefined ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed);
        this.children = children;
        this.content = content;
        this.owner = owner;

        if (children !== undefined)
            children.forEach(child => child.parent = this);

        this.updateItemState();
    }

    updateItemState(logJSON?: boolean): void {

        this.contextValue = this.isFolder ? 'folder' : 'note';
        this.iconPath = this.isFolder ? vscode.ThemeIcon.Folder : vscode.ThemeIcon.File;
        this.collapsibleState = this.isFolder ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;

        this.command = this.isFolder ? undefined : {
            title: "Show Node",
            command: "syncedNotes.showNote",
            arguments: [this]
        };

        if (logJSON)
            this.owner.logger.appendLine(`note data: ${util.inspect(this)}`);
    }

    // getTooltip(): string {
    //     return this.label as string;
    // }

    addChild(child: NoteItem): void {
        if (this.children === undefined)
            this.children = [];

        this.children.push(child);
        child.parent = this;
        child.updateItemState();
        this.updateItemState();
    }

    removeChild(child: NoteItem): void {
        if (this.children === undefined) return;
        this.children = this.children.filter(item => item !== child);

        child.updateItemState();
        this.updateItemState();
    }

    parentTo(newParent: NoteItem): void {
        if (this.parent) this.parent.removeChild(this);
        else this.owner.data = this.owner.data.filter(item => item !== this);
        newParent.addChild(this);
    }

    moveToRoot(): void {
        if (this.parent) this.parent.removeChild(this);
        this.owner.data.push(this);
        this.updateItemState();
        this.owner.saveToConfig();
    }

    async rename(): Promise<void> {
        const newName = await vscode.window.showInputBox({
            prompt: 'enter new name',
            placeHolder: this.label as string,
        });
        if (!newName) return;
        this.label = newName;
        this.updateItemState();
        this.owner.saveToConfig();
    }

    async deleteNote(): Promise<void> {

        this.owner.logger.appendLine(`deleting note: ${this.label}`);

        if (this.folderHasChildren) {
            const reallyDelete = await vscode.window.showWarningMessage(`Folder ${this.label} is not empty. Are you sure you want to delete it?`, { modal: true }, 'Yes', 'No') === 'Yes';
            if (!reallyDelete) return
        }

        if (this.parent)
            this.parent.removeChild(this);
        else
            this.owner.data = this.owner.data.filter(item => item !== this);

        this.owner.saveToConfig();
    }

    getTempFileName(): string {
        return this.label as string + ".md";
    }

    getChildren(includeNotes: boolean, includeFolders: boolean, includeEmptyFolders: boolean): NoteItem[] {
        if (this.children === undefined)
            return [];

        if (includeNotes && includeFolders && includeEmptyFolders)
            return this.children;
        if (includeNotes && includeFolders && !includeEmptyFolders)
            return this.children.filter(child => !child.folderIsEmpty);

        if (includeNotes && !includeFolders && includeEmptyFolders)
            return this.children.filter(child => !child.isFolder);
        if (includeNotes && !includeFolders && !includeEmptyFolders)
            return this.children.filter(child => !child.isFolder && !child.folderIsEmpty);

        if (!includeNotes && includeFolders && includeEmptyFolders)
            return this.children.filter(child => child.isFolder);
        if (!includeNotes && includeFolders && !includeEmptyFolders)
            return this.children.filter(child => child.isFolder && !child.folderIsEmpty);

        return [];
    }

    containsTextNoteRecursive(): boolean {

        if (!this.isFolder)
            return true;

        if (this.isFolder && this.children !== undefined) {

            for (let i = 0; i < this.children.length; i++) {
                if (this.children[i].containsTextNoteRecursive())
                    return true;
            }
        }

        return false;
    }

    getJson(): string {

        // I'm a folder
        if (this.isFolder) {
            // this.owner.logger.appendLine(`${this.label} is a folder`);
            return `{"${this.label}":[${this.children?.map(child => child.getJson()).join(',')}]}`;
        }

        // I'm a leaf
        // this.owner.logger.appendLine(`${this.label} is a leaf`);
        return `{"${this.label}" : "${this.content}"}`;
    }

    // getChildrenRecursive(includeNotes: boolean, includeFolders: boolean, includeEmptyFolders: boolean): NoteItem[] {

    //     let children = this.getChildren(includeNotes, includeFolders, includeEmptyFolders);
    //     children.forEach(child => {
    //         children = children.concat(child.getChildrenRecursive(includeNotes, includeFolders, includeEmptyFolders));
    //     });
    //     return children;
    // }

    async decodedContentAsync(truncateTo?: number): Promise<string> {
        const decoded = await decodeAsync(this.content as string);

        if (truncateTo)
            return decoded.substr(0, truncateTo) + '...';

        return decoded
    }

    async writeToTempFile(logger: vscode.OutputChannel): Promise<vscode.Uri> {
        const tempFilePath = path.join(os.tmpdir(), this.getTempFileName());
        logger.appendLine(`temp file: ${tempFilePath}`);

        await fs.writeFile(tempFilePath, await this.decodedContentAsync(), (err) => {
            if (err) logger.appendLine(`Error writing file: ${tempFilePath}, ${err}`);
        });

        return vscode.Uri.file(tempFilePath);
    }

    async showPreview(logger: vscode.OutputChannel): Promise<void> {

        await this.writeToTempFile(logger).then(async uri => {
            vscode.commands.executeCommand("markdown.showPreview", uri);
        });
    }

    async openEditor(logger: vscode.OutputChannel): Promise<void> {
        logger.appendLine(`editing note ${this.label}`);

        await this.writeToTempFile(logger).then(async uri => {
            await vscode.commands.executeCommand('vscode.open', uri);
            // await vscode.commands.executeCommand('cursorBottom');

            const onSaveDisposable = vscode.workspace.onDidSaveTextDocument(async textDocument => {
                if (textDocument.uri.fsPath === uri.fsPath) {
                    await this.saveNote(textDocument, logger);
                }
            });

            const onCloseDisposable = vscode.workspace.onDidCloseTextDocument(async textDocument => {
                if (textDocument.uri.fsPath === uri.fsPath) {
                    onSaveDisposable.dispose();
                    onCloseDisposable.dispose();
                    await fs.unlink(uri.fsPath, (err) => {
                        if (err) logger.appendLine(`Error deleting file: ${uri.fsPath}, ${err}`);
                    });
                }
            });
        });
    }

    async saveNote(textDocument: vscode.TextDocument, logger: vscode.OutputChannel): Promise<void> {
        logger.appendLine(`saving note ${this.label}`);
        const content = await textDocument.getText();
        this.content = await encodeAsync(content, logger);
        this.owner.saveToConfig();
    }
}
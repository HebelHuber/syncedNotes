import * as vscode from 'vscode';
import { encode, decode } from './encoding';
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
    contentEndcoded?: string | undefined;
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

    private constructor(label: string, owner: NoteItemProvider, contentEncoded?: string, children?: NoteItem[]) {
        super(label, children === undefined ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed);
        this.children = children;
        this.contentEndcoded = contentEncoded;
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

    toJSON(): any {
        const outObj: any = {};

        // I'm a folder
        if (this.isFolder) {
            // this.owner.logger.appendLine(`${this.label} is a folder`);
            outObj[this.label as string] = this.children?.map(child => child.toJSON());
            return outObj;
            // return `{"${this.label}":[${this.children?.map(child => child.getJson()).join(',')}]}`;
        }

        // I'm a leaf
        outObj[this.label as string] = this.contentEndcoded as string;
        return outObj;
    }

    decodedContent(truncateTo?: number): string {

        if (truncateTo)
            return decode(this.contentEndcoded as string).substr(0, truncateTo) + '...';

        return decode(this.contentEndcoded as string);
    }

    async writeToTempFile(logger: vscode.OutputChannel): Promise<vscode.Uri> {
        const tempFilePath = path.join(os.tmpdir(), this.getTempFileName());
        logger.appendLine(`temp file: ${tempFilePath}`);

        await fs.writeFile(tempFilePath, this.decodedContent(), (err) => {
            if (err) logger.appendLine(`Error writing file: ${tempFilePath}, ${err}`);
        });

        return vscode.Uri.file(tempFilePath);
    }

    async showPreview(logger: vscode.OutputChannel): Promise<void> {

        await this.writeToTempFile(logger).then(async uri => {
            vscode.commands.executeCommand("markdown.showPreview", uri);
        });
    }

    openEditor(logger: vscode.OutputChannel): void {
        logger.appendLine(`editing note ${this.label}`);

        this.writeToTempFile(logger).then(async uri => {
            await vscode.commands.executeCommand('vscode.open', uri);
            // await vscode.commands.executeCommand('cursorBottom');

            const onSaveDisposable = vscode.workspace.onDidSaveTextDocument(textDocument => {
                if (textDocument.uri.fsPath === uri.fsPath) {
                    this.saveNote(textDocument.getText(), logger);
                }
            });

            const onCloseDisposable = vscode.workspace.onDidCloseTextDocument(textDocument => {
                if (textDocument.uri.fsPath === uri.fsPath) {

                    onSaveDisposable.dispose();
                    onCloseDisposable.dispose();

                    fs.unlink(uri.fsPath, (err) => {
                        if (err) logger.appendLine(`Error deleting file: ${uri.fsPath}, ${err}`);
                    });
                }
            });
        });
    }

    saveNote(content: string, logger: vscode.OutputChannel): void {
        // logger.appendLine(`saving note: ${this.label}`);
        // const content = text.getText();
        this.contentEndcoded = encode(content);
        logger.appendLine(`content of ${this.label}: "${content}" ===IS=NOW===> "${this.contentEndcoded}"`);
        this.owner.saveToConfig();
    }
}
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
    logger: vscode.OutputChannel;

    public get isFolder(): boolean { return this.children !== undefined; }
    public get folderHasChildren(): boolean { return this.children !== undefined && this.children.length > 0 };
    public get folderIsEmpty(): boolean { return this.children !== undefined && this.children.length == 0 };
    public get subFolders(): NoteItem[] { return this.children !== undefined ? this.children.filter(child => child.isFolder) : [] };
    public get hasSubFolders(): boolean { return this.subFolders.length > 0; };
    public get isInRoot(): boolean { return this.parent === undefined; }

    static NewFolder(label: string, owner: NoteItemProvider, logger: vscode.OutputChannel): NoteItem {
        return new NoteItem(label, owner, logger, undefined, []);
    }

    static NewNote(label: string, owner: NoteItemProvider, content: string, logger: vscode.OutputChannel): NoteItem {
        return new NoteItem(label, owner, logger, content);
    }

    static NewTempNote(label: string, owner: NoteItemProvider, logger: vscode.OutputChannel, optionalDescription?: string, optionalDetail?: string): NoteItem {
        const item = new NoteItem(label, owner, logger);
        item.isTempNote = true;
        item.optionalDescription = optionalDescription;
        item.optionalDetail = optionalDetail;
        return item;
    }

    private constructor(label: string, owner: NoteItemProvider, logger: vscode.OutputChannel, contentEncoded?: string, children?: NoteItem[]) {
        super(label, children === undefined ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed);
        this.logger = logger;
        this.children = children;
        this.contentEndcoded = contentEncoded;
        this.owner = owner;

        if (children !== undefined)
            children.forEach(child => child.parent = this);

        this.updateItemState();
    }

    log(message: string): void {
        this.logger.appendLine(`[ITEM] ${message}`);
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
            this.log(`note data: ${util.inspect(this)}`);
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

    moveToRoot(saveConfig: boolean): void {
        if (this.parent) this.parent.removeChild(this);
        if (this.owner.data.includes(this)) this.owner.data = this.owner.data.filter(item => item !== this);
        this.owner.data.push(this);
        this.updateItemState();

        if (saveConfig) this.owner.saveToConfig();
    }

    rename(): void {
        vscode.window.showInputBox({
            prompt: 'enter new name',
            placeHolder: this.label as string,
        }).then(newName => {
            if (!newName) return;
            this.label = newName;
            this.updateItemState();
            this.owner.saveToConfig();
        });
    }

    async deleteNote(): Promise<void> {

        this.log(`deleting note: ${this.label}`);

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

        if (this.isFolder)
            outObj[this.label as string] = this.children?.map(child => child.toJSON());
        else
            outObj[this.label as string] = this.contentEndcoded as string;

        if (!this.isFolder)
            this.log(`JSON LEAF DATA: ${util.inspect(outObj)}`);

        return outObj;
    }

    decodedContent(truncateTo?: number): string {

        if (truncateTo)
            return decode(this.contentEndcoded as string).substr(0, truncateTo) + '...';

        return decode(this.contentEndcoded as string);
    }

    writeToTempFile(): vscode.Uri {
        const tempFilePath = path.join(os.tmpdir(), this.getTempFileName());
        this.log(`temp file: ${tempFilePath}`);

        const content = this.decodedContent();
        this.log(`writing content to temp file: ${content}`);
        try { fs.writeFileSync(tempFilePath, content) }
        catch (err) { this.log(`Error writing file: ${tempFilePath}, ${err}`); }

        return vscode.Uri.file(tempFilePath);
    }

    showPreview(): void {

        const uri = this.writeToTempFile();
        vscode.commands.executeCommand("markdown.showPreview", uri);
    }

    openEditor(): void {
        this.log(`editing note ${this.label}`);

        const uri = this.writeToTempFile();
        // vscode.commands.executeCommand('vscode.open', uri);
        // await vscode.commands.executeCommand('cursorBottom');

        // vscode.workspace.openTextDocument({ language: 'markdown', content: this.decodedContent() }).then(doc => {
        vscode.workspace.openTextDocument(uri).then(doc => {
            vscode.window.showTextDocument(doc);

            const onSaveSubscription = vscode.workspace.onDidSaveTextDocument(textDocument => {
                if (textDocument.uri.fsPath === uri.fsPath) {
                    const content = textDocument.getText();
                    this.contentEndcoded = encode(content);
                    // this.log(`modified <${this.label}>: ${JSON.stringify(this)}`);
                    this.owner._onDidChangeTreeData.fire(this);
                    this.owner.saveToConfig();
                }
            }, this);

            const onCloseSubscription = vscode.workspace.onDidCloseTextDocument(textDocument => {
                if (textDocument.uri.fsPath === uri.fsPath) {

                    onSaveSubscription.dispose();
                    onCloseSubscription.dispose();

                    fs.unlink(uri.fsPath, (err) => {
                        if (err) this.log(`Error deleting file: ${uri.fsPath}, ${err}`);
                    });
                }
            }, this);
        });
    }
}
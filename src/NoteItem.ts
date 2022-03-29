import * as vscode from 'vscode';
import { decode, encode } from './utils';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { NoteItemProvider } from './NoteItemProvider';

export class NoteItem extends vscode.TreeItem {
    children: NoteItem[] | undefined;
    content: string | undefined;
    fullPath: string;
    command?: vscode.Command | undefined;
    owner: NoteItemProvider;
    iconPath?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri; } | vscode.ThemeIcon | undefined;

    constructor(label: string, fullPath: string, owner: NoteItemProvider, content?: string, children?: NoteItem[]) {
        super(label, children === undefined ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Expanded);
        this.children = children;
        this.content = content;
        this.fullPath = fullPath;
        this.contextValue = children === undefined ? 'note' : 'folder';
        this.owner = owner;

        this.command = {
            title: "Show Node",
            command: "syncedNotes.showNote",
            arguments: [this]
        };

        // TODO for folders: change collapse state on click

        this.iconPath = children === undefined ? vscode.ThemeIcon.File : vscode.ThemeIcon.Folder;
    }

    getTooltip(): string {
        return this.label as string;
    }

    addChild(child: NoteItem): void {
        if (this.children === undefined)
            this.children = [];

        this.children.push(child);
        this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        this.contextValue = this.children.length > 0 ? 'folder' : 'note';
        this.iconPath = this.children === undefined ? vscode.ThemeIcon.File : vscode.ThemeIcon.Folder;
    }

    getTempFileName(): string {
        return this.label as string + ".md";
        // return this.fullPath.replace(/\//g, '_');
    }

    getChildren(includeNotes: boolean, includeFolders: boolean): NoteItem[] {
        if (this.children === undefined)
            return [];

        if (includeNotes && includeFolders)
            return this.children;

        if (includeNotes && !includeFolders)
            return this.children.filter(child => child.contextValue === 'note');

        if (includeFolders && !includeNotes)
            return this.children.filter(child => child.contextValue === 'folder');

        return [];
    }

    getJson(): string {

        // I'm a leaf
        if (this.children == undefined)
            return `{"${this.label}" : "${this.content}"}`;

        // I'm a folder
        return `{"${this.label}":[${this.children.map(child => child.getJson()).join(',')}]}`;
    }

    getChildrenRecursive(includeNotes: boolean, includeFolders: boolean): NoteItem[] {

        let children = this.getChildren(includeNotes, includeFolders);
        children.forEach(child => {
            children = children.concat(child.getChildrenRecursive(includeNotes, includeFolders));
        });
        return children;
    }

    async writeToTempFile(logger: vscode.OutputChannel): Promise<vscode.Uri> {
        const tempFilePath = path.join(os.tmpdir(), this.getTempFileName());
        logger.appendLine(`temp file: ${tempFilePath}`);

        await fs.writeFile(tempFilePath, decode(this.content as string), (err) => {
            if (err) logger.appendLine(`Error writing file: ${tempFilePath}, ${err}`);
        });

        return vscode.Uri.file(tempFilePath);
    }

    async showPreview(logger: vscode.OutputChannel): Promise<void> {

        this.writeToTempFile(logger).then(async uri => {
            vscode.commands.executeCommand("markdown.showPreview", uri);
        });
    }

    async openEditor(logger: vscode.OutputChannel): Promise<void> {
        logger.appendLine(`editing note ${this.label}`);

        this.writeToTempFile(logger).then(async uri => {
            await vscode.commands.executeCommand('vscode.open', uri);
            // await vscode.commands.executeCommand('cursorBottom');

            const onSaveDisposable = vscode.workspace.onDidSaveTextDocument(async textDocument => {
                if (textDocument.uri.fsPath === uri.fsPath) {
                    logger.appendLine(`saving note ${this.label}`);
                    const content = await textDocument.getText();
                    this.content = encode(content);
                    this.owner.saveToConfig();
                }
            });

            const onCloseDisposable = vscode.workspace.onDidCloseTextDocument(async textDocument => {
                if (textDocument.uri.fsPath === uri.fsPath) {
                    logger.appendLine(`closed note ${this.label}`);
                    onSaveDisposable.dispose();
                    onCloseDisposable.dispose();
                    this.owner.saveToConfig();
                }
            });
        });
    }
}
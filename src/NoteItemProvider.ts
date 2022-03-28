import * as vscode from 'vscode';
import { decode, encode } from './utils';
import { NoteItem } from './NoteItem';

interface ParsedNote {
    content: string;
    name: string;
    folder: string;
}

export class NoteItemProvider implements vscode.TreeDataProvider<NoteItem> {

    _onDidChangeTreeData: vscode.EventEmitter<NoteItem> = new vscode.EventEmitter<NoteItem>();
    onDidChangeTreeData: vscode.Event<NoteItem> = this._onDidChangeTreeData.event;

    data: NoteItem[] = [];
    logger: vscode.OutputChannel;

    constructor(logger: vscode.OutputChannel) {
        this.logger = logger;
        this.loadFromConfig();
    }

    loadFromConfig(): void {

        // TODO notes sollte ein dict in den settings sein, dann sind die names unique

        this.logger.appendLine('Loading from config...');

        const allNotesArray = new Array<NoteItem>();
        const config = vscode.workspace.getConfiguration('syncedNotes');

        // parse json for folders and notes
        for (const noteIndex in config.notes) {

            const noteParsed: ParsedNote = JSON.parse(JSON.stringify(config.notes[noteIndex]));

            if (noteParsed.folder.includes("/")) {

                // walk path and create notes if they dont exist
                let thisPath = "";
                const pathChunks = noteParsed.folder.split('/');
                for (let i = 0; i < pathChunks.length; i++) {

                    const thisChunk = pathChunks[i];
                    thisPath += thisChunk;

                    if (!allNotesArray.some(element => element.fullPath === thisPath)) {
                        allNotesArray.push(new NoteItem(thisChunk, thisPath, undefined));
                    }

                    thisPath += "/";
                };
            }

            // add the note itself

            allNotesArray.push(
                new NoteItem(
                    noteParsed.name,
                    noteParsed.folder + "/" + noteParsed.name,
                    noteParsed.content,
                    undefined
                )
            );
        }

        // link up the node tree
        allNotesArray
            .filter(element => element.fullPath.includes("/")) // skip root notes
            .forEach(element => {
                const parentPath = element.fullPath.substring(0, element.fullPath.lastIndexOf("/"));
                const parent = allNotesArray.find(element => element.fullPath === parentPath);
                parent?.addChild(element);
            });

        // add root nodes as data (also notes with empty folder)
        this.data = allNotesArray
            .filter(element =>
                !element.fullPath.includes("/") ||
                element.fullPath.startsWith("/")
            );
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
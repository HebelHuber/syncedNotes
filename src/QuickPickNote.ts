import * as vscode from 'vscode';
import { NoteItem } from './NoteItem';

export class QuickPickNote implements vscode.QuickPickItem {

    note: NoteItem;
    label: string;
    description?: string | undefined;
    detail?: string | undefined;
    // iconPath?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } | vscode.ThemeIcon | undefined;

    constructor(item: NoteItem) {
        this.note = item;
        this.label = item.label as string;
        // this.iconPath = item.iconPath;
        this.description = item.optionalDescription;
        this.detail = item.optionalDetail;

        // if (this.note.isTempNote)
        // {
            // this.iconPath = "$(add)";
            // this.label =  + this.label
        // }
    }
}
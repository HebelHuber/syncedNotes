import * as vscode from 'vscode';
import { NoteItem } from './NoteItem';

export class QuickPickNote implements vscode.QuickPickItem {

    label: string;
    description?: string | undefined;
    detail?: string | undefined;
    note?: NoteItem;
    iconPath?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } | vscode.ThemeIcon | undefined;

    constructor(item?: NoteItem, desc?: string, labelFallback?: string) {
        this.note = item;

        this.label = labelFallback as string;

        if (this.note === undefined) {
            this.iconPath = "$(add)";
            this.description = desc;
            // this.detail = desc;
        }
        else
            this.SetupFromNote();
    }


    async SetupFromNote(): Promise<void> {

        if (this.note === undefined)
            return;

        this.label = this.note.label as string;
        this.iconPath = this.note.iconPath;
        this.description = this.note.isFolder ? "open Folder" : await this.note.decodedContent();
    }
}
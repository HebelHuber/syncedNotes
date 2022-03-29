/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import * as vscode from 'vscode';
import { decode, encode } from './encoding';
import { NoteItem } from './NoteItem';
import { NoteItemProvider } from './NoteItemProvider';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

let lastOpenedNote: vscode.TextDocument;

export function activate(context: vscode.ExtensionContext) {

    //Create output channel
    const logger = vscode.window.createOutputChannel("synced notes");
    logger.show();
    logger.appendLine("I am a banana.");

    const provider = new NoteItemProvider(logger)

    // add in a subscription to workspace config changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('syncedNotes')) {

            if (!vscode.workspace.getConfiguration('syncedNotes').autorefresh)
                return;

            // provider.loadFromConfig();
            provider._onDidChangeTreeData.fire();
        }
    }));

    vscode.commands.registerCommand('syncedNotes.refreshNoteView', () => provider.loadFromConfig());
    vscode.window.registerTreeDataProvider('syncednotes-explorer', provider);

    // add folder: ask for folder name, compare with existing
    vscode.commands.registerCommand('syncedNotes.addFolder', async () => {

        const newFolderName = await vscode.window.showInputBox({
            prompt: 'Please enter a folder for your note'
        }) as string;

        const config = await vscode.workspace.getConfiguration('syncedNotes');
        const existingFolders = config.notes;

        if (newFolderName in existingFolders) {
            vscode.window.showErrorMessage(`Folder ${newFolderName} already exists`);
            return;
        }

        const newFolders = {};
        Object.assign(newFolders, existingFolders, { [newFolderName]: {} });

        await config.update('notes', newFolders, vscode.ConfigurationTarget.Global);
        provider._onDidChangeTreeData.fire();
    });

    vscode.commands.registerCommand('syncedNotes.showNote', async (note?: NoteItem) => {

        logger.appendLine(`showNote: ${note?.label}`);

        if (note === undefined) note = await provider.selectNoteFromList();

        if (note === undefined || note.isFolder) {
            vscode.window.showErrorMessage("No note selected");
            return;
        }

        note.showPreview(logger);
    });

    vscode.commands.registerCommand('syncedNotes.editNote', async (note?: NoteItem) => {

        if (note === undefined) note = await provider.selectNoteFromList();

        if (note === undefined || note.isFolder) {
            vscode.window.showErrorMessage("No note selected");
            return;
        }

        note.openEditor(logger);
    });

    vscode.commands.registerCommand('syncedNotes.removeFolder', async (folderItem?: NoteItem) => {

        const config = await vscode.workspace.getConfiguration('syncedNotes');
        let selectedFolderName: string;

        if (folderItem === undefined) {

            const folderNameOptions = Object.entries(config.notes).map(([name, value]) => { return { label: name, description: name } });

            const selectedOption = await vscode.window.showQuickPick(folderNameOptions, {
                placeHolder: 'Select a folder to delete'
            });

            if (selectedOption === undefined)
                return

            selectedFolderName = selectedOption.label as string;
        }
        else {
            selectedFolderName = folderItem.label as string;
        }

        // check if folder is empty. If not, show a warning message
        if (Object.entries(config.notes[selectedFolderName]).length > 0) {
            const deleteFolder = await vscode.window.showWarningMessage(`Folder ${selectedFolderName} is not empty. Are you sure you want to delete it?`, { modal: true }, 'Yes', 'No');
            if (!deleteFolder || deleteFolder === 'No') return;
        }

        const newFolders = Object.assign({}, ...
            Object.entries(config.notes).filter(([name, content]) => name !== selectedFolderName).map(([name, content]) => ({ [name]: content }))
        );

        await config.update('notes', newFolders, vscode.ConfigurationTarget.Global);
        provider._onDidChangeTreeData.fire();
    });
}


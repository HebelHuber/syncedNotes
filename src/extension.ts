/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import * as vscode from 'vscode';
import { NoteItem } from './NoteItem';
import { NoteItemProvider, folderSelectMode } from './NoteItemProvider';

export function activate(context: vscode.ExtensionContext) {

    const debugMode = vscode.workspace.getConfiguration('syncedNotes').debugMode as boolean;

    //Create output channel
    const logger = vscode.window.createOutputChannel("synced notes");

    if (debugMode) {
        logger.show();
        logger.appendLine("synced notes extension activated");
    }

    const provider = new NoteItemProvider(logger, debugMode)
    context.subscriptions.push(vscode.window.registerTreeDataProvider('syncednotes-explorer', provider));

    // add in a subscription to workspace config changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('syncedNotes')) {

            // if (!vscode.workspace.getConfiguration('syncedNotes').autorefresh)
            //     return;

            // provider.loadFromConfig();
        }
    }));

    // X syncedNotes.refreshNoteView

    // X syncedNotes.addNote
    // X syncedNotes.showNote
    // X syncedNotes.editNote
    // x syncedNotes.renameNote
    // X syncedNotes.moveNote
    // X syncedNotes.deleteNote
    
    // X syncedNotes.addFolder
    // X syncedNotes.renameFolder
    // X syncedNotes.moveFolder
    // X syncedNotes.deleteFolder

    const refreshNoteViewCommand = vscode.commands.registerCommand('syncedNotes.refreshNoteView', async () => {
        provider.loadFromConfig(true);
    });

    const addNoteCommand = vscode.commands.registerCommand('syncedNotes.addNote', async (selectedFolder?: NoteItem) => {
        if (selectedFolder === undefined)
            await provider.selectFolderFromList('Select folder for note', folderSelectMode.selectToAddNote);
        else
            provider.AddNote(selectedFolder);
    });

    const showNoteCommand = vscode.commands.registerCommand('syncedNotes.showNote', async (note?: NoteItem) => {

        if (note === undefined)
            note = await provider.selectNoteFromList('select note to show');

        if (note === undefined || note.isFolder) {
            return;
        }

        note.showPreview(logger);
    });

    const renameNoteCommand = vscode.commands.registerCommand('syncedNotes.renameNote', async (note?: NoteItem) => {

        if (note === undefined)
            note = await provider.selectNoteFromList('select note to rename');

        if (note === undefined)
            return;

        note.rename();
    });

    const editNoteCommand = vscode.commands.registerCommand('syncedNotes.editNote', async (note?: NoteItem) => {

        if (note === undefined)
            note = await provider.selectNoteFromList('select note to edit');

        if (note === undefined)
            return;

        note.openEditor(logger);
    });

    const moveNoteCommand = vscode.commands.registerCommand('syncedNotes.moveNote', async (selected?: NoteItem) => {
        if (selected === undefined)
            selected = await provider.selectNoteFromList('select note to move');

        if (selected === undefined)
            return;


        const targetParent = await provider.selectFolderFromList('Select target folder', folderSelectMode.selectToMoveNote, selected);

        // nothing selected
        if (!targetParent) return;

        // selected "move to root"
        if (targetParent.isTempNote) {
            if (!selected.isInRoot)
                selected.moveToRoot();
        }
        else {
            // selected a folder
            selected.parentTo(targetParent);
        }

        provider.saveToConfig();
    });

    const deleteNoteCommand = vscode.commands.registerCommand('syncedNotes.deleteNote', async (selected?: NoteItem) => {
        if (selected === undefined)
            selected = await provider.selectNoteFromList('select note to delete');

        if (selected === undefined)
            return;

        selected.deleteNote();
    });

    const addFolderCommand = vscode.commands.registerCommand('syncedNotes.addFolder', async (parentNote?: NoteItem) => {

        if (parentNote === undefined)
            await provider.selectFolderFromList('Select parent folder', folderSelectMode.selectToAddFolder);
        else
            provider.AddFolder(parentNote);
    });

    const renameFolderCommand = vscode.commands.registerCommand('syncedNotes.renameFolder', async (selected?: NoteItem) => {

        if (selected === undefined)
            selected = await provider.selectFolderFromList('Select folder to rename', folderSelectMode.justSelect);

        if (selected !== undefined) {
            selected.rename();
        }
    });

    const moveFolderCommand = vscode.commands.registerCommand('syncedNotes.moveFolder', async (selected?: NoteItem) => {

        if (selected === undefined)
            selected = await provider.selectFolderFromList('Select folder to move', folderSelectMode.justSelect);

        if (selected === undefined)
            return;

        const targetParent = await provider.selectFolderFromList('Select target folder', folderSelectMode.selectToMoveFolder, selected);

        // nothing selected
        if (!targetParent) return;

        // selected "move to root"
        if (targetParent.isTempNote) {
            if (!selected.isInRoot)
                selected.moveToRoot();
        }
        else {
            // selected a folder
            selected.parentTo(targetParent);
        }

        provider.saveToConfig();
    });

    const deleteFolderCommand = vscode.commands.registerCommand('syncedNotes.deleteFolder', async (selected?: NoteItem) => {

        if (selected === undefined)
            await provider.selectFolderFromList('Select folder to remove', folderSelectMode.selectToDelete);
        else
            selected.deleteNote();
    });

    context.subscriptions.push(refreshNoteViewCommand);
    context.subscriptions.push(addNoteCommand);
    context.subscriptions.push(showNoteCommand);
    context.subscriptions.push(renameNoteCommand);
    context.subscriptions.push(editNoteCommand);
    context.subscriptions.push(moveNoteCommand);
    context.subscriptions.push(deleteNoteCommand);
    context.subscriptions.push(addFolderCommand);
    context.subscriptions.push(renameFolderCommand);
    context.subscriptions.push(moveFolderCommand);
    context.subscriptions.push(deleteFolderCommand);

}


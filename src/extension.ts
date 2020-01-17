import { extensions, ExtensionContext, workspace, commands, window } from 'vscode';
import { GitExtension, Repository } from './git';
import { TypeObject } from './def';

export function activate(context: ExtensionContext): null | undefined {
	// This function relies on the vscode git extension.
	// eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
	const git = extensions.getExtension<GitExtension>('vscode.git')!.exports;
	// If git is not enabled, this will not work
	if (!git.enabled) {
		window.showErrorMessage("Git is not enabled in this Workspace. Git Angular will not work.", {
			modal: true
		});
		return;
	}
	// get the API Object.
	const gitApi = git.getAPI(1);
	// If this is not a git repo, show an error message.
	if (gitApi.repositories.length == 0) return window.showErrorMessage('Not a git repository', { modal: true }), null;
	// get configuration
	let config = workspace.getConfiguration('gitAngular');
	const disposable = commands.registerCommand('gitAngular.commit', async () => {
		// Alright, let's see what we got.
		let types = config.get('types') as TypeObject
		const scopes = config.get('scopes') as string[],
			allowNewTypes = config.get('allowNewTypes') as boolean,
			allowNewScopes = config.get('allowNewScopes') as boolean;

		// This has to be done because apparently config objects are not meant to be edited directly, and was throwing an error. 
		// Please see https://gitlab.com/jhechtf/git-angular/issues/6 for the error this fixes.
		if (!allowNewTypes && types) {
			types = { ...types }
			delete types['[New]'];
		}
		// get the type
		let type = await window.showQuickPick(Object.entries(types).map(([key, value]) => {
			return {
				label: key,
				detail: value
			};
		})).then(r => r == undefined ? { label: '', detail: '' } : r);
		if (type.label == '[New]' && allowNewTypes) type = await window.showInputBox({ placeHolder: 'Enter new commit type' }).then(str => ({ label: str || '', detail: '' }));
		else if (type.label === '' && !allowNewTypes) return null;

		// If our label hasn't been set yet, then we stop now.
		if (type.label === '') return null;
		// Next step: the scope. It follows basically the same steps, but I'm just trying to get this to work for right now.
		if (allowNewScopes && scopes[scopes.length - 1] != '[New]') scopes.push('[New]');
		else if (!allowNewScopes && scopes[scopes.length] == '[New]') scopes.pop();

		// get the scope.
		let scope = await window.showQuickPick(scopes, {
			placeHolder: 'Scope'
		});

		if (allowNewScopes && scope == '[New]') scope = await window.showInputBox({
			prompt: 'Please enter a scope for this commit'
		});

		// get the subject message
		const message = await window.showInputBox({
			prompt: 'Commit Subject'
		});
		// we gotta declare this outside of the loop
		let repo: Repository | null = null;

		// If we have more than one repo in this workspace
		if (gitApi.repositories.length > 1) {
			// Which repo do you want to add this commit to?
			repo = await window.showQuickPick(gitApi.repositories.map((repo, index) => {
				return {
					label: repo.rootUri.path,
					index: index
				}
			}), { placeHolder: 'Please choose the repo this commit is for' }).then(r => {
				if (!r) return gitApi.repositories[0];
				return gitApi.repositories[r.index]
			});
		} else repo = gitApi.repositories[0];

		// Build the full message
		const fullMsg = `${type.label}${scope ? '(' + scope + ')' : ''}: ${message}`;
		// set the inputbox value of our repo to the full message
		repo.inputBox.value = fullMsg;
		// show the SCM
		commands.executeCommand('workbench.view.scm', repo.rootUri);
		// If we are allowing new scopes and types, then here is where we save those to the settings
		if (allowNewScopes || allowNewTypes) {
			if (type && types[type.label] == '') {
				await config.update('types', types);
			}
			if (scope && scopes.indexOf(scope) == -1) {
				scopes.splice(scopes.length - 1, 0, scope);
				await config.update('scopes', scopes.slice(0, -1));
			}
		}
	});
	// add in a subscription to workspace config changes
	context.subscriptions.push(workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration('gitAngular')) {
			config = workspace.getConfiguration('gitAngular');
		}
	}));

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate(): void {
	console.log('deactivate!');
}

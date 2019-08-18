import { extensions, ExtensionContext, workspace, commands, window} from 'vscode';
import { GitExtension, Repository } from './git';

export function activate(context: ExtensionContext) {
	// This function relies on the vscode git extension.
	const git = extensions.getExtension<GitExtension> ('vscode.git')!.exports;
	// If git is not enabled, this will not work
	if(!git.enabled) { 
		window.showErrorMessage("Git is not enabled in this Workspace. Git Angular will not work.",{
			modal: true
		});
		return;
	}
	// get the API Object.
	const gitApi = git.getAPI(1);
	// If this is not a git repo, show an error message.
	if(gitApi.repositories.length == 0) return window.showErrorMessage('Not a git repository', {modal:true}), null;
	// get configuration
	let config = workspace.getConfiguration('gitAngular');
	let disposable = commands.registerCommand('gitAngular.commit', async () => {
		// Alright, let's see what we got.
		const types = config.get('types') as string[],
					scopes = config.get('scopes') as string[],
					allowNewTypes = config.get('allowNewTypes') as boolean,
					allowNewScopes = config.get('allowNewScopes') as boolean;

		// If we are allowing new types, and we have not modified the types, then we need to add it in.
		// new types will be added to this array in the second-to-last position
		if(allowNewTypes && types[types.length-1] != '[New]') types.push('[New]');
		// Configurations can change, and if we are no longer allowing new types, we must remove this.
		else if (!allowNewTypes && types[types.length -1] != '[New]') types.pop();
		// Show a quick pick of the results.
		let type = await window.showQuickPick(types, {placeHolder: 'Type of commit'});
		// If we have a new type available (and the option is enabled) then show an input box.
		if(allowNewTypes && type=='[New]') {
			type = await window.showInputBox({placeHolder: 'New type'});
		}
		// If we don't have a type at this point, something is wrong
		if(!type) {
			return window.showErrorMessage('"type" value was falsey'), null;
		}
		// Next step: the scope. It follows basically the same steps, but I'm just trying to get this to work for right now.
		if(allowNewScopes && scopes[scopes.length -1] != '[New]') scopes.push('[New]');
		else if (!allowNewScopes && scopes[scopes.length] == '[New]') scopes.pop();
		let scope = await window.showQuickPick(scopes, {
			placeHolder: 'Scope'
		});
		if(allowNewScopes && scope == '[New]') scope = await window.showInputBox({
			prompt: 'Please enter a scope for this commit'
		});
		// Same thing: if our scope is not there, going to be hard to commit.
		if(!scope) {
			return window.showErrorMessage('"scope" was falsey'), null;
		}
		// get the subject message
		let message = await window.showInputBox({
			prompt: 'Commit Subject'
		});
		// we gotta declare this outside of the loop
		let repo : Repository | null = null;
		// If we have more than one repo in this workspace
		if(gitApi.repositories.length > 1) {
			repo = await window.showQuickPick(gitApi.repositories.map((repo, index) => {
				return {
					label: repo.rootUri.path,
					v: 'Hi',
					index: index
				}
			}), {placeHolder: 'Please choose the repo this commit is for'}).then(r=> {
				if(!r) return gitApi.repositories[0];
				return gitApi.repositories[r.index]
			});
		} else repo = gitApi.repositories[0];
		// Build the full message		
		const fullMsg = `${type}(${scope}): ${message}\n\n`;
		// set the inputbox value of our repo to the full message
		repo.inputBox.value = fullMsg;
		// show the SCM
		commands.executeCommand('workbench.view.scm', repo.rootUri);
		// If we are allowing new scopes and types, then here is where we save those to the settings
		if(allowNewScopes || allowNewTypes) {
			if(allowNewTypes && types.indexOf(type) == -1) {
				types.splice(types.length - 2,0, type);
				config.update('types', types.slice(0, -1));
			}
			if(allowNewScopes && scopes.indexOf(scope) == -1) {
				scopes.splice(scopes.length - 1, 0, scope);
				config.update('scopes', scopes.slice(0, -1));
			}
		}
	});
	// add in a subscription to workspace config changes
	context.subscriptions.push(workspace.onDidChangeConfiguration( e=> {
		if(e.affectsConfiguration('gitAngular') ) {
			config = workspace.getConfiguration('gitAngular');
		}
	}));

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}

import * as vscode from 'vscode';
import { problemPreviewView } from './preview/ProblemPreviewView';
import { ProblemTreeProvider } from './explorer/ProblemTreeView';
import { acwingManager } from './repo/acwingManager';
import { codeLensController } from "./preview/CodeLensController";
import { AcWingController } from "./AcWingController";
import { acWingTreeItemDecorationProvider } from "./explorer/AcWingTreeItemDecorationProvider";
import { Problem } from './repo/Problem';
import { CourseTreeProvider } from './explorer/CourseTreeView';


export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "acwing" is now active!');

	const problemTreeProvider = new ProblemTreeProvider();
	problemTreeProvider.init(context);

	const acWingController = new AcWingController(context);

	const courseTreeProvider = new CourseTreeProvider();
	const courseTreeView = vscode.window.createTreeView("acWingCourses", { treeDataProvider: courseTreeProvider });
	context.subscriptions.push(courseTreeView);

	context.subscriptions.push(
		codeLensController,
		vscode.window.registerFileDecorationProvider(acWingTreeItemDecorationProvider),
		vscode.commands.registerCommand('acWing.refreshEntry', () => problemTreeProvider.refresh()),
		vscode.commands.registerCommand('acWing.prevPage', () => problemTreeProvider.prevPage()),
		vscode.commands.registerCommand('acWing.nextPage', () => problemTreeProvider.nextPage()),
		vscode.commands.registerCommand('acWing.gotoPage', () => problemTreeProvider.gotoPage()),
		vscode.commands.registerCommand('acWing.toggleViewMode', () => problemTreeProvider.toggleViewMode()),
		vscode.commands.registerCommand("acWing.setCookie", () => acWingController.signIn()),
		vscode.commands.registerCommand("acWing.clear", () => acWingController.clearCache()),
		vscode.commands.registerCommand("acWing.searchProblem", () => acWingController.searchProblem()),
		vscode.commands.registerCommand("acWing.exploreProblem", async (id: string, problem: Problem) => acWingController.exploreProblem(id, problem)),
		vscode.commands.registerCommand("acWing.previewProblem", async (id: string, problem: Problem) => acWingController.previewProblem(id, problem)),
		vscode.commands.registerCommand("acWing.editProblem", async (id: string) => acWingController.editProblem(id)),
		vscode.commands.registerCommand("acWing.newSolution", async (id: string, lang: string) => acWingController.newSolution(id, lang)),
		vscode.commands.registerCommand("acWing.showSource", (async (id: string) => acWingController.showSource(id))),
		vscode.commands.registerCommand("acWing.showSolution", (async (id: string) => acWingController.showSolution(id))),
		vscode.commands.registerCommand("acWing.showSolutionVideo", (async (id: string) => acWingController.showSolutionVideo(id))),
		vscode.commands.registerCommand("acWing.showDiscussion", (async (id: string) => acWingController.showDiscussion(id))),
		vscode.commands.registerCommand("acWing.showSubmitRecord", (async (id: string) => acWingController.showSubmitRecord(id))),
		vscode.commands.registerCommand("acWing.runSolution", (async (problemID: string, uri: vscode.Uri, lang: string) => acWingController.runSolution(problemID, uri, lang))),
		vscode.commands.registerCommand("acWing.submitSolution", (async (problemID: string, uri: vscode.Uri, lang: string) => acWingController.submitSolution(problemID, uri, lang))),
		vscode.commands.registerCommand("acWing.configure", () => vscode.commands.executeCommand("workbench.action.openSettings", `AcWing`)),
		vscode.commands.registerCommand('acWing.refreshCourses', () => courseTreeProvider.refresh())
	)
}


export function deactivate() {
	
}

import * as vscode from 'vscode';
import * as _ from "lodash";
import { acwingManager } from "../repo/acwingManager";
import { Problem, ProblemState } from '../repo/Problem';
import { SourceGroup, TreeNode } from './SourceGroup';

export class ProblemTreeProvider implements vscode.TreeDataProvider<TreeNode> {

	private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined | void> = new vscode.EventEmitter<TreeNode | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | void> = this._onDidChangeTreeData.event;

	private currentPage = 1;
	private problemList: Problem[] = [];
	private treeView: vscode.TreeView<TreeNode> | undefined;
	private mContext: vscode.ExtensionContext | undefined;
	private viewMode: 'flat' | 'group' = 'flat';

	constructor() {

	}

	public init (context: vscode.ExtensionContext) {
		this.currentPage = context.globalState.get('lastPage', 1);
		this.viewMode = vscode.workspace.getConfiguration().get<'flat' | 'group'>("acWing.viewMode", 'flat');
		let acWingTreeView = vscode.window.createTreeView("acWing", {treeDataProvider: this});
		acWingTreeView.title = this.currentPage.toString();
		this.setTreeView(acWingTreeView);
		context.subscriptions.push(acWingTreeView);
		this.mContext = context;
	}

	public async refresh(): Promise<void> {
		let newProblemList = await acwingManager.getProblemsByPage(this.currentPage, true);
		if (newProblemList && newProblemList.length == this.problemList.length) {
			for (let i = 0; i < newProblemList.length; i++) {
				if (!_.isEqual(newProblemList[i], this.problemList[i])) {
					break;
				}
			}
			console.log('ProblemTreeProvider refresh() skip.');
			return;
		}
		console.log('ProblemTreeProvider refresh() fire');
		this._onDidChangeTreeData.fire();
	}

	public async prevPage (): Promise<void> {
		let maxPage = acwingManager.getMaxPage();
		if (maxPage != 0 && this.currentPage >= maxPage) {
			return;
		}
		this.currentPage++;
		this.updateTitlte();
		this._onDidChangeTreeData.fire();
	}

	public async nextPage (): Promise<void> {
		if (this.currentPage <= 1) {
			return;
		}
		this.currentPage--;
		this.updateTitlte();
		this._onDidChangeTreeData.fire();
	}

	public async gotoPage (): Promise<void> {
		const pageOption: vscode.InputBoxOptions = {
			title: "请输入页码",
			prompt: "页码:",
		};
		const inputPage: string | undefined = await vscode.window.showInputBox(pageOption);
		if (!inputPage || isNaN(parseInt(inputPage))) {
			return;
		}

		let page = parseInt(inputPage);
		console.log('gotoPage() ' + page);

		if (page < 1 || (acwingManager.getMaxPage() != 0 && page > acwingManager.getMaxPage())) {
			return;
		}
		this.currentPage = page;
		this.updateTitlte();
		this._onDidChangeTreeData.fire();
	}

	public toggleViewMode(): void {
		this.viewMode = this.viewMode === 'flat' ? 'group' : 'flat';
		vscode.workspace.getConfiguration().update("acWing.viewMode", this.viewMode, vscode.ConfigurationTarget.Global);
		this._onDidChangeTreeData.fire();
	}

	public setTreeView(view: vscode.TreeView<TreeNode>) {
		this.treeView = view;
	}

	private updateTitlte () {
		if (!this.treeView) {
			return;
		}
		let maxPage = acwingManager.getMaxPage();
		this.treeView.title = `${this.currentPage}`;
		if (maxPage) {
			this.treeView.title = this.treeView.title + '/' + maxPage;
		}
		if (this.viewMode === 'group') {
			this.treeView.title += ' (分组)';
		}
	}

	getTreeItem(element: TreeNode): vscode.TreeItem {
		if (element instanceof SourceGroup) {
			return SourceGroup.toTreeItem(element);
		}
		return Problem.toTreeItem(element);
	}

	async getChildren(element?: TreeNode): Promise<TreeNode[]> {
		if (!acwingManager.isLogin()) {
			vscode.window.showInformationMessage('请设置acwing cooke.', ... ['OK']).then(function(val) {
				if (val) {
					vscode.commands.executeCommand('acWing.setCookie');
				}
			});
			let problem = new Problem();
			problem.id = "notSignIn",
			problem.name = "Set cookie to sign in to acwing";
			return [ problem ];
		}

		if (!element) {
			let problemNodes = await acwingManager.getProblemsByPage(this.currentPage);
			if (problemNodes) {
				this.problemList = problemNodes;
				this.updateTitlte();
				this.mContext?.globalState.update('lastPage', this.currentPage);

				if (this.viewMode === 'group') {
					const map = new Map<string, Problem[]>();
					for (const p of problemNodes) {
						const key = p.source || '未分类';
						if (!map.has(key)) { map.set(key, []); }
						map.get(key)!.push(p);
					}
					return Array.from(map.entries()).map(([s, ps]) => new SourceGroup(s, ps));
				}
				return problemNodes;
			}
		}

		if (element instanceof SourceGroup) {
			return element.problems;
		}

		return [];
	}
}

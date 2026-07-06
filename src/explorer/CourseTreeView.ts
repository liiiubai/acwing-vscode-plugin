import * as vscode from 'vscode';
import { acwingManager } from "../repo/acwingManager";
import { Course } from '../repo/Course';
import { CourseSection } from '../repo/CourseSection';
import { Problem } from '../repo/Problem';

export type CourseTreeNode = Course | CourseSection | Problem;

export class CourseTreeProvider implements vscode.TreeDataProvider<CourseTreeNode> {

    private _onDidChangeTreeData: vscode.EventEmitter<CourseTreeNode | undefined | void> = new vscode.EventEmitter<CourseTreeNode | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<CourseTreeNode | undefined | void> = this._onDidChangeTreeData.event;

    public refresh(): void {
        acwingManager.clearCourseCache();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: CourseTreeNode): vscode.TreeItem {
        if (element instanceof Course) {
            return {
                label: element.name,
                description: element.description,
                tooltip: element.description || element.name,
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                iconPath: vscode.ThemeIcon.Folder,
            };
        }
        if (element instanceof CourseSection) {
            return {
                label: element.name,
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                iconPath: vscode.ThemeIcon.Folder,
            };
        }
        return Problem.toTreeItem(element);
    }

    async getChildren(element?: CourseTreeNode): Promise<CourseTreeNode[]> {
        if (!acwingManager.isLogin()) {
            vscode.window.showInformationMessage('请设置 AcWing Cookie 以查看课程', '设置Cookie').then(val => {
                if (val) {
                    vscode.commands.executeCommand('acWing.setCookie');
                }
            });
            return [];
        }

        if (!element) {
            return acwingManager.fetchCourses();
        }

        if (element instanceof Course) {
            const sections = await acwingManager.fetchCourseProblems(element.id);
            return sections;
        }

        if (element instanceof CourseSection) {
            return element.problems;
        }

        return [];
    }
}

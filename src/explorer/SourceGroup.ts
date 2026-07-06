import { ThemeIcon, TreeItem, TreeItemCollapsibleState } from "vscode";
import { Problem } from "../repo/Problem";

export class SourceGroup {
    constructor(public readonly source: string, public readonly problems: Problem[]) {}

    public static toTreeItem(element: SourceGroup): TreeItem {
        return {
            label: `${element.source} (${element.problems.length})`,
            collapsibleState: TreeItemCollapsibleState.Expanded,
            iconPath: ThemeIcon.Folder,
        };
    }
}

export type TreeNode = SourceGroup | Problem;

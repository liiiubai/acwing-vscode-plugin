/*
 * @Author: richard 
 * @Date: 2022-11-17 14:56:00 
 * @Last Modified by:   richard 
 * @Last Modified time: 2022-11-17 14:56:00 
 */
import { Command, ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from "vscode";
import * as path from "path";

export enum ProblemState {
    EMPTY,
    ACCEPTED,
    TRY,
};

export class Problem {
    private _id: string = "";
    private _index: string = "";
    private _name: string = "";
    private _state: ProblemState = ProblemState.EMPTY;
    private _difficulty: string = "";
    private _passRate: string = "";
    private _source: string = "";
    public activityProblemId: string = "";

    constructor () {

    }

    public get id(): string {
        return this._id;
    }
    public set id(value: string) {
        this._id = value;
    }

    public get name(): string {
        return this._name;
    }

    public set name(value: string) {
        this._name = value;
    }

    public get state(): ProblemState {
        return this._state;
    }

    public set state(value: ProblemState) {
        this._state = value;
    }

    public get difficulty(): string {
        return this._difficulty;
    }

    public set difficulty(value: string) {
        this._difficulty = value;
    }

    public get passRate(): string {
        return this._passRate;
    }

    public set passRate(value: string) {
        this._passRate = value;
    }

    public get index(): string {
        return this._index;
    }

    public set index(value: string) {
        this._index = value;
    }

    public get source(): string {
        return this._source;
    }

    public set source(value: string) {
        this._source = value;
    }

    public get uri(): Uri {
        return Uri.from({
            scheme: "acwing",
            authority: "problems",
            path: `/${this.id}`,
            query: `difficulty=${this.difficulty}`,
        });
    }

    public static toTreeItem(element: Problem): TreeItem {
        if (element.id === "notSignIn") {
            return {
                label: element.name,
                collapsibleState: TreeItemCollapsibleState.None,
                command: {
                    command: "acWing.setCookie",
                    title: "登录设置cookies",
                    arguments: []
                },
            };
        }

        let iconPath: string = "";
        if (element.state == ProblemState.ACCEPTED) {
            iconPath = path.join(__filename, '..', '..', '..', 'resources', 'check.png');
        } else if (element.state == ProblemState.TRY) {
            iconPath = path.join(__filename, '..', '..', '..', 'resources', 'x.png');
        } else {
            iconPath = path.join(__filename, '..', '..', '..', 'resources', 'blank.png');
        }
        return {
            label: `${element.index}. ${element.name}`,
            tooltip: `${element.difficulty}, 通过率 ${element.passRate}`,
            iconPath: iconPath,
            resourceUri: element.uri,
            collapsibleState: TreeItemCollapsibleState.None,
            command: {
                title: "Click Problem",
                command: "acWing.exploreProblem",
                arguments: [element.id, element],
            }
        };
    }
}

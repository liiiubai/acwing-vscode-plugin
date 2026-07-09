# 改进 Code Now：项目目录保存 + 多解法支持

## Context

当前 Code Now 代码保存到 globalStorage 远离项目目录，且每题只能一个文件。

## 改动

### 1. 文件保存路径 (AcWingController.ts L177-180)

优先级：1) acWing.workspaceFolder 配置 2) 工作区+/acwing/ 3) globalStorageUri(回退)

目录结构：
{workspace}/acwing/{题号}.{题目名}/sol1.cpp

### 2. 多解法命名 (AcWingController.ts L181-184)

- 目录不存在 → 创建 + sol1
- 目录已存在 → 扫描 sol* 取 max+1
- editProblem 打开已有 sol1（不再 skip）
- 新增 newSolution 方法

### 3. 新命令 (package.json, extension.ts)

- acWing.newSolution

### 4. CodeLens 跳转 (CustomCodeLensProvider.ts)

- "新建解法" 按钮
- "切换解法" 按钮（同目录其他 sol 文件）

### 5. 修改 editProblem (AcWingController.ts)

- sol1 已存在 → 直接打开
- 新增 newSolution

## 文件清单

- src/AcWingController.ts
- src/preview/CustomCodeLensProvider.ts
- package.json
- src/extension.ts

## 验证

1. 编译通过
2. Code Now → {workspace}/acwing/{题号}.{题目名}/sol1.cpp
3. 再次点击 → 打开已有 sol1
4. 新建解法 → sol2
5. 切换解法 → sol1/sol2 跳转
6. 运行/提交正常
7. 无工作区 → globalStorage 回退

---
title: VM 生命周期与状态
description: 说明 VM 生命周期状态机的状态、转换与提交边界，并概述本章各节内容。
group: design
order: 25
source: doc/design/5-vm-lifecycle-and-state.md
---

[架构文档](/docs/design/)

如图 5.1 所示，VM 生命周期是一个带有明确所有权和提交边界的状态机。冷启动创建一个新的机器代次。快照在发布不可变状态之后终止一个代次。恢复则从该状态创建一个新的进程代次，并重建进程本地的资源。

本章定义从创建到执行、捕获、恢复与终止之间的状态转换。

**图 5.1。** VM 生命周期状态与状态转换。

状态机包含 6 个具名状态，以及初始边界和终止边界：

- `[*]`（初始）：没有前置状态，直接进入构建中。
- **构建中**（Constructing）
- **运行中**（Running）
- **捕获中**（Capturing）
- **已发布**（Published）
- **停止中**（Stopping）
- **失败**（Failed）
- `[*]`（终止）：由停止中或失败到达，表示生命周期结束。

状态转换：

| 源状态 | 触发条件 | 目标状态 |
| --- | --- | --- |
| `[*]`（初始） | 生命周期开始 | 构建中（Constructing） |
| 构建中（Constructing） | 启动或恢复成功 | 运行中（Running） |
| 运行中（Running） | 客户机快照请求 | 捕获中（Capturing） |
| 捕获中（Capturing） | 在边界之前被拒绝 | 运行中（Running） |
| 捕获中（Capturing） | 发布提交 | 已发布（Published） |
| 已发布（Published） | 源代次终止 | `[*]`（终止） |
| 已发布（Published） | 克隆或续跑（resume） | 构建中（Constructing） |
| 运行中（Running） | 客户机退出或宿主停止 | 停止中（Stopping） |
| 构建中（Constructing） | 校验或重建失败 | 失败（Failed） |
| 捕获中（Capturing） | 边界变得不确定 | 失败（Failed） |
| 停止中（Stopping） | 无条件 | `[*]`（终止） |
| 失败（Failed） | 无条件 | `[*]`（终止） |

## 目录

- [5.1 启动协议](/docs/design/5.1-boot-protocol/)：定义启动输入、初始机器状态与内核交接。
- [5.2 就绪与运行时控制](/docs/design/5.2-readiness-and-runtime-control/)：定义就绪边界与受支持的控制操作。
- [5.3 快照协议](/docs/design/5.3-snapshot-protocol/)：定义捕获发起、静默、状态收集与发布。
- [5.4 快照产物与挂载模型](/docs/design/5.4-snapshot-artifact-and-attachment-model/)：定义持久化产物、身份、共享范围与外部资源。
- [5.5 恢复协议](/docs/design/5.5-restore-protocol/)：定义准入、重建、客户机修复、熵刷新与返回执行。
- [5.6 关机与失败语义](/docs/design/5.6-shutdown-and-failure-semantics/)：定义有序退出、拆除与终止性失败边界。

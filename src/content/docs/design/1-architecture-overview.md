---
title: 架构总览
description: NVX 架构的目的、主要组件、信任边界与兼容性原则概览。
group: design
order: 1
source: doc/design/1-architecture-overview.md
---

[架构文档](/docs/design/)

NVX 提供一个小巧且带版本管理的虚拟机，用于在 Linux 或 Windows 宿主上运行 Linux 工作负载（见图 1.1）。客户机可见的机器由 NVX 机器配置文件决定，而不是从所选的 hypervisor 推断得出。KVM、MSHV 和 WHP 提供执行服务，而机器配置文件定义统一的启动、CPU、内存、设备、时间和生命周期契约。

本章介绍 NVX 的目的、主要架构元素、信任边界和兼容性原则。

**图 1.1。** NVX 架构的高层视图。

图中结构（自上而下排列，`→` 表示单向依赖，`↔` 表示双向交互）：

- **宿主编排器**（Host Orchestrator）：配置、策略与挂载
  - → **OpenVMM NVX 机器配置文件**（OpenVMM NVX Machine Profile）：机器、设备与生命周期
    - → **执行后端**（Execution backend）：KVM、MSHV 或 WHP
    - ↔ **客户机内核与客户机代理**（Guest kernel and guest agents）：启动、修复与监管
      - → **单个隔离的工作负载**（Single isolated workload）
    - ↔ **不可变快照产物与外部挂载**（Immutable snapshot artifacts and external attachments）

## 目录

- [1.1 目标](/docs/design/1.1-goals/)：定义架构所提供的属性。
- [1.2 非目标](/docs/design/1.2-non-goals/)：明确不在架构范围内的关注点。
- [1.3 系统组件与职责](/docs/design/1.3-system-components-and-responsibilities/)：识别宿主、VMM 和客户机组件，并为每个组件分配职责。
- [1.4 信任边界](/docs/design/1.4-trust-boundaries/)：描述受信任与不受信任的行为主体、敏感数据流和验证边界。
- [1.5 兼容性与版本模型](/docs/design/1.5-compatibility-and-versioning-model/)：说明客户机可见的契约和持久化状态如何演进。

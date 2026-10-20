---
title: 客户机运行时架构
description: 说明 NVX 客户机运行时如何把一个微虚拟机变成一个隔离的工作负载沙箱，并概述本章各节内容。
group: design
order: 20
source: doc/design/4-guest-runtime-architecture.md
---

[架构文档](/docs/design/)

NVX 客户机运行时把一个微虚拟机变成一个工作负载沙箱。客户机代理在整个 VM 生命周期内监管该工作负载。在[分层沙箱根](/docs/design/4.1-guest-filesystem-and-image-model/)中，它们始终位于工作负载的命名空间之外；[无块托管根](/docs/design/4.1-guest-filesystem-and-image-model/)则不创建任何命名空间，而是把工作负载连同其凭据和一个 cgroup 一起容纳其中。该架构不引入 pod 基础设施、pause 容器，也不引入用于创建任意额外容器的客户机侧服务。

本章描述客户机如何把虚拟机变成一个隔离的工作负载沙箱。

## 目录

- [4.1 客户机文件系统与镜像模型](/docs/design/4.1-guest-filesystem-and-image-model/)：解释镜像层、可写暂存、叠加组装与实时共享。
- [4.2 客户机代理与工作负载模型](/docs/design/4.2-guest-agents-and-workload-model/)：定义客户机代理与工作负载之间的关系。
- [4.3 隔离与资源模型](/docs/design/4.3-isolation-and-resource-model/)：描述身份、命名空间、能力、设备与 cgroups。
- [4.4 宿主—客户机控制接口](/docs/design/4.4-host-guest-control-interface/)：定义经认证的运行时操作及其会话语义。

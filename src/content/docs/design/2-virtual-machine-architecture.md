---
title: 虚拟机架构
description: 定义呈现给客户机的、与后端无关的虚拟平台，并给出本章各节的内容索引。
group: design
order: 7
source: doc/design/2-virtual-machine-architecture.md
---

[架构文档](/docs/design/)

NVX 机器配置（machine profile）在每个受支持的后端上呈现一个固定的 Linux 平台。机器配置是一个允许列表（allowlist）：它直接构建所需的机器，而不是先创建一台标准 PC 再移除设备。

本章定义呈现给客户机的、与后端无关的虚拟平台。

## 目录

- [2.1 机器模型与配置](/docs/design/2.1-machine-model-and-configuration/)：定义机器身份、不变配置以及客户机可见设置的归属。
- [2.2 CPU 与拓扑](/docs/design/2.2-cpu-and-topology/)：描述虚拟处理器模型、拓扑、特性表面和处理器容量。
- [2.3 内存布局](/docs/design/2.3-memory-layout/)：定义 RAM、保留区域、MMIO 窗口和容量行为。
- [2.4 中断与 I/O 架构](/docs/design/2.4-interrupt-and-io-architecture/)：描述中断路由、端口 I/O、MMIO 和设备通知。
- [2.5 设备拓扑、传输与发现](/docs/design/2.5-device-topology-transport-and-discovery/)：定义固定的设备身份、地址、中断、传输和发现机制。

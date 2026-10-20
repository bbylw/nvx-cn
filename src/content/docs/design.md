---
title: 架构设计
description: NVX 微虚拟机与单工作负载客户机运行时的架构总览，以及 31 篇架构章节的中文导航。
group: dev
order: 1
source: doc/design
---

这一章描述 NVX 微虚拟机及其单工作负载客户机运行时的架构。它按架构概念而不是实现组件来组织设计。

实现状态、当前限制、验证过程、测试覆盖和交付计划有意不放进这套架构指南，它们分散在上游仓库的[持续集成](/docs/ci/)、[对抗性测试](/docs/adversarial-testing/)和[打包与源码交付](/docs/distribution/)文档里。

## 这套手册讲什么

NVX 提供一个小型、带版本的虚拟机，在 Linux 或 Windows 宿主上运行 Linux 工作负载。客户机看到的机器由 **NVX 机器配置档**定义，而不是从选中的 hypervisor 反推：KVM、MSHV、WHP 只提供执行服务，机器配置档则给出一套统一的启动、CPU、内存、设备、时间与生命周期契约。

按这个思路，整套手册分成五章：

| 章节 | 说明 |
| --- | --- |
| [1. 架构总览](/docs/design/1-architecture-overview/) | NVX 的目标、主要架构元素、信任边界与兼容性原则。 |
| [2. 虚拟机架构](/docs/design/2-virtual-machine-architecture/) | 呈现给客户机的、与后端无关的虚拟平台。 |
| [3. 虚拟设备](/docs/design/3-virtual-devices/) | 每类设备对客户机可见的行为。 |
| [4. 客户机运行时架构](/docs/design/4-guest-runtime-architecture/) | 客户机如何把虚拟机变成隔离的工作负载沙箱。 |
| [5. VM 生命周期与状态](/docs/design/5-vm-lifecycle-and-state/) | 从创建、执行、捕获、恢复到终止的状态转换。 |

## 架构总览

宿主侧的编排器负责配置、策略和挂载；OpenVMM 的 NVX 机器配置档负责机器、设备与生命周期；KVM、MSHV 或 WHP 提供执行后端；客户机内核与客户机代理负责启动、修复与监管；最终承载的是**单个隔离的工作负载**；快照产物与外部挂载则与机器配置档双向联动。

用一条链条描述就是：

1. 宿主编排器把配置、策略和挂载交给 NVX 机器配置档。
2. 机器配置档把机器状态与设备模型交给执行后端（KVM、MSHV 或 WHP）。
3. 客户机内核启动，客户机代理接管修复与监管。
4. 客户机代理拉起唯一的工作负载。
5. 快照产物与外部挂载在生命周期中随时可以接入或摘除。

这条链路的信任边界写在[信任边界](/docs/design/1.4-trust-boundaries/)里；机器侧的契约写在[机器模型与配置](/docs/design/2.1-machine-model-and-configuration/)里；客户机侧的工作负载模型写在[客户机代理与工作负载模型](/docs/design/4.2-guest-agents-and-workload-model/)里。

## 第 1 章 · 架构总览

- [1.1 目标](/docs/design/1.1-goals/)：定义架构提供的属性。
- [1.2 非目标](/docs/design/1.2-non-goals/)：划定架构范围之外的关注点。
- [1.3 系统组件与职责](/docs/design/1.3-system-components-and-responsibilities/)：识别宿主、VMM 与客户机组件，并分配各自职责。
- [1.4 信任边界](/docs/design/1.4-trust-boundaries/)：描述受信与不受信主体、敏感数据流与校验边界。
- [1.5 兼容性与版本模型](/docs/design/1.5-compatibility-and-versioning-model/)：说明客户机可见契约与持久化状态如何演进。

## 第 2 章 · 虚拟机架构

- [2.1 机器模型与配置](/docs/design/2.1-machine-model-and-configuration/)：定义机器身份、不变配置，以及客户机可见设置的所有权。
- [2.2 CPU 与拓扑](/docs/design/2.2-cpu-and-topology/)：描述虚拟处理器模型、拓扑、特性面与处理器容量。
- [2.3 内存布局](/docs/design/2.3-memory-layout/)：定义 RAM、保留区域、MMIO 窗口与容量行为。
- [2.4 中断与 I/O 架构](/docs/design/2.4-interrupt-and-io-architecture/)：描述中断路由、端口 I/O、MMIO 与设备通知。
- [2.5 设备拓扑、传输与发现](/docs/design/2.5-device-topology-transport-and-discovery/)：定义固定设备身份、地址、中断、传输与发现机制。

## 第 3 章 · 虚拟设备

- [3.1 平台控制设备](/docs/design/3.1-platform-control-device/)：覆盖字节通道、关机与快照请求功能。
- [3.2 时钟与时间](/docs/design/3.2-clock-and-time/)：定义时钟源、定时器行为、速率与时间连续性。
- [3.3 控制台](/docs/design/3.3-consoles/)：把启动通信与经认证的运行时控制分开。
- [3.4 块存储](/docs/design/3.4-block-storage/)：定义固定存储角色、分层、可变性与保存状态。
- [3.5 网络](/docs/design/3.5-network/)：定义网络身份、连通性、策略、入站访问与数据包流转。
- [3.6 宿主文件系统](/docs/design/3.6-host-filesystem/)：定义 virtio-fs 请求路径、宿主支持导出、访问策略与会话状态保存。

## 第 4 章 · 客户机运行时架构

- [4.1 客户机文件系统与镜像模型](/docs/design/4.1-guest-filesystem-and-image-model/)：解释镜像分层、可写暂存、叠加组装与实时共享。
- [4.2 客户机代理与工作负载模型](/docs/design/4.2-guest-agents-and-workload-model/)：定义客户机代理与工作负载之间的关系。
- [4.3 隔离与资源模型](/docs/design/4.3-isolation-and-resource-model/)：描述身份、命名空间、能力、设备与 cgroups。
- [4.4 宿主—客户机控制接口](/docs/design/4.4-host-guest-control-interface/)：定义经认证的运行时操作及其会话语义。

## 第 5 章 · VM 生命周期与状态

- [5.1 启动协议](/docs/design/5.1-boot-protocol/)：定义启动输入、初始机器状态与内核移交。
- [5.2 就绪与运行时控制](/docs/design/5.2-readiness-and-runtime-control/)：定义就绪边界与受支持的控制操作。
- [5.3 快照协议](/docs/design/5.3-snapshot-protocol/)：定义捕获发起、静默、状态收集与发布。
- [5.4 快照产物与挂载模型](/docs/design/5.4-snapshot-artifact-and-attachment-model/)：定义持久化产物、身份、共享范围与外部资源。
- [5.5 恢复协议](/docs/design/5.5-restore-protocol/)：定义准入、重建、客户机修复、熵刷新与返回执行。
- [5.6 关机与失败语义](/docs/design/5.6-shutdown-and-failure-semantics/)：定义有序退出、拆除与终止性失败边界。

## 配套文档

架构章节回答“系统长什么样”，操作类文档回答“怎么用起来”：

- [环境准备](/docs/setup/)：KVM、MSHV、WHP 各自的宿主要求。
- [构建](/docs/build/)：编译 NVX、校验内核配置、打包客户机。
- [运行](/docs/run/)：启动、退出、网络策略、挂载与直接运行 OpenVMM。
- [命令行参考](/docs/usage/)：nvx.py 与 nvx-rs 的全部命令和选项。
- [Rust API](/docs/rust-api/)：在 Rust 中驱动沙箱生命周期。

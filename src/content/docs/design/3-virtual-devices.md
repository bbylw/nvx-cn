---
title: 虚拟设备
description: 虚拟设备向客户机暴露少量稳定的接口，本章规定每一类设备对客户机可见的行为。
group: design
order: 13
source: doc/design/3-virtual-devices.md
---

[架构文档](/docs/design/)

虚拟设备向客户机暴露少量稳定的接口。每个接口都有固定的身份标识和放置位置、有界的状态，以及在捕获与恢复期间明确的行为。

本章规定每一类设备对客户机可见的行为。

## 目录

- [3.1 平台控制设备](/docs/design/3.1-platform-control-device/)：涵盖字节通道、关机和快照请求功能。
- [3.2 时钟与时间](/docs/design/3.2-clock-and-time/)：定义时钟源、定时器行为、速率和时间连续性。
- [3.3 控制台](/docs/design/3.3-consoles/)：把启动通信与经过认证的运行时控制区分开来。
- [3.4 块存储](/docs/design/3.4-block-storage/)：定义固定的存储角色、分层、可写性和已保存状态。
- [3.5 网络](/docs/design/3.5-network/)：定义网络身份、连通性、策略、入站访问和数据包流。
- [3.6 宿主文件系统](/docs/design/3.6-host-filesystem/)：定义 virtio-fs 请求路径、宿主支持的导出、访问策略和已保存的会话状态。

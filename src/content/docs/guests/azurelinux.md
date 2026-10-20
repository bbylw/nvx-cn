---
title: Azure Linux 客户机支持
description: NVX 如何在自有内核上运行 Azure Linux 用户态，以及内核与根文件系统策略。
group: guest
order: 2
source: doc/guests/azurelinux-guest.md
---

NVX 在自有 Linux 内核上运行 Azure Linux 3.0 用户态。它构建一个产物 `initramfs-azurelinux.cpio.gz`，供 `nvx.py run --guest azurelinux` 启动以进入交互式 shell 或运行工作负载。该产物不启动 Azure Linux 内核、固件或 systemd，也不改变[机器与设备 ABI](/docs/design/2-virtual-machine-architecture/)。

[构建](/docs/build/)、[运行](/docs/run/)和[命令行参考](/docs/usage/)介绍相关命令。本章说明各部分如何配合以及为什么这样设计。

## 角色

Azure Linux initramfs 是工作负载客户机，而不是沙箱控制环境。Alpine 仍是 `run` 的默认客户机，也是 `sandbox` 唯一的控制环境：

- initramfs 省略沙箱 init 代理，因此通用 `/init` 拒绝沙箱模式；
- 微虚拟机测试夹具会拒绝 Azure Linux 的沙箱控制场景；并且
- `build-distro-layer` 只接受 Ubuntu，因此没有 Azure Linux 沙箱层。

恢复从捕获的 RAM 和机器契约获取客户机，因此 `run` 拒绝 `--guest azurelinux` 与 `--restore-snapshot` 一同使用。

## 内核策略

该 initramfs 启动与 Alpine 和 Ubuntu 相同的 `build/vmlinux`。[Ubuntu 章节](/docs/guests/ubuntu/)描述了该内核提供和省略了什么。因此 Azure Linux 支持意味着 NVX 内核策略下的 Azure Linux 用户态，而不是与每个 Azure Linux 工作负载兼容。

## 根文件系统构建器

该 initramfs 只用 Docker 构建：`build-initramfs --guest azurelinux` 以及选择 Azure Linux 的 `build-guest` 使用 Docker 构建，而 `build-guest --native` 拒绝 Azure Linux。该[Dockerfile](https://github.com/microsoft/nvx/blob/dev/docker/Dockerfile)（英文原文）从固定输入定义构建：

- **基础镜像**：来自 MCR 的 Azure Linux 3.0 `base/core` 容器镜像，按摘要固定。`SOURCE-MANIFEST.json` 重复发布版、镜像和软件包锁摘要，当它们与构建常量不一致时 `scripts/nvx.py verify` 会失败。
- **补充软件包**来自 [`azurelinux/packages.lock.json`](https://github.com/microsoft/nvx/blob/dev/azurelinux/packages.lock.json)（英文原文）中的锁，它添加 `busybox` 和 `util-linux`（`setpriv` 的来源）及其依赖。每个条目记录 RPM 的名称、版本、发布号、架构、URL 和 SHA-256。锁必须指明与构建相同的发布版、架构和基础镜像，并且每个 URL 都必须指向 `packages.microsoft.com` 上的 Azure Linux 3.0 基础仓库。

构建随后：

1. 下载每个被锁定的 RPM 并校验其 SHA-256；
2. 在固定的基础镜像内导入 Microsoft RPM 签名密钥，检查每个 RPM 的签名，安装这些 RPM，并要求存在 `ldd`、`setpriv` 和 BusyBox；
3. 记录已安装的 RPM 清单，用于软件包清单；
4. 安装通用 NVX `/init`、它需要的客户机脚本，以及与 Alpine 和 Ubuntu 相同的九个静态 Rust 二进制，因此它们不依赖 Azure Linux 库；
5. 链接共享客户机脚本所需的 BusyBox applet，包括 `/bin/sh`；其他所有命令都解析到 Azure Linux 软件包；
6. 让 UID 65534 的 `nobody` 账户拥有空主目录 `/nonexistent` 而不是 `/dev/null`，因为工作负载身份需要存在的主目录；并且
7. 移除记录安装时状态的 RPM 与软件包管理器数据库和缓存。

归档以 root 为属主，时间戳设为 Unix 纪元，文件顺序经过排序，并且没有压缩时间戳，因此用相同输入重建预期是字节一致的。与 Ubuntu 产物不同，没有自动化检查比较两次 Azure Linux 重建。

## Azure Linux initramfs

Azure Linux initramfs 在机器层面的启动方式与 Alpine 相同：OpenVMM 通过 [Linux 直接 MP 表加载器](/docs/design/5.1-boot-protocol/)加载内核和 initramfs，通用的 [`/init`](https://github.com/microsoft/nvx/blob/dev/guest/common/init)（英文原文）作为 PID 1 运行。它运行与其他客户机相同的启动步骤，包括[时间 ABI](/docs/design/3.2-clock-and-time/)启动步骤，然后运行 `nvx_exec` 工作负载、启动托管代理，或打开 shell。托管代理直接在 initramfs 根中运行工作负载，而不是在单独的层中。在 shell 路径上，`/init` 从 `/etc/os-release` 读取客户机身份，遇到未知身份就停止，打印 `NVX-GUEST-BOOT-OK: azurelinux`，并启动 BusyBox shell。

与 Ubuntu 一样，客户机默认 512 MiB，因为内核把 initramfs 解压到上限为一半客户机内存的 RAM 文件系统中；见[运行](/docs/run/)。

## 来源信息与对应源码

软件包清单 `initramfs-azurelinux.cpio.gz.packages.json` 记录发布版、架构、基础镜像、输入摘要和产物 SHA-256。每个软件包条目给出 RPM 的版本、发布号、架构、许可证和源码 RPM。该清单还记录共享的聚合 Rust 源码摘要，以及九个已安装客户机二进制各自的摘要。输入摘要是一个域分隔的 SHA-256，覆盖发布版、架构、基础镜像，以及定义该构建的检出文件：Dockerfile、软件包锁、构建模块、客户机脚本、完整的 `nvx-rs` 客户机输入集和 `rust-toolchain.toml`。

发布版暂存会拒绝与产物、基础镜像或当前输入不匹配的清单。只有纯二进制软件包携带这两个 Azure Linux 文件；已发布的平台发布版是纯二进制的，`download` 会安装它们。`collect-sources` 不收集 Azure Linux 对应源码，因此 `package --include-source` 会省略该客户机；见[软件包与源码交付](/docs/distribution/)和[发布版布局](/docs/build/)。

## 验证

当其输入变化时，CI 在 Docker 中重建该 initramfs。[微虚拟机测试工作流](https://github.com/microsoft/nvx/blob/dev/.github/workflows/run-nvx-microvm-tests.yml)（英文原文）在每个后端上以单个处理器运行 Azure Linux 的启动、身份、控制台退出、网络、网络快照、工作负载身份和托管生命周期场景。Azure Linux 不属于性能门禁的一部分。

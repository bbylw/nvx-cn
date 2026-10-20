---
title: Ubuntu 客户机支持
description: NVX 如何在自有内核上运行 Ubuntu 用户态，以及根文件系统的构建方式。
group: guest
order: 1
source: doc/guests/ubuntu-guest.md
---

NVX 在自有 Linux 内核上运行 Ubuntu 用户态。它从一个固定的 Ubuntu Base 根文件系统构建两个产物：一个供 `nvx.py run` 启动以进入交互式 Ubuntu shell 的 initramfs，以及一个供 `nvx.py sandbox` 作为非 root 工作负载运行的 EROFS `distro` 层。两个产物都不启动 Ubuntu 内核、固件或 systemd，也不改变[机器与设备 ABI](/docs/design/2-virtual-machine-architecture/)。

[构建](/docs/build/)、[运行](/docs/run/)和[命令行参考](/docs/usage/)介绍相关命令。本章说明各部分如何配合以及为什么这样设计。

## 角色

| 产物 | 使用者 | 启动监管程序 |
| --- | --- | --- |
| `initramfs-ubuntu.cpio.gz` | `nvx.py run --guest ubuntu` | Ubuntu initramfs 内部的通用 NVX `/init` |
| `ubuntu-distro.erofs` | `nvx.py sandbox --layer distro,...` | Alpine 控制 initramfs 及其 init 代理 |

Alpine 仍是 `run` 的默认客户机，也是 `sandbox` 唯一的控制环境。沙箱启动器始终启动 Alpine initramfs，微虚拟机测试夹具会拒绝 Ubuntu 的沙箱控制场景。把受信任的代理留在 Alpine 上，使其与 Ubuntu 发布版解耦，并让沙箱快照契约保持不变。

NVX 从 Ubuntu Base 这一普通的根文件系统归档开始，而不是 Ubuntu 云镜像。云镜像是带自有内核、引导加载程序和 cloud-init 策略的 UEFI/GPT 磁盘，而无固件的 Linux 直接启动不会用到其中任何一项。

## 内核策略

两个产物都启动与 Alpine 相同的 `build/vmlinux`。该内核在这台机器上提供 Ubuntu 用户态所需的能力：

- 使用 Intel MP 表且无 ACPI 的 Linux 直接启动；
- devtmpfs、procfs、sysfs 和 tmpfs；
- virtio-mmio 块、网络、控制台和文件系统设备；
- ext4、EROFS 和 overlayfs；以及
- 沙箱使用的 cgroups 以及 PID、挂载、UTS、IPC 和网络命名空间。

其[补丁](https://github.com/microsoft/nvx/blob/dev/kernel/patches)（英文原文）添加 xe9 早期控制台与交互式控制台，以及共享的 virtio-mmio 中断状态。[内核配置](https://github.com/microsoft/nvx/blob/dev/kernel/config-microvm)（英文原文）省略 PCI、用户命名空间、fanotify 和 SquashFS。它启用模块支持只是为了通过严格的模块内存保护让运行时代码保持只读；NVX 不随附任何模块，`/init` 会在启动任何其他进程之前禁用模块加载。因此 Ubuntu 支持意味着 NVX 内核策略下的 Ubuntu 用户态，而不是与每个 Ubuntu 工作负载兼容。

## 根文件系统构建器

Ubuntu 根文件系统构建器为两个产物准备同一棵树。它在 Linux 上原生运行，或在同样服务于 Windows 宿主的 Docker 构建中运行，两条路径运行同一个构建器。其输入是固定的：

- **Ubuntu Base** 26.04.1（amd64），通过 URL 和 SHA-256 固定。`SOURCE-MANIFEST.json` 重复该固定值，两者不一致时 `scripts/nvx.py verify` 会失败。
- **补充软件包**来自 [`ubuntu/packages.lock.json`](https://github.com/microsoft/nvx/blob/dev/ubuntu/packages.lock.json)（英文原文）中的锁，它添加 `busybox-static`、`iputils-ping`、`net-tools` 和 `netcat-openbsd` 及其库依赖，使通用 `/init` 无需改动即可工作。每个条目记录该软件包的确切 URL、SHA-256、版本、源码包和依赖。构建器从不到在线仓库解析软件包。

构建器随后：

1. 校验基础归档的摘要，并用自己的解包器解包；该解包器拒绝绝对路径或带父级相对路径的成员、逃逸根目录的链接、通过链接目录写入、设备节点、FIFO、套接字，以及类型不同的重复路径；
2. 检查 `/etc/os-release` 是否指明固定的发布版；
3. 对照锁校验每个补充 `.deb`，用同一个解包器解包，并将其记录到软件包数据库中。它从不运行维护者脚本，并且当某个软件包携带经过审查的逐包列表之外的维护者操作时会失败；
4. 以固定权限模式创建 `/root`、`/tmp`、`/run` 和 `/nonexistent`，为网络引导留一个空的 `/etc/resolv.conf`，并添加 `nc`、`netcat`、`wget` 和 `mdev` 链接；
5. 移除软件包缓存、日志、临时文件、机器 ID、随机种子和 SSH 主机密钥；
6. 要求存在一个 `root` 账户、UID 为 65534 且主目录为 `/nonexistent` 的 `nobody` 账户、一个 `nogroup` 组，以及 usr-merged 的 `/bin`、`/sbin`、`/lib` 和 `/lib64` 链接；并且
7. 从 `guest/common` 和 `guest/ubuntu` 安装 NVX 脚本，从 `nvx-rs` 安装九个 Rust 客户机二进制。

构建器从不在宿主上执行 Ubuntu 树中的任何二进制。两个产物都以 root 属主、固定时间戳和稳定文件顺序打包，因此用相同输入重建会得到字节一致的结果。

## Ubuntu initramfs

Ubuntu initramfs 在机器层面的启动方式与 Alpine 相同：OpenVMM 通过 [Linux 直接 MP 表加载器](/docs/design/5.1-boot-protocol/)加载内核和 initramfs，通用的 [`/init`](https://github.com/microsoft/nvx/blob/dev/guest/common/init)（英文原文）作为 PID 1 运行。它禁用模块加载，运行[时间 ABI](/docs/design/3.2-clock-and-time/)启动步骤，然后要么运行 `nvx_exec` 工作负载，要么挂载 HostFs 共享、配置静态网络，并启动托管代理或交互式 shell。对 Ubuntu 而言该 shell 是 Bash，其启动文件在准备好接受输入后打印 `NVX-GUEST-BOOT-OK: ubuntu`。

客户机默认 512 MiB，因为内核把 initramfs 解压到上限为一半内存的 tmpfs 中；[运行](/docs/run/)给出了测得的最小值。恢复从捕获的 RAM 和机器契约获取客户机，因此不需要选择客户机。

该 initramfs 支持控制台、`nvx_exec`、一次性与托管生命周期、静态 IPv4 和 IPv6 网络、HostFs、SMP 和无块设备快照，包括时间 ABI 的客户机义务。测试夹具会拒绝 Ubuntu 的 `console-snapshot` 场景，而不是用 Alpine 替代。

它安装与 Alpine 和 Azure Linux 相同的九个 Rust 客户机二进制，放在各自的 `/sbin/nvx-*` 名称下。Docker 从一个按摘要固定的 Rust 构建器中复制全部九个，而原生构建和确定性构建使用共享的 fresh-target 例程。软件包清单记录一个聚合的 `nvx-rs` 源码摘要以及每个已安装二进制的摘要。

## Ubuntu 沙箱层

[`build-distro-layer`](/docs/usage/) 在 Linux 上把准备好的树变成 `ubuntu-distro.erofs`。它目前只接受 `--guest ubuntu`，并且没有 `--replace` 时拒绝覆盖已存在的层。打包之前，它应用该层的元数据策略：

- 只允许普通文件、目录和符号链接；
- 清除 setuid 和 setgid 位；
- 无扩展属性，因此没有文件能力、ACL、安全标签或 overlay 属性；以及
- 没有 `/sbin/init`，也没有 `systemd` 软件包。

EROFS 文件系统的 UUID 是该层输入摘要的前 128 位；输入摘要是一个域分隔的 SHA-256，覆盖 Ubuntu 发布版与架构、基础归档摘要、补充软件包摘要和客户机定制文件。层清单在 UUID 旁记录完整输入摘要以及产物自身的 SHA-256，因此 UUID 从不会被当作完整性证明。

该层在 Alpine 控制 initramfs 下作为沙箱的只读 `distro` 层运行在可写暂存盘之上，暂存盘用 `mkfs.ext4` 单独格式化；见[实验性沙箱](/docs/run/)。Alpine [容器入口辅助程序](https://github.com/microsoft/nvx/blob/dev/guest/alpine/nvx-container-enter)（英文原文）把其 musl 加载器、`setpriv` 和库注入 `/.nvx-agent`，因此 glibc 的 Ubuntu 二进制可以运行，而受信任的代理保持基于 musl。工作负载获得专用的挂载、PID 和 UTS 命名空间，并共享客户机的网络命名空间。它以固定的非 root 身份运行，默认 `65534:65534`，即构建器为其创建主目录的 Ubuntu `nobody` 账户，没有补充组、没有能力，并设置 `no_new_privs`。

沙箱拒绝 systemd 入口点，也拒绝清单中列出 `systemd` 软件包的发行版层。systemd 需要单独的兼容性配置文件。

## 来源信息与对应源码

每个 Ubuntu 产物旁边都有一个软件包清单：`initramfs-ubuntu.cpio.gz.packages.json` 和 `ubuntu-distro.erofs.manifest.json`。两者都记录发布版、架构、根文件系统摘要、输入摘要、产物摘要和 NVX 辅助程序。每个软件包条目给出二进制软件包和源码包的版本、许可证文件、补充软件包的 `.deb` 摘要，以及它来自 Ubuntu Base 还是锁。

发布版暂存会拒绝与产物和当前输入不匹配的 Ubuntu 清单。平台发布版在 `guest/` 下携带全部四个 Ubuntu 文件，`download` 会安装它们，并且当 initramfs 缺失时 `run --guest ubuntu` 会失败而不是回退到 Alpine。[软件包与源码交付](/docs/distribution/)描述了 `collect-sources` 如何物化对应的 Ubuntu 源码。

## 验证

当其输入变化时，CI 构建 Ubuntu 产物，并重建两次以比较摘要；在本地，[`verify-guest-determinism`](/docs/usage/)执行同样的操作。[微虚拟机测试工作流](https://github.com/microsoft/nvx/blob/dev/.github/workflows/run-nvx-microvm-tests.yml)（英文原文）在每个后端上运行 Ubuntu 的启动、身份、控制台、生命周期、网络和文件系统快照场景，在 Linux/KVM 上运行更广泛的生命周期、网络快照、SMP、快照和工作负载身份场景，并在每个后端上运行沙箱层和 live-share 冒烟测试。Ubuntu 不属于性能门禁的一部分。

## 完整 Ubuntu systemd 客户机（提案）

完整操作系统配置文件可以针对可写 ext4 根磁盘启动 NVX 内核，并以 systemd 作为 PID 1。它需要自己的设计：中立的根磁盘角色而非沙箱 `scratch` 角色、systemd 与 udev 打包、从 `virtnet_*` 标记生成网络配置、控制台登录、就绪与干净关机、可变根快照，以及特权外层客户机的安全预期。

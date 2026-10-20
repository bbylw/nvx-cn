---
title: 构建
description: 从源码构建 NVX、检查内核配置并生成可分发产物的完整步骤。
group: use
order: 2
source: doc/build.md
---

直接通过 `scripts/nvx.py` 驱动受支持的工作流；不需要 Make 包装脚本。

可移植工作流会下载固定的 Linux 归档、验证其 SHA-256、应用 `kernel/patches` 中的每个补丁，并在 Docker 中构建 Linux 以及选定的客户机产物。Alpine 仍是默认值。OpenVMM 在宿主上构建：

```bash
python3 scripts/nvx.py build-guest
python3 scripts/nvx.py build-openvmm
```

使用以下命令构建所有客户机产物，包括 Ubuntu EROFS 发行版层：

```bash
python3 scripts/nvx.py build-guest --guest all
```

在 Linux 宿主上，`--native` 不使用 Docker，而是使用[环境准备](/docs/setup/)中列出的宿主软件包来构建内核以及选定的 Alpine 或 Ubuntu initramfs。Azure Linux 只能在 Docker 中构建，因此原生构建会拒绝 `--guest azurelinux` 和 `--guest all`。由于只有 `--guest all` 会构建 Ubuntu EROFS 发行版层，请在原生构建后使用下文所述的 `build-distro-layer` 构建它。

```bash
python3 scripts/nvx.py build-guest --native
python3 scripts/nvx.py build-guest --native --guest ubuntu
```

两种原生镜像构建都会调用与 Docker 和 `nvx-rs` CI 作业相同的客户机二进制例程。也可以直接运行它：

```bash
python3 scripts/nvx.py build-guest-binaries --output build/guest-binaries
```

该例程采用 `rust-toolchain.toml` 中的确切工具链、`x86_64-unknown-linux-musl` 目标，以及 `guest` 配置档和特性。它使用 `--locked`、全新的 target 目录、禁用的增量编译、稳定的源码和 Cargo 主目录路径重映射，以及不生成链接器构建 ID。一次 Cargo 调用会构建全部九个程序，并且每个结果都必须通过 `check-static-elf`。输出的 `manifest.json` 绑定了确切的构建固定项、一个覆盖 `nvx-rs` crate、共享 Python 构建配方和 `rust-toolchain.toml` 的摘要，以及每个二进制的 SHA-256。

原生构建会将 Linux 归档、Ubuntu Base 归档和补充 Ubuntu 软件包保存在缓存目录（`.cache/` 或 `$NVX_CACHE_DIR`）下的 `downloads/` 中。它会复用该目录中 SHA-256 与固定值匹配的文件，否则重新下载，因此将固定的归档预先放入该目录，就可以让无法访问其下载服务器的宿主进行原生构建。Alpine minirootfs 和软件包仍来自 Alpine 服务器。

OpenVMM 的恢复步骤排除了兼容性 IGVM 产物，因为 NVX 不构建也不打包它，因此构建不依赖不相关的上游工作流产物。

OpenVMM 构建不需要访问运行时虚拟机监控程序设备。默认情况下，Windows 构建原生 MSVC 可执行文件，Linux 构建原生 GNU 目标。`build-openvmm` 和 `build` 都接受 `--backend`：`kvm` 选择 GNU，`mshv` 在 Linux 上选择静态链接的 musl 目标，`whp` 在 Windows 上选择 MSVC。例如，以下命令构建 musl，且不需要 `/dev/mshv`：

```bash
python3 scripts/nvx.py build-openvmm --backend mshv
```

组合的 `build` 命令会在生成客户机产物之前拒绝不支持的操作系统/后端组合。仅客户机和仅源码的命令不会选择 OpenVMM 构建目标。

通过 NVX 调用时，OpenVMM 自定义的 TTRPC 生命周期、SMP 和快照测试使用无 ACPI、启用 MP 的 `build/vmlinux` 和 `build/initramfs.cpio.gz` 产物。第 1 阶段的生命周期和 TTRPC 接口测试继续使用 OpenVMM 打包的客户机产物。

在 Linux 宿主上，直接构建 Alpine 或 Ubuntu initramfs：

```bash
python3 scripts/nvx.py build-initramfs --guest alpine
python3 scripts/nvx.py build-initramfs --guest ubuntu
```

通过 Docker 构建 Azure Linux initramfs：

```bash
python3 scripts/nvx.py build-initramfs --guest azurelinux
```

默认构建会生成：

```text
build/vmlinux
build/vmlinux.config
build/vmlinux.provenance.json
build/initramfs.cpio.gz
build/initramfs.cpio.gz.packages.json
build/initramfs.provenance.json
build/openvmm.provenance.json
openvmm/target/release/openvmm[.exe]
```

程序化调用方可以通过 [`OpenVmmBuildConfig`](https://github.com/microsoft/nvx/blob/dev/scripts/nvx_tools/build_config.py)（英文原文）选择后端并覆盖输出目标位置。原生和 musl 构建会在记录来源信息之前，将新构建的可执行文件规范化到该目标位置。宿主操作系统检测和后端验证位于 [`build.py`](https://github.com/microsoft/nvx/blob/dev/scripts/nvx_tools/build.py)（英文原文），而不在配置对象中。

固定的构建输入和默认值位于 [`build_constants.py`](https://github.com/microsoft/nvx/blob/dev/scripts/nvx_tools/build_constants.py)（英文原文）。其命名空间类按内核、OpenVMM、Rust 客户机二进制、Alpine、Ubuntu、initramfs、Docker、缓存工具和发布设置进行分组。例如，Python 调用方使用 `KernelBuildConstants.VERSION` 和 `AlpineBuildConstants.MINIROOTFS_SHA256`；先前的模块级常量不再重新导出。共享的仓库目录和产物目录归属于 `BuildConstants`。

将每次调用的选择和覆盖项保留在现有构建配置对象中。依赖环境的缓存位置和依赖宿主的可执行文件选择仍由各自的辅助函数在创建配置时解析，而不会固化到常量模块中。

来源信息附属文件将内核绑定到其固定归档、补丁集、输入配置、生成的配置和输出哈希；将 initramfs 和软件包清单绑定到固定的 Alpine 输入、Rust 客户机输入和源文件；并将 OpenVMM 绑定到确切的干净 gitlink 修订版和可执行文件哈希。打包会拒绝缺失、不干净、过期或不匹配的来源信息。`build/nvx-rs.provenance.json` 同样将 `nvx.py` 运行的 `nvx-rs` 可执行文件绑定到其源码的摘要以及其构建所用的 Rust 发布版、目标和特性；`nvx.py` 在构建 `nvx-rs` 时写入它，而 [`record-nvx-rs-provenance`](/docs/usage/) 会为以其他方式进行的构建写入它。

Ubuntu 会额外生成：

```text
build/initramfs-ubuntu.cpio.gz
build/initramfs-ubuntu.cpio.gz.packages.json
build/ubuntu-distro.erofs
build/ubuntu-distro.erofs.manifest.json
```

在 Linux 上单独准备 Ubuntu 沙箱层，且不替换现有输出：

```bash
python3 scripts/nvx.py build-distro-layer \
  --guest ubuntu \
  --output build/ubuntu-distro.erofs
```

仅当有意重建该路径时才传入 `--replace`。原生 Ubuntu 构建需要 `zstd`，而 EROFS 转换还需要来自 `erofs-utils` 的 `mkfs.erofs`。构建器会在安全解包之前验证 Ubuntu Base 和每个补充 `.deb`，且从不执行 Ubuntu 根文件系统中的二进制文件或维护者脚本。Docker 构建器按摘要固定其 Debian 基础镜像，并安装确切版本的 `erofs-utils`，以便干净的 EROFS 构建使用相同的编码器。

使用以下命令检查两个 Ubuntu 输出是否可确定性重建：

```bash
python3 scripts/nvx.py verify-guest-determinism --guest ubuntu
```

Azure Linux 只能在 Docker 中构建，并会额外生成：

```text
build/initramfs-azurelinux.cpio.gz
build/initramfs-azurelinux.cpio.gz.packages.json
```

分别运行两个测试层：

```bash
python3 scripts/nvx.py test-openvmm --backend kvm
python3 scripts/nvx.py test-microvm --backend kvm
python3 scripts/nvx.py test-microvm --backend kvm --guest ubuntu
```

这两条命令都需要上述标准客户机构建输出。第二条命令默认将每个场景的完整日志写入 `build/test-results/microvm`。

所有三种 initramfs 都会在 `/sbin` 下安装相同的九个 Rust 可执行文件：`nvx-console-pending`、`nvx-device-io`、`nvx-exit`、`nvx-ingress`、`nvx-managed-agent`、`nvx-mmio-write`、`nvx-reseed`、`nvx-time` 和 `nvx-time-probe`。Docker 会在一个按摘要固定的 Rust 1.95.0 镜像中构建它们一次，并将完全相同的字节复制到 Alpine、Ubuntu 和 Azure Linux；内核目标不依赖该构建。Ubuntu 确定性目标则在两次尝试中都从全新的 target 目录重新构建它们。原生镜像构建也会重新构建它们。

Alpine initramfs 还包含沙箱 PID-1 引导程序及其容器命名空间脚本。`nvx-time-probe` 测量 TSC 和时钟读取延迟，报告客户机的时钟、clocksource、TSC 标志和虚拟机监控程序身份，并运行跨 vCPU warp 测试；[时间 ABI](/docs/design/3.2-clock-and-time/)通过该测试强制执行其 1 µs 偏差上限。`nvx-time` 实现时间 ABI 的[客户机义务](/docs/design/3.2-clock-and-time/)：一致性检查、违规监视器、恢复数据包 v4 与时间样本解析器、快照代理的时间步进，以及挂钟时间约束。在 shell 就绪之前，它只将时钟步进到宿主 UTC；其他启动检查在后台运行，生产控制台除违规事件外不显示任何时间 ABI 行。`nvx-time status` 会等待待处理的检查完成，然后按需为 CI 和测试框架打印每项已记录的检查（启动、捕获和恢复）以及运行时状态。当内核启动时的 W+X 审计报告存在可写且可执行的映射时，其启动检查也会失败。`nvx-time exhaustive` 运行仅限 CI 的穷尽检查（在每个在线 CPU 上检查 X1 至 X6）；它报告后退出，生产启动从不运行它。`--report-only` 标志（或内核命令行令牌 `nvx_time_abi=report-only`）会报告违规而不关机，适用于针对早于该 ABI 的 VMM 进行的运行。所有九个可执行文件都链接由固定 Rust 目标提供的 musl。每个软件包清单都会记录共享 Rust 源码摘要以及每个已安装二进制的摘要。[内核配置检查](#内核配置检查)涵盖沙箱引导程序所需的内核特性。APK 清单记录引导程序使用的 `blkid` 和 `util-linux` 工具，以及每个客户机二进制的摘要。

Ubuntu initramfs 使用 Ubuntu 用户空间和 NVX 内核。它不是使用 Ubuntu 内核或 systemd 的虚拟机。其与发行版无关的软件包清单记录了 Ubuntu Base 和补充二进制/源码的身份信息、许可证元数据、根文件系统 SHA-256 以及 NVX 客户机二进制来源信息。

内核构建 `build-kernel`（Docker 构建也会运行它）会将经过验证和打补丁的源码缓存到 `.cache/linux`，使用 `O=build/linux`，运行 `olddefconfig`，除非生成的配置通过[内核配置检查](#内核配置检查)，否则停止，并将其导出为 `build/vmlinux.config`。时间 ABI 设置保持 `CONFIG_HYPERVISOR_GUEST` 和 `CONFIG_PARAVIRT` 开启，并关闭 `CONFIG_HYPERV`、`CONFIG_KVM_GUEST` 和 `CONFIG_CPU_FREQ`。客户机仅通过时间 ABI 的 Hyper-V 身份来识别虚拟机监控程序，因此 KVM 客户机代码、kvmclock 和 haltpoll 空闲驱动会成为死代码。没有 cpufreq 时，`intel_pstate` 无法探测微虚拟机未实现的 MSR，因此启动期间不会在禁用中断的情况下打印 `#GP` 跟踪。`CONFIG_SCHED_MC_PRIO` 也关闭，因为它会同时选中 cpufreq 和 `intel_pstate`。生产内核不得启用 soft-lockup 或 hung-task 检测器。更改归档哈希或补丁会使源码缓存和对象缓存都失效；更改输入配置只会使对象缓存失效。

内核在运行时将其生成的代码保持为只读。在 x86 上，只有 `CONFIG_STRICT_MODULE_RWX` 才能使这类内存成为只读且可执行（`CONFIG_ARCH_HAS_EXECMEM_ROX`），并且它需要 `CONFIG_MODULES`。如果没有它，当缓解措施在启动时修补间接分支时，间接目标选择（Indirect Target Selection，ITS）缓解措施的 thunk 页会保持可写且可执行；除非 Spectre v2 使用 retpoline，否则该缓解措施会在启动时执行这种修补。因此，内核支持模块，但从不构建或发布任何模块：

- 如果任何选项被设为 `m`，构建就会失败；
- `CONFIG_MODPROBE_PATH` 为空，因此内核从不启动模块辅助程序；
- `CONFIG_TRIM_UNUSED_KSYMS` 会丢弃所有符号导出，约 200 KB，若保留则会将内核数据推过下一个 2 MiB 边界；
- init 会在任何其他内容运行之前向 `/proc/sys/kernel/modules_disabled` 写入 1。

当缓解措施修补间接分支时，只读可执行缓存会占用客户机内存中的一个 2 MiB 块。`CONFIG_DEBUG_WX` 会在启动时审计内核页表，如果审计报告存在可写且可执行的映射，`nvx-time` 的启动检查就会失败。

## 内核配置检查

内核构建会将 `olddefconfig` 生成的配置与固定的设置组进行比对检查，因此配置或版本更改不会悄无声息地丢弃机器配置档或客户机所需的特性。这些组位于 [`build_constants.py`](https://github.com/microsoft/nvx/blob/dev/scripts/nvx_tools/build_constants.py)（英文原文）中的 `KernelBuildConstants`。

| 组 | 必需设置 | 用途 |
| --- | --- | --- |
| 直接启动 | 关闭 ACPI 和 PVH；从命令行启用 MP 表解析、本地 APIC、IOAPIC 和 virtio-mmio 设备 | 通过[无 ACPI 的 MP 表加载器](/docs/design/5.1-boot-protocol/)启动 |
| Virtio 控制台 | 基于 virtio-mmio 的 Virtio 控制台和 HVC 驱动 | 驱动 [virtio 控制台](/docs/design/3.3-consoles/) |
| 沙箱 | virtio-blk；ext4；使用 zstd 压缩的 EROFS；不总是跟随重定向的 overlayfs；内存和 PID cgroup；BPF 和 cgroup BPF；seccomp 过滤器；Unix 域套接字；网络命名空间和 veth | 在 ext4 暂存磁盘之上叠加 EROFS，并在[沙箱引导程序](/docs/design/4.1-guest-filesystem-and-image-model/)中将工作负载限制在其中 |
| 网络 | IPv4；不带 SIT 隧道驱动的 IPv6；virtio-net | 配置[可移植网络配置档](/docs/design/3.5-network/)的双栈 NIC；SIT 会添加一个从 IPv4 数据包中解封装 IPv6 的 `sit0` 设备 |
| 共享中断状态 | 来自内核补丁的 `CONFIG_VIRTIO_MMIO_SHARED_STATUS` | 读取[共享 virtio 中断状态](/docs/design/2.4-interrupt-and-io-architecture/) |
| 时间 ABI | 开启虚拟机监控程序客户机支持和半虚拟化支持；关闭 Hyper-V、KVM 客户机和 cpufreq | 满足[时间 ABI](/docs/design/3.2-clock-and-time/)，如上所述 |
| 加固 | 严格的内核和模块 RWX，配合只读可执行内存、ITS 缓解措施、空 modprobe 路径、裁剪的符号导出、启动时 W+X 审计，且没有选项被构建为模块 | 保持运行时代码只读，如上所述 |
| 看门狗 | 关闭 soft-lockup 和 hung-task 检测器，或在 [CI 调试内核](#ci-调试内核)中开启 | 使检测器不进入生产内核 |

`build-kernel` 会运行每项检查，打包时会在打包后的配置上再次运行这些检查。`scripts/nvx.py verify` 是一种更轻量的源码检查。它会在签入的 `kernel/config-microvm` 中查找直接启动、沙箱、网络、时间 ABI 和加固组的固定设置，以及 xe9 控制台和 virtio-fs。它不会拒绝构建为模块的选项；只有构建和打包检查会这样做。当 `build/vmlinux.config` 存在时，`verify` 还会检查该文件中的直接启动、沙箱和网络组以及 xe9 控制台。

## CI 调试内核

CI 使用同一内核的调试变体来证明快照恢复永远不会触发内核看门狗：

```bash
python3 scripts/nvx.py build-guest --debug-kernel
python3 scripts/nvx.py build-kernel --debug   # native, Linux only
```

该变体在 `kernel/config-microvm` 之上应用 [`kernel/config-microvm-debug`](https://github.com/microsoft/nvx/blob/dev/kernel/config-microvm-debug)（英文原文）片段。片段中的每个赋值都会在 `olddefconfig` 之前替换匹配的基础赋值。它会启用 `DEBUG_KERNEL`、soft-lockup 和 hung-task 检测器，以及额外的 RCU 停滞诊断。它会固定生产环境的 RCU 停滞超时，并关闭 `DEBUG_KERNEL` 原本会默认启用的调试选项。如果生成的配置中缺少这些检测器，构建就会失败。CI 可以通过 `watchdog_thresh=` 和 `sysctl.kernel.hung_task_timeout_secs=` 为一次启动缩短 soft-lockup 和 hung-task 阈值。RCU 停滞超时保持生产值，因为时间 ABI 的一致性检查涵盖[停滞检测器设置](/docs/design/3.2-clock-and-time/)并要求使用该值。

该变体在 `build/linux-debug` 中构建，因此绝不会使生产对象缓存失效，并会生成：

```text
build/vmlinux-debug
build/vmlinux-debug.config
build/vmlinux-debug.provenance.json
```

其来源信息包含生产字段，外加 `debug_config_fragment` 路径和 SHA-256。调试内核是 CI 产物，永远不会被打包。`build-guest-artifacts` 动作仅在其 `debug-kernel` 输入为 `true` 时才缓存并构建它。

发布打包需要 OpenVMM 二进制文件、采用下文布局的客户机产物，以及 OpenVMM、内核和 Alpine initramfs 的来源信息附属文件，因此请先运行 `build-openvmm` 和 `build-guest --guest all`。它还需要位于 `nvx-rs/target/release/nvx-rs[.exe]` 的 `nvx-rs` 发布版构建：Linux 上是静态的 `x86_64-unknown-linux-musl` 可执行文件，Windows 上是 `x86_64-pc-windows-msvc` 可执行文件，并带有 [`record-nvx-rs-provenance`](/docs/usage/) 写入 `build/nvx-rs.provenance.json` 的来源信息。包含源码的软件包不需要 Azure Linux 产物。打包会在替换现有 `dist/` 版本之前暂存并验证完整输出，替换需要 `--force`。其 `SOURCE-MANIFEST.json` 记录软件包版本以及 OpenVMM、Linux、生成的内核配置、每个打包的客户机 initramfs 及其软件包清单、Ubuntu 发行版层及其清单的确切哈希。其 `nvx_rs` 部分记录 `nvx-rs` 可执行文件的 SHA-256、构建它的 `nvx-rs` 源码摘要，以及该构建的 Rust 发布版、目标和特性。其 `guest_rust` 部分固定 Rust 1.95.0 和 `x86_64-unknown-linux-musl`，每个客户机的 `guest_sources` 都包含 `nvx-rs` 和 `rust-toolchain.toml`。OpenVMM 部分声明微虚拟机 ABI 2、控制会话协议 1 和契约 `nvx-microvm-v2-control-v2`；产品客户机代理元数据有意不包含在此平台清单中。

二进制发布目录具有以下布局：

```text
bin/openvmm[.exe]
bin/nvx-rs[.exe]
guest/vmlinux
guest/vmlinux.config
guest/initramfs.cpio.gz
guest/initramfs.cpio.gz.packages.json
guest/initramfs-ubuntu.cpio.gz
guest/initramfs-ubuntu.cpio.gz.packages.json
guest/ubuntu-distro.erofs
guest/ubuntu-distro.erofs.manifest.json
guest/initramfs-azurelinux.cpio.gz
guest/initramfs-azurelinux.cpio.gz.packages.json
provenance/openvmm.provenance.json
provenance/initramfs.provenance.json
provenance/vmlinux.provenance.json
provenance/nvx-rs.provenance.json
licenses/LICENSE-OPENVMM
licenses/COPYING-LINUX
LICENSE
README.md
SOURCE-MANIFEST.json
THIRD_PARTY_NOTICES.md
SHA256SUMS
```

使用 `--include-source` 构建的软件包还会包含 `source/`，并省略 Azure Linux 客户机产物，因为这些产物对应的源码不会被收集。项目源码归档包含 `nvx-rs`，但不包含其生成的 `target/` 树。`SHA256SUMS` 包含排序后的 `SHA256  relative/path` 条目，对每个打包文件使用 POSIX 分隔符，包括 `SOURCE-MANIFEST.json`，但不包括 `SHA256SUMS` 自身。

## 构建打包的 Linux 源码

Linux 对应源码归档包含打过补丁的 `linux-6.18.38/` 树，以及用于分发的内核的确切 `vmlinux.config`。

在已安装内核构建依赖的 Linux 宿主上，从归档根目录运行：

```bash
mkdir build
cp vmlinux.config build/.config
make -C linux-6.18.38 O="$PWD/build" olddefconfig
make -C linux-6.18.38 O="$PWD/build" -j"$(nproc)" vmlinux
```

常规仓库工作流通过 `scripts/nvx.py build-kernel` 或 Docker 产物目标执行相同的构建。

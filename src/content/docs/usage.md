---
title: 命令行参考
description: nvx.py 与 nvx-rs 的全部命令、选项、环境变量和典型用法。
group: use
order: 5
source: doc/usage.md
---

`scripts/nvx.py` 是受支持的命令行入口点，用于构建、运行、基准测试和打包 NVX。请在仓库根目录下使用 Python 3.10 或更高版本运行它：

```text
python3 scripts/nvx.py COMMAND [OPTIONS]
```

本页示例使用 POSIX 写法。在 Windows 上，请改用 `python scripts\nvx.py`。每个命令都接受 `-h` 或 `--help`，包括嵌套命令：

```console
python3 scripts/nvx.py --help
python3 scripts/nvx.py run --help
python3 scripts/nvx.py performance gate --help
```

## nvx-rs

`nvx.py` 会为 [`sandbox`](#sandbox) 命令运行 [`nvx-rs`](/docs/nvx-rs/)（NVX 运行时步骤的 Rust 实现），该命令完全由 `nvx-rs` 执行；它还会为 [`run`](#run) 的出站策略步骤和产物步骤运行 `nvx-rs`。它按以下顺序运行：

1. `NVX_RS` 环境变量指定的可执行文件；
2. 检出目录中的 `nvx-rs/target/release/nvx-rs`（Windows 上为 `nvx-rs.exe`），即 `cargo build --release` 的输出位置，也是 [`download`](#download) 安装某个发布版 `nvx-rs` 的位置；否则
3. 由它在仓库根目录用 `cargo build --release --locked --features cli --manifest-path nvx-rs/Cargo.toml --target-dir nvx-rs/target` 构建该可执行文件后运行，使用 `rust-toolchain.toml` 固定的 Rust 发布版，并将 Cargo 的输出写到标准错误，以免与命令自身的输出混在一起。

执行 `download` 之后，`nvx.py` 不再需要 Cargo：每个发布包都附带 `bin/nvx-rs`（或 `bin/nvx-rs.exe`）；当发布版是由检出目录的 `nvx-rs` 源码构建时，`download` 会安装它。如果没有 `NVX_RS`、没有已构建或已安装的可执行文件，也没有 Cargo，此类命令会失败并列出这些选项；[rustup](https://rustup.rs) 可安装 Cargo。一旦可执行文件存在，`nvx.py` 不会自行重新构建，因此在修改 `nvx-rs` 后需重新运行构建命令，或删除该可执行文件。[`test-microvm`](#test-microvm) 的 `managed-lifecycle` 场景也需要 Cargo，因为它要运行 `nvx-rs` 测试。

`nvx.py` 所运行的 `nvx-rs` 的来源信息记录在 `build/nvx-rs.provenance.json`，它把可执行文件的 SHA-256 与该可执行文件构建所依据的 `nvx-rs` 源码摘要绑定：包括 crate 的清单、锁文件、构建脚本、`src/` 目录树和 `rust-toolchain.toml`，以及构建使用的 Rust 发布版、目标和 Cargo feature。`nvx.py` 在构建 `nvx-rs` 时记录它，`download` 安装发布版的 `nvx-rs` 时记录它，[`record-nvx-rs-provenance`](#record-nvx-rs-provenance) 则为以其他方式完成的构建记录它。[`package`](#package) 和[对抗性执行器](/docs/adversarial-testing/)会拒绝来源信息未表明其由检出目录源码构建的 `nvx-rs`，因此过期的构建绝不会在未被察觉的情况下发布或运行。

## 命令

| 命令 | 说明 |
| --- | --- |
| `init` | 初始化 OpenVMM 子模块及其嵌套子模块。 |
| `build-guest` | 构建 Linux 内核和选定的客户机产物。 |
| `check-guest-binaries` | 针对 musl 对 Rust 客户机可执行文件执行 lint 和测试。 |
| `build-guest-binaries` | 为 Linux 客户机构建固定的 Rust 可执行文件并计算摘要。 |
| `test-guest-binaries` | 针对预构建的 Rust 客户机可执行文件运行 musl 集成测试。 |
| `build-kernel` | 在本机构建固定并打过补丁的 Linux 内核。 |
| `build-initramfs` | 构建选定的 Alpine、Ubuntu 或 Azure Linux initramfs。 |
| `build-distro-layer` | 构建确定性的 Ubuntu EROFS 发行版层。 |
| `verify-guest-determinism` | 两次重新构建 Ubuntu 客户机产物并比较 SHA-256 值。 |
| `build-openvmm` | 构建 OpenVMM 发布版二进制文件。 |
| `record-openvmm-provenance` | 将现有 OpenVMM 二进制文件绑定到固定的源码修订版。 |
| `record-nvx-rs-provenance` | 将现有 `nvx-rs` 可执行文件绑定到其源码、Rust 发布版、目标和 feature。 |
| `materialize-kernel-provenance-inputs` | 从原始 run-head blob 写入内核来源信息输入。 |
| `setup-cross-os-cache` | 为 GitHub Actions 跨操作系统缓存安装 GNU tar 和 zstd。 |
| `classify-ci-changes` | 选择一组变更文件所触发的 CI 套件。 |
| `kernel-patch-identity` | 打印内核缓存键所依据的内核补丁路径与内容摘要。 |
| `guest-binary-source-identity` | 打印客户机镜像缓存键所依据的 Rust 客户机二进制源码路径与内容摘要。 |
| `check-required-ci` | 校验必需的 GitHub Actions 作业结果。 |
| `check-static-elf` | 检查可执行文件是否为静态 ELF 文件，且没有解释器或可执行栈。 |
| `test-openvmm-unit` | 运行 OpenVMM 工作区的单元测试和文档测试。 |
| `test-openvmm` | 运行 OpenVMM Petri VMM 测试。 |
| `test-microvm` | 通过 OpenVMM 运行 NVX Linux 和设备正确性测试。 |
| `doctor` | 验证此宿主是否满足 NVX 时间 ABI。 |
| `test-aci-edge-sandboxes` | 在真实 hypervisor 上运行 `aci_edge_sandboxes` Rust crate 的生命周期测试。 |
| `test-agent-bundling` | 在无 hypervisor 的情况下检查 `aci_edge_sandboxes` crate 的 agent 打包暂存。 |
| `test-adversarial` | 运行由 Copilot 驱动的代理式对抗性测试活动。 |
| `build` | 构建客户机产物和 OpenVMM。 |
| `download` | 安装由本次检出或某个已发布的第一父提交祖先构建的所选平台软件包。 |
| `run` | 运行 OpenVMM 微虚拟机。 |
| `sandbox` | 在 EROFS 层和私有 ext4 暂存盘之上运行或管理工作负载。 |
| `benchmark` | 运行 OpenVMM 原生基准测试协调器。 |
| `performance` | 收集、门禁检查并持久化 CI 性能结果，并检查基准测试宿主。 |
| `collect-sources` | 实体化经过校验的 Linux、Alpine 和 Ubuntu 发布源码。 |
| `collect-alpine-sources` | 收集精确的 Alpine recipe 和上游源码。 |
| `collect-ubuntu-sources` | 收集精确的 Ubuntu 源码包。 |
| `create-linux-source-archive` | 创建 Linux 对应源码归档。 |
| `package` | 暂存二进制分发内容。 |
| `archive-release` | 从暂存的发行内容创建确定性归档。 |
| `verify` | 校验源码和子模块输入。 |

## 初始化与校验

### `init`

```console
python3 scripts/nvx.py init
```

初始化并递归更新 OpenVMM Git 子模块。

### `verify`

```console
python3 scripts/nvx.py verify
```

校验仓库固定的源码输入和子模块状态。

### `setup-cross-os-cache`

```console
python3 scripts/nvx.py setup-cross-os-cache
```

安装 GitHub Actions 跨操作系统缓存所使用的 GNU tar 和 zstd 工具。

### `kernel-patch-identity`

```text
python3 scripts/nvx.py kernel-patch-identity [--root PATH]
```

按路径顺序、以相对路径为标识打印 `kernel/patches/` 下每个文件的摘要及其内容。客户机构建会把该摘要追加到两个内核缓存键中，因为 `hashFiles` 只对内容计算哈希：补丁即使字节未变，只要改名就会改变缓存键。

### `guest-binary-source-identity`

```text
python3 scripts/nvx.py guest-binary-source-identity [--root PATH]
```

打印客户机软件包清单为 Rust 客户机二进制文件记录的源码摘要：`nvx-rs/src/` 下每个文件的相对路径与内容、crate 的清单、锁文件和构建脚本、`rust-toolchain.toml`，以及 `build_constants.py` 和 `guest_binaries.py` 构建模块的摘要。客户机构建会把它追加到 Alpine、Ubuntu 和 Azure Linux 缓存键中，因为 `hashFiles` 只对内容计算哈希：把一个模块移到它自己的 `mod.rs` 中，即使没有任何字节变化，也会改变缓存键。

### `classify-ci-changes`

```text
python3 scripts/nvx.py classify-ci-changes
    --event-name {pull_request,push}
    --changed-files PATH
    [--null]
    [--summary PATH]
```

默认读取每行一个变更仓库路径；使用 `--null` 时读取以 NUL 分隔的路径。它把变更检测器的 `run-tests`、`run-workloads`、`run-openvmm-unit-tests` 和 `run-openvmm-vmm-tests` 输出打印为 `name=true` 或 `name=false` 行。只有文档变更会跳过工作负载，且只有测试输入才会运行 NVX 微虚拟机测试。PR 仅在某个 OpenVMM 套件自身的某个输入发生变更时才运行该套件，而 push 在需要运行测试时会运行这两个套件。摘要文件会收到每个决策的 Markdown 说明。命令失败或缺少某项输出时，CI 会改为运行完整矩阵；参见[变更分类](/docs/ci/)。

### `check-required-ci`

```text
python3 scripts/nvx.py check-required-ci
    --event-name {pull_request,push}
    --same-repository {false,true}
    --run-tests VALUE
    --run-workloads VALUE
    --run-openvmm-unit-tests VALUE
    --run-openvmm-vmm-tests VALUE
```

校验通过 `QUALITY_RESULT`、`CHANGES_RESULT` 以及各作业专用的 `*_RESULT` 环境变量提供的 GitHub Actions 结果值。CI 提供由 `classify-ci-changes` 报告的 `true` 或 `false` 套件标志。该命令要求由事件、仓库和套件标志启用的作业结果为成功，未启用的作业结果为 `skipped`；不匹配会作为错误报告，并导致非零退出。

### `check-static-elf`

```text
python3 scripts/nvx.py check-static-elf PATH [PATH ...]
```

打印每个可执行文件的 ELF 类型、大小和链接方式，并检查每个文件是否都是 64 位小端 ELF 可执行文件，且没有程序解释器（`PT_INTERP`）或所需库（`DT_NEEDED`），以便它能在没有动态加载器的客户机中运行；只要有任一文件不满足就失败。静态位置无关可执行文件可通过。存在可执行栈时也会失败：即带有 `PF_X` 的 `PT_GNU_STACK` 程序头。`nvx-rs` CI 作业用它检查[客户机二进制文件](/docs/nvx-rs/)。

### `check-guest-binaries`

```text
python3 scripts/nvx.py check-guest-binaries [--toolchain TOOLCHAIN]
```

这个仅限 Linux 的检查命令会把 `x86_64-unknown-linux-musl` 目标添加到 `--toolchain` 指定的 Rust 工具链（默认为 `rust-toolchain.toml` 的精确固定版本）。然后它对 `guest` feature 的每个目标以拒绝警告的方式运行 Clippy，并运行该 feature 的 musl 测试，其静态测试可执行文件在宿主上运行。它会忽略继承的 `NVX_GUEST_BINARIES`，以便集成测试运行 Cargo 从检出目录构建的二进制文件。`nvx-rs` CI 作业在构建二进制文件之前，用其 action 选择的工具链运行它。

### `build-guest-binaries`

```text
python3 scripts/nvx.py build-guest-binaries --output DIRECTORY
```

这个仅限 Linux 的构建命令会检查 `rust-toolchain.toml` 的精确固定版本，并通过一次 `cargo build` 为 `x86_64-unknown-linux-musl` 构建九个 Rust 客户机可执行文件，使用 `guest` profile、全新的目标目录、Cargo 锁定模式、禁用增量编译、移除继承的 Cargo profile 覆盖、重映射源码路径，且不带链接器构建 ID。它运行静态 ELF 检查，并写出包含源码和可执行文件 SHA-256 摘要的 `manifest.json`。它会就地更新较早构建的输出：当该构建的清单未记录时添加 `nvx-managed-agent`、`nvx-ingress`、`nvx-time` 和 `nvx-time-probe`，当该构建的清单记录了已退役的 `nvx-port-io` 可执行文件时将其移除，并拒绝其他任何已存在的 `DIRECTORY`。

### `test-guest-binaries`

```text
python3 scripts/nvx.py test-guest-binaries --binaries DIRECTORY
```

这个仅限 Linux 的测试命令会校验九个二进制文件和构建清单，设置 `NVX_GUEST_BINARIES`，并针对该确切目录运行 musl `guest_tools` 集成测试。

宿主前提条件参见[环境准备](/docs/setup/)。

### `materialize-kernel-provenance-inputs`

```console
python3 scripts/nvx.py materialize-kernel-provenance-inputs
```

从当前 Git run head 重新创建受跟踪的内核配置和补丁文件。它会移除该修订版中不存在的过期工作树补丁，并在打包内核来源信息输入之前使用。

## 构建命令

### `build-guest`

```text
python3 scripts/nvx.py build-guest
    [--guest {alpine,ubuntu,azurelinux,all}]
    [--native]
    [--debug-kernel]
```

默认使用 Docker 构建客户机内核和 initramfs。`--native` 直接在 Linux 上构建选定产物。Alpine 为默认值。Azure Linux 不支持 `--native`，始终通过 Docker 构建。`--guest all` 还会构建 Ubuntu EROFS 发行版层。`--debug-kernel` 还会构建 CI 调试内核 `build/vmlinux-debug`；参见[构建](/docs/build/)。

### `build-kernel`

```console
python3 scripts/nvx.py build-kernel [--debug]
```

直接在 Linux 上获取、校验、打补丁并构建固定的内核。`--debug` 构建 CI 调试变体，而非生产内核。

### `build-initramfs`

```console
python3 scripts/nvx.py build-initramfs [--guest {alpine,ubuntu,azurelinux}]
```

构建选定的 initramfs。Alpine 和 Ubuntu 直接在 Linux 上构建；Azure Linux 使用 Docker。Alpine 为默认值。

### `build-distro-layer`

```text
python3 scripts/nvx.py build-distro-layer
    --guest ubuntu
    [--output PATH]
    [--replace]
```

直接在 Linux 上构建不可变的 Ubuntu EROFS `distro` 层。默认输出为 `build/ubuntu-distro.erofs`。除非提供 `--replace`，否则拒绝已存在的输出或清单文件。

### `verify-guest-determinism`

```text
python3 scripts/nvx.py verify-guest-determinism
    --guest ubuntu
    [--work-dir PATH]
```

目前仅支持 `--guest ubuntu`。它会从各自独立的根目录两次构建 Ubuntu initramfs 和 EROFS 层，并比较每个产物的 SHA-256。若不一致，会在存在差异时报告第一个不同的规范化 rootfs 条目。

### `build-openvmm`

```text
python3 scripts/nvx.py build-openvmm [--skip-restore] [--backend {kvm,mshv,whp}]
```

构建 `openvmm` 发布版二进制文件。构建前，该命令运行 `cargo xflowey restore-packages`；当这些软件包已恢复时使用 `--skip-restore`。未指定 `--backend` 时，Windows 构建原生 MSVC 目标，Linux 构建原生 GNU 目标。在 Linux 上，`--backend kvm` 选择 GNU，`--backend mshv` 选择 musl；Windows 接受 `--backend whp`。构建目标选择不会探测 `/dev/kvm` 或 `/dev/mshv`，因此编译也能在仅用于构建的宿主和同时暴露这两个设备的宿主上进行。不支持的 OS/后端组合会被拒绝。

### `record-openvmm-provenance`

```console
python3 scripts/nvx.py record-openvmm-provenance
```

为现有的 `openvmm/target/release/openvmm[.exe]` 二进制文件，在 `build/openvmm.provenance.json` 中记录已检出的 OpenVMM 修订版、干净状态标志和可执行文件 SHA-256。该命令不接受任何选项。它要求 OpenVMM 子模块已检出/初始化，且发布版二进制文件已存在于 POSIX 上的 `openvmm/target/release/openvmm` 或 Windows 上的 `openvmm/target/release/openvmm.exe`。任一前提条件缺失时命令都会失败。

### `record-nvx-rs-provenance`

```text
python3 scripts/nvx.py record-nvx-rs-provenance [--target TARGET]
```

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `--target TARGET` | `rustc -vV` 报告的宿主目标 | 构建 `nvx-rs` 所用的 Rust 目标。 |

为 `nvx.py` 在不自行构建的情况下所运行的 `nvx-rs` 记录 `build/nvx-rs.provenance.json`，即 `NVX_RS` 指定的那个，否则为 `nvx-rs/target/release/nvx-rs[.exe]`；参见 [nvx-rs](#nvx-rs)。该记录把可执行文件的 SHA-256 绑定到本次检出目录 `nvx-rs` 源码的摘要、`rust-toolchain.toml` 固定的 Rust 发布版、目标以及 `cli` feature，因此请在从本次检出构建 `nvx-rs` 之后立即记录。对于 `x86_64-unknown-linux-musl`（Linux 发布包的目标），可执行文件必须是静态的。CI 的 NVX CLI 作业会记录它们交给软件包的构建，而 `nvx.py` 会记录它自身完成的构建。

### `build`

```text
python3 scripts/nvx.py build
    [--guest {alpine,ubuntu,azurelinux,all}]
    [--native]
    [--debug-kernel]
    [--skip-restore]
    [--backend {kvm,mshv,whp}]
```

依次运行 `build-guest` 和 `build-openvmm`。各选项的含义与这些单独命令相同。

依赖项、输出和本机构建细节参见[构建](/docs/build/)。

## 测试命令

### `test-openvmm-unit`

```console
python3 scripts/nvx.py test-openvmm-unit
```

使用 cargo-nextest 的 `agent` profile 和 `ci` feature 运行 OpenVMM 工作区的单元测试二进制文件。需要专用测试夹具的软件包会被排除，OpenVMM 的 `xtask` 报告的所有 fuzz crate 也会被排除。随后用 Cargo 运行工作区的文档测试。

### `test-openvmm`

```text
python3 scripts/nvx.py test-openvmm --backend {kvm,mshv,whp}
```

构建并运行 OpenVMM 自身检出的 VMM 测试。Linux 直接启动的微虚拟机 TTRPC 测试会启动 NVX 的 `build/vmlinux` 和 `build/initramfs.cpio.gz`，因此请先构建客户机；其余测试产物由 OpenVMM 自身生成。

### `test-microvm`

```text
python3 scripts/nvx.py test-microvm
    --backend {kvm,mshv,whp}
    [--guest {alpine,ubuntu,azurelinux}]
    [--scenario SCENARIO]...
    [--debug-kernel]
    [--processors {1,2,4,8} ...]
    [--memory-mib MIB]
    [--timeout SECONDS]
    [--output-dir PATH]
```

针对公共 OpenVMM CLI 运行 NVX 自有的 Linux、SMP、virtio、沙箱和快照正确性场景。重复 `--scenario` 可选择子集；未指定时，运行所选客户机支持的所有场景，但三个仅在明确指定时才运行的场景除外。`smp-lapic` 重复 `smp`，并额外断言每个 CPU 都使用一次性计数 LAPIC。`managed-exec-config` 和 `sandbox-lifecycle` 驱动公共 `sandbox` 生命周期命令（参见[运行](/docs/run/)），并且还需要客户机产物构建的 Ubuntu 层和暂存模板，而软件包会省略这些内容。Alpine 仍为默认值。Ubuntu 和 Azure Linux 不能充当沙箱控制端，因此它们拒绝仅适用于 Alpine 控制端的 `sandbox-blocks` 和 `scratch-snapshot` 场景，以及依赖沙箱控制端的 `snapshot-tiers`、`managed-exec-config` 和 `sandbox-lifecycle` 场景。Ubuntu 还会拒绝 Alpine 提示符专用的 `console-snapshot` 场景。`--debug-kernel` 启动 CI 调试内核 `build/vmlinux-debug`，客户机的时间 ABI 监视器会报告其 soft-lockup 和 hung-task 检测器；未指定 `--scenario` 时，它只运行同宿主恢复场景 `smp`、`smp-snapshot`、`restore-processors`、`restore-downtime` 和 `snapshot-tiers`。`cpu-profile-fallback` 场景使用 OpenVMM 的 `host-cpu-unknown` 测试钩子进行冷启动，该钩子使 OpenVMM 的默认 CPU 配置档选择 `auto` 在由内置配置档服务的宿主上回退到宿主配置档，检查回退警告，捕获客户机，并按其快照的宿主配置档恢复。`managed-lifecycle` 场景启动一个客户机，其 init 将启动交给托管 agent，并用 Cargo 运行被忽略的 `nvx-rs` 测试 `tests/managed_lifecycle.rs`；该测试用场景的命令行启动 OpenVMM 并驱动客户机的控制会话；随后该场景检查 OpenVMM 的结果报告和客户机控制台。驱动 `sandbox` 或编译出站策略的场景会运行 [`nvx-rs`](#nvx-rs)。该命令需要 `build/vmlinux`（使用 `--debug-kernel` 时为 `build/vmlinux-debug` 及其 `build/vmlinux-debug.config`）、选定的 initramfs 以及 `openvmm/target/release/openvmm[.exe]`。

### `doctor`

```text
python3 scripts/nvx.py doctor
    --backend {kvm,mshv,whp}
    [--checks ID ...]
    [--openvmm PATH]
    [--kernel PATH]
    [--initrd PATH]
    [--cpu-fingerprint PATH | --no-openvmm]
    [--ci-schedule]
    [--probe-dir PATH]
    [--summary PATH]
    [--timeout SECONDS]
```

验证此宿主是否满足[时间 ABI](/docs/design/3.2-clock-and-time/)。它按顺序运行选定的检查，每个检查打印一行 `NVX-DOCTOR: check=<id> status=<pass|fail> detail="..."`，若有检查失败则以状态 1 退出。当某项检查无法读取其判定所依赖的事实时，该检查即失败，绝不会通过。[CI](/docs/ci/)描述了每项检查以及 CI 运行的子集。

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `--backend {kvm,mshv,whp}` | 必填 | 选择要验证的后端。 |
| `--checks ID ...` | `H1` 到 `H7` | 仅按顺序运行 `H1` 到 `H7` 中的这些检查。 |
| `--openvmm PATH` | `openvmm/target/release/openvmm[.exe]` | 选择用于 `H2`、`H3` 和 `H6` 的 OpenVMM 二进制文件。 |
| `--kernel PATH` | `build/vmlinux` | 选择用于 `H3` 和 `H6` 的客户机内核。 |
| `--initrd PATH` | `build/initramfs.cpio.gz` | 选择用于 `H3` 和 `H6` 的客户机 initramfs。 |
| `--cpu-fingerprint PATH` | 探测目录中的 `nvx-cpu-fingerprint-<backend>.json` | 选择 `H2` 写入 OpenVMM CPU 指纹的位置。 |
| `--no-openvmm` | 关闭 | 在没有 OpenVMM 二进制文件的情况下验证。此时 `H2` 检查 CPU 标识和代次，但不检查 CPU 配置档；并且 `--checks` 必须排除会启动 OpenVMM 的 `H3` 和 `H6`。 |
| `--ci-schedule` | 关闭 | 按 CI 的短计划运行 `H4` 和 `H6`：3 次速率采样，间隔 1 秒，而不是 13 次采样、间隔 10 秒；以及两次 warp 探测运行，而不是五次。 |
| `--probe-dir PATH` | `$RUNNER_TOOL_CACHE/nvx-host-time-probe`，或 `build/host-time-probe` | 选择宿主探测的缓存目录，doctor 会用 `rustc` 构建该探测。 |
| `--summary PATH` | 无 | 追加 Markdown 摘要，例如追加到 `$GITHUB_STEP_SUMMARY`。 |
| `--timeout SECONDS` | `120` | 设置每个探测或客户机允许的秒数。`H4` 在其之上另加采样窗口。 |

### `test-aci-edge-sandboxes`

```text
python3 scripts/nvx.py test-aci-edge-sandboxes
    --backend {kvm,mshv,whp}
    [--output-dir PATH]
    [--cargo CARGO]
```

在真实 hypervisor 上运行 [`aci_edge_sandboxes` crate](/docs/rust-api/) 中被忽略的 `openvmm_e2e` 测试，其 OpenVMM 后端构建于 [`nvx-rs` crate](/docs/nvx-rs/) 之上。这些测试用 `build/vmlinux` 和 Alpine initramfs 启动沙箱，工作负载直接使用其用户空间，并运行工作负载。它们检查工作负载身份、超时和取消，检查客户机状态持续到停止，还检查一次启动会在取消置备之前终止先前被中断启动的 VM。它们检查每个工作负载都在其请求的工作目录中启动（未指定时为 `/`），并检查缺失、非目录或不可访问的工作目录会使启动失败。它们还会以只读、读写和拒绝方式映射临时宿主目录，并针对网络网关检查出站默认值和规则，这不需要 Internet 访问。该命令需要 Cargo 和 `openvmm/target/release/openvmm[.exe]`，并在测试失败时把 OpenVMM 日志写入 `--output-dir`（默认 `build/test-results/aci_edge_sandboxes`）。沙箱将其状态保存在临时目录中，该命令仅在每个沙箱都已取消置备后才删除它。如果测试被中断，或未能停止或取消置备某个沙箱，该命令会保留该目录，并用可能仍在运行的 OpenVMM 进程 ID 标出每个剩余沙箱。

### `test-agent-bundling`

```text
python3 scripts/nvx.py test-agent-bundling
    [--cargo CARGO]
    [--toolchain TOOLCHAIN]
```

检查 [`aci_edge_sandboxes` crate](/docs/rust-api/) 如何通过其 `agent-bundled` feature 暂存边缘 agent 包，过程中不需要 hypervisor 或可运行的 agent 库。该命令为当前宿主的平台写入一个合成 bundle，其中的文件各自包含自己的名称，通过 `ACI_EDGE_SANDBOXES_AGENT_BUNDLE_DIR` 暂存它，并要求该 crate 的 bundled-agent 单元测试用构建时编译进去的摘要找到它。随后它要求构建拒绝以下 bundle 副本：文件被篡改、运行时清单把另一个文件固定为内核、使用另一个沙箱 ABI，以及用链接代替目录（符号链接，或 Windows 上的 junction）。它从 crate 的 `src/agent/bundle_contract.rs` 读取变量名，并从其数据模型读取沙箱 ABI，同时从构建环境中清除该 crate 的其他 bundle 变量。`--cargo` 选择 Cargo 可执行文件，`--toolchain` 选择 rustup 用来运行它的 Rust 工具链。CI 在 Linux 和 Windows 上运行该命令。

### `test-adversarial`

```text
python3 scripts/nvx.py test-adversarial
    --backend {kvm,mshv,whp}
    --campaign {workload-isolation,guest-isolation,snapshot-isolation}
    [--budget-seconds SECONDS]
    [--budget-actions COUNT]
    [--budget-ai-credits CREDITS]
    [--seed SEED]
    [--output-dir PATH]
    [--replay ACTIONS.jsonl]
    [--model MODEL]
    [--host-type {baremetal,virtual-machine}]
    [--memory-mib MIB]
    [--phase-timeout SECONDS]
    [--action-timeout SECONDS]
    [--executor-command PATH]
    [--no-minimize]
    [--minimize-attempts COUNT]
```

运行有界自适应测试活动，其中已安装并完成身份验证的 Copilot CLI 一次选择一个确定性原语。Copilot 没有工具，也不能直接访问 NVX。类型化代理会校验并记录每个操作，而无凭据执行器和独立看门狗负责 VM 操作、canary、拆除检查以及测试活动后的干净启动。

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `--backend` | 必填 | 在 Linux 上选择 KVM 或 MSHV，在 Windows 上选择 WHP。 |
| `--campaign` | 必填 | 选择工作负载、特权客户机或快照边界探测。 |
| `--budget-seconds` | `900` | 限制预检、操作、canary 启动和最小化的实际耗时。 |
| `--budget-actions` | `8` | 限制被接受并执行的代理操作数。 |
| `--budget-ai-credits` | `300` | 限制计费的 Copilot 用量；最小值为 60 credits，以便身份验证预检和至少一个操作各自保留 30 credits 的 CLI 上限。 |
| `--seed` | `0` | 为确定性候选排序和合成 canary 数据设置种子。 |
| `--output-dir` | `build/test-results` 下按后端区分的路径 | 唯一测试活动运行目录的父目录。 |
| `--replay` | 无 | 重放与其同级 `replay-manifest.json` 绑定的 `actions.jsonl`，不调用 Copilot。 |
| `--model` | Copilot 自动路由 | 选择策略模型。 |
| `--host-type` | `NVX_HOST_TYPE` 或 `unspecified` | 记录执行器是裸机还是虚拟机。 |
| `--memory-mib` | `256` | 为确定性微虚拟机场景设置内存。 |
| `--phase-timeout` | `60` | 设置每个底层确定性场景阶段的超时。 |
| `--action-timeout` | `600` | 设置单个操作或 canary 启动的外层限制。 |
| `--executor-command` | 本地子执行器 | 为独立的可弃置目标选择一个受信任的无参数包装器。 |
| `--no-minimize` | 关闭 | 禁用异常发生后在全新目标上的较短前缀重放。 |
| `--minimize-attempts` | `3` | 限制测试活动时间预算内的较短前缀尝试次数。 |

缺少 Copilot CLI 或未通过身份验证，在自适应模式下属于预检失败。重放模式没有 Copilot 前提条件。生产和 CI 测试活动必须通过 `--executor-command` 使用独立的可弃置执行器；本地模式无法可靠地对目标宿主机崩溃进行分类。本地目标日志保存在较短的 `build/adv` 状态根目录下，以避免 Windows 路径长度失败；运行摘要会记录其绝对位置。有关信任边界、包装器契约、产物和 CI 策略，参见 [Copilot 驱动的对抗性测试](/docs/adversarial-testing/)。

## 下载与运行

### `download`

```text
python3 scripts/nvx.py download
    [--repository OWNER/REPOSITORY]
    [--hypervisor {auto,whp,kvm,mshv}]
```

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `--repository OWNER/REPOSITORY` | `microsoft/nvx` | 从中下载发布版的 GitHub 仓库。 |
| `--hypervisor {auto,whp,kvm,mshv}` | `auto` | 选择发布版平台。`auto` 在 Windows 上选择 WHP，在 Linux 上选择 KVM。 |

`download` 首先在 CI 从已检出提交构建的发布版中查找所选平台的软件包。当该软件包存在时，打包的产物与检出内容一致。对于每个检查通过的 `dev` 提交，CI 会发布一个标记为 `v<VERSION>-dev.<first 12 characters of the commit>` 的开发发布版。当 `HEAD` 没有发布版时（例如 CI 的 `[skip ci]` 基线提交、检查失败的提交和本地提交），或其发布版没有所选平台的软件包时，`download` 会使用最近的一个拥有该软件包的第一父提交祖先。这些回退产物与该祖先一致，而不是与 `HEAD` 一致。它最多检查 20 个提交，每次一个 GitHub API 请求。请更新检出内容以安装更新的发布版。

安装发布版会替换 `build/` 下打包的客户机产物，并移除发布版未声明的任何已知客户机产物，例如包含源码的软件包所省略的 Azure Linux 客户机。它把打包的 OpenVMM 安装到 `openvmm/target/release/openvmm[.exe]`，把打包的 `nvx-rs` 安装到 `nvx-rs/target/release/nvx-rs[.exe]`，两者均可执行，其来源信息位于 `build/`，因此 [`run`](#run) 和 [`sandbox`](#sandbox) 不需要 Cargo。

`download` 仅在打包的 `nvx-rs` 来源信息描述的是 `nvx.py` 所运行的、由检出目录 `nvx-rs` 源码完成的构建，且使用检出目录固定的 Rust 发布版、发布目标和 `cli` feature 时，才安装该 `nvx-rs`，因为 `nvx.py` 会直接运行该可执行文件而不重新构建。由其他 `nvx-rs` 源码构建的回退发布版，以及在软件包开始附带 `nvx-rs` 之前的发布版，仍会安装其他所有内容：此时 `download` 会移除先前的 `nvx-rs` 及其来源信息并报告原因；当某个命令需要时，`nvx.py` 会用 Cargo 从检出目录构建 `nvx-rs`；参见 [nvx-rs](#nvx-rs)。若某个软件包的 `nvx-rs` 与其自身来源信息不匹配，下载会在替换任何内容之前失败。

Windows 发布版下载支持 WHP。Linux 发布版下载支持 KVM 和 MSHV。配置后，`download` 首先使用 `GH_TOKEN` 或 `GITHUB_TOKEN`。如果 GitHub 以 HTTP 401 或 403 拒绝该令牌，NVX 会报告失败并在无凭据的情况下重试，以便公共发布版仍可下载。私有仓库需要具有仓库内容读取权限的令牌，且在组织强制单点登录时该令牌须已获组织授权。

### `run`

```text
python3 scripts/nvx.py run
    [--guest {alpine,ubuntu,azurelinux}]
    [--hypervisor {auto,whp,kvm,mshv}]
    [--machine {microvm}]
    [--memory-mib MIB]
    [--memory-capacity-mib MIB]
    [--processors {1,2,4,8}]
    [--cpu-profile ID]
    [--mount GUEST_TARGET,HOST_PATH[,ro|rw]]...
    [--mount-deny HOST_PATH]...
    [--mount-allow HOST_PATH]...
    [--mount-write HOST_PATH]...
    [--mount-owner {vmm,caller}]
    [--net IPV4/PREFIX]
    [--network-profile {portable}]
    [--network-egress {allow,deny}]
    [--network-ingress {allow,deny}]
    [--network-egress-allow CIDR[:PROTOCOL[:PORT[-PORT]]]]...
    [--network-egress-deny CIDR[:PROTOCOL[:PORT[-PORT]]]]...
    [--network-egress-policy-file PATH]
    [--host-loopback {allow,deny}]
    [--network-proxy IPV4:TCP-PORT]
    [--host-loopback-forward PROTOCOL:HOST_PORT:GUEST_PORT]...
    [--outcome-report PATH]
    [--cmdline TEXT]
    [--restore-snapshot PATH]
    [--restore-processors {1,2,4,8}]
    [--restore-memory-mib MIB]
    [--restore-ready-path PATH]
    [--dry-run]
```

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `--guest {alpine,ubuntu,azurelinux}` | `alpine` | 在同一个 NVX 内核下选择 Alpine、Ubuntu 或 Azure Linux 用户空间。此选项不用于快照恢复。 |
| `--hypervisor {auto,whp,kvm,mshv}` | `auto` | 选择 OpenVMM hypervisor。`auto` 在 Windows 上选择 WHP，在其他平台上选择 KVM。 |
| `--machine {microvm}` | `microvm` | 选择具有共享状态边缘中断的固定拓扑微虚拟机。 |
| `--memory-mib MIB` | 因客户机而异 | 以 MiB 为单位设置客户机内存。默认值：Alpine 为 128，Ubuntu 为 512，Azure Linux 为 512。 |
| `--memory-capacity-mib MIB` | 无 | 为新的微虚拟机快照预留不可变、按 128 MiB 对齐的 RAM 容量。 |
| `--processors {1,2,4,8}` | `1` | 选择微虚拟机处理器数量。 |
| `--cpu-profile ID` | `auto` | 选择客户机的 CPU 配置档：`auto` 表示宿主 CPU 的内置配置档；在没有任何内置配置档服务的 Intel 或 AMD CPU 上，它会带警告回退到由此宿主派生的开发配置档；也可以指定内置配置档 ID，或用 `host` 表示该开发配置档。恢复使用快照的配置档，`auto` 以及对宿主配置档使用 `host` 时也指向它。 |
| `--mount GUEST_TARGET,HOST_PATH[,ro\|rw]` | 无 | 在绝对客户机目标路径上暴露宿主目录，或不带目录的单个常规宿主文件。模式取最后一个逗号之后的部分，因此当给出模式时 `HOST_PATH` 可以包含逗号。重复使用可暴露更多目录或文件，每个都有自己的目标和模式，作为聚合挂载的子项位于微虚拟机唯一的 virtio-fs 设备上，客户机负责将它们绑定到各自的目标；共享文件始终使用该聚合挂载。目标路径与宿主路径不得重叠，且各共享的内核命令行 token 必须符合其 1024 字节预算。`rw` 映射接受客户机创建的符号链接，宿主绝不会跟随这些链接。活动快照恢复要求相同的映射以相同顺序出现，并具有相同的规范路径、类型、目标、模式和所有权模式；休眠槽恢复可以附加一个客户机在恢复后显式挂载的新目录映射。 |
| `--mount-deny HOST_PATH` | 无 | 在已挂载的宿主根目录内隐藏一个现有文件或目录；重复使用可拒绝多个路径。当其中的 `--mount-allow` 路径仍然保留时，它可以指定该根目录本身。存在多个映射或共享文件时，该路径必须是绝对路径；共享文件不接受此选项。 |
| `--mount-allow HOST_PATH` | 无 | 在 `--mount-deny` 路径内再次暴露一个现有文件或目录；沿途被隐藏的目录只列出通向它的条目。重复使用可允许多个路径。存在多个映射或共享文件时，该路径必须是绝对路径；共享文件不接受此选项。参见[访问策略](/docs/run/)。 |
| `--mount-write HOST_PATH` | 无 | 使一个现有文件或目录成为 `rw` 映射中唯一可写的部分之一；客户机在该映射其他位置的写入会以 `EROFS` 失败。重复使用可声明多个可写路径。存在多个映射或共享文件时，该路径必须是绝对路径；共享文件不接受此选项。活动快照恢复要求相同的拒绝、允许和可写路径。 |
| `--mount-owner {vmm,caller}` | `vmm` | 选择客户机对每个 `--mount` 目录或文件执行操作时使用的宿主身份。`caller` 以客户机调用者的 UID 和 GID 执行每项操作，并将客户机 root 映射为共享目录或文件的所有者；它要求 Linux 宿主。参见[运行](/docs/run/)。 |
| `--net IPV4/PREFIX` | 无 | 使用静态客户机 IPv4 地址和前缀启用 virtio-net。客户机还会获得将其嵌入 `fd00::/96` 的 IPv6 地址，例如 `10.0.0.2/24` 对应 `fd00::a00:2/120`。 |
| `--network-profile {portable}` | 无 | 选择必需的跨平台网络行为契约；必须与 `--net` 一起指定。 |
| `--network-egress {allow,deny}` | `allow` | 设置默认客户机出站策略。 |
| `--network-ingress {allow,deny}` | `deny` | 设置默认宿主入站策略。`allow` 会把客户机监听的每个 TCP 和 UDP 端口发布给宿主专用网络上的客户端，并且仅在使用 `--host-loopback allow` 时也发布给宿主本身；参见[专用网络入站](/docs/run/)。快照捕获和恢复拒绝 `allow`。 |
| `--network-egress-allow CIDR[:PROTOCOL[:PORT[-PORT]]]` | 无 | 允许匹配的客户机出站流量；重复使用可添加规则。`CIDR` 是 IPv4 或 IPv6 地址或网络，规则只匹配其自身的地址族。`PROTOCOL` 为 `tcp`、`udp` 或 `icmp`；省略 `PORT` 时匹配所有端口；只有 `tcp` 和 `udp` 接受 `PORT` 或包含端点的 `PORT-PORT` 范围，例如 `8000-8010`。 |
| `--network-egress-deny CIDR[:PROTOCOL[:PORT[-PORT]]]` | 无 | 拒绝匹配的客户机出站流量；重复使用可添加规则。拒绝规则优先。`PROTOCOL` 和 `PORT` 的流量选择方式与 `--network-egress-allow` 相同。 |
| `--network-egress-policy-file PATH` | 无 | 从 JSON 加载有界的 IPv4 和 IPv6 范围以及规则局部 CIDR 排除项。要求显式指定 `--network-egress`；不能与显式的 allow/deny 规则标志混用。 |
| `--host-loopback {allow,deny}` | 沿用现有映射 | 控制客户机与宿主回环服务之间的访问。显式 `allow` 是双向的：客户机通过其网关访问宿主回环，客户机监听的每个 TCP 和 UDP 端口都会发布到宿主回环，仅限宿主访问；若同时使用 `--network-ingress allow`，也允许宿主访问；参见[宿主回环访问](/docs/run/)。快照捕获和恢复拒绝 `allow`。 |
| `--network-proxy IPV4:TCP-PORT` | 无 | 允许一个显式的宿主 TCP 代理端点。 |
| `--host-loopback-forward PROTOCOL:HOST_PORT:GUEST_PORT` | 无 | 将一个 TCP 或 UDP localhost 端口发布到客户机；重复使用可添加转发。 |
| `--outcome-report PATH` | 无 | 写出有界的本地 JSON 结果报告。 |
| `--cmdline TEXT` | 空 | 追加内核参数；`nvx_*` 和 `tsc=` token 为保留项。 |
| `--restore-snapshot PATH` | 无 | 从快照目录恢复不可变的机器契约和已保存状态。 |
| `--restore-processors {1,2,4,8}` | 无 | 在恢复就绪之前使此连续处理器前缀上线。需要选择启用的微虚拟机快照，且不能超过 `--processors` 容量。 |
| `--restore-memory-mib MIB` | 无 | 为支持扩展的快照恢复选择按 128 MiB 对齐的 RAM 目标。 |
| `--restore-ready-path PATH` | 无 | 向现有 Unix 套接字或 Windows 命名管道发布一个恢复就绪事件。 |
| `--dry-run` | 关闭 | 打印生成的 OpenVMM 命令而不运行它。 |

该命令需要 OpenVMM 发布版二进制文件、`build/vmlinux` 以及选定的 `build/initramfs*.cpio.gz`（它通过 `nvx-rs artifacts` 查找），并使用 `nvx-rs egress compile` 编译 `--network-egress-policy-file`；参见 [nvx-rs](#nvx-rs)。它自行构建并运行 OpenVMM 命令。选择 Ubuntu 时绝不会回退到 Alpine。宿主设置、客户机关闭、网络和 virtio-fs 示例参见[运行](/docs/run/)。

如果没有内置 CPU 配置档服务某台 Intel 或 AMD 宿主的 CPU，OpenVMM 会回退到宿主配置档，并在每次冷启动时以 `NVX-CPU-PROFILE-FALLBACK:` 发出警告，如 CPU 配置档所述。在此类 CPU 上冷启动失败后，`run` 会指出该 CPU、列出内置配置档覆盖的 CPU、说明 `auto` 会在其上回退，并通过 CPU 配置档请求要求提供该 CPU 的指纹，同时给出写入该指纹的 OpenVMM 命令。位于这些指引上方的 OpenVMM 自身错误会指出失败原因，并在宿主配置档无法启动时说明这一点。对于没有内置配置档服务的其他厂商 CPU，OpenVMM 会在创建 VM 之前以 `E_PROFILE_HOST_UNKNOWN` 退出，`run` 会说明宿主配置档在那里也无法启动。若宿主的 hypervisor 不支持其内置配置档，则会改为以 `E_PROFILE_UNSUPPORTED` 失败；在 Intel 或 AMD CPU 上，OpenVMM 的错误本身会指出 `--cpu-profile host`。

### `sandbox`

```text
python3 scripts/nvx.py sandbox
    [{run,provision,start,exec,stop,deprovision}]
    [--layer ROLE,PATH,EROFS_UUID]...
    [--scratch PATH]
    [--state-dir PATH]
    [--entrypoint PATH]
    [--arg VALUE]...
    [--hostname NAME]
    [--workload-user UID:GID]
    [--memory-max BYTES]
    [--pids-max COUNT]
    [--memory-mib MIB]
    [--timeout SECONDS]
    [--exec-timeout-ms MILLISECONDS]
    [--cwd GUEST_PATH]
    [--environment KEY=VALUE]...
    [--environment-file PATH]
    [--inherit-default-environment]
    [--hypervisor {auto,whp,kvm,mshv}]
    [--mount GUEST_TARGET,HOST_PATH[,ro|rw]]...
    [--mount-deny HOST_PATH]...
    [--mount-allow HOST_PATH]...
    [--mount-write HOST_PATH]...
    [--mount-owner {vmm,caller}]
    [--net IPV4/PREFIX]
    [--network-profile {portable}]
    [--network-egress {allow,deny}]
    [--network-ingress {allow,deny}]
    [--network-egress-allow CIDR[:PROTOCOL[:PORT[-PORT]]]]...
    [--network-egress-deny CIDR[:PROTOCOL[:PORT[-PORT]]]]...
    [--network-egress-policy-file PATH]
    [--host-loopback {allow,deny}]
    [--network-proxy IPV4:TCP-PORT]
    [--host-loopback-forward PROTOCOL:HOST_PORT:GUEST_PORT]...
    [--outcome-report PATH]
    [--cmdline TEXT]
    [--dry-run]
```

网络策略和实时共享选项只配置 `run` 和 `provision` 启动。

`sandbox` 使用给定的操作和选项运行 `nvx-rs sandbox`（参见 [nvx-rs](#nvx-rs)），其退出状态即该命令的退出状态：错误为 1，用法错误为 2，Ctrl-C 后为 130，其他情况下为工作负载或 OpenVMM 返回的状态。`nvx.py` 解析这些选项仅用于其帮助信息以及未知选项、无效选项值和缺失值的用法错误，因此它仍接受缩写选项，并将它们完整传给 `nvx-rs`。`nvx-rs` 会检查这些值，其用法信息和消息中会写出 `nvx.py sandbox`；无论终端宽度如何，其用法文本都按 80 列换行。

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `{run,provision,start,exec,stop,deprovision}` | `run` | 选择一次性运行或托管生命周期操作。 |
| `--layer ROLE,PATH,EROFS_UUID` | `run` 和 `provision` 必填 | 附加 `distro` EROFS 层。仅接受 `distro`。 |
| `--scratch PATH` | `run` 和 `provision` 必填 | 附加预格式化的 ext4 暂存镜像作为可写覆盖层。 |
| `--state-dir PATH` | 托管操作必填 | 选择持久化沙箱状态。一次性 `run` 拒绝此选项。 |
| `--entrypoint PATH` | `/bin/sh` | 选择不含空白的绝对工作负载入口点。 |
| `--arg VALUE` | 无 | 追加一个不含空白的入口点参数。重复使用可传入多个参数。 |
| `--hostname NAME` | `nvx-sandbox` | 设置工作负载的 UTS 主机名。 |
| `--workload-user UID:GID` | `65534:65534` | 为 `run` 或 `provision` 选择固定的非 root 工作负载身份。 |
| `--memory-max BYTES` | 无 | 设置工作负载 cgroup 内存限制。 |
| `--pids-max COUNT` | 无 | 设置工作负载 cgroup 进程数限制。 |
| `--memory-mib MIB` | `256` | 以 MiB 为单位设置客户机内存。 |
| `--timeout SECONDS` | `60` | 设置 `start`、`exec` 和 `stop` 中每个托管控制请求及其响应的超时，以及 `provision`、`start`、`stop` 和 `deprovision` 等待沙箱另一次生命周期转换的最长时间。该值必须有限且大于 0。 |
| `--exec-timeout-ms MILLISECONDS` | `0` | 在无符号 32 位范围 `0..4294967295` 内设置托管 `exec` 的客户机工作负载超时；零表示禁用工作负载截止时间。这与有限的宿主 `--timeout` 控制截止时间相互独立。 |
| `--cwd GUEST_PATH` | `/` | 为托管 `exec` 设置工作负载根目录内的绝对工作目录。它在应用工作负载身份和根目录之后解析；缺失、不可访问或非目录路径会使工作负载启动失败。默认环境和分层环境会把 `PWD` 指向此目录；完全替换环境则自行控制 `PWD`。 |
| `--environment KEY=VALUE` | 省略 | 设置精确的托管 `exec` 环境。重复使用可设置多个条目。空值、空格、额外的等号和 UTF-8 均会保留。内联值在调用方宿主进程参数中可见；敏感值请使用 `--environment-file`。 |
| `--environment-file PATH` | 省略 | 从由 `KEY=VALUE` 字符串组成的 UTF-8 JSON 数组读取精确的托管 `exec` 环境，输入上限为 1 MiB。空数组表示请求空环境。此选项与 `--environment` 互斥；两者都省略时保留客户机默认值。 |
| `--inherit-default-environment` | 关闭 | 将来自 `--environment` 或 `--environment-file` 的托管 `exec` 环境叠加到客户机默认环境之上，而不是替换它；同名条目会替换默认变量。未指定这两个选项时，工作负载本就获得默认环境，因此该标志没有效果。 |
| `--hypervisor {auto,whp,kvm,mshv}` | `auto` | 选择宿主 hypervisor。 |
| `--mount GUEST_TARGET,HOST_PATH[,ro\|rw]` | 无 | 为 `run` 或 `provision` 在容器 rootfs 内的绝对目标路径上实时共享宿主目录，或不带目录的单个常规宿主文件；默认为 `ro`。模式取最后一个逗号之后的部分，因此当给出模式时 `HOST_PATH` 可以包含逗号。重复使用可附加更多共享，每个都有自己的目标和模式，例如读写工作区和只读工具缓存，作为聚合挂载的子项，由客户机绑定到各自目标；共享文件始终使用该聚合挂载。目标路径与宿主路径不得重叠，且各共享的内核命令行 token 计入沙箱的 1024 字节预算。`rw` 共享接受客户机创建的符号链接，宿主绝不会跟随这些链接。`/`、`/etc`、`/run` 和 `/run/nvx`，以及 `/etc/machine-id`、`/proc`、`/sys`、`/dev`、`/.nvx-agent` 和 `/run/nvx/time` 目录树均为保留项。 |
| `--mount-deny HOST_PATH` | 无 | 在 `--mount` 宿主目录内隐藏一个现有文件或目录；相对路径会在其中解析。当其中的 `--mount-allow` 路径仍然保留时，它可以指定该目录本身。存在多个共享时，它作用于其前面的 `--mount`，该 `--mount` 必须共享一个目录。重复使用可拒绝多个路径。 |
| `--mount-allow HOST_PATH` | 无 | 再次暴露同一共享的 `--mount-deny` 路径内的一个现有文件或目录，例如隐藏日志中可读的 `mcp-payloads` 目录。沿途被隐藏的目录只列出通向它的条目，工作负载无法修改它们。相对路径在共享内解析；存在多个共享时，它作用于其前面的 `--mount`。重复使用可允许多个路径。参见[访问策略](/docs/run/)。 |
| `--mount-write HOST_PATH` | 无 | 使一个现有文件或目录成为 `rw` 共享中唯一可写的部分之一；工作负载在共享其他位置的写入会以 `EROFS` 失败。相对路径在共享内解析；存在多个共享时，它作用于其前面的 `--mount`，该 `--mount` 必须为 `rw`。重复使用可声明多个可写路径。`provision` 会持久化拒绝、允许和可写路径。 |
| `--mount-owner {vmm,caller}` | `vmm` | 为 `run` 或 `provision` 选择共享文件操作使用的宿主身份。`vmm` 以 OpenVMM 身份执行这些操作；`caller` 以工作负载的 UID 和 GID 执行，将客户机 root 映射为每个共享宿主目录或文件的所有者，并在 OpenVMM 无法采用该身份时以 `EPERM` 使其失败。`caller` 要求 Linux 宿主，并由 `provision` 持久化。参见[文件所有权](/docs/run/)。 |
| `--net IPV4/PREFIX` | 无 | 使用静态客户机地址启用 virtio-net。客户机还会获得将其嵌入 `fd00::/96` 的 IPv6 地址。 |
| `--network-profile {portable}` | 无 | 选择必需的跨平台网络行为契约；必须与 `--net` 一起指定。 |
| `--network-egress {allow,deny}` | `allow` | 为 `run` 或 `provision` 设置默认客户机出站策略。 |
| `--network-ingress {allow,deny}` | `deny` | 为 `run` 或 `provision` 设置宿主入站策略。`allow` 会把工作负载监听的每个 TCP 和 UDP 端口发布给宿主专用网络上的客户端，并且仅在使用 `--host-loopback allow` 时也发布给宿主本身；参见[专用网络入站](/docs/run/)。 |
| `--network-egress-allow CIDR[:PROTOCOL[:PORT[-PORT]]]` | 无 | 允许匹配的客户机出站流量；重复使用可添加规则。要求显式指定 `--network-egress`。`CIDR` 是 IPv4 或 IPv6 地址或网络，规则只匹配其自身的地址族。`PROTOCOL` 为 `tcp`、`udp` 或 `icmp`；省略 `PORT` 时匹配所有端口；只有 `tcp` 和 `udp` 接受 `PORT` 或包含端点的 `PORT-PORT` 范围，例如 `8000-8010`。 |
| `--network-egress-deny CIDR[:PROTOCOL[:PORT[-PORT]]]` | 无 | 拒绝匹配的客户机出站流量；重复使用可添加规则。要求显式指定 `--network-egress`；拒绝规则优先。`PROTOCOL` 和 `PORT` 的流量选择方式与 `--network-egress-allow` 相同。 |
| `--network-egress-policy-file PATH` | 无 | 为 `run` 或 `provision` 加载有界的 IPv4 和 IPv6 范围以及规则局部 CIDR 排除项。托管 `provision` 会持久化下沉后的规则，而不是此路径。要求显式指定 `--network-egress`；不能与显式的 allow/deny 规则标志混用。 |
| `--host-loopback {allow,deny}` | 沿用现有映射 | 为 `run` 或 `provision` 控制工作负载与宿主回环服务之间的访问。显式 `allow` 是双向的：工作负载通过其网关访问宿主回环，工作负载监听的每个 TCP 和 UDP 端口都会发布到宿主回环，仅限宿主访问；若同时使用 `--network-ingress allow`，也允许宿主访问；参见[宿主回环访问](/docs/run/)。 |
| `--network-proxy IPV4:TCP-PORT` | 无 | 允许一个显式的宿主 TCP 代理端点；IPv4 地址必须与客户机网关匹配。 |
| `--host-loopback-forward PROTOCOL:HOST_PORT:GUEST_PORT` | 无 | 将一个 TCP 或 UDP localhost 端口发布到客户机；重复使用可添加转发，并设置 `--host-loopback allow`。 |
| `--outcome-report PATH` | 无 | 为一次性 `run` 或托管 `exec` 写出有界的本地 JSON 结果报告。 |
| `--cmdline TEXT` | 空 | 追加非沙箱内核参数；`nvx_*`、`virtfs_*` 和 `tsc=` token 为保留项。 |
| `--dry-run` | 关闭 | 仅用于一次性 `run`：打印生成的 OpenVMM 微虚拟机命令而不运行它。托管操作拒绝此选项。 |

产物准备、安全边界以及当前快照/配置限制参见[运行](/docs/run/)。

## CPU 配置档

每个微虚拟机都会向其客户机呈现一个 CPU 配置档：某一 CPU 世代的完整 CPUID 表面，由 OpenVMM 固定，并为所有后端共享（参见 [CPU 配置档设计](/docs/design/2.2-cpu-and-topology/)）。默认情况下，OpenVMM 选择宿主 CPU 世代的内置配置档：

| 配置档 | 世代 | CPU（显示家族/型号） |
| --- | --- | --- |
| `intel.skylake-sp.v1` | `skylake-sp` | 第一代 Intel Xeon Scalable（6/85，步进 0 到 4） |
| `intel.icelake-sp.v1` | `icelake-sp` | 第三代 Intel Xeon Scalable（6/106） |
| `intel.emeraldrapids.v1` | `emeraldrapids` | 第五代 Intel Xeon Scalable（6/207） |
| `intel.alderlake.v1` | `alderlake` | 第十二代 Intel Core（6/151 和 6/154） |
| `amd.milan.v1` | `milan` | 第三代 AMD EPYC（25/1，含 Milan-X） |
| `amd.genoa.v1` | `genoa` | 第四代 AMD EPYC（25/17，含 Genoa-X） |
| `amd.turin.v1` | `turin` | 第五代 AMD EPYC（26/2） |

任何其他 CPU（包括 Cascade Lake、Sapphire Rapids、Granite Rapids、Tiger Lake、Raptor Lake 以及 AMD 的 Ryzen CPU）都没有内置配置档：在 Intel 或 AMD CPU 上，`--cpu-profile auto` 会回退到下文中描述的宿主配置档；在其他厂商的 CPU 上，则会以 `E_PROFILE_HOST_UNKNOWN` 失败。即使是所列世代的宿主，如果其 SKU 或 hypervisor 缺少该配置档的某项特性，仍可能以 `E_PROFILE_UNSUPPORTED` 失败；在 Intel 或 AMD CPU 上，OpenVMM 的错误此时会指出 `--cpu-profile host`。`intel.alderlake.v1` 派生自 WHP 上的一台 Core i9-12900H，`amd.milan.v1` 派生自 WHP 上的一台 EPYC 7763 Azure VM，`amd.genoa.v1` 和 `amd.turin.v1` 则分别派生自 KVM 上的一台 GitHub 托管 Actions runner（配备 EPYC 9V74 或 9V45 的 Azure VM）。配备 EPYC 7763、9V74 或 9V45 的 GitHub runner 在 KVM 上通过其配置档的完整 `test-microvm` 套件。KVM 和 MSHV 上的 Alder Lake 宿主，MSHV 上的 Milan、Genoa 和 Turin 宿主，WHP 上的 Genoa 和 Turin 宿主，裸机 AMD 宿主，以及缺少配置档特性的 SKU 均未经验证。AMD 配置档省略了 KVM 无法呈现的内容：没有 `SPEC_CTRL` 控制时的 `BTC_NO` 和 PSFD，以及 KVM 在 AMD 宿主上添加的 Intel 推测执行控制枚举。它们不呈现 AMD 的任何推测执行控制（`IBRS`、`STIBP` 和 `SSBD`），因为 Azure VM 的 hypervisor 不提供这些控制；因此 `amd.milan.v1` 的 Linux 客户机使用 retpolines，并在每个宿主上报告 SSB、SRSO 和 TSA 为易受攻击。`amd.genoa.v1` 固定了 Azure 在 Genoa 上呈现的 TSA 免疫项，而裸机 Genoa 宿主的 KVM 不会报告这些内容。

在没有内置配置档服务的 Intel 或 AMD 开发宿主上，`--cpu-profile auto` 会回退到宿主配置档 `intel.host.v1` 或 `amd.host.v1`；例如在 hypervisor 不支持内置配置档时，`run --cpu-profile host` 也会选择它。OpenVMM 会在此宿主上对 hypervisor 取指纹，并对它应用内置配置档的派生策略，因此客户机看到的是同类的过滤后 CPU 表面；OpenVMM 还会像验证内置配置档那样验证它：如果 hypervisor 缺少时间 ABI 所需的某项 CPU 特性，冷启动仍会以 `E_PROFILE_UNSUPPORTED` 失败。若 `auto` 发生了回退，错误还会说明这一点；使用显式 `--cpu-profile host` 时，则只报告该失败。宿主配置档仅供开发使用：

- 它未被固定：微码、固件、hypervisor 或 OS 更新都可能改变它。
- 每次冷启动都会先对 hypervisor 取指纹，[#394](https://github.com/microsoft/nvx/pull/394) 在 WHP 上测得 2.6 至 5.5 ms、KVM 上 11 至 23 ms、MSHV 上 52 ms。开销随宿主而异，回退警告会报告每次冷启动取指纹所花的时间。
- 快照会记录其宿主配置档，且仅在具有相同 CPU 型号和步进、且其 hypervisor 支持该配置档的宿主上恢复。
- `doctor` 从不会验证它，因此 CI 宿主需要内置配置档；`benchmark` 会拒绝没有内置配置档服务的 CPU。

每次发生回退的冷启动都会在默认日志级别记录一条 OpenVMM 警告，以 `NVX-CPU-PROFILE-FALLBACK:` 开头，并指出 CPU、宿主配置档及其摘要、这些限制，以及该次冷启动取指纹所花的时间。它还会请你协助为该 CPU 添加内置配置档：运行 `openvmm --hypervisor <backend> --cpu-fingerprint fingerprint.json`（在此类 CPU 上它会报告 `E_PROFILE_HOST_UNKNOWN`，但仍会写出指纹），并将 `fingerprint.json` 附加到 [CPU 配置档请求](https://github.com/microsoft/nvx/issues/new?template=cpu-profile.yml)；警告中的链接会预填该 CPU。指纹包含 CPU 的身份和微码、OS 类型和构建、hypervisor 接口，以及后端支持的 CPUID、XSAVE、MSR 和时间表面；它不包含主机名、用户名或序列号。来自其他后端的同世代指纹也有帮助，因为配置档是其各后端指纹的交集，且已发布的配置档不可变。显式 `--cpu-profile host` 同样会发出警告；当没有内置配置档服务该 CPU 时，也会给出同样的请求。

[#408](https://github.com/microsoft/nvx/issues/408) 跟踪面向更多 Intel CPU（例如 Tiger Lake 和 Meteor Lake）的内置配置档，[#409](https://github.com/microsoft/nvx/issues/409) 则跟踪更多 AMD CPU；维护者会把每个 CPU 配置档请求链接到其中之一；宿主配置档不服务 Intel 和 AMD 以外厂商的任何 CPU。配置档派生自其世代宿主在每个它所服务的后端上的指纹；参见 OpenVMM 子模块中的 `vmm_core/cpu_profile`。

## 基准测试

### `benchmark`

```text
python3 scripts/nvx.py benchmark [OPTIONS]
```

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `--suite {boot,snapshot,restore,e2e,phase2,snapshot-profile,all,cold-start,device-io,device-restore-profile,network-snapshot,performance,shell-snapshot,shell-snapshot-restore,snapshot-restore-memory,snapshot-restore-vcpu,virtfs}` | `boot` | 选择验收、诊断或工作负载套件。 |
| `--backend {whp,kvm,mshv,both}` | Windows 上为 `both`；其他平台为 `kvm` | 选择 hypervisor 后端。 |
| `--platform NAME` | 推断的 OS/后端 | 记录按宿主类型区分的性能序列。 |
| `--openvmm-dir PATH` | `openvmm/` | 选择 OpenVMM 仓库。 |
| `--nvx-dir PATH` | 仓库根目录 | 选择包含客户机产物的 NVX 仓库。 |
| `--warmups N` | `device-io` 为 `5`；`device-restore-profile` 为 `1`；其他为 `3` | 设置被排除的预热尝试次数；允许为零。 |
| `--runs N` | `device-io` 为 `30`；`device-restore-profile` 为 `5`；其他为 `11` | 设置保留的尝试次数。 |
| `--memory-mib MIB` | `128` | 为通用套件设置客户机内存。 |
| `--processors {1,2,4,8}` | `1` | 以此微虚拟机数量运行每次冷启动、捕获、恢复和工作负载启动。 |
| `--virtfs-runs N` | `3` | 设置 virtio-fs 工作负载样本数。 |
| `--virtfs-memory-mib MIB` | `512` | 为 virtio-fs 工作负载设置客户机内存。 |
| `--payload-mib MIB` | `64` | 设置 virtio-fs 顺序 I/O 载荷大小。 |
| `--shell-memories MIB [MIB ...]` | `128 256 512`（`snapshot-profile` 为 `128 256 512 1024`） | 设置 shell 快照测量的客户机内存大小。 |
| `--network-memory-mib MIB` | `256` | 为网络快照工作负载设置客户机内存。 |
| `--restore-devices {console,net,virtiofs} [...]` | 全部三种设备 | 为 `device-restore-profile` 套件选择设备。 |
| `--restore-modes {active,deferred} [...]` | 两种模式 | 为 `device-restore-profile` 套件选择激活模式。 |
| `--device-io-duration-seconds SECONDS` | `10` | 设置每次存储操作或 UDP 往返的测量窗口。 |
| `--device-io-size-mib MIB` | `512` | 设置 virtio-blk 和 virtio-fs 后备对象的大小。 |
| `--device-io-port PORT` | `5201` | 设置同宿主 UDP 回显端口。 |
| `--net IPV4/PREFIX` | 无 | 使用静态客户机地址启用 virtio-net。 |
| `--network-profile {portable}` | 无 | 与 `--net` 一起使用；选择可移植的 KVM/MSHV/WHP 契约。 |
| `--cpus CPUSET` | 每个物理核心一个逻辑 CPU | 以 `taskset` 语法设置进程亲和性。 |
| `--host-cpu-reserve N` | `2` | 要求除客户机 vCPU 数量外还有这么多亲和 CPU 用于 VMM/设备工作。 |
| `--timeout SECONDS` | `10` | 设置每个启动标记允许的时间。 |
| `--teardown-mode {guest-exit,host-terminate,host-sigterm}` | `guest-exit` | 选择如何停止被测 VM；`host-sigterm` 是已弃用的别名。 |
| `--skip-build` | 关闭 | 复用现有发布版二进制文件。 |
| `--snapshot-profile` | 关闭 | 保留 OpenVMM 生命周期阶段样本和宿主计数器，并在 Windows 上于每次捕获期间采样存储、CPU、回写和 Defender 遥测；`snapshot-profile` 套件会隐含启用。 |
| `--cache-state {warm,cold,both}` | `both` | 为 `snapshot-profile` 套件选择产物缓存状态。 |
| `--output PATH` | 无 | 将基准测试结果写为 JSON。 |
| `--output-dir PATH` | 无 | 将规范工作负载日志写入目录。 |
| `--scratch-dir PATH` | 系统临时目录 | 为临时快照、客户机 RAM 后备和工作负载文件选择一个现有目录。 |
| `--keep-kvm-stage` | 关闭 | 保留临时暂存的 KVM 基准测试二进制文件。 |

测量的次数必须至少为 1；预热次数可以为零，超时必须大于零。除 `phase2`（它不启动微虚拟机）外的每个套件，都会在构建或测量任何内容之前拒绝某台宿主：如果 `--openvmm-dir` 检出目录中没有任何内置 CPU 配置档服务其 CPU，或者它无法识别该 CPU 或读取该检出目录的配置档，因而无法确认存在这样的配置档。在此类 Intel 或 AMD CPU 上，OpenVMM 的默认 CPU 配置档选择 `auto` 会回退到宿主配置档；该配置档每次冷启动都会先对 hypervisor 取指纹，且任何基线都不共享其结果；拒绝信息会指出该 CPU 并链接到 CPU 配置档请求。在其他厂商的 CPU 上，每次冷启动都会以 `E_PROFILE_HOST_UNKNOWN` 失败；对于检出目录中多个世代的配置档都覆盖的 CPU 也是如此，`benchmark` 同样会拒绝：`auto` 会拒绝这样的配置档目录，而不会回退。`e2e` 套件使用通用内存大小，并针对 shell 就绪标记测量冷启动、快照生成、快照恢复、客户机退出拆除和峰值 RSS。CI 使用默认的 128 MiB 基线。JSON 结果和工作负载元数据会在 `host` 下记录基准测试宿主的来源信息，不包含凭据或 Azure 资源标识符。套件语义、平台支持、指标定义和完整示例参见[基准测试](/docs/benchmarks/)。

### `performance`

`performance` 处理 CI 的基准测试输出。它要求一个嵌套命令。

#### `performance collect`

```text
python3 scripts/nvx.py performance collect
    --platform PLATFORM
    --commit COMMIT
    --input-dir PATH
    --output-dir PATH
    [--require-network]
    [--require-shell-snapshot]
    [--require-shared-suite]
    [--require-shell-snapshot-restore-512]
    [--lifecycle-input PATH]
    [--lifecycle-attempt-log PATH]
    [--summary PATH]
```

将规范基准测试日志解析为 p50 CSV 文件。`--require-*` 标志会针对各自对应的工作负载集合拒绝不完整的输入。`--require-shell-snapshot-restore-512` 仅接受来自 2、4 或 8 vCPU 运行的规范 512 MiB 恢复指标。`--lifecycle-input` 会校验并合并一个 128 MiB、客户机退出的 `e2e` JSON 结果，生成包含 29 项指标的微虚拟机 CI 结果。元数据选择 `device-io` 的目录会被收集为五个额外的 ABI-2、单 vCPU `ops/s` 指标；CI 会将它们合并为包含 34 项指标的单 vCPU 结果。`--lifecycle-attempt-log` 读取 `validate-openvmm` 记录的尝试日志。`--lifecycle-input` 文件必须是恰好一次有效记录尝试的字节级完全副本，否则收集会在写入 CSV 之前失败；该命令会指出该次尝试。`--summary` 写出 p50 表，以及生命周期最小值/最大值/样本数和 RSS 诊断、基准测试宿主来源信息，以及任何快照生成存储遥测。配合 `--lifecycle-attempt-log` 时，它还会列出每次尝试、标记已发布的那次，并报告被拒绝尝试的遥测。当输入记录了基准测试宿主时，该命令还会将其以 `<platform>-host.json` 写入 `--output-dir`，格式与[预期基准测试宿主](/docs/benchmarks/)一致。如果只有部分输入记录了宿主，如果这些输入或 `--output-dir` 中已有的宿主文件记录了另一台宿主，或者如果 `--output-dir` 会混合记录了宿主的结果与未记录宿主的结果，该命令就会失败。

#### `performance validate-openvmm`

```text
python3 scripts/nvx.py performance validate-openvmm
    --platform PLATFORM
    --input PATH
    [--attempt-log PATH]
```

校验一个完整的 128 MiB、客户机退出 OpenVMM `e2e` 结果，不写入 CSV。快照生成不稳定时会以状态 75 退出，以便调用方有选择地重新测量临时宿主状况；其他格式错误或不完整的输入会以状态 2 退出。`--attempt-log` 会把输入的路径、SHA-256 摘要、结果（`valid`、`unstable` 或 `invalid`）、退出状态和错误追加到 JSON 尝试日志，并在首次尝试时创建该日志。

#### `performance collect-openvmm`

```text
python3 scripts/nvx.py performance collect-openvmm
    --platform PLATFORM
    --commit COMMIT
    --input PATH
    --output-dir PATH
    [--summary PATH]
```

将完整的 128 MiB、客户机退出 OpenVMM `e2e` 结果转换为包含八项指标的生命周期 p50 CSV。与 `performance collect` 一样，它会把记录的基准测试宿主以 `<platform>-host.json` 写入 `--output-dir`。

#### `performance gate`

```text
python3 scripts/nvx.py performance gate
    --baseline-dir PATH
    --target-dir PATH
    [--window N]
    [--minimum-history N]
    [--threshold PERCENT]
    [--absolute-tolerance-ms MILLISECONDS]
    [--history-reset-dir PATH]
    [--summary PATH]
```

对照滚动基线历史检查目标 p50 值是否出现回归。`--window` 默认为 `10`，`--minimum-history` 默认为 `10`，`--threshold` 默认为 `40`，`--absolute-tolerance-ms` 默认为 `5`。门禁使用可用窗口的中位数，并把历史不足的指标视为预热。`--summary` 写出 Markdown 摘要。`--history-reset-dir` 指定受跟踪的候选历史；从现有历史文件中移除的指标会重新开始基线预热。当候选预期宿主（`--history-reset-dir` 中的 `<platform>-host.json`）在某个必需属性上与 `--baseline-dir` 中的不同时，除非候选历史文件不保留该序列（任何指标）的任何行，否则门禁会失败。

#### `performance persist`

```text
python3 scripts/nvx.py performance persist
    --source-dir PATH
    --history-dir PATH
    [--exclude-metric NAME]...
    [--require-host]
```

将当前 p50 值追加到分支历史。重复 `--exclude-metric` 可省略多个指标。当两个目录都包含某平台的宿主文件 `<platform>-host.json` 时，如果该平台结果记录的宿主在某个必需属性上与历史不同，该命令会拒绝追加这些结果，并对提示性差异发出警告。对于已有宿主文件的历史，它也会拒绝没有宿主文件的结果。`--require-host` 要求每个平台都提供这两个文件。

#### `performance check-host`

```text
python3 scripts/nvx.py performance check-host
    --platform PLATFORM
    --history-dir PATH
    [--scratch-dir PATH]
    [--output PATH]
    [--summary PATH]
```

将本宿主与 `PLATFORM` 序列的预期宿主（`--history-dir` 中的 `<platform>-host.json`）进行比较，方式与 CI 在测量该序列之前相同；参见[预期基准测试宿主](/docs/benchmarks/)。当某个必需属性（例如 CPU、VM 大小、OS 构建，或基准测试磁盘或卷）不同时，命令以状态 1 退出；当预期宿主缺失或格式错误时，以状态 2 退出。提示性差异（例如微码修订版或 Windows 累积更新）只会发出警告。该命令会打印每个被比较的属性，并把必需差异和提示性差异分别报告为一条 GitHub Actions 错误和一条警告注解。`--scratch-dir` 指定基准测试要使用的暂存目录（基准测试将使用该目录所在的卷）；默认为系统临时目录。`--output` 以宿主文件格式写出本宿主，可直接替换预期宿主；`--summary` 追加包含该内容的 Markdown 比较。

## 源码与打包命令

### `collect-sources`

```console
python3 scripts/nvx.py collect-sources
```

实体化包含源码的发布版所需的、经过校验的 Linux、Alpine 和 Ubuntu 源码产物。Azure Linux 的对应源码不会被收集，因此包含源码的软件包会省略 Azure Linux 客户机。

### `collect-alpine-sources`

```text
python3 scripts/nvx.py collect-alpine-sources MANIFEST [MANIFEST ...]
    [--output PATH]
    [--cache PATH]
    [--skip-upstream]
```

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `MANIFEST` | 必填 | 要收集的一个或多个 Alpine 软件包清单。 |
| `--output PATH` | `build/sources/alpine` | 选择输出目录。 |
| `--cache PATH` | `.cache/aports` | 选择 aports 缓存目录。 |
| `--skip-upstream` | 关闭 | 仅收集精确的 aports recipe，不运行 `abuild fetch`。 |

每次运行都会替换生成的 `recipes`、`upstream`、`manifest.json` 和 `SHA256SUMS` 条目。收集器会拒绝作为符号链接或 Windows junction 的输出路径，以及包含其他任何内容的输出目录。发布版校验和清单拒绝符号链接，因此 recipe 符号链接会存储为其目标的常规副本。离开 recipe 的链接、硬链接和特殊文件都会被拒绝。

### `collect-ubuntu-sources`

```text
python3 scripts/nvx.py collect-ubuntu-sources MANIFEST [MANIFEST ...]
    [--output PATH]
    [--cache PATH]
```

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `MANIFEST` | 必填 | 要收集的一个或多个 Ubuntu 软件包或 EROFS 清单。 |
| `--output PATH` | `build/sources/ubuntu` | 选择输出目录。 |
| `--cache PATH` | `.cache/ubuntu-source-indexes` | 选择已下载的源码索引缓存。 |

收集器需要 `gpgv`，会对源码包名称/版本对去重，通过签名的 `InRelease` 元数据和固定的 Ubuntu 归档密钥环验证当前或历史 Ubuntu 源码索引，校验每个 `.dsc`，并下载每个被引用的源码成员。

### `create-linux-source-archive`

```text
python3 scripts/nvx.py create-linux-source-archive
    --config PATH
    --output PATH
```

根据固定的内核输入和生成的内核配置创建确定性的 Linux 对应源码归档。`--config` 必须指定一个现有的生成内核配置，`--output` 指定要创建的归档。

### `package`

```text
python3 scripts/nvx.py package
    [--version VERSION]
    [--destination PATH]
    (--include-source | --binary-only)
    [--force]
```

| 选项 | 说明 |
| --- | --- |
| `--version VERSION` | 覆盖打包的版本。 |
| `--destination PATH` | 覆盖暂存目标位置。 |
| `--include-source` | 在软件包中包含对应源码产物，并省略 Azure Linux 客户机产物。 |
| `--binary-only` | 仅暂存二进制文件；单独发布对应源码。 |
| `--force` | 替换现有暂存目标位置。 |

必须且只能指定 `--include-source` 和 `--binary-only` 之一。每个软件包都会附带 `nvx-rs` 及其来源信息，该来源信息必须表明 `nvx-rs/target/release/nvx-rs[.exe]` 是由检出目录的源码为宿主操作系统的发布目标构建的：Linux 上为 `x86_64-unknown-linux-musl` 静态可执行文件，Windows 上为 `x86_64-pc-windows-msvc`；参见 [`record-nvx-rs-provenance`](#record-nvx-rs-provenance)。发布流程和源码发布要求参见[打包与源码交付](/docs/distribution/)。

### `archive-release`

```text
python3 scripts/nvx.py archive-release
    --source PATH
    --destination PATH
```

根据 `SHA256SUMS` 校验暂存的发行内容，对已接受的清单做快照，并在目标位置创建确定性归档。目标位置必须位于源目录之外，并以 `.tar.gz` 或 `.zip` 结尾。

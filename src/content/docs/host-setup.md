---
title: 宿主准备脚本
description: scripts/setup 下宿主环境准备脚本的用途、参数与用法。
group: dev
order: 8
source: scripts/setup/README.md
---

这些脚本在受支持的宿主上准备一个已存在的 NVX 检出目录：

- `setup-linux-mshv.sh` 配置 Linux/MSHV 的构建与设备前置条件。
- `setup-windows-whp.ps1` 配置 Windows/WHP 的构建前置条件。
- `setup-linux-runner.sh` 配置 Linux/KVM 或 Linux/MSHV 的 Actions 运行器。

有关 Azure VMSS 的引导，请参阅 [Azure 供应](https://github.com/microsoft/nvx/blob/dev/scripts/setup/azure/README.md)（英文原文）。本目录中的脚本在 Azure 之外的受支持宿主上同样可用。

它们不会创建机器，也不会初始化检出目录。运行器模式从标准输入读取一个短期的注册令牌，并且不在脚本中存储仓库凭据。使用开发宿主模式之前，请先初始化 OpenVMM 子模块。

每个脚本都从其所在目录中的 [`tool-versions.conf`](https://github.com/microsoft/nvx/blob/dev/scripts/setup/tool-versions.conf)（英文原文）读取它所安装工具的版本、发布产物和校验和，因此在检出目录之外运行脚本时，请把该清单与脚本一起暂存到同一位置；参见[工具版本](#工具版本)。

## GitHub Actions 运行器

在已完成认证的工作站上生成仓库运行器注册令牌，然后将其流式传输到目标主机，不要把它写入 shell 历史记录。在 Linux 上：

```bash
scp scripts/setup/setup-linux-runner.sh scripts/setup/tool-versions.conf HOST:/tmp/
gh api --method POST repos/microsoft/nvx/actions/runners/registration-token \
  --jq .token |
  ssh HOST '/tmp/setup-linux-runner.sh --backend kvm --runner-name azure-kvm-1 --runner-token-stdin'
```

对于 Windows/WHP，把 `setup-windows-whp.ps1` 和 `tool-versions.conf` 暂存到同一个目录中，并从 PowerShell 通过 SSH 运行该脚本：

```powershell
scp scripts/setup/setup-windows-whp.ps1 scripts/setup/tool-versions.conf HOST:C:/
$token = gh api --method POST `
  repos/microsoft/nvx/actions/runners/registration-token --jq .token
$token | ssh HOST powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File C:\setup-windows-whp.ps1 -RunnerOnly `
  -RunnerName nvx-windows-3 -RunnerTokenStdin
$token = $null
```

两个脚本都会根据清单中的校验和验证 Actions 运行器软件包。Linux 运行器标签为 `linux`、所选后端和 `virtual-machine`。Windows 标签为 `windows`、`whp` 和 `virtual-machine`。运行器名称仍是唯一标识，但不会被注册为标签。在 Linux 上使用 `--extra-runner-labels LABELS`，或在 Windows 上使用 `-ExtraRunnerLabels LABELS`，可以在不移除这些必需标签的前提下添加以逗号分隔的池标签。标签可以包含字母、数字、下划线、句点和连字符，并且不得与另一个标签重复（不区分大小写）。更改已配置运行器的标签需要新的注册令牌；检查模式要求同样的附加标签。

Linux 上的 `--benchmark-runner` 和 Windows 上的 `-BenchmarkRunner` 还会注册 `benchmark` 标签，CI 的平台作业需要该标签。每个后端的池中恰好有一个运行器携带它，这样每次运行都在同一台 VM 上测量该后端的性能序列；把它移动到另一个运行器会改变该序列；参见 [CI 采集](/docs/benchmarks/)。请使用该开关来供应基准测试运行器，并在检查该运行器时同样传入：仅通过 API 添加的标签会在供应过程替换注册时丢失。每个序列还会在 `data/<platform>-host.json` 中记录其基准测试运行器的宿主；如果运行器的 CPU、处理器数、内存、VM 规格、操作系统版本或基准测试磁盘和卷与该记录不同，其平台作业会在开始测量之前失败。在可能改变这些因素的维护之后（例如重新部署、调整规格、重装映像或更新操作系统），请检查该运行器的下一个平台作业。如果它的宿主检查失败，请按[预期基准宿主](/docs/benchmarks/)中的描述，在同一个 PR 中接受新宿主并重置该序列的历史；把标签移动到另一个运行器也需要同一个 PR，除非该运行器的宿主与之一致。

在 Linux 上，省略 `--runner-name` 可以在不协调现有运行器的服务或缓存目录的情况下准备宿主依赖。在后续调用中传入它的名称即可更新该服务；`--check-only` 仍会校验运行器状态。

在 Windows 上，首次 `-RunnerOnly` 运行可能在注册之前为 sccache 创建 `_work`；随后带名称的运行会接受该目录，但会拒绝无关的部分运行器安装。

Rustup 引导二进制文件在执行前会进行版本固定并进行 SHA-256 验证；Linux 的供应流程还会安装 `zstd`，用于原生的 Actions 缓存归档。

两个运行器设置脚本都会安装固定版本并经过 SHA-256 验证的 `sccache` 二进制文件。运行器服务使用持久的 `_work/_sccache` 目录，限制为 10 GiB，禁用 Cargo 增量编译，并通过 `RUSTC_WRAPPER` 暴露 `sccache`。CI 使用干净的 Cargo 目标目录并报告每个作业的缓存统计信息，而不是恢复已编译的 `target/` 目录树。

迁移现有运行器或更改其名称、后端、标签时，请再次提供新的注册令牌；供应过程会替换注册信息，并把预期的标签集记录在一个受保护的本地标记文件中。

运行器服务会获得显式的工具 PATH。在 Windows 上，Rust 工具链对服务账户是只读的，而 Cargo registry 和 Git 缓存使用运行器的按作业临时目录。

Windows 运行器的供应流程还会启用完整的 Hyper-V 功能，以便 OpenVMM VMM 测试所需的、已授权的内置 PCAT 和 SVGA 固件可在 `System32` 下使用。

在两个平台上，运行器和工具链可执行文件归管理员所有，且对作业只读；运行器自动更新被禁用，可写的运行器状态被限制在 `_work` 中。

Windows 运行器的供应流程还会在最大的非系统 NTFS 卷上（或在 `-BenchmarkScratchDirectory` 指定的位置）创建 `nvx-benchmark-scratch` 目录，并将其发布为计算机级别的 `NVX_BENCHMARK_SCRATCH` 变量。与 `_work/_sccache` 一样，Network Service 会获得该目录树的修改（Modify）权限。CI 会把基准测试快照和客户机内存后备文件放在那里，这样它们的刷写就不会占用受限突发的系统磁盘。当存在数据卷时，检查模式要求该目录存在。更换基准测试暂存或运行器工作区背后的存储属于性能平台变更：应对所有 Windows 运行器同时应用，并按[预期基准宿主](/docs/benchmarks/)中的描述接受基准测试运行器的新宿主并重置其序列的历史。

持久化运行器没有 Docker 访问权限。客户机产物改为在 GitHub 托管的运行器上使用 Docker 构建。

Linux 的供应流程通过 SSH 管理员账户运行，但监听程序和 workflow 作业以专用的 `nvx-runner` 账户运行，该账户既没有 sudo 权限，也没有 Docker 访问权限。

当宿主 CPU 未暴露不变 TSC（`/proc/cpuinfo` 中的 `nonstop_tsc`）时，Linux 的供应流程和检查模式会发出警告，但不会停止。该标志仅作为证据。在时间 ABI 之前，此类宿主上的客户机在 CPU 激活期间会遇到跨 vCPU 的 TSC warp（#265）；在时间 ABI 之下，客户机 warp 探针（H6）会检查它们的偏差是否在 ABI 的 1 µs 界限之内，因此请先用 `python3 scripts/nvx.py doctor --backend <backend>` 对此类 VM 进行资格验证，然后再注册它。CI 的微虚拟机作业和平台作业会在每个运行器上运行该探针。

持久化运行器只执行推送和同一仓库的 PR。来自 fork 的 PR 仍在 GitHub 托管的作业上运行，直到维护者在受信任的仓库分支上暂存该更改。

在不更改宿主的情况下校验已安装的运行器：

```bash
sh scripts/setup/setup-linux-runner.sh \
  --backend kvm --runner-name azure-kvm-1 --check-only
```

```powershell
.\scripts\setup\setup-windows-whp.ps1 `
  -RunnerOnly -RunnerName nvx-windows-3 -CheckOnly
```

### Rust 工具链

运行器脚本会安装清单中 `rust.toolchain` 所固定的 Rust 发布版（它等于仓库中 [`rust-toolchain.toml`](https://github.com/microsoft/nvx/blob/dev/rust-toolchain.toml)（英文原文）里的发布版）及其 OpenVMM 目标，并安装到只读的受信任工具链中；检查模式要求恰好是该发布版。`validate-runner` 动作会让缺少该发布版的运行器上的作业失败，因此在固定版本的变更合并之前，请先更新所有运行器。不带运行器名称的运行会把新的发布版安装到现有发布版旁边，并保持运行器服务和默认工具链不变；作业通过 `rust-toolchain.toml` 选择该发布版。请暂存更新后的脚本和清单，然后运行该次执行并校验运行器：

```bash
scp scripts/setup/setup-linux-runner.sh scripts/setup/tool-versions.conf HOST:/tmp/
ssh HOST 'sh /tmp/setup-linux-runner.sh --backend kvm'
ssh HOST 'sh /tmp/setup-linux-runner.sh --backend kvm --runner-name azure-kvm-1 --check-only'
```

```powershell
scp scripts/setup/setup-windows-whp.ps1 scripts/setup/tool-versions.conf HOST:C:/
ssh HOST powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File C:\setup-windows-whp.ps1 -RunnerOnly
ssh HOST powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File C:\setup-windows-whp.ps1 -RunnerOnly -RunnerName nvx-windows-3 -CheckOnly
```

## Linux / MSHV

Linux 脚本支持带有 `apt-get`、`dnf` 或 `tdnf` 的发行版。它会安装原生构建依赖，以及清单所固定的 Rust 和 cargo-nextest 发布版。它会安装带 Buildx 的 Docker，并配置基于组的 Docker 和 `/dev/mshv` 访问权限。

在检出目录中运行完整的引导流程：

```bash
sh scripts/setup/setup-linux-mshv.sh
```

更改组成员身份会以状态 20 退出。请重新连接并再次运行脚本，使新的成员身份生效。

在不更改宿主、也不需要构建产物的情况下校验依赖：

```bash
sh scripts/setup/setup-linux-mshv.sh --check-only --skip-build
```

省略 `--skip-build` 还会校验已构建的产物和生成的 MSHV 命令。当脚本位于检出目录之外时，使用 `--workspace PATH`。

要为 Windows 构建生成绑定修订版的客户机产物包：

```bash
sh scripts/setup/setup-linux-mshv.sh \
    --guest-bundle /path/to/nvx-guest-artifacts
```

目标位置必须不存在或为空。该产物包包含内核、initramfs、软件包清单、检出修订版和 SHA-256 校验和。将 `--bundle-only` 与 `--guest-bundle` 一起使用，可以在既不供应也不重建宿主的情况下，打包由另一次 `build-guest` 调用产生的产物。

## Windows / WHP

在提升权限的 Windows PowerShell 会话中运行完整的引导流程。它使用 WinGet 安装缺失的工具，安装清单所固定的 Rust 和 cargo-nextest 发布版，启用 Windows Hypervisor Platform，并构建 OpenVMM。仅运行器的供应流程还会启用 Hyper-V，以获得其内置的 PCAT 和 SVGA 固件。该脚本绝不会自动重启。

传入在 Linux 上生成的客户机产物包，以完成构建校验：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\setup\setup-windows-whp.ps1 `
  -GuestArtifactsDirectory .\nvx-guest-artifacts
```

该脚本会校验每一个校验和，并要求产物包的修订版与检出目录一致。需要重启时会以状态 3010 退出。在宿主工具和 OpenVMM 构建就绪后，若缺少客户机产物则以状态 21 退出。

在不更改宿主、也不需要构建产物的情况下校验依赖：

```powershell
.\scripts\setup\setup-windows-whp.ps1 -CheckOnly -SkipBuild
```

省略 `-SkipBuild` 还会校验客户机产物、OpenVMM 二进制文件和生成的 WHP 命令。当脚本位于检出目录之外时，使用 `-Workspace PATH`。

## 工具版本

[`tool-versions.conf`](https://github.com/microsoft/nvx/blob/dev/scripts/setup/tool-versions.conf)（英文原文）固定了设置脚本和 [Specula 运行器设置](https://github.com/microsoft/nvx/blob/dev/.github/specula/README.md)（英文原文）所安装的 Rust 工具链、rustup、cargo-nextest、sccache 和 Actions 运行器的发布版，以及它们下载的每个发布产物的 SHA-256 校验和；其中没有任何一项重复固定。每一行要么是 `#` 注释，要么是不含空格的 `KEY=VALUE`：

| 键 | 值 |
| --- | --- |
| `TOOL.version` | 确切的 `MAJOR.MINOR.PATCH` 发布版 |
| `rust.toolchain` | Rust 发布版，与 `rust-toolchain.toml` 中的通道一致 |
| `TOOL.artifacts.PLATFORM.name` | 发布版中的产物路径，其中 `{version}` 代表 `TOOL.version` |
| `TOOL.artifacts.PLATFORM.sha256` | 该产物的小写 SHA-256 校验和 |

`PLATFORM` 为 `linux-x86_64` 或 `windows-x86_64`。脚本只借助 shell 或 PowerShell，在解析完自身选项之后、检查或更改宿主之前，把该清单当作数据读取。当清单缺失或格式错误、缺少它们所需的固定项，或指明了另一个平台时，脚本会以错误退出；错误信息会指明该清单，对于格式错误的条目还会指明其所在行。只有在下载的产物与校验和匹配之后，脚本才会运行或安装它。

要升级某个工具，请在清单中修改它的版本以及它每个产物的校验和。脚本从 `https://static.rust-lang.org/rustup/archive/VERSION/NAME` 下载 rustup，从 `https://github.com/mozilla/sccache/releases/download/vVERSION/NAME` 下载 sccache，从 `https://github.com/actions/runner/releases/download/vVERSION/NAME` 下载 Actions 运行器。升级 Rust 还要同时修改 `rust-toolchain.toml`；参见 [Rust 工具链](/docs/ci/)。`scripts/test_tool_versions.py` 会在 Linux 和 Windows 上检查：清单是否为两个平台固定了每个工具，shell 与 PowerShell 读取器对清单的解读是否一致，以及是否有脚本、workflow 或设置指南硬编码了固定项。然后重新运行这些脚本，以更新现有宿主和运行器。

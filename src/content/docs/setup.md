---
title: 环境准备
description: 在 Linux/KVM、Linux/MSHV 或 Windows/WHP 上准备 NVX 的构建与运行环境。
group: use
order: 1
source: doc/setup.md
---

## 初始化

克隆时包含子模块，或在克隆后初始化：

```bash
git clone --recurse-submodules <umbrella-repository-url> nvx
cd nvx
python3 scripts/nvx.py verify
```

在 Windows PowerShell 上，如果安装的启动器是 `python`，请用它代替 `python3`：

```powershell
git clone --recurse-submodules <umbrella-repository-url> nvx
Set-Location nvx
python scripts\nvx.py verify
```

如果检出目录已存在：

```bash
python3 scripts/nvx.py init
```

## 前置条件

每个平台都需要 Python 3.10 或更高版本以及 Git。构建 OpenVMM 或 Rust crate 还需要 [rustup](https://rustup.rs/)，它会在首次使用时安装 [`rust-toolchain.toml`](https://github.com/microsoft/nvx/blob/dev/rust-toolchain.toml)（英文原文）所固定的 Rust 发布版。`nvx.py run` 和 `nvx.py sandbox` 会运行 `nvx-rs`，[`download`](/docs/usage/) 会从基于检出目录中 `nvx-rs` 源码构建的发布版安装它。否则，除非 `NVX_RS` 指定了某个可执行文件，`nvx.py` 会在某条命令首次需要它时用该发布版构建它；参见[命令行参考](/docs/usage/)。

默认情况下，微虚拟机在支持其配置档的虚拟机监控程序上，使用其宿主 CPU 的内置 [CPU 配置档](/docs/usage/)启动：包括四个 Intel 代次以及 AMD 的 EPYC Milan、Genoa 和 Turin。在其他 Intel 或 AMD CPU 上，默认的 `--cpu-profile auto` 会回退到从宿主派生的开发配置档，并在每次冷启动时发出警告，要求提供该 CPU 的指纹，以便内置配置档能够为其服务；`nvx.py run --cpu-profile host` 会显式选择该配置档，例如在虚拟机监控程序不支持内置配置档的情况下（`E_PROFILE_UNSUPPORTED`，其消息中会指明该选项）。OpenVMM 验证宿主配置档的方式与验证内置配置档相同：如果虚拟机监控程序缺少时间 ABI 所要求的某个 CPU 特性，冷启动仍会以 `E_PROFILE_UNSUPPORTED` 失败。其他厂商的 CPU 没有 CPU 配置档。

对于 Debian/Ubuntu 宿主：

```bash
sudo apt-get update
sudo apt-get install -y \
  bc binutils bison build-essential ca-certificates cpio curl erofs-utils flex \
  gzip libelf-dev libssl-dev python3 rsync tar xz-utils zstd
```

原生客户机构建使用 `rust-toolchain.toml` 中的确切 Rust 发布版及其 musl 标准库目标：

```bash
toolchain=$(sed -n 's/^channel = "\([^"]*\)".*/\1/p' rust-toolchain.toml)
rustup toolchain install "$toolchain" --profile minimal
rustup target add --toolchain "$toolchain" x86_64-unknown-linux-musl
```

Linux runner 的环境准备脚本和 Copilot 环境准备会自动安装此目标。内核构建以及作为 Rust 的链接器驱动仍需要 `build-essential`；不需要单独的客户机 libc 编译器。

### Linux / KVM

在宿主固件中启用 Intel VT-x 或 AMD-V。Linux 通常会自动加载匹配的 KVM 内核模块；启动后应存在 `/dev/kvm`。将当前用户加入 `kvm` 组：

```bash
sudo usermod -aG kvm "$USER"
```

更改组后请注销并重新登录，然后用 `test -r /dev/kvm && test -w /dev/kvm` 检查访问权限。

### Linux / MSHV

MSHV 要求 Linux 以 Microsoft Hypervisor 根分区方式运行，并使用启用了 MSHV 的内核。内核必须暴露 `/dev/mshv`；如果其 MSHV 根驱动是模块，请用以下命令加载：

```bash
sudo modprobe mshv_root
```

授予当前会话读写访问权限并验证设备：

```bash
sudo chmod a+rw /dev/mshv
test -r /dev/mshv && test -w /dev/mshv
```

基于 RPM 的 MSHV 宿主还需要原生工具链，用于构建 [`scripts/setup/tool-versions.conf`](https://github.com/microsoft/nvx/blob/dev/scripts/setup/tool-versions.conf)（英文原文）所固定的 cargo-nextest 发布版：

```bash
sudo tdnf install -y \
  gcc glibc-devel kernel-headers binutils make \
  pkgconf pkgconf-pkg-config openssl-devel libarchive
cargo install --locked cargo-nextest --version \
  "$(sed -n 's/^cargo_nextest\.version=//p' scripts/setup/tool-versions.conf)"
```

### Windows / WHP

在宿主固件中启用硬件虚拟化。然后在提升权限的 PowerShell 会话中启用 **Windows Hypervisor Platform** 并重启：

```powershell
Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -All
```

在本地构建 NVX 还需要 rustup、Visual Studio 2022 C++ 生成工具、Windows SDK，以及使用 Linux 容器的 Docker Desktop。

## 自动化环境引导

[`scripts/setup`](/docs/host-setup/)中的脚本会准备 Linux/KVM、Linux/MSHV 和 Windows/WHP 开发宿主或 GitHub Actions 宿主。它们安装平台构建前置条件、配置虚拟机监控程序访问权限，并提供不修改系统的验证模式。Runner 注册令牌从标准输入读取，因此不会出现在命令历史中。

Linux 还可以为 Windows 生成绑定特定修订版并带校验和的客户机产物包。Windows 脚本会先验证该产物包，再将其复制到检出目录并原生构建 OpenVMM。

## 远程代理宿主

NVX 智能体技能可以在预配置的 SSH 宿主上运行和诊断 NVX。远程开发需要主动启用：将纳入版本跟踪的宿主清单模板复制到仓库根目录下被忽略的 `.nvx-hosts.json` 文件中。

在 Linux 上：

```bash
cp scripts/nvx-hosts.example.json .nvx-hosts.json
```

在 Windows PowerShell 上：

```powershell
Copy-Item scripts\nvx-hosts.example.json .nvx-hosts.json
```

该清单的 schema 刻意不设版本。其顶层对象只包含 `hosts`；不要添加 `version` 字段。

编辑 `.nvx-hosts.json` 中的每个配置档：

- 配置档名称就是传给 `nvx-host-connect` 技能的名称。
- `ssh_target` 是开发者 SSH 配置中配置的一个目标或别名。
- `backend` 必须是 `kvm`、`mshv` 或 `whp` 之一。
- `host_type` 为必填项，用于标识服务器本身，且必须是 `baremetal` 或 `virtual-machine` 之一。
- `remote_repo` 是该宿主上 NVX 检出目录的绝对路径。可以省略，此时代理会在连接时询问。
- `notes` 是可选的开发者本地上下文信息。

将身份验证信息保留在 SSH agent 和 SSH 配置中。不要在 `.nvx-hosts.json` 中放置密码、令牌、私钥、口令短语或 SSH 选项。该文件被 Git 忽略。

在 Linux 上使用以下命令列出并验证已配置的配置档：

```bash
python3 .github/skills/nvx-host-connect/scripts/hosts.py
```

在 Windows PowerShell 上使用：

```powershell
python .github\skills\nvx-host-connect\scripts\hosts.py
```

如果清单不存在或不包含任何宿主，解析器会禁用远程访问，并报告仅启用了本地 NVX 开发。

## 开发

安装固定版本的 Python 开发工具：

```bash
python3 -m pip install --requirement requirements-dev.txt
```

使用平台包管理器安装 ShellCheck 0.11.0 和 shfmt 3.12.0，以匹配 CI 中强制使用的版本。

提交更改前运行所有 lint 和格式检查：

```bash
python3 -m ruff check scripts .github/specula
shellcheck --shell=sh \
  guest/common/init guest/alpine/nvx-container-enter \
  guest/alpine/nvx-container-launch \
  guest/common/nvx-hostmount guest/common/nvx-identity-probe \
  guest/common/nvx-init-agent \
  guest/common/nvx-container-enter-azurelinux \
  guest/common/nvx-container-launch-azurelinux \
  guest/common/nvx-sandbox-smoke \
  guest/common/nvx-snapshot guest/common/nvx-virtio-restore-probe \
  scripts/setup/setup-linux-mshv.sh scripts/setup/setup-linux-runner.sh
shellcheck --shell=bash \
  .github/specula/setup-runner.sh guest/ubuntu/nvx-bashrc
python3 -m pyright --pythonplatform Linux
python3 -m pyright --pythonplatform Windows
python3 -m ruff format --check scripts .github/specula
shfmt -d -ln posix -i 4 -ci \
  guest/common/init guest/alpine/nvx-container-enter \
  guest/alpine/nvx-container-launch \
  guest/common/nvx-hostmount guest/common/nvx-identity-probe \
  guest/common/nvx-init-agent \
  guest/common/nvx-container-enter-azurelinux \
  guest/common/nvx-container-launch-azurelinux \
  guest/common/nvx-sandbox-smoke \
  guest/common/nvx-snapshot guest/common/nvx-virtio-restore-probe \
  scripts/setup/setup-linux-mshv.sh scripts/setup/setup-linux-runner.sh
shfmt -d -ln bash -i 4 -ci \
  .github/specula/setup-runner.sh guest/ubuntu/nvx-bashrc
python3 scripts/check_markdown_links.py
```

Pyright 针对 Linux 和 Windows 平台 API 均以严格模式运行。链接检查会读取 Git 跟踪的文件，因此在运行前请先暂存新文件。

### 对抗性活动控制器

可选的 `test-adversarial` 命令还要求在运行前安装并完成 GitHub Copilot CLI 的身份验证。在不更改身份验证状态的情况下验证控制器：

```bash
copilot --version
```

该测试框架会自行执行一次非交互式的已认证冒烟提示，如果无法完成，预检就会失败。它有意不安装 Copilot CLI，也不运行 `copilot login`。仓库的 `.github/workflows/copilot-setup-steps.yml` 会准备 Copilot 云智能体会话，但不会安装或验证 Copilot CLI，因此不满足此前提条件。

生产活动还需要一个由管理员拥有的无参数执行器包装脚本，用于配置一个单独的一次性目标并转发有界执行器协议。关于隔离与凭据要求，以及目标所需的 Rust 工具链和 nvx-rs，请参见 [Copilot 驱动的对抗性测试](/docs/adversarial-testing/)。

使用以下命令应用已配置的 Python 和 POSIX shell 格式化工具：

```bash
python3 -m ruff format scripts .github/specula
shfmt -w -ln posix -i 4 -ci \
  guest/common/init guest/alpine/nvx-container-enter \
  guest/alpine/nvx-container-launch \
  guest/common/nvx-hostmount guest/common/nvx-identity-probe \
  guest/common/nvx-init-agent \
  guest/common/nvx-container-enter-azurelinux \
  guest/common/nvx-container-launch-azurelinux \
  guest/common/nvx-sandbox-smoke \
  guest/common/nvx-snapshot guest/common/nvx-virtio-restore-probe \
  scripts/setup/setup-linux-mshv.sh scripts/setup/setup-linux-runner.sh
shfmt -w -ln bash -i 4 -ci \
  .github/specula/setup-runner.sh guest/ubuntu/nvx-bashrc
```

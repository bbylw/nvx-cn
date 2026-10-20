# NVX：超轻量级微虚拟机沙箱

NVX 是一个超轻量级微虚拟机沙箱，用硬件强制隔离来运行不受信任的工作负载。它构建在 OpenVMM 之上，客户机运行 Linux。

NVX 由[微软研究院系统研究组][msr-systems]与 [Azure 系统研究院][azure-systems] 联合开发，建立在 [Nanvix](https://github.com/nanvix) 系统的研究成果之上。

[msr-systems]: https://www.microsoft.com/en-us/research/group/systems-research-group-redmond/
[azure-systems]: https://www.microsoft.com/en-us/research/group/azure-research-systems/

NVX 仓库包含 Linux、OpenVMM 与 Rust 客户机工具链的版本锁定，以及使用 NVX 所需的补丁、客户机源文件、构建工具与基准测试。Alpine、Ubuntu 与 Azure Linux 都在各自统一的 `/sbin/nvx-*` 路径上提供来自 [`nvx-rs`](https://nvx.ndjp.net/docs/nvx-rs/) 的九个静态客户机二进制。

## 快速开始

需要 Python 3.10 或更新版本。下面的命令会在当前检出版本存在对应发布包时，下载该平台预构建的 NVX 包；否则回退到最近的、已发布的第一父提交祖先。因此不需要构建客户机、OpenVMM，或 `nvx.py run` 所运行的 [`nvx-rs`](https://nvx.ndjp.net/docs/nvx-rs/)。如果发布包中的 `nvx-rs` 与检出目录里的来源不同，`nvx.py` 会用 Cargo 构建它，[rustup](https://rustup.rs/) 会安装所需的工具链。启动成功会打印 `NVX-GUEST-BOOT-OK: alpine` 并打开一个 root shell。加上 `--guest ubuntu` 或 `--guest azurelinux`，可以用同一个 NVX 内核启动 Ubuntu 或 Azure Linux 用户态。

在客户机内用 `/sbin/nvx-exit 0` 干净退出。详细的前置条件与运行选项见[环境准备](https://nvx.ndjp.net/docs/setup/)与[运行](https://nvx.ndjp.net/docs/run/)指南。

> ℹ️ 若要在不经过 `scripts/nvx.py` 运行时包装器的情况下直接集成 OpenVMM，见[直接运行 OpenVMM](https://nvx.ndjp.net/docs/run/#直接运行-openvmm)。

### Linux / KVM

需要[配置好 KVM，并对 `/dev/kvm` 有读写权限](https://nvx.ndjp.net/docs/setup/#linux--kvm)。

```bash
git clone https://github.com/microsoft/nvx.git && cd nvx
python3 scripts/nvx.py download
python3 scripts/nvx.py run
```

### Linux / MSHV

需要[配置好 MSHV，并对 `/dev/mshv` 有读写权限](https://nvx.ndjp.net/docs/setup/#linux--mshv)。

```bash
git clone https://github.com/microsoft/nvx.git && cd nvx
python3 scripts/nvx.py download --hypervisor mshv
python3 scripts/nvx.py run --hypervisor mshv
```

### Windows / WHP

需要[启用 Windows Hypervisor Platform](https://nvx.ndjp.net/docs/setup/#windows--whp)。

```powershell
git clone https://github.com/microsoft/nvx.git; Set-Location nvx
python scripts\nvx.py download
python scripts\nvx.py run
```

## 文档

### 使用

- [环境准备](https://nvx.ndjp.net/docs/setup/) — 配置宿主环境的说明。
- [构建](https://nvx.ndjp.net/docs/build/) — 从源码构建 NVX 的说明。
- [运行](https://nvx.ndjp.net/docs/run/) — 运行 NVX 的说明。
- [基准测试](https://nvx.ndjp.net/docs/benchmarks/) — 对 NVX 做基准测试的说明。
- [命令行参考](https://nvx.ndjp.net/docs/usage/) — `scripts/nvx.py` 全部命令与选项的完整参考。
- [Rust API](https://nvx.ndjp.net/docs/rust-api/) — 用 Rust 驱动沙箱生命周期的 `aci_edge_sandboxes` crate。
- [NVX Rust crate](https://nvx.ndjp.net/docs/nvx-rs/) — 承载 NVX 机制的 `nvx-rs` crate：OpenVMM 控制协议，以及 NVX 微虚拟机的启动、策略下沉与监管。

### 开发

- [架构设计](https://nvx.ndjp.net/docs/design/) — NVX 微虚拟机及其单工作负载客户机运行时的架构。
- [Ubuntu 客户机支持](https://nvx.ndjp.net/docs/guests/ubuntu/) — NVX 如何在自有内核上运行 Ubuntu 用户态。
- [Azure Linux 客户机支持](https://nvx.ndjp.net/docs/guests/azurelinux/) — NVX 如何在自有内核上运行 Azure Linux 用户态。
- [项目结构](https://nvx.ndjp.net/docs/project-structure/) — NVX 仓库布局总览。
- [持续集成](https://nvx.ndjp.net/docs/ci/) — 运行与维护 NVX CI 的说明。
- [对抗性测试](https://nvx.ndjp.net/docs/adversarial-testing/) — 有边界的自适应压力与收敛测试活动。
- [打包与源码交付](https://nvx.ndjp.net/docs/distribution/) — 打包与分发 NVX 的说明。
- [贡献指南](https://nvx.ndjp.net/docs/contribute/) — 向 NVX 贡献代码的约定。
- [OpenVMM 上游路线图](https://nvx.ndjp.net/docs/openvmm-roadmap/) — 把 OpenVMM 分支中的微虚拟机提交上游化的计划。
- [宿主准备脚本](https://nvx.ndjp.net/docs/host-setup/) — `scripts/setup` 下宿主环境准备脚本的用法。
- [安全策略](https://nvx.ndjp.net/docs/security/) — 漏洞报告方式与安全响应流程。

## License

- NVX 由 Microsoft Corporation 以 MIT License 发布，版权归其所有。
- 本文为非官方中文翻译，内容以 [`microsoft/nvx`](https://github.com/microsoft/nvx) 仓库原文为准。

---
title: 项目结构
description: NVX 仓库的目录布局、源码目录与各组件的职责。
group: dev
order: 2
source: doc/project-structure.md
---

本文档介绍 NVX 仓库的布局。标记为生成的路径是构建产物或缓存，不属于受跟踪的源码树。`openvmm/` 目录是维护在独立仓库中的 Git 子模块。

## 仓库布局

| 路径 | 用途 |
| --- | --- |
| `.github/workflows` | CI、发布版验证、对抗性活动和 Copilot 环境工作流 |
| `.github/actions` | 可复用的本地 CI 动作 |
| `.github/skills` | 用于常见开发工作流的 Copilot 代理技能 |
| `.github/agents` | 有边界的 Copilot 策略师定义 |
| `.github/specula` | 增量形式化验证适配器与运行器设置 |
| `doc` | 用户与贡献者文档 |
| `docker` | 可复现的客户机构建环境 |
| `kernel` | 可复现的配置与完整 Linux 补丁系列 |
| `guest` | 通用和发行版专属的客户机脚本 |
| `ubuntu` | 固定的 Ubuntu 补充二进制软件包锁 |
| `azurelinux` | 校验和固定的 Azure Linux 补充 RPM 锁 |
| `aci_edge_sandboxes` | Rust crate `aci_edge_sandboxes`：带 OpenVMM 后端与可选原生代理后端的状态感知沙箱 API |
| `nvx-rs` | Rust crate `nvx-rs`、库 `nvx`：OpenVMM 后端所构建的 NVX 机制 |
| `openvmm` | 来自 `microsoft/openvmm` 的公共 OpenVMM Git 子模块，跟踪其 `feature/microvm/dev` 分支 |
| `data` | 受跟踪的性能历史与生成的基准测试数据 |
| `scripts/nvx_tools` | `nvx.py` 命令的实现 |
| `scripts/nvx.py` | 规范的构建、运行、测试、基准测试与打包 CLI |
| `scripts/setup` | 开发宿主和 GitHub Actions runner 引导脚本，以及它们安装的工具版本清单 |
| `scripts/nvx_adversarial_executor.py` | 免凭据的对抗性执行器协议入口点 |
| `.cache/linux` | 生成的已验证/已打补丁 Linux 源码树；被 Git 忽略 |
| `build/sources` | 生成的 Linux、Alpine 和 Ubuntu 发布版源码；被 Git 忽略 |

## 目录树

```text
nvx/
|-- .github/                     GitHub 自动化与 Copilot 定制
|   |-- ISSUE_TEMPLATE/          CPU 配置文件请求 issue 表单
|   |-- actions/                 可复用的本地 CI 动作
|   |-- agents/                  有边界的 Copilot 策略师定义
|   |-- skills/                  Copilot 开发工作流技能
|   |-- specula/                 增量形式化验证集成
|   |-- workflows/               GitHub Actions 工作流
|   |   |-- adversarial.yml      受信任的定时/手动对抗性活动
|   |   |-- build-openvmm-binary.yml 可复用的 OpenVMM 二进制构建
|   |   |-- ci.yml               主构建、测试、基准测试与发布工作流
|   |   |-- copilot-code-review.yml Copilot 代码审查环境
|   |   |-- copilot-setup-steps.yml Copilot 云代理环境
|   |   |-- run-nvx-microvm-tests.yml 可复用的 NVX 微虚拟机测试作业
|   |   |-- run-platform.yml     可复用的平台基准测试与打包作业
|   |   `-- specula-release.yml  对已发布发布版的 Specula 验证
|   |-- actionlint.yaml          供 actionlint 使用的自托管 runner 标签
|   `-- copilot-instructions.md  全仓库范围的 Copilot 指令
|-- .vscode/settings.json        共享的 VS Code 设置
|-- guest/                       客户机自有的脚本
|   |-- common/                  共享的 init、代理、快照与探测脚本
|   |-- alpine/                  Alpine 控制容器入口脚本
|   `-- ubuntu/                  Ubuntu 交互式 shell 启动策略
|-- ubuntu/
|   `-- packages.lock.json       精确的 Ubuntu 补充二进制软件包闭包
|-- azurelinux/
|   `-- packages.lock.json       校验和固定的 Azure Linux 补充 RPM 闭包
|-- data/                        基准测试数据
|   |-- linux-kvm-virtual-machine*.csv Linux/KVM CI 滚动历史
|   |-- linux-mshv-virtual-machine*.csv Linux/MSHV CI 滚动历史
|   `-- windows-whp-virtual-machine*.csv Windows/WHP CI 滚动历史
|-- build/                       生成的构建产物（被忽略）
|-- dist/                        生成的发布版软件包（被忽略）
|-- docker/
|   `-- Dockerfile               可复现的客户机构建环境
|-- doc/                         用户与贡献者文档
|   |-- adversarial-testing.md   Copilot 驱动的对抗性测试
|   |-- benchmarks.md            基准测试命令与测量方法
|   |-- build.md                 客户机与 OpenVMM 构建工作流
|   |-- ci.md                    持续集成概览
|   |-- contribute.md            贡献指南
|   |-- design/                  微虚拟机及其客户机运行时的架构
|   |-- distribution.md          打包与源码交付
|   |-- guests/                  客户机用户态章节（Ubuntu 与 Azure Linux）
|   |-- openvmm-upstream-roadmap.md 将 OpenVMM 分支的微虚拟机提交上游化的计划
|   |-- project-structure.md     本指南
|   |-- run.md                   客户机启动与宿主映射
|   |-- setup.md                 初始化与开发前置条件
|   `-- usage.md                 完整的 nvx.py 命令与选项参考
|-- kernel/                      Linux 配置与 NVX 补丁集
|   |-- patches/                 按顺序应用到 Linux 的补丁
|   |-- COPYING-LINUX            Linux 版权与许可声明
|   |-- config-microvm           微虚拟机内核配置
|   `-- config-microvm-debug     CI 调试内核片段（启用看门狗）
|-- aci_edge_sandboxes/          用于状态感知沙箱 API 的 Rust crate `aci_edge_sandboxes`
|   |-- model/                   可序列化的契约与 wire-model crate
|   |-- src/                     门面与后端
|   |   |-- openvmm/             默认后端：把请求转换为 nvx 调用
|   |   |-- agent/               可选后端，基于另行提供的原生代理库
|   |   `-- bin/                 包装 nvx 伪 OpenVMM 的 aci-edge-sandboxes-fake-openvmm
|   |-- examples/                面向 OpenVMM 与代理后端的可运行生命周期示例
|   |-- tests/                   Mock、伪 OpenVMM、校验、真实 hypervisor 与代理库测试
|   `-- build.rs                 把 nvx-rs 暂存的捆绑包传递给依赖方
|-- nvx-rs/                      用于 NVX 机制的 Rust crate `nvx-rs`、库 `nvx`
|   |-- src/
|   |   |-- protocol/            宿主与客户机共享的控制台编解码器
|   |   |-- contract.rs          控制契约版本与发布版兼容性
|   |   |-- net/                 CIDR 解析与相减，以及主机名和客户机网络形式
|   |   |-- host/                产物、启动、网络与出站策略下沉、会话、VM 实例、沙箱启动配置，以及 `nvx-rs` CLI（feature `cli`）
|   |   |-- testing/             伪 OpenVMM（feature `testing`）
|   |   |-- guest/               在 Linux 客户机中运行的程序（feature `guest`）
|   |   `-- bin/                 nvx-rs CLI、nvx-fake-openvmm 测试替身和客户机二进制
|   |-- tests/                   伪 OpenVMM 实例生命周期、CLI、客户机二进制和 hypervisor 托管生命周期测试，以及 Python 记录的黄金测试夹具
|   |-- build.rs                 暂存捆绑产物（feature `bundled`）
|   `-- artifacts.json           为捆绑产物固定的发布版软件包
|-- openvmm/                     OpenVMM Git 子模块
|-- scripts/                     构建、运行、基准测试与发布工具
|   |-- nvx_tools/               NVX CLI 背后的 Python 实现
|   |   |-- aci_edge_sandboxes_tests.py 真实 hypervisor 的 aci_edge_sandboxes 生命周期测试夹具
|   |   |-- adversarial.py       Copilot 控制器与活动协调器
|   |   |-- adversarial_broker.py 带类型的动作目录与重放日志
|   |   |-- adversarial_cases/   确定性的活动目录
|   |   |-- adversarial_executor.py 免凭据的目标执行器
|   |   |-- adversarial_oracles.py 独立金丝雀与看门狗
|   |   |-- archive.py           可复现的源码与发布归档
|   |   |-- azurelinux.py        Azure Linux 软件包锁与构建输入标识
|   |   |-- benchmark.py         OpenVMM 基准测试协调器
|   |   |-- benchmark_scripts/   Shell 程序与基准测试模板
|   |   |-- build.py             产物构建工作流
|   |   |-- build_config.py      每次调用的构建配置
|   |   |-- build_constants.py   分组的构建固定值、路径与固定默认值
|   |   |-- ci.py                CI 变更分类、必需作业与 OpenVMM 测试
|   |   |-- collect_alpine_sources.py Alpine 源码收集
|   |   |-- collect_ubuntu_sources.py Ubuntu 源码收集
|   |   |-- common.py            共享的进程与配置辅助函数
|   |   |-- create_linux_source_archive.py Linux 源码打包
|   |   |-- development_release.py 可恢复的开发发布版发布
|   |   |-- doctor.py            时间 ABI 宿主资格验证
|   |   |-- elf.py               ELF 二进制的静态可执行文件检查
|   |   |-- guests.py            带类型的客户机描述符
|   |   |-- host_telemetry.py    基准测试宿主的来源信息，以及 Windows 捕获存储遥测
|   |   |-- host_time_probe.rs   doctor 构建并运行的宿主 TSC 探测程序
|   |   |-- managed_exec_tests.py 托管工作负载环境、目录与超时测试
|   |   |-- microvm_test_scripts/ 微虚拟机测试所用的客户机工作负载
|   |   |-- microvm_tests.py     NVX 微虚拟机正确性测试
|   |   |-- nvx_rs.py            查找、构建并运行 nvx-rs，nvx.py 将工作委托给它
|   |   |-- openvmm_process.py   供测试使用的前台 OpenVMM 进程控制
|   |   |-- performance.py       CI 性能采集、持久化与门禁
|   |   |-- process_supervisor.py 面向单个自有进程树的 Linux 监管器
|   |   |-- release.py           发布版下载、源码收集与打包
|   |   |-- sandbox.py           `nvx.py run` 的 live-share 参数
|   |   |-- sandbox_lifecycle_tests.py 托管沙箱生命周期与安全测试
|   |   |-- time_abi.py          时间 ABI 夹具检查与 CPU 配置文件指引
|   |   `-- ubuntu.py            已验证的 Ubuntu rootfs 与 EROFS 准备
|   |-- setup/                   宿主与 Actions runner 引导脚本
|   |   |-- setup-linux-mshv.sh  Linux/MSHV 开发宿主引导
|   |   |-- setup-linux-runner.sh Linux/KVM 或 Linux/MSHV 的 Actions runner 引导
|   |   |-- setup-windows-whp.ps1 Windows/WHP 开发宿主与 Actions runner 引导
|   |   `-- tool-versions.conf   共享的工具发布版与校验和固定值
|   |-- check_markdown_links.py  CI 运行的 Markdown 链接、锚点与 doc/ 路径检查
|   |-- nvx-hosts.example.json   被忽略的 .nvx-hosts.json 的模板
|   |-- nvx.py                   受支持的命令行入口点
|   |-- nvx_adversarial_executor.py 受限的对抗性执行器入口点
|   |-- publish_development_release.py CI 运行的开发发布版发布器
|   `-- test_*.py                Python 工具的单元测试
|-- SECURITY.md                  Microsoft 安全漏洞报告策略
|-- .dockerignore                Docker 构建上下文排除项
|-- .gitattributes               Git 路径属性
|-- .gitignore                   生成文件排除项
|-- .gitmodules                  OpenVMM 子模块定义
|-- LICENSE                      仓库许可证
|-- pyproject.toml               Pyright 与 Ruff 配置
|-- README.md                    项目概览与文档索引
|-- requirements-dev.txt         固定的 Python 开发工具
|-- rust-toolchain.toml          固定的 Rust 发布版
|-- SOURCE-MANIFEST.json         固定的源码版本、哈希与输出
|-- THIRD_PARTY_NOTICES.md       第三方归属与声明
`-- VERSION                      NVX 发布版版本
```

被忽略的 `.cache/` 目录也可能出现在仓库根目录下。它包含已下载并准备好的上游源码树，包括 Linux。

## 源码目录

### `.github/`

仓库自动化与 Copilot 定制放在这里。`workflows/ci.yml` 定义主 CI 流水线及其作业级编排。它调用三个可复用工作流：`build-openvmm-binary.yml` 为一个目标构建 OpenVMM，`run-nvx-microvm-tests.yml` 在一个后端上运行 NVX 微虚拟机测试，`run-platform.yml` 对一个平台进行基准测试，并在 `dev` 推送时打包其发布版。其余工作流运行对抗性活动、用 Specula 验证已发布的发布版，并准备 Copilot 云代理与代码审查环境。作业与门禁见[持续集成](/docs/ci/)。

`actions/` 目录包含用于验证、产物构建、基准测试、打包、发布和性能历史管理的可复用实现。`skills/` 目录定义常见开发工作流的 Copilot 代理技能，`copilot-instructions.md` 保存全仓库范围的 Copilot 指令。`specula/` 目录包含针对固定的 OpenVMM 发布版做增量形式化验证所需的适配器、测试和专用运行器设置。

### `guest/`、`ubuntu/` 与 `azurelinux/`

`guest/common` 包含 Alpine、Ubuntu 和 Azure Linux initramfs 构建共享的脚本，以及容器入口脚本的 Azure Linux 变体。九个编译后的 `/sbin/nvx-*` 程序位于 `nvx-rs/src/guest` 和 `nvx-rs/src/bin` 下。`init` 控制早期启动，然后启动一个由 `nvx_exec=` 指定名称的 initramfs 程序：仅 Alpine 有的 `nvx-init-agent` 沙箱配置、用于托管工作负载的 `nvx-managed-agent`、用于基准测试剖析的 virtio 恢复探测程序，或交互式 shell。在交互式启动时，`init` 为 Alpine 和 Azure Linux 打印稳定的发行版启动标记，`guest/ubuntu/nvx-bashrc` 打印 Ubuntu 的标记。`guest/alpine` 包含仅由 Alpine initramfs 安装的容器启动与入口脚本；入口脚本把 Alpine 的 musl 加载器和 `setpriv` 暂存到工作负载的根目录内。

沙箱脚本通过 sysfs 解析固定的 virtio-blk 角色，在 ext4 暂存盘之上组装 EROFS 下层，在放行之前把工作负载放入其 cgroup，构建其挂载/PID/UTS 命名空间，在丢弃能力后进入其文件系统根，并保留代理作为外层 PID 1。在托管沙箱中，代理监管 `nvx-managed-agent`，并在收到停止请求后执行有序卸载拆除。其余通用辅助程序负责关机、virtio-fs 挂载、快照准备以及时间 ABI 的客户机侧。Rust 客户机二进制提供关机、托管控制、恢复修复、设备访问、入站通告和诊断探测。

`ubuntu/packages.lock.json` 固定了在不执行维护者脚本的情况下安装的完整补充 `.deb` 闭包。`azurelinux/packages.lock.json` 固定 Azure Linux initramfs 添加到其按摘要固定的基础镜像中的每个 RPM 的 SHA-256；Docker 构建会精确下载这些 RPM，校验其校验和与签名，并在不从仓库解析软件包的情况下安装它们。基础镜像固定值或所添加的软件包变化时，请更新它。

### `data/`

由本地运行和 CI 拥有的基准测试数据。其根目录下的平台 CSV 是 CI 维护的滚动性能门禁历史。被忽略的子目录保存运行日志、下载的产物、收集的结果和门禁输入。

### `docker/`

该容器定义用于在可复现的 Linux 环境中构建 Linux 内核，以及 Alpine、Ubuntu 和 Azure Linux initramfs 镜像和 Ubuntu EROFS 发行版层。

### `kernel/`

NVX 拥有的、用于产出客户机内核的输入。`config-microvm` 定义内核构建。`config-microvm-debug` 是一个在其之上应用的片段，用于 CI 调试内核。`patches/` 中的文件按名称顺序应用到固定的 Linux 源码上。`COPYING-LINUX` 记录上游 Linux 版权与许可声明。内核相关细节见[构建指南](/docs/build/)。

### `aci_edge_sandboxes/`

Rust crate `aci_edge_sandboxes` 向 MXC 等使用方暴露五阶段的状态感知沙箱生命周期（provision、start、exec、stop 和 deprovision）。它定义契约类型、可插拔的后端 trait 和默认后端；默认后端把契约的请求转换为 `nvx` 库的调用，并把其错误映射到契约的错误码。可选的 `agent` feature 增加第二个后端，即一个另行提供的原生代理库的薄客户端，该库拥有整个沙箱生命周期。该 crate 独立于 OpenVMM 子模块构建。其 API、策略遵循矩阵和测试见 [README](/docs/rust-api/)。

### `nvx-rs/`

Rust crate `nvx-rs`，其库 `nvx` 承载 NVX 机制：客户机代理的经认证控制协议、产物发现与捆绑发布版暂存、OpenVMM 的命令行、网络与文件系统策略的下沉、`nvx.py` 出站策略文件的编译器、面向 Linux 和 Windows 宿主的进程与平台原语、VM 实例的监管、`nvx.py sandbox` 的沙箱启动配置、移植 `nvx.py sandbox` 的 `nvx-rs` 命令行界面、出站策略编译和产物查找，以及用于测试的伪 OpenVMM。其 `guest` feature 构建每个客户机镜像安装到 `/sbin/nvx-*` 的九个静态可执行文件。它和 `aci_edge_sandboxes` 一样，是一个带自己的 `Cargo.lock` 的独立 crate，并独立于 OpenVMM 子模块构建。见其 [README](/docs/nvx-rs/)。

### `openvmm/`

`microsoft/openvmm` 的 Git 子模块。`.gitmodules` 记录其 URL 和被跟踪的分支，父仓库的 Git 树固定其确切修订。它包含 VMM 实现以及自己的源码布局、文档、测试和构建配置。对 OpenVMM 的更改在那个仓库中进行，然后通过更新子模块固定值记录到这里；见 [OpenVMM](/docs/contribute/)。

### `scripts/`

宿主侧工具。`nvx.py` 是公共入口点；命令实现位于 `nvx_tools/`，`nvx_tools/build_config.py` 承载聚合运行时配置，以及每个工作流消费的专用 Docker、initramfs、发行版层、内核和 OpenVMM 构建配置。固定输入和默认值位于 [`nvx_tools/build_constants.py`](https://github.com/microsoft/nvx/blob/dev/scripts/nvx_tools/build_constants.py)（英文原文），使用诸如 `KernelBuildConstants.VERSION` 之类的类限定常量。该常量模块不依赖工作流或配置模块。

独立的基准测试 shell 程序和参数化的客户机模板位于 `nvx_tools/benchmark_scripts/`，微虚拟机测试的客户机工作负载位于 `nvx_tools/microvm_test_scripts/`。源码收集脚本为 Linux、Alpine 和 Ubuntu 组装对应的源码归档。对抗性控制器、带类型的 broker、免凭据执行器、看门狗和受跟踪的确定性目录同样位于 `nvx_tools/`；`nvx_adversarial_executor.py` 是本地子进程和管理员拥有的远程包装器使用的受限协议入口点。`performance.py` 采集、持久化并门控 CI 性能结果。`host_telemetry.py` 记录基准测试宿主的来源信息，并在 Windows 上记录剖析快照捕获期间的存储活动，如[快照生命周期剖析](/docs/benchmarks/)和[CI 采集](/docs/benchmarks/)所述。`nvx.py` 旁的 `test_*.py` 文件是工具的单元测试。

`setup/` 脚本使用[工具清单](https://github.com/microsoft/nvx/blob/dev/scripts/setup/tool-versions.conf)（英文原文）引导开发宿主和 GitHub Actions runner；见[自动化环境引导](/docs/setup/)。`nvx-hosts.example.json` 是[远程代理宿主](/docs/setup/)清单的模板，CI 运行 `publish_development_release.py` 来发布开发发布版。

## 根目录文件

| 路径 | 职责 |
| --- | --- |
| `README.md` | 项目概览与文档索引 |
| `pyproject.toml` | 严格的 Pyright 策略，加上 Ruff 检查与格式化设置 |
| `requirements-dev.txt` | 贡献者和 CI 使用的固定 Python 工具 |
| `rust-toolchain.toml` | 构建 OpenVMM、其测试客户机和仓库 Rust 代码所用的 Rust 发布版 |
| `SOURCE-MANIFEST.json` | 发行版版本，OpenVMM 微虚拟机 ABI 与控制协议版本，Rust 客户机工具链与源码根，以及确切的 Linux、Alpine、Ubuntu 和 Azure Linux 输入标识与输出位置 |
| `VERSION` | 打包工具消费的发行版版本 |
| `.gitmodules` | OpenVMM 仓库 URL、路径和跟踪分支 |
| `.gitignore` | 排除构建产物、缓存、虚拟环境、日志和平台元数据 |
| `.dockerignore` | 限制发送到 Docker 构建上下文的文件 |
| `.gitattributes` | 仓库专属的 Git 属性 |
| `LICENSE` | 仓库内容的许可条款 |
| `THIRD_PARTY_NOTICES.md` | 依赖项的归属与再分发声明 |

## 生成的目录

| 路径 | 内容 |
| --- | --- |
| `.cache/` | 已下载、已验证并打过补丁的上游源码树 |
| `build/` | 内核、initramfs 与 EROFS 镜像、软件包清单和收集的源码 |
| `data/baseline/` | 性能门禁暂存的基础分支历史 |
| `data/results/` | 当前提交收集到的 p50 结果 |
| `data/runs/` | 原始基准测试日志与各平台产物 |
| `dist/` | 暂存的二进制与源码发布归档 |
| `openvmm/target/` | 在 OpenVMM 子模块内生成的 Rust 构建输出 |
| `aci_edge_sandboxes/target/` | `aci_edge_sandboxes` crate 的 Rust 构建输出 |
| `nvx-rs/target/` | `nvx-rs` crate 的 Rust 构建输出 |
| `.ruff_cache/` | Ruff 的本地检查缓存 |
| `__pycache__/` | 可能出现在 Python 源码目录下的 Python 字节码缓存 |

生成的路径可以由本目录其他指南中记录的构建和打包命令删除并重新创建。不应把它们当作源码或手工编辑。

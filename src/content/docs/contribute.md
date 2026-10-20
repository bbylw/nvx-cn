---
title: 贡献指南
description: 向 NVX 提交代码、编写提交信息与发起 PR 的规范。
group: dev
order: 6
source: doc/contribute.md
---

NVX 通过向 [microsoft/nvx](https://github.com/microsoft/nvx) 的 `dev` 分支发起 PR 来接受贡献。本指南涵盖工作流、审查者期望的约定、质量门禁、测试归属，以及 OpenVMM 更改如何进入 NVX。按 [SECURITY.md](/docs/security/) 所述报告安全漏洞，绝不要在公共 issue 中报告。

## 工作流

1. 克隆仓库及其 OpenVMM 子模块，并运行 `scripts/nvx.py verify`，如[环境准备](/docs/setup/)所述。
2. 从 `dev` 创建主题分支。
3. 进行更改，同时包含其测试和文档，然后运行覆盖它的[质量门禁](#质量门禁)和[测试](#测试归属)。
4. 以[草稿或就绪审查](#草稿或就绪)状态向 `dev` 发起 PR。
5. 处理审查，直到 PR 满足下面的合并规则。

`dev` 上的分支规则要求一次批准审查、每个审查线程都已解决，以及通过的 `Required status check`——该 CI 作业确认更改调度的每个作业都成功。Copilot 会审查每次推送，包括草稿。PR 以合并提交合并，因此分支上的每个提交都会进入 `dev`；给每个提交一个遵循[约定](#提交与-pr)的主题。

CI 只对推送和同仓库 PR 运行需要 OpenVMM 部署密钥或 hypervisor runner 的作业，包括 NVX CLI 测试。来自 fork 的 PR 运行其余 GitHub 托管的检查，维护者会将其暂存到 `microsoft/nvx` 分支以运行剩余部分；见[作业图与 runner 容量](/docs/ci/)。

## 提交与 PR

| 项目 | 约定 |
| --- | --- |
| 提交主题 | `area: summary`，其中 `area` 是发生更改的组件、命令或目录，例如 `doc`、`ci`、`guest`、`sandbox` 或 `openvmm`。摘要以小写祈使动词开头，并省略末尾句号：`ci: run each OpenVMM suite only when its inputs change`。 |
| 提交正文 | 当主题不足以说明时，说明更改了什么以及为什么。 |
| PR 标题 | 单提交 PR 的提交主题；否则使用相同形式的摘要。 |
| PR 正文 | 更改了什么以及为什么，然后是一个 `Validation` 部分，列出你运行的检查和留给 CI 的门禁，例如你无法测试的后端。 |
| Issue 引用 | 当 PR 完成该 issue 时，将 `Closes #N` 或 `Fixes #N` 放在最前；否则使用 `Part of #N` 或 `Refs #N`。 |
| 审查线程 | 用处理该评论的提交回复，或用无需更改的证据回复，然后解决该线程。 |

将 `data/*.csv` 中的性能历史留给 CI：成功的 `dev` 推送会追加到其中。

## 草稿或就绪

当发往 `dev` 的 PR 被打开、重新打开、推送或标记为就绪审查时，CI 会运行；当 PR 是草稿时，会跳过其 lint、构建和测试作业。新的推送会取消 PR 正在进行的运行；将其重新转换为草稿则不会。更改不止文档的就绪 PR 会占用共享的自托管 KVM、MSHV 和 WHP runner 池，因此：

- 当更改涉及的不仅仅是文档，且尚未通过覆盖它的[质量门禁](#质量门禁)和[测试](#测试归属)时，打开**草稿**。通过后将其标记为就绪。
- 否则以**就绪**打开。仅文档更改（每个路径都在 `doc/` 下或以 `.md` 结尾）会跳过客户机产物、OpenVMM 构建和每个 hypervisor 作业；见[变更分类](/docs/ci/)。

## 质量门禁

CI 在 GitHub 托管的 runner 上运行这些检查。推送前运行覆盖你更改的检查；[环境准备](/docs/setup/)列出了 Python、shell 和链接检查的命令。

| 代码 | 检查 | 定义 |
| --- | --- | --- |
| `scripts/` 和 `.github/specula/` 中的 Python | 使用 88 列行的 Ruff lint 和格式检查；在 `scripts/` 上针对 Linux 和 Windows API 运行严格模式 Pyright；以及 Specula 接线测试。代码目标为 Python 3.10。 | [check-quality](https://github.com/microsoft/nvx/blob/dev/.github/actions/check-quality/action.yml)、[pyproject.toml](https://github.com/microsoft/nvx/blob/dev/pyproject.toml) |
| 客户机和安装 shell 脚本 | ShellCheck，以及使用四空格缩进和缩进 `case` 分支的 shfmt。除非 check-quality 将其作为 Bash 检查，脚本为 POSIX `sh`。 | [check-quality](https://github.com/microsoft/nvx/blob/dev/.github/actions/check-quality/action.yml) |
| `scripts/setup/setup-windows-whp.ps1` | PowerShell 语法 | [check-quality](https://github.com/microsoft/nvx/blob/dev/.github/actions/check-quality/action.yml) |
| Markdown 文件和 `doc/` 路径 | 受跟踪 Markdown 文件中的每个相对链接和图像都解析到受跟踪文件，每个锚点都解析到 GitHub 生成的标题 slug（忽略代码）。受跟踪文件提到的每个 `doc/` 路径也会解析，但 `DOC_PATH_FIXTURES` 列出的测试夹具除外。 | [check-quality](https://github.com/microsoft/nvx/blob/dev/.github/actions/check-quality/action.yml)、[check_markdown_links.py](https://github.com/microsoft/nvx/blob/dev/scripts/check_markdown_links.py) |
| `aci_edge_sandboxes/` | rustfmt、以警告即错误运行的 Clippy 和 rustdoc、测试，以及最低支持的 Rust 版本；见 [Rust crate](/docs/ci/) | [check-aci-edge-sandboxes](https://github.com/microsoft/nvx/blob/dev/.github/actions/check-aci-edge-sandboxes/action.yml) |
| `nvx-rs/` | rustfmt、以警告即错误运行的 Clippy 和 rustdoc、包括捆绑发布版夹具的测试、最低支持的 Rust 版本、macOS 检查，以及通过 `nvx.py` 对客户机二进制进行的 musl lint、测试、构建、摘要清单和静态 ELF 检查；见 [Rust crate](/docs/ci/) | [check-nvx-rs](https://github.com/microsoft/nvx/blob/dev/.github/actions/check-nvx-rs/action.yml) |
| NVX CLI | 在 Linux 和 Windows 上编译 `scripts/`、运行每个 `scripts/test_*.py` 模块，并检查命令帮助 | [validate-nvx](https://github.com/microsoft/nvx/blob/dev/.github/actions/validate-nvx/action.yml) |

check-quality 会列出它检查的每个 shell 脚本，并且除非 validate-nvx 在两个操作系统上运行每个 `scripts/test_*.py` 模块，否则 CLI 测试会失败，因此请将新的脚本或测试模块添加到这些列表中。

## 测试归属

OpenVMM 拥有控制平面覆盖。用 `scripts/nvx.py test-openvmm-unit` 运行其单元和文档测试，用 `scripts/nvx.py test-openvmm --backend BACKEND` 运行其 VMM 测试。VMM 测试启动 OpenVMM 自己的测试客户机，但管理 RPC（TTRPC）生命周期、SMP 和快照测试除外——当 [`test-openvmm`](/docs/usage/) 运行它时，它会启动 NVX 的内核和 Alpine initramfs。

NVX 拥有依赖于其打过补丁的 Linux 内核、其 Alpine、Ubuntu 和 Azure Linux 用户态、客户机二进制和脚本、SMP 行为或 virtio 设备的行为。将这些场景添加到 `scripts/nvx_tools/microvm_tests.py`，并用 `scripts/nvx.py test-microvm --backend BACKEND` 运行它们。将客户机工作负载保留在 `scripts/nvx_tools/microvm_test_scripts` 中，并保留完整的失败日志。驱动公共 `nvx.py sandbox` 命令的场景位于 `scripts/nvx_tools/managed_exec_tests.py` 和 `scripts/nvx_tools/sandbox_lifecycle_tests.py`，`microvm_tests.py` 注册它们。`nvx.py sandbox` 和控制协议属于 `nvx-rs`（[microsoft/nvx#359](https://github.com/microsoft/nvx/issues/359)），因此这些场景将它们作为命令驱动，用 `nvx-rs egress compile` 编译出站策略，并将控制会话留给 `nvx-rs`：`managed-lifecycle` 场景构建 OpenVMM 的命令行并运行被忽略的 `nvx-rs` 测试 `tests/managed_lifecycle.rs`，后者驱动客户机。不要添加控制协议、生命周期或出站逻辑的 Python 客户端。

宿主工具的单元测试位于 `scripts/test_*.py`。`aci_edge_sandboxes` 和 `nvx-rs` crate 在其 Rust 源码旁保留单元测试，并在其 `tests` 目录中保留集成测试。后者还针对精确的客户机 profile 二进制运行 `tests/guest_tools.rs`。NVX 机制的测试（例如控制协议的黄金测试夹具）属于 `nvx-rs`，ACI Edge Sandboxes 约定的测试属于 `aci_edge_sandboxes`。`scripts/nvx.py test-aci-edge-sandboxes --backend BACKEND` 命令在真实 hypervisor 上运行所有被忽略的 `openvmm_e2e` 测试，这会检验两个 crate；`scripts/nvx.py test-agent-bundling` 在没有 hypervisor 的情况下检查该 crate 的代理捆绑暂存。[持续集成](/docs/ci/)描述了 OpenVMM VMM 测试和 NVX 微虚拟机套件覆盖的内容。

## OpenVMM

### 访问

`openvmm/` 是公共 [microsoft/openvmm](https://github.com/microsoft/openvmm) 仓库的 Git 子模块。`.gitmodules` 记录其 URL 和跟踪的 `feature/microvm/dev` 分支，每个 NVX 提交固定一个精确修订版。使用 `--recurse-submodules` 克隆，或在现有检出中运行 `scripts/nvx.py init`，如[环境准备](/docs/setup/)所述。在子模块以固定修订版检出之前，`scripts/nvx.py verify` 会失败。早于从 `nanvix/openvmm` 迁移的检出会继续从那里获取，直到 `git submodule sync -- openvmm` 采用记录的 URL。

### 源码更改

通过向 `microsoft/openvmm` 的 `feature/microvm/dev` 分支发起 PR 来更改 OpenVMM，该 PR 遵循[其贡献者说明](https://github.com/microsoft/openvmm/blob/feature/microvm/dev/.github/copilot-instructions.md)，包括其 Clippy、rustdoc、测试和格式检查，然后将审查过的修订版提升到 NVX。

`feature/microvm/dev` 在 `microsoft/openvmm` 的 `main` 分支之上承载微虚拟机提交。[OpenVMM 上游路线图](/docs/openvmm-roadmap/)将这些提交分组为计划发往 `main` 的 PR，并标记那些保留为仅 fork 的提交。

### 固定版本提升

固定版本提升将 `openvmm` gitlink 移动到一个经过审查的 OpenVMM 修订版：

- 使提升成为直接基于当前 `dev` 的单提交主题分支；除非该修订版需要协调的 NVX 更改，该提交应只更改 gitlink，主题如 `openvmm: pin auto's fallback to host CPU profiles`。绝不将 OpenVMM 历史合并到 NVX。
- 提交后，运行 `scripts/nvx.py verify`，它检查子模块检出是否与记录的固定版本匹配。
- 在 PR 中，指明 OpenVMM PR 和精确固定的 SHA、范围与任何前置修订版，以及你运行的验证。
- gitlink 更改是每个 CI 套件的输入，因此其 PR 会运行完整矩阵，包括两个 OpenVMM 套件。
- 当 rebase 在 gitlink 上冲突时，不要选择任何一方：合并两个更改通常需要一个新的 OpenVMM 修订版。

[nvx-openvmm-promote](https://github.com/microsoft/nvx/blob/dev/.github/skills/nvx-openvmm-promote/SKILL.md) 技能给出了完整过程，包括如何证明替换修订版与已审查版本匹配。

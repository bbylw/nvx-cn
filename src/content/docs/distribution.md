---
title: 打包与源码交付
description: 打包、归档并分发 NVX 的二进制包与源码包。
group: dev
order: 5
source: doc/distribution.md
---

`package` 从构建好的 OpenVMM 二进制、`nvx-rs` 可执行文件和客户机产物暂存一个发布目录，默认为 `dist/<version>`。[构建](/docs/build/)列出了它所需的产物和来源信息以及二进制发布布局。每个软件包要么仅含二进制，要么包含源码，你必须二选一。

每个软件包都会附带 `nvx-rs` 的发布构建，即 `nvx.py` 运行的 Rust 命令行接口（[命令行参考](/docs/usage/)）：Linux 软件包中为 `bin/nvx-rs`，一个静态的 `x86_64-unknown-linux-musl` 可执行文件；Windows 软件包中为 `bin/nvx-rs.exe`，一个带静态 C 运行时的 `x86_64-pc-windows-msvc` 可执行文件。`provenance/nvx-rs.provenance.json` 将其与构建它的 `nvx-rs` 源码摘要、Rust 发布版、目标和 `cli` 特性绑定，打包后的 `SOURCE-MANIFEST.json` 在其 `nvx_rs` 部分记录相同信息以及该可执行文件的 SHA-256。`package` 要求 `nvx-rs/target/release/nvx-rs[.exe]` 及其来源信息位于 `build/`，后者必须将其描述为检出源码的此类构建；见 [`record-nvx-rs-provenance`](/docs/usage/)。

## 仅二进制软件包

暂存一个二进制发布版和 SHA-256 清单：

```bash
python3 scripts/nvx.py package --binary-only
```

仅二进制模式需要明确确认，因为匹配的 Linux、Alpine、Ubuntu 和 Azure Linux 源码必须单独发布。

## 包含源码的软件包

首先物化发布源码：

```bash
python3 scripts/nvx.py collect-sources
```

`collect-sources` 读取已构建客户机产物的软件包清单，因此先运行 `build-guest --guest all`。它需要内核、Alpine 和 Ubuntu 产物，但不需要 Azure Linux 产物。它还需要带 Linux 引擎的 Docker（在 Alpine 容器中获取并验证 Alpine 上游源码，并构建 Linux 源码归档），以及 `gpgv`（验证 Ubuntu 源码索引）。

这会在 `build/sources/linux` 下生成打过补丁的 Linux 对应源码归档，在 `build/sources/alpine` 下生成精确的 Alpine 配方/上游源码，在 `build/sources/ubuntu` 下生成精确的 Ubuntu `.dsc` 及引用的源码成员。然后使用四个独立的源码产物暂存二进制发布版：

```bash
python3 scripts/nvx.py package --include-source
```

发布版包含：

```text
source/nvx-project-source-0.1.0.tar.gz
source/nvx-linux-source-6.18.38.tar.gz
source/nvx-alpine-source-0.1.0.tar.gz
source/nvx-ubuntu-source-0.1.0.tar.gz
```

`collect-sources` 不收集 Azure Linux 对应源码，因此 `--include-source` 会从暂存发布版和打包后的 `SOURCE-MANIFEST.json` 中省略 `initramfs-azurelinux.cpio.gz` 及其软件包清单。在 Azure Linux 对应源码单独发布期间，只能从仅二进制软件包分发 Azure Linux 客户机。

Linux 是 GPL-2.0-only，因此 `vmlinux` 的分发者必须提供其完整的对应源码。Alpine 软件包保留其各自的许可证。收集器使用嵌入每个已安装 APK 中的精确 aports 提交，并运行 `abuild fetch` 和 `abuild verify`。其清单列出可执行配方文件，Alpine 源码归档从该列表获取其文件模式，而不是从收集宿主获取，因为后者可能不存储这些模式。

Ubuntu 产物使用 Ubuntu 用户态与 NVX 内核。收集器从两个 Ubuntu 清单中去重精确的源码包名/版本对，从 Canonical 的归档下载匹配的 `.dsc` 和源码成员，通过其签名的 `InRelease` 文件和固定的 Ubuntu 归档密钥环验证每个源码索引，然后在打包前验证索引中的 SHA-256 元数据。源码收集和发布暂存还要求每个 Ubuntu 产物与其伴随清单中嵌入的产物名称和 SHA-256 匹配。已离开活动套件索引的精确版本通过 Canonical 的 Launchpad 发布历史定位，并从签名的历史 `snapshot.ubuntu.com` 索引解析。签名的发布元数据、密钥环和原始 Launchpad 响应连同其 URL 和 SHA-256 摘要一并保留。绝不替换为更新的源码版本。

OpenVMM 采用 MIT 许可：保留其声明，但其源码不必仅因与 Linux 聚合而发布。见 `THIRD_PARTY_NOTICES.md`。

`nvx-rs` 可执行文件是 MIT 许可的 NVX 代码，静态链接 Rust 标准库和宽松许可的 crate，在 Linux 上链接 musl 和 LLVM 的 `libunwind`，在 Windows 上链接 Microsoft C 运行时。`THIRD_PARTY_NOTICES.md` 列出每一项及其许可证；`nvx-rs/Cargo.lock` 通过校验和固定每个 crate。

## 发布归档

将一个暂存发布目录转换为一个确定性归档：

```bash
python3 scripts/nvx.py archive-release \
  --source dist/0.1.0 \
  --destination dist/nvx-0.1.0.tar.gz
```

`archive-release` 在写入暂存目录之外的 `.tar.gz` 或 `.zip` 归档之前，会根据 `SHA256SUMS` 检查暂存文件；见 [`archive-release`](/docs/usage/)。`SHA256SUMS` 列出每个打包文件，包括 `bin/nvx-rs[.exe]` 及其来源信息；每个归档都会将 `bin/` 中的可执行文件标记为可执行。

[`download`](/docs/usage/) 根据 `SHA256SUMS` 验证软件包，并将 OpenVMM、客户机产物、其来源信息和 `nvx-rs` 安装到检出中，`nvx-rs` 安装到 `nvx-rs/target/release/nvx-rs[.exe]`，其来源信息安装到 `build/`，因此 `nvx.py run` 和 `nvx.py sandbox` 无需 Cargo。只有当其来源信息描述的是 `nvx.py` 所运行的检出 `nvx-rs` 源码构建时，它才安装 `nvx-rs`。在软件包附带 `nvx-rs` 之前的发布版仍可安装：`download` 安装其余部分，并让 `nvx.py` 用 Cargo 构建 `nvx-rs`，如同对 `nvx-rs` 源码与检出不同的回退发布版所做的那样。

当软件包包含 `nvx-rs` 及其来源信息时，`download` 在决定构建是否兼容之前检查它们的一致性。不匹配的可执行文件会在运行时替换之前失败，即使对不兼容的回退发布版也是如此。

CI 遵循仅二进制路径。在 `dev` 推送或来自本仓库分支的就绪 PR 更改不止文档时，`linux-kvm`、`linux-mshv` 和 `windows-whp` 平台作业各自用 `--binary-only` 暂存 `dist/nvx-<version>-<platform>`，然后通过 [`package-release`](https://github.com/microsoft/nvx/blob/dev/.github/actions/package-release/action.yml) action 在 Linux 上归档为 `.tar.gz`，在 Windows 上归档为 `.zip`，并使用其操作系统的 NVX CLI 作业构建和测试的 `nvx-rs` 与来源信息。只有 `dev` 推送会上传归档，因此 PR 能证明其软件包可以构建，而不会发布它们。开发发布作业在发布前检查每个软件包都附带 OpenVMM 和 `nvx-rs`。[持续集成](/docs/ci/)描述了门禁和发布所得开发发布版的作业。

仅文档推送（每个更改路径都在 `doc/` 下或以 `.md` 结尾）会跳过平台作业，如[变更分类](/docs/ci/)所述。此类提交不会获得软件包或开发发布版，因此 [`download`](/docs/usage/)会安装其最近的已发布第一父提交祖先的软件包。

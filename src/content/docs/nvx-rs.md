---
title: NVX Rust crate
description: nvx-rs crate 的模块布局、OpenVMM 控制协议、出站策略文件与 Python 对等性。
group: use
order: 7
source: nvx-rs/README.md
---

`nvx-rs` 是承载 NVX 机制的 Rust crate：OpenVMM 控制协议，以及 NVX 微虚拟机的启动、策略下沉与监管。它的库名为 `nvx`。[`aci_edge_sandboxes` crate](/docs/rust-api/)在其上构建，并将其重新导出为 `aci_edge_sandboxes::nvx`。该 crate 还包含在 NVX 的 Linux 客户机中运行的程序，以及 `nvx-rs` 命令行接口——`nvx.py` 将沙箱、出站策略和产物步骤委托给它的后端，随着 [microsoft/nvx#356](https://github.com/microsoft/nvx/issues/356) 的各个阶段将这些步骤迁移到 Rust。

NVX 沙箱是一个由 OpenVMM 以托管生命周期运行的微虚拟机：客户机的 init 启动托管代理，代理运行宿主通过经过身份验证的控制台发送给它的工作负载。该 crate 不发布到 registry，并且有自己的 `Cargo.lock`；仓库根目录的工作区会与嵌套的 `openvmm/` 工作区相互影响。

## 布局

```text
nvx-rs/
├── src/
│   ├── protocol/    NVXS 记录、NVXC 帧、EXEC 与 MAPS 载荷、客户机特性，以及
│   │                内核命令行标记；无依赖，由宿主和客户机共享
│   ├── contract.rs  控制约定版本与发布清单兼容性
│   ├── net/         CIDR 解析与相减，以及主机名和客户机网络形式
│   ├── hypervisor.rs
│   ├── error.rs     nvx::Error 及其 ErrorKind
│   ├── host/        特性 `host`（默认）：产物、启动、网络与出站策略文件、
│   │                文件系统、会话、进程、平台、VM 实例、结果报告，以及
│   │                `nvx.py` 的沙箱启动配置，连同它们保留的 Python 语义；
│   │                在特性 `cli` 下，还有 `nvx-rs` CLI
│   ├── testing/     特性 `testing`：伪 OpenVMM
│   ├── guest/       特性 `guest`：在 Linux 客户机中运行的程序
│   └── bin/         nvx-rs、nvx-fake-openvmm 以及客户机二进制
├── tests/           伪 OpenVMM、CLI 和客户机二进制测试，以及 Python 为其代码移植
│                    记录的黄金测试夹具，位于 fixtures/
├── build.rs         打包发布版的暂存
└── artifacts.json   `bundled` 特性暂存的 NVX 发布版
```

| 模块 | 内容 |
| --- | --- |
| `nvx::protocol` | 控制台的编解码器：`NVXS` 外层记录、`NVXC` 应用帧、宿主编码且客户机代理解码的 `EXEC` 载荷、宿主映射表的 `MAPS` 载荷、`GuestFeatures`，以及 `nvx_maps=` 和 `nvx_workload_account=create` 标记。黄金字节夹具独立于编解码器固定每条记录，宿主与伪 OpenVMM 共享该编解码器 |
| `nvx::contract` | 该 crate 使用的 OpenVMM 微虚拟机 ABI、broker 协议和控制约定修订版，以及用于发布版 `SOURCE-MANIFEST.json` 的 `manifest_is_compatible` |
| `nvx::net` | `Cidr`：IPv4 和 IPv6 网络及其相减；`is_valid_hostname` 和 `is_valid_guest_network`，即 VM 的主机名和客户机地址形式 |
| `nvx::Hypervisor` | KVM、MSHV 或 WHP，其 serde 形式位于 `serde` 特性之后 |
| `nvx::host::artifacts` | `Artifacts`（也是 `nvx::Artifacts`）：OpenVMM 可执行文件、客户机内核和 Alpine initramfs，可来自发布版、仓库检出、环境、可执行文件旁的目录或捆绑包。`ArtifactDir` 和 `Guest`：`nvx.py` 运行的客户机的所有产物——OpenVMM 可执行文件、内核、Alpine、Ubuntu 和 Azure Linux initramfs 镜像及其软件包清单，以及 Ubuntu 发行版层及其清单——位于检出的 `build/` 和 `openvmm/target/release/`，或发布版的 `guest/` 和 `bin/`，按 `nvx.py` 的顺序和消息进行检查。`ArtifactPaths` 列出所有这些，并序列化为 JSON |
| `nvx::host::launch` | `LaunchSpec` 与 OpenVMM 的命令行：托管生命周期、`WorkloadIdentity`、1024 字节的内核命令行、其保留参数、Windows 命令行 32,767 字符的限制，以及 `LaunchSpec::check`——每条命令行都会应用它来检查内存大小、非 root 身份、主机名、客户机网络和内核参数 |
| `nvx::host::network` | `NetworkPolicy` 与 `openvmm_arguments`：出站默认值与规则、入站、宿主回环访问与转发，作为 OpenVMM 选项。出站策略文件的下沉会将出站规则精确下沉为 OpenVMM 的 IPv4 和 IPv6 规则，每个动作至多 256 条规则 |
| `nvx::host::network::policy` | 出站策略文件：`compile_policy_file`、`compile_policy_bytes` 和 `compile_policy` 将其中一个编译为原生规则的 `CompiledEgressPolicy`；见[出站策略文件](#出站策略文件) |
| `nvx::host::filesystem` | 通过 OpenVMM 的聚合 virtio-fs 设备导出宿主路径的 `ExportPlan`、宿主映射表、保留的客户机目标，以及 `guest_path` 和 `resolve_guest_path`（也在 `nvx::` 下） |
| `nvx::host::instance` | `Instance`：位于其自身目录中的 VM。它用全新的 capability 启动 OpenVMM，等待客户机就绪并挂载映射的路径，协调已记录的状态，恢复被中断的启动，运行工作负载并泵送其输出，并以强制回退停止 VM |
| `nvx::host::session`、`process`、`platform`、`report` | 经过身份验证的控制会话、OpenVMM 进程、Linux 和 Windows 原语，以及 OpenVMM 的结果报告 |
| `nvx::host::sandbox` | `nvx.py sandbox` 的启动配置，移植自 `scripts/nvx_tools/sandbox.py` 所持有的那一份：`SandboxLaunch`，包含 EROFS 发行版 `SandboxLayer`（沙箱采用的唯一一层）、ext4 暂存磁盘、入口点、参数、主机名、工作负载身份和资源限制，以及它的 `--microvm-sandbox-block` 和 `--microvm-workload-identity` 参数与内核命令行，处于 OpenVMM 留给它的 1024 字节预算之内。`mount`：宿主目录和文件的 `SandboxMount` 实时共享、其客户机目标与保留目标、其访问策略和所有者、多个共享的聚合，以及对其宿主路径的检查。`options`：`nvx.py sandbox` 和 `nvx.py run` 对其选项应用的检查：`--mount-deny`、`--mount-allow` 和 `--mount-write` 对共享的归属、systemd 策略、`nvx.py run` 共享的目标，以及托管 exec 环境；见 [Python 对等性](#python-对等性) |
| `nvx::testing::fake_openvmm` | 伪 OpenVMM，在没有 VM 的情况下提供控制台并运行脚本化工作负载，用于直接启动，以及 `nvx-rs sandbox` 和 `nvx.py sandbox` 的托管沙箱与一次性沙箱 |
| `nvx::host::cli` | 特性 `cli`：`nvx-rs` 可执行文件；见 [nvx-rs 命令行](#nvx-rs-命令行) |
| `nvx::guest` | 在 Linux 客户机中运行的程序；见[客户机二进制](#客户机二进制) |

下沉函数采用消息引用其输入时使用的名称，例如 `EgressRules::name` 和 `PathList::name`，因此调用方的消息会指明它们自己的字段。

## 出站策略文件

`nvx::host::network::policy` 编译 `nvx.py run` 和 `nvx.py sandbox` 通过 `--network-egress-policy-file` 接收的出站策略文件（[格式](/docs/run/)）。它是原 `scripts/nvx_tools/egress_policy.py` 的忠实移植，在 `nvx.py` 委托给 `nvx-rs` 时取代了后者：它接受相同的文件，将其编译为相同的规则，并以相同的消息失败。

- 一个策略至多是 1 MiB 的 UTF-8 JSON，其根只有 `allow` 和 `deny` 数组。JSON 按 Python 的 `json.loads` 读取方式读取，因此 `NaN` 和 `Infinity` 是数字，而重复字段和超过 64 位的整数是错误。
- 规则采用 MXC 形式，带有可选的 `to` 目标（`cidr` 和 `except`）以及 `ports` 选择器（`protocol`、`port` 和 `endPort`），或者采用旧式扁平形式（`cidr`、`except`、`protocol`、`port` 和 `endPort`）。协议为 `tcp`、`udp`、`icmp` 和 `any`，TCP 和 UDP 接受一个端口或一个范围。CIDR 按 Python 的 `ipaddress.ip_interface` 读取方式读取：主机位被清除，接受 `/255.255.0.0` 这类 IPv4 网络掩码，拒绝 IPv6 作用域。
- 每个动作 `allow` 或 `deny` 至多下沉为 256 条原生规则：减去例外，目标合并为尽可能少的网络，针对协议每个端口的规则涵盖它们所覆盖的更窄规则，对端口边界的一次扫描合并重叠和相邻的范围。规则按地址族、地址、前缀长度、协议和端口排序，并以 `CIDR`、`CIDR:PROTOCOL`、`CIDR:PROTOCOL:PORT` 或 `CIDR:PROTOCOL:FIRST-LAST` 的形式表示。

`openvmm_arguments` 以相同方式下沉 `NetworkPolicy` 规则，因而也以相同方式下沉 `aci_edge_sandboxes` 策略：`EgressRule` 是策略文件的 MXC 规则，其消息在文件命名为 `allow` 或 `deny` 的地方命名为 `EgressRules::name`，例如 `network.egress.allow[0].to[1].cidr is not a valid IPv4 or IPv6 CIDR: x`；只有 `NetworkPolicy` 才有的检查（例如宿主回环相关检查）保留在 `openvmm_arguments` 中。

消息与 Python 逐字节一致，但有两种情况没有 Rust 对应物。Python 会用未配对代理项保存的字符串（例如从 `\ud800` 转义解码的字符串，或非 Unicode 路径）会将代理项显示为 `\udXXX`，这正是 Python 打印它的方式；路径则按 `str(pathlib.Path(path))` 的方式显示。Python 的解码器对嵌套深度超过其栈允许的文档抛出 `RecursionError`；此读取器没有这种限制，因此这些文档会作为无效策略失败。

[`tests/fixtures/egress-policy.json`](https://github.com/microsoft/nvx/blob/dev/nvx-rs/tests/fixtures/egress-policy.json) 保存 Python 编译器对其测试编译过的每个策略、手写边界用例以及带种子的随机语料的结果，测试无需 Python 即可重放；`NVX_EGRESS_POLICY_FIXTURE` 让测试指向相同格式的另一语料。见 [Python 对等性](#python-对等性)。

## Python 对等性

`nvx::host::network::policy`、`nvx::host::sandbox` 以及 `nvx::host::artifacts` 的客户机查找取代了 `nvx.py` 运行的 Python 代码，因此它们逐字节保留其约定：限制、选项语义、输出和消息。它们按 Python 的方式检查值：空白是 `str.isspace` 接受的内容，整数是 `int` 读取的内容，UUID 是 `uuid.UUID` 读取的内容，JSON 是 `json.loads` 读取的内容，并以它的消息失败；宿主路径按 `pathlib` 的方式规范化（在 Windows 上使用反斜杠），并按 `Path.resolve` 的方式解析；文件身份是 `os.stat` 的身份，在 Windows 上是卷序列号和 128 位文件 ID；消息按 `repr` 的方式引用值。私有 `python` 模块在 CPython 3.14 之后实现这些语义，使用 Python 3.14 的 Unicode 16.0.0 表。Python 将不是有效 Unicode 的操作系统字符串解码为代理项：路径按 Python 打印它们的方式打印，文件系统查询则拒绝它们。

`tests/fixtures` 保存 Python 代码对固定输入和带种子随机语料所做的结果：`python.json` 用于 Python 语义，`sandbox.json` 和 `sandbox_options.json` 用于启动配置和沙箱选项（POSIX 和 Windows 路径皆然），`egress-policy.json` 用于策略编译器，`cli.json` 用于作为命令的 `nvx.py sandbox`；见[黄金场景](#黄金场景)。`scripts/nvx_rs_fixtures.py` 用 CPython 3.14 记录它们，并生成 `src/host/python/unicode.rs` 的 Unicode 表，直到 `nvx.py` 委托给 `nvx-rs`，且 [microsoft/nvx#359](https://github.com/microsoft/nvx/issues/359) 将该脚本连同它记录的 Python 代码一起退役。黄金测试将这些移植与这些记录比较，无需 Python。这些记录现在是该行为的参考：有意的行为变更应在同一次变更中手动更新它所改变的记录。

## nvx-rs 命令行

`cli` 特性构建 `nvx-rs` 可执行文件，它忠实移植了 `nvx.py` 委托给它的那些运行时步骤（[microsoft/nvx#359](https://github.com/microsoft/nvx/issues/359)）：

```text
nvx-rs [-h] [--root PATH] [--prog PROG] artifacts
nvx-rs [-h] [--root PATH] [--prog PROG] egress compile PATH
nvx-rs [-h] [--root PATH] [--prog PROG] sandbox [run|provision|start|exec|stop|deprovision] [OPTIONS]
```

```bash
cd nvx-rs
cargo build --release --features cli   # target/release/nvx-rs
```

每个 NVX 发布软件包都会附带该发布构建：Linux 软件包中为 `bin/nvx-rs`（一个静态 `x86_64-unknown-linux-musl` 可执行文件），Windows 软件包中为 `bin/nvx-rs.exe`（带静态 C 运行时），其来源信息位于 `provenance/nvx-rs.provenance.json`（[打包与源码交付](/docs/distribution/)）。解压后发布版中的 `nvx-rs` 可按原样运行：没有 `--root` 时，它使用包含它的发布版；见[产物根目录](#产物根目录)。[`nvx.py download`](/docs/usage/) 会将其安装到构建它的源码检出中，以便 `nvx.py` 无需 Cargo 即可运行它。

`nvx.py` 运行 `NVX_RS` 指定的可执行文件；否则运行其检出中的 `nvx-rs/target/release/nvx-rs[.exe]`；再否则先用 Cargo 构建该文件，其输出到标准错误；见[命令行参考](/docs/usage/)。`nvx.py` 记录它构建和安装的构建的来源信息，而 `nvx.py record-nvx-rs-provenance` 记录以其他方式进行的构建的来源信息。它运行 `nvx-rs --root REPOSITORY --prog "nvx.py sandbox" sandbox OPERATION OPTIONS`，完全使用用户给出的选项，并沿用命令的标准流和退出状态；并为 `nvx.py run` 运行 `nvx-rs egress compile PATH` 和 `nvx-rs --root REPOSITORY artifacts`；为 `nvx.py test-microvm` 的出站场景运行 `nvx-rs egress compile PATH`。

错误将 `error: MESSAGE` 打印到标准错误并以状态 1 退出，正如 `nvx.py` 报告 `ScriptError`。用法错误打印解析器的用法和 `PROG: error: MESSAGE` 并以状态 2 退出，正如 `argparse`；帮助以状态 0 退出。Ctrl-C 打印 `Interrupted` 并以状态 130 退出。`sandbox run` 和 `sandbox exec` 以 OpenVMM 或工作负载的状态退出。文本的行尾按 Python 的 `print` 结束方式结束，在 Windows 上为 `\r\n`，其他地方为 `\n`，而工作负载输出原样通过。

`--prog PROG` 在用法、帮助和错误消息中指定程序名，默认为 `nvx-rs`。`nvx.py` 传递自己的名称，因此 `nvx-rs` 报告的 `nvx.py sandbox` 用法错误（例如无效的 `--layer`）读作 `usage: nvx.py sandbox ...` 和 `nvx.py sandbox: error: ...`，与 `nvx.py` 委托该命令之前一样。用法会为该名称换行，正如 `argparse` 按 80 列换行那样。

### 产物根目录

每条命令都使用一个根目录的产物：一个仓库检出（客户机产物在 `build/`，OpenVMM 在 `openvmm/target/release/`），或一个解压后的发布版（它们在 `guest/` 和 `bin/`）。

- `--root PATH` 指定根目录，正如知道自己仓库根的 `nvx.py` 传入的那样。包含 `bin/openvmm[.exe]`、`guest/vmlinux` 或 `guest/initramfs.cpio.gz` 的目录是发布版，其他任何目录都是检出。
- 没有 `--root` 时，根目录是其 `bin/` 包含该可执行文件的发布版（如发布版的 `bin/nvx-rs[.exe]`），或是在任意深度包含该文件的 `nvx-rs/target/` 的检出（如 `cargo build` 之后）。两者都必须有其 `SOURCE-MANIFEST.json`；否则命令失败并要求 `--root`。
- 环境变量 `NVX_OPENVMM` 指定要代替根目录中 OpenVMM 运行的 OpenVMM 可执行文件，例如测试中的 `nvx-fake-openvmm`。相对路径相对于工作目录。

### `artifacts`

以 JSON 打印产物的路径，正如 `json.dumps(value, indent=2, sort_keys=True)` 所写。路径是绝对路径且不检查：

```json
{
  "guests": [
    {
      "distribution": "Alpine Linux",
      "distro_layer": null,
      "distro_manifest": null,
      "initramfs": "/nvx/build/initramfs.cpio.gz",
      "name": "alpine",
      "package_manifest": "/nvx/build/initramfs.cpio.gz.packages.json"
    },
    {
      "distribution": "Ubuntu Base",
      "distro_layer": "/nvx/build/ubuntu-distro.erofs",
      "distro_manifest": "/nvx/build/ubuntu-distro.erofs.manifest.json",
      "initramfs": "/nvx/build/initramfs-ubuntu.cpio.gz",
      "name": "ubuntu",
      "package_manifest": "/nvx/build/initramfs-ubuntu.cpio.gz.packages.json"
    },
    {
      "distribution": "Azure Linux",
      "distro_layer": null,
      "distro_manifest": null,
      "initramfs": "/nvx/build/initramfs-azurelinux.cpio.gz",
      "name": "azurelinux",
      "package_manifest": "/nvx/build/initramfs-azurelinux.cpio.gz.packages.json"
    }
  ],
  "kernel": "/nvx/build/vmlinux",
  "layout": "repository",
  "openvmm": "/nvx/openvmm/target/release/openvmm",
  "root": "/nvx"
}
```

`layout` 为 `repository` 或 `release`，客户机按 `nvx.py` 的顺序列出，没有发行版层的客户机，其该项及其清单为 `null`，设置了 `NVX_OPENVMM` 时 `openvmm` 为该值。

### `egress compile PATH`

编译一个出站策略文件，与 `--network-egress-policy-file` 所做的一样，并以相同的 JSON 形式打印其原生 OpenVMM 规则：`{"allow": [RULE, ...], "deny": [RULE, ...]}`，每个列表按 OpenVMM 接收规则的顺序排列，这些规则是 `--network-egress-allow` 和 `--network-egress-deny` 的值。`nvx.py` 拒绝的文件会以它的消息失败。

### `sandbox`

`nvx-rs sandbox` 保留 `nvx.py sandbox` 的约定：其解析器的每个选项，具有相同的名称、默认值和值检查，以及相同的操作、检查、消息、输出、退出状态、结果报告和状态目录。操作默认为 `run`。选项取值形式为 `--option VALUE` 或 `--option=VALUE`，重复的选项会累积，`--mount-deny`、`--mount-allow` 和 `--mount-write` 应用于它们之前的 `--mount`。

- `run` 打印 `>> COMMAND`，即 OpenVMM 的命令行，在 Windows 上按 `subprocess.list2cmdline` 的方式引用，在其他地方按 `shlex.join` 的方式引用。除非给出 `--dry-run`，否则随后以标准流运行 OpenVMM 并以其状态退出。`--outcome-report` 向 OpenVMM 请求其结果报告。
- `provision` 在其状态目录中记录沙箱。`start` 以托管生命周期分离启动 OpenVMM，通过其标准输入传递全新的 capability，并等待客户机应答。`exec` 运行工作负载，先打印其标准输出再打印标准错误，并以其状态退出；`--outcome-report` 写入 `{"operation_id": HEX, "outcome": {"category": CATEGORY, "operation": "exec", "status_code": STATUS}, "schema_version": 1}`。`stop` 关闭 VM 且不打印任何内容。`deprovision` 移除状态目录。

状态目录及其文件就是 `nvx.py` 在委托给 `nvx-rs` 之前所写的那些，因此 `nvx-rs` 和较旧的 `nvx.py` 都能操作对方供给或启动的沙箱：

| 文件 | 内容 |
| --- | --- |
| `config.json` | 已供给的沙箱，采用能容纳它的格式 1 到 6 中最低的一种，按 `json.dumps(value, indent=2, sort_keys=True)` 写入，模式 0600，通过临时文件写入 |
| `runtime.json` | 格式 1：运行中 OpenVMM 的 `pid` 和 `start_time`（按 Python 识别进程的方式），以及其 `control_endpoint`：`STATE/control.sock`，或在 Windows 上为 `//./pipe/openvmm-microvm-HEX` |
| `control.capability` | 运行中 OpenVMM 的 32 字节 capability，模式 0600 |
| `control.sock` | POSIX 宿主上的控制端点 |
| `openvmm.log` | OpenVMM 的输出，每次启动时追加 |
| `outcome.json` | 最近一次启动的 OpenVMM 结果报告 |
| `lifecycle.lock` | 串行化生命周期转换的锁：POSIX 上为独占 `flock`，Windows 上为其首字节的锁，按 Python 的方式获取；deprovision 在移除目录时在其中留下 `deprovisioned` |

#### 客户机特性

在客户机应答后，`start` 向它询问控制特性，并要求 `GuestFeatures::LAYERED_SANDBOX`，即其启动所使用的特性：按执行的环境（第 4 位），因为 `exec` 会发送工作目录和环境。它既不需要取消（第 0 位，因为 CLI 从不取消工作负载，且 Ctrl-C 会结束会话），也不需要工作负载账户（第 2 位，[#566](https://github.com/microsoft/nvx/issues/566)）。缺少所需特性的客户机镜像，或早于该请求的客户机镜像，会像启动失败那样被停止，启动会以 `the guest image lacks control features that layered sandboxes need (...)` 失败，其中列出缺失的特性。`nvx.py` 不询问；这是唯一有意的行为变更。NVX 的客户机代理在沙箱模式下通告第 0、2 和 4 位。

#### 与 nvx.py 的其他差异

- 长选项不能缩写；`nvx.py` 会完整传递它们。
- 帮助和用法按 80 列格式化，正如 `argparse` 为管道格式化那样，无效选择会像 Python 3.14.5 及更高版本那样以带引号的形式列出选项。
- 在 `nvx.py` 会以 Python traceback 结束的地方（例如配置缺少 `start` 读取的字段），`nvx-rs` 打印 `error: MESSAGE`（带有异常的消息）并以状态 1 退出。
- 文本以 UTF-8 进入管道和文件，而 Windows 上的 Python 使用 ANSI 代码页，除非 `PYTHONIOENCODING` 或 UTF-8 模式另有指定。
- `start` 拒绝另一个进程提供服务的控制端点，将其视为尚未出现的端点；在 Windows 上，它启动 OpenVMM 时不带控制台窗口，正如 `nvx::host::process` 启动它那样。
- `exec` 拒绝超过 1 MiB 的工作负载输出，客户机代理从不会转发这些输出。

### 测试挂钩

`--root` 和 `NVX_OPENVMM` 让测试无需 VM 即可运行 CLI。`nvx-fake-openvmm` 提供沙箱配置：其托管生命周期（capability 在其标准输入上）、控制台，以及停止时的结果报告；其一次性运行会运行 `/bin/echo`、`/bin/sleep`、`/bin/true` 或 `/bin/false`，如被要求则写入结果报告，并以工作负载的状态退出。内核命令行标记会使它失败：`fake_exit_on_start=STATUS`、`fake_exit_status=STATUS`、`fake_guest_features=MASK` 和 `fake_legacy_guest=1` 等；见 `nvx::testing::fake_openvmm`。

```bash
cd nvx-rs
cargo build --features cli,testing --bins
NVX_OPENVMM=target/debug/nvx-fake-openvmm \
  target/debug/nvx-rs --root .. sandbox run --layer distro,LAYER,UUID \
  --scratch SCRATCH --entrypoint /bin/echo --arg hello
```

### 黄金场景

`tests/fixtures/cli.json` 保存场景，这些场景由夹具脚本从 `nvx.py sandbox` 的 Python 实现记录（作为命令运行，根目录的 OpenVMM 为 `nvx-fake-openvmm` 的副本），以及从 `egress compile` 和 `artifacts` 背后的 Python 函数记录：选项和用法错误、试运行、一次性运行、每种配置格式下沙箱的生命周期，以及生命周期操作的拒绝。每一步记录退出状态、标准输出和错误，以及状态文件，其中根目录、进程 ID 和随机标识符以占位符表示。其 `posix` 和 `windows` 部分分别在每种宿主上记录，脚本还在其中用 `nvx-rs` 播放了每个场景，并让 Python 实现与 `nvx-rs` 双向轮流执行每个生命周期，未发现差异。`tests/cli.rs` 用 `nvx-rs` 重放其宿主对应的部分，无需 Python；由于 `nvx.py sandbox` 运行 `nvx-rs`，这些场景就是它的参考。

## 特性

| 特性 | 内容 |
| --- | --- |
| `host`（默认） | `host` 模块。它启用 `serde` 和 `sha2`，后者用于命名沙箱聚合共享的子项 |
| `bundled` | 在构建时暂存一个发布版；见[打包产物](#打包产物) |
| `testing` | 伪 OpenVMM 和 `nvx-fake-openvmm` 二进制 |
| `cli` | `host::cli` 的 `nvx-rs` CLI 及其 `nvx-rs` 二进制；它启用 `host`。见 [nvx-rs 命令行](#nvx-rs-命令行) |
| `serde` | `Hypervisor` 的 serde 形式 |
| `guest` | `guest` 模块和客户机二进制；见[客户机二进制](#客户机二进制) |

不启用默认特性时，该 crate 只有 `protocol`、`contract`、`net`、`Hypervisor` 和 `Error`，并且只依赖启用 `serde` 时的 `serde`，以及启用 `guest` 时的 `nix` 和 `getrandom`；`aci_edge_sandboxes_model` 就是这样使用它的。

## 示例

```rust,no_run
use std::sync::atomic::AtomicBool;
use std::time::Duration;

use nvx::host::instance::{self, Instance};
use nvx::host::launch::LaunchSpec;
use nvx::protocol::{Workload, WorkloadEnvironment};
use nvx::{Artifacts, Hypervisor};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let spec = LaunchSpec::new(Artifacts::discover()?, Hypervisor::from_env_or_default()?);
    let directory = std::env::temp_dir().join("nvx-example");
    instance::create_private_dir(&directory)?;
    let instance = Instance::new(&directory, "example");
    let started = instance.start(&spec, Duration::from_secs(60))?;

    let workload = Workload {
        argv: vec!["/bin/echo".to_owned(), "hello".to_owned()],
        timeout_ms: 0,
        cwd: None,
        environment: WorkloadEnvironment::Default,
    };
    let timeout = Duration::from_secs(60);
    let capability = instance.read_capability()?;
    let execution = instance.exec(&started.runtime, &capability, &workload, timeout, timeout)?;
    let mut stdout = Vec::new();
    let outcome = execution.pump(
        &mut |chunk: &[u8]| {
            stdout.extend_from_slice(chunk);
            Ok(())
        },
        &mut |_: &[u8]| Ok(()),
        &AtomicBool::new(false),
    )?;
    println!("{outcome:?}: {}", String::from_utf8_lossy(&stdout));
    instance.stop(&started.runtime, Duration::from_secs(30))?;
    Ok(())
}
```

## 错误

每个可失败操作都返回 `nvx::Error`：一条调用方可原样显示的消息、一个 `ErrorKind`，以及一个可选原因。

| `ErrorKind` | 含义 |
| --- | --- |
| `Unavailable` | 缺失或不可用的产物、hypervisor 或发布版，缺少所需控制特性的客户机镜像，或不受支持的宿主 |
| `Unsupported` | NVX 无法表示或强制执行的格式良好的请求，例如超出 OpenVMM 或客户机代理限制的策略 |
| `Exited` | VM 的 OpenVMM 进程已退出 |
| `Io` | 宿主 I/O 失败，或 NVX 在宿主上记录且无法读取的状态 |
| `Protocol` | 失败的控制会话，或客户机代理拒绝的请求 |
| `TimedOut` | 已过期的截止时间 |
| `Other` | 任何其他失败 |

消息按 `Instance::new` 赋予它的名称将实例称为 `sandbox NAME`。`aci_edge_sandboxes` 将这些种类映射到其错误码；见其[错误映射](/docs/rust-api/)。

## 打包产物

启用 `bundled` 特性时，构建脚本将发布版的 OpenVMM 可执行文件、客户机内核和 Alpine initramfs，连同其 `SOURCE-MANIFEST.json` 和 `SHA256SUMS`，暂存到其输出目录，`Artifacts::bundled` 返回它们。当没有其他来源时，`Artifacts::discover` 使用该捆绑包。

| 构建变量 | 作用 |
| --- | --- |
| `NVX_BUNDLE_DIR` | 在此目录中暂存解压后的发布版，用于离线构建或本地产物 |
| `NVX_BUNDLE_HYPERVISOR` | `kvm`（默认）或 `mshv`：要下载的 Linux 软件包 |
| `NVX_BUNDLE=skip` | 不暂存任何内容，如同该特性被禁用；CI 为 `--all-features` 构建设置它 |

在没有 `NVX_BUNDLE_DIR` 的情况下，构建脚本使用 `curl` 下载 [`artifacts.json`](https://github.com/microsoft/nvx/blob/dev/nvx-rs/artifacts.json) 固定的发布软件包，并使用 `tar` 解压；Windows 软件包是 ZIP 归档，需要 bsdtar（Windows 自带的 `tar`）或 `unzip`。每个暂存文件都必须匹配源中的 `SHA256SUMS`，下载必须匹配其固定摘要，发布版必须声明 `nvx::contract` 的控制约定。构建脚本只解压并验证捆绑包所包含的文件，因此附带 `bin/nvx-rs[.exe]` 的发布版会按 `artifacts.json` 固定的较旧发布版来暂存，而该旧发布版并不附带它。依赖项的构建脚本通过 `DEP_NVX_ARTIFACTS_DIR` 接收该暂存目录，并可将其作为 `nvx/` 放在其可执行文件旁一起交付。

## 客户机二进制

`guest` 特性添加在 NVX 的 Linux 客户机中运行的程序：`nvx::guest` 模块和每个程序一个二进制。Alpine、Ubuntu 和 Azure Linux 镜像都在其既有的 `/sbin/nvx-*` 路径附带全部九个程序。

| 二进制 | 程序 |
| --- | --- |
| `nvx-console-pending DEVICE` | 打印设备（例如控制台）中等待读取的字节数 |
| `nvx-mmio-write ADDRESS VALUE` | 通过 `/dev/mem` 在物理地址存储一个 32 位值（x86_64） |
| `nvx-reseed [--generation-only] SEED_FILE [PREVIOUS]`、`nvx-reseed --sample` | 从种子文件重新播种内核的随机数生成器并检查其 VM 代数 ID，或打印随机样本 |
| `nvx-exit [CODE]` | 通过 OpenVMM 的控制端口 0x604 以 8 位退出码停止 VM（x86_64） |
| `nvx-device-io file ...`、`nvx-device-io network ...` | 基准测试辅助程序，测量文件与 UDP 往返 I/O 并打印一行 JSON（x86_64） |
| `nvx-managed-agent CONTROL_TTY ROOTFS HOSTNAME UID GID USER HOME` | 提供托管控制会话并监管顺序工作负载；`--exec-config-fd FD -- WORKLOAD ...` 是其内部启动辅助程序 |
| `nvx-ingress GATEWAY_IPV4` | 向可移植网络网关通告可达的 TCP 监听器和已稳定下来的 UDP 套接字；`test DIRECTORY` 运行合成 procfs 快照 |
| `nvx-time [--report-only] COMMAND` | 强制执行 NVX 时间 ABI v1：运行其一致性检查、在恢复后修复墙上时钟、发布时间状态，并运行纪律与违规监视守护进程；`test NAME ...` 运行其解码器和进程测试挂钩（x86_64） |
| `nvx-time-probe latency\|warp\|clock ...` | 诊断时钟读取延迟、跨 CPU TSC 偏差与偏移、时钟、CPUID、时钟事件、内核消息，并可选诊断 MSR（x86_64） |

每个二进制的命令行、退出状态和字节输出都是兼容性约定；[`nvx::guest`](https://github.com/microsoft/nvx/blob/dev/nvx-rs/src/guest/mod.rs) 文档描述了每个程序。客户机以静态 `x86_64-unknown-linux-musl` 可执行文件运行它们。在 Linux 上，使用 musl 目标和 C 编译器驱动程序 `cc`，`nvx.py` 构建它们：

```bash
rustup target add x86_64-unknown-linux-musl
python3 scripts/nvx.py build-guest-binaries \
  --output build/nvx-rs-guest-binaries
```

原生客户机构建、固定摘要的 Docker Rust 阶段和 CI 都调用此例程。Docker 构建一次该集合，并在全部三个客户机镜像中安装相同的字节；Ubuntu 确定性检查会从全新的目标重建。

## 测试

```bash
cd nvx-rs
NVX_BUNDLE=skip cargo test --all-features   # unit, golden-fixture, parity-fixture, and fake-OpenVMM tests
```

测试不需要 hypervisor。伪 OpenVMM 测试针对 `nvx-fake-openvmm` 端到端驱动 `Instance`；CLI 测试重放[黄金场景](#黄金场景)，并检查客户机特性要求以及（在 Linux 上）Ctrl-C；共享协议定义加黄金字节夹具覆盖每条记录的两侧。在 Linux 上，一个回环测试通过 broker 垫片将宿主的 `ControlSession` 驱动到真实托管代理的会话、调度和执行引擎；`nvx.py` 还会对客户机二进制进行 lint 和测试，并针对它们的构建运行集成测试：

```bash
python3 ../scripts/nvx.py check-guest-binaries
python3 ../scripts/nvx.py test-guest-binaries \
  --binaries ../build/nvx-rs-guest-binaries
```

[`check-nvx-rs`](https://github.com/microsoft/nvx/blob/dev/.github/actions/check-nvx-rs/action.yml) action 运行 rustfmt、对每个特性以及无默认特性的库以警告即错误方式运行 Clippy、测试、合成发布版的 `bundled` 测试、以警告即错误方式运行 rustdoc、最低支持的 Rust 版本（1.89），以及 macOS 检查。在 Linux 上，它还通过 `nvx.py` 对客户机二进制进行 lint、构建和测试。`python3 scripts/nvx.py test-aci-edge-sandboxes --backend kvm` 通过 `aci_edge_sandboxes` 在真实 hypervisor 上检验该 crate。

`tests/managed_lifecycle.rs` 是一个被忽略的测试，在真实 hypervisor 上测试客户机的托管生命周期（其 init 将启动交给托管代理）：经过身份验证的会话与重连、请求作用域的工作目录与环境、工作负载身份、超时、被拒绝的工作目录，以及停止；这些由 `nvx::host::session` 驱动。`nvx.py test-microvm --scenario managed-lifecycle` 为其客户机和后端构建 OpenVMM 的命令行，用 Cargo 运行测试，并检查结果报告及其留下的客户机控制台：

```bash
python3 ../scripts/nvx.py test-microvm --backend kvm --scenario managed-lifecycle
```

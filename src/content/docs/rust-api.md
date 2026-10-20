---
title: Rust API
description: aci_edge_sandboxes crate 的 Rust API、沙箱生命周期、错误映射与示例。
group: use
order: 6
source: aci_edge_sandboxes/README.md
---

`aci_edge_sandboxes` 是 ACI Edge Sandboxes 生命周期的 Rust 接口。它通过可插拔的后端提供 provision、start、exec、stop 与 deprovision。默认后端直接驱动 `openvmm` 二进制文件；运行时不涉及守护进程或 Python 工具。可选的 `agent` 后端使用单独提供的原生库 `aci_edge_agent`，以及一种不同的、基于镜像的客户机。

默认情况下，每个沙箱都是一个微虚拟机，直接从 initramfs 运行 NVX 客户机的 Alpine Linux 用户态。该后端没有镜像层、暂存磁盘或容器命名空间；工作负载以非 root 用户身份在客户机内运行，客户机状态驻留内存，直到沙箱停止。可选启用的原生后端则针对调用方提供的只读 GPT 镜像运行命令，并使用 RAM 覆盖层。

Cargo 软件包、库和目录的名称均为 `aci_edge_sandboxes`。

## 快速开始

```rust,no_run
use aci_edge_sandboxes::nvx::Hypervisor;
use aci_edge_sandboxes::openvmm::OpenVmmConfig;
use aci_edge_sandboxes::{ExecRequest, NetworkPolicy, AciEdgeSandbox, ProvisionRequest};

fn main() -> aci_edge_sandboxes::Result<()> {
    let config = OpenVmmConfig::from_release_dir(
        "/opt/nvx",              // An extracted NVX release archive.
        Hypervisor::Kvm,         // Hypervisor::Whp on Windows.
        OpenVmmConfig::default_state_root()?,
    )?;
    let client = AciEdgeSandbox::openvmm(config)?; // Or OpenVmmConfig::discover().

    let request = ProvisionRequest::new().with_network(NetworkPolicy::deny_all());
    let sandbox = client.provision(&request)?.sandbox_id;

    client.start(&sandbox)?;
    let output = client
        .exec(&sandbox, &ExecRequest::command_line("echo hello"))?
        .wait_with_output()?;
    println!("{:?}: {}", output.outcome, String::from_utf8_lossy(&output.stdout));
    client.stop(&sandbox)?;
    client.deprovision(&sandbox)?;
    Ok(())
}
```

[`examples/lifecycle.rs`](https://github.com/microsoft/nvx/blob/dev/aci_edge_sandboxes/examples/lifecycle.rs) 是可运行版本，接受命令行参数。

## 生命周期

| 操作 | 状态转换 | 结果 |
| --- | --- | --- |
| `AciEdgeSandbox::provision` | （无）→ 已预配 | `SandboxId`（`aci-edge-sandboxes:<32 hex>`）以及可选的元数据 |
| `AciEdgeSandbox::start` | 已预配 → 运行中 | 可选的元数据 |
| `AciEdgeSandbox::exec` | 运行中 → 运行中 | 实时的标准输出和标准错误，随后是 `ExecOutcome` |
| `AciEdgeSandbox::stop` | 运行中 → 已预配 | 可选的元数据 |
| `AciEdgeSandbox::deprovision` | 已预配 → （无） | 可选的元数据；该 ID 随之失效 |

`ExecOutcome` 区分 `Exited(code)`、`Signaled(signal)`、`TimedOut`、`Cancelled` 和 `Failed(reason)`。`Failed(WorkingDirectory)` 表示工作负载从未运行，因为它无法进入其工作目录。`Execution::wait` 返回 `Err` 表示无法确定结果，例如因为 VM 已停止。

请求类型使用契约的 JSON 字段名（`readonlyPaths`、`memoryMib`、`commandLine` 等）序列化，并拒绝未知字段。所有 provision 字段都是可选的，因此 `{}` 是有效的 provision 请求。与 MXC 的 schema 一样，它们接受 0 到 4,294,967,295 毫秒（约 49.7 天）的 `process.timeout`，并拒绝负数或更大的值。协议信封（`version`、`phase` 和 `containment`）由调用方负责。

## 架构

- NVX 机制位于 [`nvx-rs` crate](/docs/nvx-rs/) 中，其库名为 `nvx`：包括 OpenVMM 控制协议、产物发现、OpenVMM 的命令行、网络与文件系统策略的下沉、进程与平台原语、VM 实例的监管，以及伪 OpenVMM。本 crate 将其重新导出为 `aci_edge_sandboxes::nvx`。本 crate 保留 ACI Edge Sandboxes 契约：外观层（facade）、`Backend`、MXC 模型及其校验、错误码、`SandboxId`、执行与流管道，以及异步和 mock API。其 `openvmm` 后端只把契约请求转换为 `nvx` 调用，并将 `nvx` 错误映射到契约的错误码；参见[错误映射](#错误映射)。
- `AciEdgeSandbox` 是入口点。它按契约要求的顺序校验每个请求，然后调用后端：
  1. 结构检查，报告为 `malformed_request` 或 `malformed_id`；
  2. 针对后端 `Capabilities` 的能力检查，报告为 `policy_validation`；
  3. 确定性的后端策略检查，例如客户机参数和出站规则限制，通过无副作用的校验钩子完成；
  4. 依赖宿主的检查，例如产物或 hypervisor 是否可用，仅在执行操作时进行。

  被拒绝的请求绝不会运行任何内容。
- `Backend` 是对象安全的 trait，每个操作对应一个方法，另有 `capabilities`、`probe` 以及 provision/exec 校验钩子。请使用与操作相同的确定性策略检查来实现这些钩子；校验不得检查宿主文件、创建状态或启动进程。后端将工作负载输出推送到 `OutputSink`，并返回 `ExecControl` 用于等待和取消。由外观层决定输出如何到达调用方：同步 API 中使用操作系统管道，异步 API 中使用进程内流。外观层的 sink 从 `OutputSink::close_handle` 返回 `OutputCloser`；当写入可能等待已停止读取的调用方时，请在取消或超时时关闭它。`ExecIo::stdin` 提供可中断的 `InputSource`。克隆其 `InputCloser`，以便在取消或超时时唤醒挂起的读取，并在报告完成前结束输入工作线程。同步调用方仍会收到原始的操作系统管道写入器；一旦后端关闭输入，写入就会失败。
- 本 crate 中的后端：
  - `openvmm::OpenVmmBackend`（特性 `openvmm`，默认）通过 `nvx` 驱动 `openvmm` 可执行文件。
  - `agent::AgentBackend`（特性 `agent`）将生命周期转发给单独提供的原生库，由该库驱动 OpenVMM 和基于镜像的客户机。
  - `testing::MockBackend`（特性 `testing`）在内存中实现状态机，供使用方的单元测试使用。
- `AsyncAciEdgeSandbox`（特性 `async`）为 Tokio 封装 `AciEdgeSandbox`。生命周期调用在阻塞线程池上运行，输出以 `AsyncRead` 流的形式到达。即使其 future 被丢弃，调用仍会继续运行。被丢弃的 `exec` 会在工作负载一开始运行时就请求取消它，但只有 `capabilities().exec.cancel` 为 true 的后端（例如 OpenVMM 和 agent 后端）会遵守该请求；对于其他后端，工作负载会一直运行到结束。其他调用会完成，因此沙箱状态会体现它们的效果。

要添加后端，请实现 `Backend`。只声明它能够强制执行的能力，并使用[错误映射](#错误映射)中列出的错误码报告状态机违规。

## Agent 后端（可选）

启用 `agent` 特性即可使用 `AciEdgeSandbox::agent(AgentConfig)`。该后端是单独提供的原生库 `aci_edge_agent.dll`（Linux 上为 `libaci_edge_agent.so`）的薄客户端；该库掌管整个沙箱生命周期：状态根目录及其记录、OpenVMM 进程及其启动控制台、客户机会话，以及客户机镜像。默认的直接 OpenVMM 后端及其 Alpine 客户机保持不变。本 crate **不会**构建或发布该库，只有在启用 `agent-bundled` 特性时才会下载它；参见[打包的 agent](#打包的-agentagent-bundled)。

`AgentConfig` 指定该库、调用方自身策略所批准的库 SHA-256，以及一个 `SetupConfig`；该库在每个进程中应用一次 `SetupConfig`：

```jsonc
{
  "stateRoot": "C:\\nvx-edge-state",
  // A release bundle trusted through its manifest's SHA-256, or explicit files:
  // "runtime": { "files": { "openvmm": "…", "kernel": "…", "initrd": "…" } }
  "runtime": { "bundle": { "path": "C:\\nvx\\edge", "manifestSha256": "<64 hex digits>" } },
  "hypervisor": "whp",          // optional; KVM on Linux and WHP on Windows otherwise
  "cpuProfile": "auto",         // or "host"
  "timeouts": { "startMs": 60000, "controlMs": 60000, "stopMs": 30000, "execGraceMs": 30000 },
  "defaults": {                 // what a sandbox inherits unless its spec sets it
    "image": { "path": "C:\\images\\layers.gpt" },
    "resources": { "vcpus": 1, "memoryMib": 256 },
    "guestNetwork": "10.0.0.2/24"
  },
  // How long a library that pulls registry references may take to materialize one.
  "images": { "references": { "pullTimeoutMs": 1800000 } },
  "diagnostics": { "guestDebug": false, "contentVerification": false }
}
```

除 `stateRoot` 和 `runtime` 之外，每个字段都有默认值。捆绑包目录包含 `edge` profile 的 format-2 `SOURCE-MANIFEST.json`、`bin/openvmm[.exe]`、`bin/direct-images[.exe]`、库本身（`bin/aci_edge_agent.dll` 或 `bin/libaci_edge_agent.so`）、`guest/vmlinux` 以及 `guest/initramfs-edge.cpio.gz`。清单固定每个文件的 SHA-256 和客户机的运行时 ABI。该库会检查除自身之外的每个文件：调用方将库的 SHA-256（清单中的 `agent.library_sha256`）传给 `AgentConfig`。显式文件可以用 `RuntimeFiles::approved_sha256` 固定。

`SandboxSpec` 与预配请求一同传给 `AciEdgeSandbox::provision_with`，用于设置单个沙箱的镜像（本地 GPT 磁盘的 `ImageSource::Path`、已注册镜像的 `ImageSource::Digest`，或在库支持时使用镜像仓库引用的 `ImageSource::Reference`）、资源、客户机网络及转发端口。每个客户机只有一个虚拟处理器，因此 `resources.vcpus` 只能为 1，`resources.memoryMib` 设置其内存。`Capabilities::spec` 列出该库支持的字段；主机名目前还不在其中。请求仍可设置 `microvm.provision.memoryMib`，但不能与 `spec.resources.memoryMib` 同时设置。

支持 `spec.image.reference`（`Capabilities::spec.image_reference`）的库会在沙箱首次使用某个引用时，用外部工具把该引用转换为本地磁盘镜像，并按引用的文本缓存结果。该工具来自运行时捆绑包（`bin/direct-images[.exe]`），因此使用显式运行时文件的库不会具体化（materialize）镜像引用。它不会再次检查标签，因此 `latest` 这类移动标签会一直指向首次拉取的内容：请使用版本标签或摘要（`repository@sha256:…`）来控制沙箱启动的内容。`images.references.pullTimeoutMs` 限制每次拉取（默认 30 分钟）。

对于私有镜像仓库，将 `images.references.authFile` 设置为宿主侧兼容 Docker 的 JSON 凭据文件，或使用 `ReferenceSettings::with_auth_file`。设置中只携带其路径：

```json
{
  "images": {
    "references": {
      "authFile": "C:\\edge-secrets\\registry-auth.json"
    }
  }
}
```

该文件的 `auths` 条目以镜像仓库主机为键，若存在端口则包含端口。条目支持 `auth`（`username:password` 的 base64）、`username` 与 `password` 搭配，或用于已签发的仓库持有者令牌的 `registrytoken`。Base64 **不是加密**；请使用宿主权限或 ACL 保护该文件。不支持凭据助手（`credHelpers` 和 `credsStore`）以及身份/刷新令牌，并会显式失败。宿主不会搜索用户的 Docker 配置或其他凭据文件。

宿主只为所请求的镜像仓库选择凭据，并在每次实际拉取时重新读取该文件，因此可以通过替换文件来轮换凭据。无关的镜像仓库以匿名方式拉取；选定的文件格式错误或不可读会导致拉取失败。本地和已缓存镜像不会读取该文件。现有状态根目录仍是缓存的信任边界；凭据不会限制对已缓存镜像的访问。

原生宿主通过镜像工具现有的密码/令牌命令行选项传递凭据。尽管客户端只收到文件路径，能够检查该进程的用户仍可看到这些凭据。不要将凭据文件映射到客户机中；宿主会拒绝会暴露该文件的映射。

- **加载。** `AgentBackend::new` 校验库的 SHA-256 和沙箱 ABI 版本，并在每个进程中加载一次；加载后一直保持，直到进程退出。它加载的正是校验过的字节。在 Linux 上，它从密封的内存副本加载，如果内核拒绝创建或执行该副本，则失败。在 Windows 上，其打开的句柄在库加载完成前阻止写入者改动文件，并阻止文件及其目录被重命名或删除。其他宿主无法加载该库。库缺失、版本错误或摘要错误都会导致失败，而不会回退。
- **打开。** 进程为某个设置打开的第一个后端会校验运行时文件，或检查此前进程记录在状态根目录下的 seal，并注册默认镜像。同一设置的后续后端会复用该宿主，而不触碰任何文件，因此调用方可以为每个操作创建后端；这些操作会检查它们使用的文件。若某个后端发现运行时文件已更改，下一个后端会重新校验这些文件；若发现默认镜像已更改或未注册，则重新注册该镜像。宿主、客户机会话和启动控制台捕获在进程生命周期内一直保留在库中；丢弃后端不会停止其沙箱。
- **镜像。** 库按内容 ID `sha256:<hex>`（`ImageId`）在状态根目录下注册镜像。注册会对镜像哈希一次；`ImageDigest::Expect` 还要求提供摘要，`ImageDigest::Trusted` 则记录调用方自身策略已验证的摘要，而不读取文件。之后在任何进程中注册时，只要文件仍然匹配，就会复用已有注册，而无需再次读取。预配会记录镜像 ID 和运行时摘要。启动时会将每个文件的 seal（卷、文件 ID、长度和最后写入时间，Linux 上还包括更改时间）与哈希时记录的 seal 比较，而不是再次哈希；如果任何内容发生变化，则以 `backend_unavailable` 失败，因此一次启动的开销大约等于客户机的启动时间。seal 能检测替换或修改，但无法检测故意恢复时间戳的写入者。在 Windows 上，启动还会在 OpenVMM 打开文件之前阻止写入者改动文件。使用 `register_image` 重新注册已更改的镜像：内容未变会保留其 ID，因此使用它的沙箱可以再次启动。`images` 列出注册项以及每个文件是否仍然匹配，`verify_image` 会再次哈希一个镜像，而 `unregister_image` 在已有预配沙箱使用该镜像时会拒绝。`Diagnostics::content_verification` 会在每次启动前再次哈希镜像和运行时文件，作为诊断手段。
- **客户机。** 镜像以只读方式挂载；edge 客户机校验其 GPT 和 p2+ ext4 层，并将可写层保留在 RAM 中，因此不需要暂存磁盘。启动通过标准输入向 OpenVMM 发送一个新的 32 字节能力，检查提供控制端点的进程，并等待客户机 agent 就绪。
- **客户机会话。** OpenVMM 每个 VM 一次只接受一个宿主会话。库为使用沙箱的进程保留每个运行中沙箱的一个会话，该进程的操作共享该会话，因此它们从不等候彼此的会话，其执行也通过该会话并行运行。其他进程会等待持有者释放会话（在 stop、deprovision 或退出时）。`guestSession.hold: false` 会在会话空闲 `lingerMs` 后释放它，供从多个长期存活的进程驱动同一沙箱的调用方使用。
- **中断的启动。** 启动在启动前认领沙箱的 OpenVMM 日志，OpenVMM 继承该认领。如果调用方在记录 OpenVMM 身份之前死亡，下一个操作会最多等待启动超时时间，让该 OpenVMM 打开其端点，然后终止它；一旦没有任何进程持有该日志，沙箱便可再次使用。
- **启动控制台。** 库从启动沙箱或最后使用沙箱的进程，将客户机启动控制台复制到 `AgentBackend::diagnostics` 指定的控制台日志。OpenVMM 一次只服务一个控制台客户端，并在没有客户端连接时保留客户机输出，因此写入足够多控制台输出的客户机会停滞，直到监听者重新连接：请保持该进程运行，或从其后续进程使用该沙箱，由后续进程的监听者接管捕获。
- **元数据。** 启动会报告 `bootMilliseconds`、`guestBuildId` 和 `phases`（`spawnMs`、`attachMs` 和 `readyMs`）。停止会报告 `forced`、`phases`（`shutdownMs` 和 `exitMs`），以及在优雅关闭失败后的 `gracefulError`。捕获失败绝不会导致 stop 或 deprovision 失败：两者都会将其报告为 `consoleError`。`AgentBackend::guest_logs` 在客户机运行期间读取其日志的有界快照。

执行可以运行 shell 命令或 argv，并在运行期间流式输出。输出随命令写入而到达，没有大小限制；`ExecIo::stdin` 为命令的标准输入提供数据，`ExecControl` 可取消命令。每次执行的流控会限制库为其缓冲的输出量，因此停止读取的调用方只会暂停该命令，而不会影响其他命令。每个沙箱最多同时运行 16 个执行；再多一个会以 `backend_error` 失败。超时会向上取整为整毫秒，最长可达一小时，并以 `TimedOut` 结束命令。如果超时在结果到达之前发生，`wait` 会像取消时一样关闭输出流，这样调用方持有但未读取的流就不会延迟结果；以这种方式丢失输出的执行会以 `TimedOut` 结束。快照/恢复和客户机侧镜像拉取不属于此配置。

[`examples/agent_lifecycle.rs`](https://github.com/microsoft/nvx/blob/dev/aci_edge_sandboxes/examples/agent_lifecycle.rs) 运行一次完整的生命周期。它需要 `--host-library`、`--host-sha256`、`--state-root`，`--image` 或 `--image-ref` 之一，以及（`--openvmm`、`--kernel` 和 `--initrd`）或（`--bundle` 和 `--bundle-sha256`）这一组参数，还需要 `--` 之后的命令；除非以 `agent-bundled` 构建，此时以上每项都有默认值；参见[打包的 agent](#打包的-agentagent-bundled)。注册本地镜像时，`--image-sha256` 要求提供该镜像的摘要。`--image-ref` 需要捆绑包；`--registry-auth-file PATH` 选择其凭据文件，`--pull-timeout-ms` 设置其拉取截止时间。`--hypervisor`、`--cpu-profile auto|host`、`--memory-mib` 和 `--guest-debug` 调整设置。可重复的 `--readonly`、`--readwrite` 和 `--denied` 选项映射宿主路径；`--egress allow|deny` 与可重复的 `--egress-allow`、`--egress-deny` 选项（各自接受 `CIDR` 或 `CIDR:tcp|udp:PORT`）挂接网络。`--network-proxy URL` 通过宿主代理转发客户机流量；`--host-loopback allow|deny` 与可重复的 `--host-loopback-forward tcp|udp:HOST:GUEST` 在宿主回环上发布客户机端口。可重复的 `--env KEY=VALUE` 会叠加在客户机环境之上，`--cwd PATH` 作用于命令。在设置相应的 `EDGE_AGENT_TEST_*` 路径和已批准的库摘要后，被忽略的 `tests/agent_guest.rs` 会测试真实客户机：在 Windows 上使用 WHP，或在 `EDGE_AGENT_TEST_HYPERVISOR` 指定的 hypervisor 下，例如 Linux 上的 `mshv`。`EDGE_AGENT_TEST_CPU_PROFILE=host` 会在宿主 CPU profile 上启动其客户机。

例如，在 Windows WHP 宿主机上，从 `aci_edge_sandboxes` 目录运行，并将以下路径设置为兼容的、单独构建的产物，以及调用方准备的、带 p2+ ext4 层的 GPT 磁盘（不是容器镜像引用）。请使用 **edge** 客户机 initramfs，而不是默认的 Alpine 或标准容器客户机 initramfs：

```powershell
$openvmm = 'C:\path\to\openvmm.exe'
$kernel = 'C:\path\to\vmlinux'
$initrd = 'C:\path\to\nvx-edge-initramfs.cpio.gz'
$image = 'C:\path\to\layers.gpt'
$hostLibrary = 'C:\path\to\aci_edge_agent.dll'
$approvedHostSha256 = '<64 hexadecimal digits from an independent trust policy>'
$stateRoot = 'C:\nvx-edge-state'

cargo run --release --locked --features agent --example agent_lifecycle -- `
    --openvmm $openvmm --kernel $kernel --initrd $initrd --image $image `
    --host-library $hostLibrary --host-sha256 $approvedHostSha256 `
    --state-root $stateRoot -- 'printf READY'
```

若要改为通过该库拉取私有镜像，请使用经过校验的捆绑包，并将 `--image` 替换为 `--image-ref`：

```powershell
cargo run --release --locked --no-default-features --features agent --example agent_lifecycle -- `
    --bundle 'C:\path\to\edge-bundle' --bundle-sha256 '<approved manifest SHA-256>' `
    --image-ref 'registry.example:5443/team/image:1' `
    --registry-auth-file 'C:\edge-secrets\registry-auth.json' --pull-timeout-ms 120000 `
    --host-library $hostLibrary --host-sha256 $approvedHostSha256 `
    --state-root $stateRoot -- 'printf READY'
```

若要只读映射 `C:\work\src`、读写映射 `C:\work\out`，并让客户机只能访问 `192.0.2.10` 的 TCP 443 端口，请在 `--` 之前添加 `--readonly C:\work\src --readwrite C:\work\out --egress deny --egress-allow 192.0.2.10:tcp:443`；`nvx::resolve_guest_path` 会给出对应的客户机路径，这里是 `/mnt/c/work/src` 和 `/mnt/c/work/out`。若要让客户机只能通过监听宿主 3128 端口的代理出站，请改为添加 `--egress deny --network-proxy http://127.0.0.1:3128`；若要访问宿主 `127.0.0.1:18080` 上 8080 端口的客户机服务，请添加 `--egress allow --host-loopback allow --host-loopback-forward tcp:18080:8080`。

请从匹配的源码单独构建原生库和静态 edge initramfs；除非以 `agent-bundled` 构建，否则此示例既不会获取也不会构建它们。请使用锁定的 OpenVMM（包含无暂存磁盘的 RAM 覆盖拓扑）及其时间 ABI 所需的 NVX 内核，例如某个发布版的 `guest/vmlinux`。OpenVMM 在每次冷启动时选择 [CPU profile](/docs/usage/)，因此在其内置 profile 都不适用的宿主机上，或宿主机 hypervisor 不支持其 profile 时，start 会以 `backend_error` 失败；错误中指定的 OpenVMM 日志会给出原因。在此类开发宿主机上，`cpuProfile: "host"`（示例中的 `--cpu-profile host`）会在宿主 profile 上启动客户机，OpenVMM 每次冷启动都从宿主 hypervisor 推导该 profile，且不会固定它。在 Linux 上，请提供匹配的 `libaci_edge_agent.so` 和 OpenVMM 构建，并选择 `--hypervisor mshv`。

### 打包的 agent（`agent-bundled`）

`agent-bundled` 特性会启用 `agent`，并让构建脚本下载、校验并暂存完整的 edge agent 捆绑包：agent 库、OpenVMM、edge 客户机内核与 initramfs、镜像工具、它们的清单以及 `SHA256SUMS`。使用它构建的程序无需指定任何路径或摘要：

```rust
use aci_edge_sandboxes::AciEdgeSandbox;
use aci_edge_sandboxes::agent::AgentConfig;

let client = AciEdgeSandbox::agent(AgentConfig::bundled("C:\\nvx-edge-state")?)?;
```

`BundledAgent::discover` 返回捆绑包的目录、运行时、库和摘要，供调用方自行设置：`bundle.config(bundle.setup(state_root).with_cpu_profile(...))`。

默认情况下，构建脚本会下载正在构建的提交所对应发布版的 `aci-edge-sandboxes.zip` 资产，名称为 `v<VERSION>-dev.<first 12 hex digits>`，其中 `<VERSION>` 是该提交的 `VERSION` 文件内容，尖括号部分是提交哈希的前 12 位十六进制数字。发布版不会为每个提交都发布捆绑包，因此如果该发布版没有，构建会使用最近一个拥有该资产的 first-parent 祖先的发布版，并以该祖先自己的 `VERSION` 命名，最多搜索 32 个提交，同时警告使用了哪一个。如果没有任何祖先拥有该资产，或无法确定提交（没有 git checkout，或 `PATH` 上没有 `git`），则构建失败。发布版不为 Linux 发布捆绑包，因此 Linux 构建需要下面某个变量。其他目标无法运行 agent 库，因此不会暂存任何内容，行为与 `bundled` 相同。当 `HEAD` 移动到其他提交或下面某个变量发生变化时，构建脚本会再次运行；请运行 `cargo clean -p aci_edge_sandboxes` 以获取之后为同一提交发布的捆绑包。当可执行文件旁的副本（见下文）被替换、更改或移除时（例如使用不同捆绑包的另一种特性配置构建），构建脚本也会再次运行，并恢复正在构建的配置所固定的捆绑包。

| 构建变量 | 作用 |
| --- | --- |
| `ACI_EDGE_SANDBOXES_AGENT_BUNDLE_URL` | 改为从 `curl` 可读取的任意 URL（例如镜像站点）下载此捆绑包 ZIP；`file://` URL 指向构建宿主机上的 ZIP |
| `ACI_EDGE_SANDBOXES_AGENT_BUNDLE_DIR` | 改为暂存此解压后的捆绑包，用于离线构建或本地构建的捆绑包 |
| `ACI_EDGE_SANDBOXES_AGENT_BUNDLE_SHA256` | 要求该 ZIP 具有此 SHA-256 |
| `ACI_EDGE_SANDBOXES_AGENT_BUNDLE=skip` | 不暂存任何内容，如同禁用该特性；`BundledAgent::discover` 随后会以 `backend_unavailable` 失败。CI 会为 `--all-features` 构建设置它 |

除非满足以下条件，否则构建失败：`SHA256SUMS` 列出的每个文件都与其匹配；捆绑包不包含链接；`SOURCE-MANIFEST.json` 是 `edge` profile 的 format-2 清单，且其固定项与 `bin/openvmm[.exe]`、`guest/vmlinux`、`guest/initramfs-edge.cpio.gz`、`bin/direct-images[.exe]` 和库匹配；`bundle-manifest.json` 描述一个完整的捆绑包，其 consumer 段指定该清单和适用于目标平台的 agent 库，并带有找到的摘要；并且该库支持本 crate 的沙箱 ABI。如果捆绑包记录的 NVX 提交与它应来自的提交不同，构建会发出警告。这些检查证明捆绑包完整，而不证明它已获授权：信任来自下载源，可用 `ACI_EDGE_SANDBOXES_AGENT_BUNDLE_SHA256` 固定。解压 ZIP 需要构建宿主机上有 bsdtar（Windows 自带的 `tar`）或 `unzip`。

构建脚本将捆绑包暂存到其输出目录（依赖方的构建脚本会将其读取为 `DEP_ACI_EDGE_SANDBOXES_AGENT_ARTIFACTS_DIR`），并把它复制到 Cargo profile 目录（例如 `target/release`）中 `aci-edge-sandboxes` 目录下、Cargo 构建的可执行文件旁边。本 crate 只会将捆绑包的 `SOURCE-MANIFEST.json` 和库的 SHA-256 摘要编译进去。`BundledAgent::discover` 按以下顺序查找：

1. `ACI_EDGE_SANDBOXES_AGENT_ARTIFACTS_DIR` 指定的目录（当其已设置且非空时）。该目录中必须存有捆绑包的副本；发现过程不会回退。
2. 当前可执行文件旁边的 `aci-edge-sandboxes/` 目录（如果其中存有该捆绑包）。
3. 可执行文件所在目录的相邻目录（即其父目录）中的 `aci-edge-sandboxes/`，用于服务 Cargo 的 `examples/` 和 `deps/`。

因此，只要相对位置保持不变，可执行文件与 `aci-edge-sandboxes` 目录一起复制到别处后仍可工作；如果捆绑包中的文件与编译时写入的摘要不符，宿主会拒绝该捆绑包。当 Cargo 的 `build-dir` 不是 target 目录时，副本会放到那里，并且只服务于测试可执行文件；对于其他可执行文件，请从 `DEP_ACI_EDGE_SANDBOXES_AGENT_ARTIFACTS_DIR` 将捆绑包复制到可执行文件旁，或设置 `ACI_EDGE_SANDBOXES_AGENT_ARTIFACTS_DIR`。

以 `agent-bundled` 构建后，[`examples/agent_lifecycle.rs`](https://github.com/microsoft/nvx/blob/dev/aci_edge_sandboxes/examples/agent_lifecycle.rs) 无需任何选项即可运行：

```powershell
cargo run --release --locked --features agent-bundled --example agent_lifecycle
```

它使用暂存的捆绑包和库，将状态保存在可执行文件旁的 `aci-edge-sandboxes-state/` 中，启动 `mcr.microsoft.com/azurelinux/base/core:3.0`，并运行 `printf READY; echo; head -n 2 /etc/os-release`。每个选项仍会覆盖其默认值，`--bundle`、`--openvmm` 或 `--host-library` 选项会替换暂存的运行时或库。

### 原生宿主路径与网络

原生后端接受与直接后端相同的 `filesystem` 和 `network` 策略：它把宿主路径映射到相同的客户机路径，并以相同方式展开网络规则；参见[宿主路径](#宿主路径)和[网络规则](#网络规则)。与直接后端不同，它按下面的规则为所有映射路径导出一个目录。它还会拒绝会让工作负载看到其状态根目录的映射（详见下文）。其工作负载以客户机的 root 身份运行。库在预配时规划策略：解析映射路径和被拒绝路径、选择导出、固定读写映射内的对象、展开网络规则，沙箱记录会保存生成的计划。每次启动都会依据所有无需宿主访问的规划规则重新检查该计划，并检查被固定的对象：如果某个对象已被替换，启动会以 `backend_error` 失败，必须取消预配并重新预配该沙箱才能接受更改。

- 状态根目录保存每个沙箱的记录，因此也保存其计划；计划决定下一次启动导出什么、允许哪些出站，以及客户机可访问或发布哪些宿主回环端口。启动时的检查能发现受损的计划，但无法发现被改成另一种本可由规划产生的计划，因此只有调用方可以写入状态根目录。所以，对于位于状态根目录内的映射路径，以及包含状态根目录的映射路径（除非映射内的被拒绝路径将其隐藏），provision 会以 `policy_validation` 拒绝。
- OpenVMM 通过一个 virtio-fs 设备导出包含所有映射路径的最深目录；除非某个路径是读写，否则导出为只读，并隐藏被拒绝的路径。客户机将导出挂载在工作负载无法到达的位置，并把每个映射路径绑定挂载到 RAM 覆盖层中其客户机路径处，按需设为只读。绑定挂载通过客户机 1024 字节的内核命令行传递，大约能容纳十几个典型路径；如果挂载项放不下，provision 会以 `policy_validation` 拒绝该策略。
- 被拒绝的路径会通过其别名保持隐藏：`..`、宿主符号链接和 junction、工作负载创建的链接，以及被拒绝对象的其他名称（例如指向被拒绝文件的宿主硬链接）。OpenVMM 从不在宿主上跟随链接，因此客户机自行解析每个链接，每次查找被拒绝路径都会以 `EACCES` 失败；Windows 绝对符号链接或 junction 完全无法跟随（`EPERM`）。OpenVMM 只识别被拒绝对象本身：如果宿主硬链接已经把被拒绝目录内的文件连接到目录外的名称，那么通过该名称仍可读取。包含指向被拒绝文件的宿主硬链接的目录可能会列出该链接的名称，而同时查找其条目的目录列举（如客户机首次读取目录时）会以 `EACCES` 失败。
- 工作负载以客户机的 root 身份运行，仅具有默认容器能力（`CHOWN`、`DAC_OVERRIDE`、`FOWNER`、`FSETID`、`KILL`、`SETGID`、`SETUID`、`NET_BIND_SERVICE` 和 `AUDIT_WRITE`），启用 `no_new_privs`，且没有用户命名空间，因此无法重新挂载或卸载映射路径，也无法再次挂载导出。通过读写映射进行的宿主侧更改（包括模式和所有权）使用运行 OpenVMM 的账户凭据，因此请以非特权身份运行 OpenVMM。如果宿主硬链接已经把读写映射中的文件连接到只读映射中的文件，那么通过读写路径仍可写入。
- 如果策略拒绝出站且没有允许规则或代理，则不会挂接网络设备。否则，客户机会获得其 spec 的 `guestNetwork`，或设置的默认值（未设置时为 `10.0.0.2/24`），位于 OpenVMM 的 NAT 网关（网络的第一个地址）之后。OpenVMM 还会给客户机一个嵌入此网络的 IPv6 网络 `fd00::/96`，例如 `fd00::a00:2/120`，位于网关对应地址（例如 `fd00::a00:1`）之后。当策略允许访问网关的 TCP 或 UDP 端口 53 时，客户机在 `/etc/resolv.conf` 中将网关设为其 DNS 服务器；否则，如果策略允许对该网关的 IPv6 地址使用 DNS，则使用该地址。请选择不包含客户机必须访问的地址的客户机网络。与 [OpenVMM 后端](#网络规则)不同，入站必须为 `deny`；宿主回环访问可以独立允许，如下所述。

### 原生代理与宿主回环

使用代理时，一般宿主回环访问保持拒绝。通用监听器发布和显式转发需要允许宿主回环访问。

- `runtimeConfig.networkProxy`（`ProvisionRequest::with_network_proxy`）指定一个监听宿主 IPv4 回环的 HTTP 或 HTTPS 代理，例如 `http://127.0.0.1:3128` 或 `http://localhost:3128`：必须有显式端口，端口后最多只能有一个尾部 `/`。与 MXC 的 schema 一样，代理是客户机唯一的出站途径，因此网络策略必须拒绝出站且不带允许或拒绝规则；provision 会以 `policy_validation` 拒绝其他策略，以及 IPv6 或远程代理。客户机唯一可到达的目的地是通往其网关代理端口的 TCP，OpenVMM 会连接到该代理；客户机无法访问 DNS 服务器，因此由代理解析名称。每个工作负载都会获得指向网关处代理的 `HTTP_PROXY`、`HTTPS_PROXY`、`http_proxy` 和 `https_proxy`（例如 `http://10.0.0.1:3128`），以及设置为 `localhost,127.0.0.1` 的 `NO_PROXY` 和 `no_proxy`；因此，HTTPS 代理的证书必须对网关地址有效。
- `network.ingress.hostLoopback: allow` 允许客户机通过其网关访问宿主回环服务，并将客户机绑定到非回环地址的每个 TCP 或 UDP 监听器发布到宿主 IPv4 或 IPv6 回环的同一端口，无需端口列表。仅绑定到客户机 `127.0.0.1` 或 `::1` 的监听器保持为沙箱私有；OpenVMM 从不在 LAN 或公共接口上发布监听器，也不会挤占已占用该端口的宿主监听器；对宿主的应答不受出站策略影响。它需要 `/29` 或更大的客户机网络：OpenVMM 会在其网络的某个地址上向客户机呈现宿主对端，而 `/30` 无法腾出这样的地址。
- 沙箱 spec 的 `hostLoopbackForwards`（`SandboxSpec::with_host_loopback_forward`，传给 `AciEdgeSandbox::provision_with`）会在宿主回环上再发布最多 64 个客户机端口：OpenVMM 监听 `127.0.0.1:hostPort`，并将每个 TCP 连接或 UDP 数据报转发到客户机的 `guestPort`。端口必须非零，且每种协议中主机端口和客户机端口各自最多出现一次，因为 OpenVMM 为每个客户机端口保留一个转发监听器。转发的端口需要 `network.ingress.hostLoopback: allow`。客户机会以 OpenVMM 在客户机网络内分配的地址应答转发流量，因此出站默认值必须为 `allow`，这会使客户机的其他出站保持开放，并且任何拒绝规则都不得覆盖客户机网络。

只有客户机可以设置代理变量：如果某个 exec 的 `process.env` 以任意大小写指定了其中任一变量，无论是否使用代理，都会以 `policy_validation` 失败。

### 原生工作目录与环境

`process.cwd` 必须是不含 `..`、最多 4095 字节的绝对客户机路径，与直接后端相同；`nvx::resolve_guest_path` 可给出映射宿主路径对应的客户机路径。如果工作负载无法进入某个目录，命令会以退出码 126 结束，并在标准错误中输出一行 `NVX-EDGE-STAGE-ERROR`。客户机的默认环境只包含 `PATH`（`/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`）和代理变量。`process.env` 只能通过 `inheritDefaultEnv: true` 叠加在其上，最多 256 个条目、总计不超过 32 KiB；替换默认环境会以 `policy_validation` 失败。同名条目中，较后的条目会替换较前的条目；条目会替换同名的默认值。

调用方必须独立批准并保护原生资产。校验调用方提供的摘要并不能使可写路径或自声明的摘要变得可信；仅应将此配置用于不可变且经外部授权的库安装。

## OpenVMM 后端

### 配置

`OpenVmmConfig` 指定产物、hypervisor 和状态根目录：

| 构造函数 | 产物 |
| --- | --- |
| `OpenVmmConfig::discover` | 由 `nvx::Artifacts::discover` 定位；hypervisor 来自 `NVX_HYPERVISOR` 或平台默认值，状态根目录为默认值 |
| `OpenVmmConfig::from_artifacts` | 一个 `nvx::Artifacts` 值 |
| `OpenVmmConfig::from_release_dir` | 解压后的发布版中的 `bin/openvmm[.exe]`、`guest/vmlinux` 和 `guest/initramfs.cpio.gz` |
| `OpenVmmConfig::from_repo_layout` | 检出目录中的 `openvmm/target/release/openvmm[.exe]`、`build/vmlinux` 和 `build/initramfs.cpio.gz` |
| `OpenVmmConfig::new` | 显式路径 |

发布版和仓库布局构造函数要求 `SOURCE-MANIFEST.json` 的控制契约 `nvx-microvm-v2-control-v2`。initramfs 是 Alpine 镜像：其用户态即工作负载的环境，其托管 agent 提供控制台服务。

### 产物

`nvx::Artifacts` 保存 OpenVMM 可执行文件、客户机内核和 Alpine initramfs。

`nvx::Artifacts::discover` 采用第一个存在的来源：

1. `NVX_OPENVMM`、`NVX_KERNEL` 和 `NVX_INITRD`，必须同时设置。
2. `NVX_ARTIFACTS_DIR`，指向解压后的发布版或仓库检出目录。包含发布版 `bin/openvmm[.exe]`、`guest/vmlinux` 或 `guest/initramfs.cpio.gz` 的目录被视为发布版；其他任何目录都被视为检出目录，其 `guest/` 目录仅保存源码。
3. 当前可执行文件旁边采用发布布局的 `nvx/` 目录。
4. 由 `bundled` 特性在构建时暂存的捆绑包。

`bundled` 特性会启用 `nvx-rs` 的 `bundled` 特性，后者构建脚本会在其输出目录中暂存 `bin/`、`guest/`、`SOURCE-MANIFEST.json` 和 `SHA256SUMS`，`nvx::Artifacts::bundled` 会返回它们。捆绑包来自以下两个来源之一：

- `NVX_BUNDLE_DIR` 指向解压后的发布版，用于离线构建或本地构建的产物。
- 否则，构建脚本使用 `curl` 下载 [`nvx-rs/artifacts.json`](https://github.com/microsoft/nvx/blob/dev/nvx-rs/artifacts.json)（英文原文）中固定的发布包，并使用 `tar` 解压。Windows 包是 ZIP 归档，GNU tar 无法读取，因此为 Windows 构建需要构建宿主机上有 bsdtar（Windows 自带的 `tar`）或 `unzip`。`NVX_BUNDLE_HYPERVISOR=mshv` 会选择 Linux MSHV 包而不是 KVM。

每个暂存文件都必须与源的 `SHA256SUMS` 匹配，下载内容必须与其固定的摘要匹配。暂存目录位于 Cargo 的构建输出中，因此可服务于构建机上的开发和测试。要部署，请将其以 `nvx/` 复制到可执行文件旁。依赖本 crate 的 crate 的构建脚本会以 `DEP_ACI_EDGE_SANDBOXES_ARTIFACTS_DIR` 收到其路径，本 crate 的构建脚本会从 `nvx-rs` 传递该路径；直接依赖 `nvx-rs` 的 crate 会以 `DEP_NVX_ARTIFACTS_DIR` 收到它。`NVX_BUNDLE=skip` 会关闭暂存，CI 在 `--all-features` 构建中使用它。

> OpenVMM 后端需要兼容的 NVX 客户机镜像。`start` 会以 `backend_unavailable` 拒绝不兼容的镜像，而不是在没有所请求策略保证的情况下运行。
>
> 构建脚本只会暂存 `SOURCE-MANIFEST.json` 声明了 `nvx-rs` 控制契约的发布版。契约变更后，下载锁定发布版的 `bundled` 构建会失败，直到 [`nvx-rs/artifacts.json`](https://github.com/microsoft/nvx/blob/dev/nvx-rs/artifacts.json)（英文原文）指向具有新契约的发布版，因此一旦发布就应重新固定。在此之前，请使用 `NVX_BUNDLE_DIR` 暂存当前构建。

默认值：

| 字段 | 默认值 |
| --- | --- |
| `memory_mib` | 256（预配请求可通过 `microvm.provision.memoryMib` 覆盖） |
| `workload_uid`、`workload_gid` | 65534，即 Alpine 的 `nobody` |
| `hostname` | `nvx-sandbox`，通过内核的 `hostname=` 参数设置 |
| `guest_network` | `10.0.0.2/24` |
| `start_timeout`、`control_timeout` | 60 秒 |
| `stop_timeout`、`exec_response_grace` | 30 秒 |

每个超时最长 30 天（`OpenVmmConfig::MAX_TIMEOUT`），除 `exec_response_grace` 外都必须为正数。`guest_network` 必须是 OpenVMM 接受的地址：/1 到 /30 前缀，且不能是网络自身地址、广播地址或第一个地址（即网关）。

请选择仅当前用户可访问的 `state_root`。`OpenVmmConfig::default_state_root` 在 Windows 上返回 `%LOCALAPPDATA%\nvx\sandboxes`，在其他平台上返回 `$XDG_STATE_HOME/nvx/sandboxes`（默认为 `~/.local/state/nvx/sandboxes`）。

### 如何运行 OpenVMM

- **预配。** 校验请求并将其记录到 `<state_root>/<token>/sandbox.json`。不会运行任何 VM。
- **启动。** 使用托管生命周期（`--microvm-lifecycle managed`）、工作负载身份和经过认证的控制台启动 OpenVMM，但不使用任何沙箱块设备。因此客户机 init 停留在其 Alpine 根文件系统中，并直接启动托管 agent。
  - 一个全新的 32 字节能力通过 OpenVMM 的标准输入管道传递，该管道在 OpenVMM 启动前关闭。
  - 在启动 OpenVMM 之前，启动会将控制端点记录到 `launch.json`。如果调用方在记录 OpenVMM 进程身份之前死亡，对沙箱的下一个操作会通过该端点找到 VM 并终止它，因此不会留下未跟踪的 VM。
  - OpenVMM 与调用方分离运行：在 Linux 上处于新会话中，在 Windows 上不共享调用方的控制台。除标准输入和日志外，它不继承调用方的任何句柄，因此即使调用方自己的输出是管道（例如 MXC 阶段进程），它在退出时仍能到达文件末尾。
  - 当客户机 agent 在控制台上应答、通告此后端所需的控制特性，并已挂载每个映射的宿主路径后，启动返回。缺少任何特性的客户机会被终止，启动会以 `backend_unavailable` 失败。
- **执行。** 连接到控制台，进行认证，并实时流式传输工作负载的输出。agent 通过 `setpriv` 以工作负载身份运行工作负载，不赋予能力并启用 `no_new_privs`，且位于其自己的 cgroup 中。每次执行都有自己的[工作目录](#工作目录)和[环境](#环境)。当工作负载的第一个进程退出时，agent 会杀死它遗留的所有进程，包括其他会话中的进程，因此没有工作负载进程会活得比其 exec 更久。
- **停止。** 请求客户机关闭。如果客户机未在 `stop_timeout` 内完成，则终止 OpenVMM。工作负载写入的所有内容都会被丢弃，因为根文件系统位于客户机内存中。
- **取消预配。** 删除状态目录。它会拒绝删除包含意外文件的目录。

后端保存持久化的生命周期状态，并在每次操作前与 OpenVMM 进程核对。因此，操作可以从不同的调用方进程安全运行，而不会遗忘正在运行的 VM。在 Windows 上，如果调用方运行在某个作业对象内，而该作业对象会在调用方退出时终止 VM，请设置 `breakaway_from_job`。

### 策略支持矩阵

| 字段 | 预配 | 执行 |
| --- | --- | --- |
| `filesystem.readonlyPaths`、`readwritePaths` | 映射到客户机；参见[宿主路径](#宿主路径) | 不适用 |
| `filesystem.deniedPaths` | 隐藏在映射路径内 | 不适用 |
| `network.egress.default` | 应用（`allow` 或 `deny`） | 不适用 |
| `network.egress.allow`、`deny` | 应用；参见[网络规则](#网络规则) | 不适用 |
| `network.ingress.default` | 应用（`allow` 或 `deny`）；参见[网络规则](#网络规则) | 不适用 |
| `network.ingress.hostLoopback` | 应用（`allow` 或 `deny`，省略时为 `deny`）；参见[网络规则](#网络规则) | 不适用 |
| `spec.hostLoopbackForwards`（ACI Edge Sandboxes 扩展） | 应用；参见[网络规则](#网络规则) | 不适用 |
| `microvm.provision.memoryMib` | 应用 | 不适用 |
| `process.commandLine` | 不适用 | 作为 `/bin/sh -c <commandLine>` 运行；最多 4096 字节 |
| `process.argv`（ACI Edge Sandboxes 扩展） | 不适用 | 应用；绝对程序路径，最多 64 个参数，每个 4096 字节 |
| `process.cwd` | 不适用 | 应用；最多 4095 字节的绝对客户机路径，省略时为 `/`；参见[工作目录](#工作目录) |
| `process.timeout` | 不适用 | 应用，最多 4,294,967,295 毫秒（约 49.7 天），即 MXC 允许的上限；`0` 表示禁用 |
| `process.env`、`inheritDefaultEnv` | 不适用 | 按每次执行应用；参见[环境](#环境) |
| 管道标准输入 | 不适用 | 拒绝；工作负载读取到文件末尾 |

工作负载以配置的非 root 身份运行，最多可写入合计 1 MiB 的输出。更大的输出会以 `Failed(OutputLimitExceeded)` 结束。

### 工作目录

每次执行都从它请求的工作目录开始，先前执行不会留下任何残留。

- 没有 `process.cwd` 时，工作负载从客户机的根目录 `/` 开始。
- `process.cwd` 必须是最多 4095 字节的绝对客户机路径。相对路径会在任何内容运行前以 `policy_validation` 拒绝；`nvx::resolve_guest_path` 可将映射的宿主路径转换为客户机路径。
- 客户机 agent 会在工作负载启动前，以工作负载自身的身份进入该目录；除非 `process.env` 替换了环境，否则会将 `PWD` 指向该目录。对于包含空组件、`.` 或 `..` 的路径，`PWD` 会改用该目录的物理路径。
- 目录不存在、不是目录，或工作负载无法搜索它时，启动会失败，后端绝不会回退到其他目录。不会运行任何内容，工作负载的标准错误会收到类似 `nvx-managed-agent: cannot enter working directory /work: No such file or directory` 的诊断信息，执行以 `Failed(WorkingDirectory)` 结束。
- 如果客户机镜像的 agent 无法以这种方式拒绝不可用的工作目录，启动会以 `backend_unavailable` 拒绝该镜像。

### 环境

每次执行都从自己的环境开始，因此先前执行不会留下任何内容。`process.env` 和 `process.inheritDefaultEnv` 遵循 MXC 的 schema：

| `process.env` | `inheritDefaultEnv` | 工作负载获得 |
| --- | --- | --- |
| 省略 | 忽略 | 默认环境 |
| `[]` | `false`（默认） | 空环境 |
| `[]` | `true` | 默认环境 |
| `["FOO=bar", "EMPTY="]` | `false`（默认） | 恰好 `FOO=bar` 和 `EMPTY=` |
| `["FOO=bar"]` | `true` | 默认环境加上 `FOO`；同名条目会替换默认值 |

默认环境是客户机自身的环境，绝不包含宿主变量：`PATH=/usr/sbin:/usr/bin:/sbin:/bin`、`TERM=linux`、工作负载身份的 `HOME`、`USER` 和 `LOGNAME`，以及指向工作目录的 `PWD`；此外还有客户机启动遗留的少数变量（`SHLVL` 以及 `nvx_lifecycle` 等内核参数），工作负载不应依赖它们。

在 Rust 中，省略 `process.env` 时 `ProcessSpec::env` 为 `None`，而 `[]` 对应空列表的 `Some`；`"env": null` 无法反序列化，因为 MXC 的 schema 只允许数组。`ExecRequest::with_env` 添加一个条目，`ExecRequest::with_envs` 设置整个列表，`ExecRequest::with_inherit_default_env` 设置该标志。

- 条目是 `KEY=VALUE` 字符串。值可以包含除 NUL 之外的任何内容，例如空格、引号、换行、`=`，也可以为空；工作负载会按原样收到它，不经过 shell 解释。没有 `=` 或名称为空的条目属于 `malformed_request`。
- exec 请求将条目放在独立字段中，与参数和工作目录并列，因此不会占用参数限制。最多 256 个名称唯一的条目，每个最多 4096 字节，整个请求最多 64 KiB。重复名称，或更多、更长的条目，会在任何内容运行前触发 `policy_validation`。
- 客户机 agent 以工作负载身份进入工作目录，并在降低工作负载权限后、启动程序前应用这些条目。因此工作负载保持其身份、无能力并启用 `no_new_privs`；`process.argv` 程序会精确收到所请求的环境，在工作目录中也是如此。通过 `process.argv` 运行 `/usr/bin/env` 即可查看。
- `process.commandLine` 在 `/bin/sh` 中运行，而该 shell 就是工作负载，因此它会导出自己的变量：BusyBox 的 `sh` 会设置 `SHLVL` 和 `PWD`，替换同名条目，就像它对任何脚本所做的那样。

### 宿主路径

映射的宿主路径按 MXC 的 WSLc 后端方式出现在客户机中：Windows 路径 `C:\work\src` 出现在 `/mnt/c/work/src`，绝对 Linux 路径出现在相同路径。宿主路径可以包含逗号（MXC 的 `readonlyPaths` 和 `readwritePaths` 允许），因此 `C:\reports\2026, final` 出现在 `/mnt/c/reports/2026, final`。客户机路径派生自解析后的宿主路径，因此链接、字母大小写和 Windows 短名称不会为同一对象创建第二个客户机路径。`nvx::resolve_guest_path` 执行相同的转换，例如把宿主工作目录转换为 `process.cwd`；`nvx::guest_path` 按书写原样转换路径。

- OpenVMM 提供一个 virtio-fs 设备，后端将其作为聚合挂载：一个合成的只读根，列出每个子项对应的一个导出宿主目录或文件，挂载在 `/run/nvx/hostfs/root`，这是只有客户机 root 才能进入的客户机目录。子项是最外层的映射目录及其外的映射文件，因此映射路径可以位于任何位置、任何卷上。随后，客户机 agent 将每个映射路径绑定挂载到其客户机路径，按需只读或读写，因此工作负载只能看到映射路径。
- 宿主强制执行每个映射的访问权限。只有包含读写映射的子项才是读写；随后 OpenVMM 将写入限制在其读写映射内，因此只有读写映射内的只读路径仅通过客户机的绑定挂载保持只读。OpenVMM 单独导出映射文件：客户机既无法访问其同级文件，也无法访问其所在目录，无法列出、检查或更改该目录；因此读写文件可以原地重写，但不能被替换、重命名或删除。OpenVMM 按名称解析文件，因此客户机看到的是宿主程序（例如编辑器）覆盖保存后的文件；当占用该名称的不是常规文件时，对该文件的访问会以 `EACCES` 失败。如果映射文件被目录替换，或映射目录被文件替换，启动会拒绝运行该沙箱，OpenVMM 也会拒绝这样的子项，因此文件授权绝不会变成目录授权。拒绝映射整个卷（`/` 或 `C:\`）；请映射其中的目录。
- 导出目录内的被拒绝路径由 OpenVMM 本身隐藏：它们不会出现在列表中，也无法通过任何名称访问；例外是指向被拒绝目录内文件的宿主硬链接，OpenVMM 无法将其与其他文件区分开。在其导出目录之下，OpenVMM 隐藏或单独列出的路径（例如只读路径中的读写路径）不得包含冒号、反斜杠、链接或除空格之外的空白字符，其中任何名称都不得以空格开头或结尾。
- 映射路径必须存在，且必须是目录或常规文件。同时列为只读和读写的路径按只读映射。被拒绝路径不得包含映射路径；尚不存在的被拒绝路径不得位于映射路径内，因为一旦工作负载创建它，就没有任何机制能隐藏它。在 Windows 宿主上，文件以不区分大小写的方式打开，因此读写目录内的只读文件会被拒绝。覆盖客户机自身系统目录（`/usr`、`/etc` 等）的映射会被拒绝。违规会报告为 `policy_validation`。
- 一个沙箱最多通过 256 个子项映射 4096 个路径。如果某个策略的映射目录及其外的映射文件需要更多子项，该策略会被拒绝，而不会通过包含这些文件的目录来提供服务（那会授予超出文件本身的权限）；请改为映射包含这些文件的目录。在每个导出目录中，OpenVMM 最多隐藏 128 个被拒绝路径，并最多单独列出 128 个位于只读路径内的读写路径。
- 在每个宿主上，OpenVMM 的命令行都必须符合 Windows 进程命令行 32,767 字符的限制，并保留 1,024 个字符，这通常能容纳数百个路径。provision 会以 `policy_validation` 拒绝超出这些限制的策略，也会拒绝其子项会两次导出同一对象的策略，例如两个指向同一文件的映射宿主硬链接。保留量用于吸收预配后变长的已配置路径；如果命令行完全放不下，启动会以 `policy_validation` 拒绝。
- 预配会记录读写映射内每个映射对象和被拒绝对象的身份，如果其中某个对象发生变化，启动会拒绝运行；因此工作负载无法重命名被拒绝或只读对象，并在其路径上留下诱饵供下一次启动使用。读写映射之外的对象不会被固定，因此替换它们的宿主编辑不会阻止重启。
- 启动通过控制通道将映射表交给客户机 agent，每个请求都适合一条 64 KiB 的控制记录；内核命令行只携带条目数量。agent 在挂载每个条目之前会拒绝工作负载，如果无法挂载某个条目，启动会失败。早于映射表的客户机镜像不会通告其控制特性，因此启动会拒绝它们。
- 在 Windows 宿主上，映射文件显示为 root 所有，模式为 `0777`，因此工作负载身份可以读取它们，对于读写路径还可以写入。在 Linux 宿主上，virtio-fs 原样显示宿主所有者和模式；在启用 `map_host_identity`（默认）时，映射宿主路径的沙箱会以调用用户的 ID 运行其工作负载，客户机会为它们创建账户。

只有客户机内核能让读写映射内的只读路径保持只读，因此请优先选择不被任何读写映射包含的只读路径。

### 网络规则

OpenVMM 的可移植网络配置强制执行出站默认值以及 IPv4 和 IPv6 允许/拒绝规则；拒绝规则优先，且规则只匹配其网络所属地址族的目标，因此拒绝的默认值会阻止另一个地址族。每条规则列出目标网络（`to`，每个都是 CIDR，可带 `except` 子网）和目标 `ports`（协议、`port`、可选的 `endPort`）。空的 `to` 匹配两个地址族的所有目标，例如同时匹配 `0.0.0.0/0` 和 `::/0`；空的 `ports` 匹配所有协议和端口。不带 `port` 的 `tcp` 或 `udp` 条目匹配该协议的所有端口；带 `port` 和 `endPort` 的条目匹配从 `port` 到 `endPort` 的所有端口；`icmp` 条目仅匹配 ICMP，对于 IPv6 网络则匹配 ICMPv6；`any` 匹配所有协议，或在带端口/端口范围时匹配这些端口上的 TCP 和 UDP。

规则通过编译 NVX 出站策略文件的同一下沉过程精确转换为 OpenVMM 规则（[`nvx::host::network::policy`](https://github.com/microsoft/nvx/blob/dev/nvx-rs/src/host/network/policy/mod.rs)（英文原文））：从网络中减去例外；带端口或端口范围的协议 `any` 变为一条 TCP 规则和一条 UDP 规则；每个动作的目标合并为覆盖它们的最少网络；针对某协议所有端口或所有协议的规则会包含其覆盖的更窄规则；网络中重叠和相邻的端口范围合并为一条范围规则。每个动作的规则按地址族、地址、前缀长度、协议和端口顺序传递，仍需要超过 256 条 OpenVMM 规则的动作会被拒绝。网络的读取方式与策略文件相同，因此会清除主机位，并接受 `/255.255.0.0` 这类 IPv4 子网掩码，但请求校验仍会在后端看到它们之前拒绝这两者。拒绝出站且没有允许规则、同时拒绝入站和宿主回环时，不会挂接网络设备；否则客户机会获得 `10.0.0.2/24`，位于配置文件的 NAT 网关 `10.0.0.1`（同时提供 DNS）之后，以及 `fd00::a00:2/120`，位于网关的 IPv6 地址 `fd00::a00:1` 之后。

当 `network.ingress.default: allow` 时，OpenVMM 会在工作负载开始监听后约一秒内，在工作负载监听的每个 TCP 和 UDP 端口上监听所有宿主地址，并将宿主私有网络（其地址不能全局路由）中的客户端转发到客户机。它会拒绝其他客户端、客户机网络内的客户端（客户机会把它们当作邻居）、IPv6 链路本地客户端，以及宿主本身，除非 `network.ingress.hostLoopback` 为 `allow`。对已接纳客户端的应答不受出站策略影响。宿主进程已占用的端口不会被发布；其他主机上的客户端需要宿主防火墙放行才能访问 OpenVMM；参见[私有网络入站](/docs/run/)。

当 `network.ingress.hostLoopback: allow` 时，工作负载与宿主回环之间的访问是双向的：工作负载通过其网关访问宿主回环服务（例如宿主 `127.0.0.1:8080` 上的服务可通过 `10.0.0.1:8080` 访问），并受出站策略约束；宿主也可以访问工作负载。未允许入站时，OpenVMM 仅在工作负载于非回环地址监听的每个 TCP 和 UDP 端口上监听宿主 IPv4 和 IPv6 回环，只接纳宿主，并让对宿主的应答不受出站策略影响；客户机回环上的工作负载监听器保持私有，宿主进程已占用的端口不会被发布。宿主回环访问需要 `/29` 或更大的 `guest_network`，因为 OpenVMM 会在该网络的某个地址上向工作负载呈现宿主对端；允许对 `/30` 使用宿主回环访问的策略会以 `policy_validation` 失败。沙箱 spec 的 `hostLoopbackForwards`（`SandboxSpec::with_host_loopback_forward`，传给 `AciEdgeSandbox::provision_with`）会在自行选择的客户机端口上再发布最多 64 个宿主回环端口，每种协议和客户机端口一个转发。它们需要允许宿主回环访问，并且由于工作负载会在 OpenVMM 于客户机网络内分配的地址上应答它们，还需要出站默认值为 `allow` 且没有覆盖客户机网络的拒绝规则；参见[宿主回环访问](/docs/run/)。

### 幂等性与并发

- 每次预配都会创建新沙箱。
- 对运行中的沙箱执行 `start` 会以 `already_started` 失败，对已停止的沙箱执行 `stop` 会以 `already_stopped` 失败。
- 取消预配运行中的沙箱会以 `already_started` 失败；请先停止它。取消预配后，每次调用都会以 `stale_id` 失败且不写入任何状态；使用从未预配过的 ID 调用也是如此。
- 同一沙箱的生命周期转换由锁文件串行化。
- 执行是串行进行的：并发 exec 会最多等待 `control_timeout`，直到正在运行的执行完成。
- `stop` 会等待正在运行的 exec 直到 `stop_timeout`，然后终止 VM；该 exec 随后失败。
- `Canceller::cancel` 会在 20 毫秒内向客户机发送 `CANCEL`。agent 会杀死工作负载 cgroup 中的每个进程，执行以 `Cancelled` 结束。取消已经完成的执行不会有任何效果。一旦发送取消，缺失的响应会在 `control_timeout` 或更早的工作负载响应截止时间内以 `backend_error` 失败，即使工作负载没有超时也是如此。

### 错误映射

| 条件 | `ErrorCode` | 协议码 |
| --- | --- | --- |
| 请求形状无效、相对路径或非 UTF-8 路径、`memoryMib` 为零、`process.timeout` 超过 4,294,967,295 毫秒 | `MalformedRequest` | `malformed_request` |
| ID 缺少 `aci-edge-sandboxes:` 前缀，或不是 32 位小写十六进制令牌 | `MalformedId` | `malformed_id` |
| 该 ID 没有状态目录（从未预配，或已取消预配） | `StaleId` | `stale_id` |
| 对已停止沙箱执行 `exec`，或 VM 已死亡 | `NotStarted` | `not_started` |
| 对运行中的沙箱执行 `start` 或 `deprovision` | `AlreadyStarted` | `already_started` |
| 对已停止的沙箱执行 `stop` | `AlreadyStopped` | `already_stopped` |
| 不支持策略或 exec 特性、命令过大、`process.cwd` 为相对路径或过大 | `PolicyValidation` | `policy_validation` |
| 缺少 OpenVMM 产物、hypervisor 不可访问、发布版或客户机镜像不兼容、宿主不受支持 | `BackendUnavailable` | `backend_unavailable` |
| OpenVMM 启动失败、启动超时、控制会话失败、I/O 错误 | `BackendError` | `backend_error` |

启动失败会指明 OpenVMM 日志，即 `OpenVmmBackend::log_path`。

后端保留 `nvx` 错误的消息，并将其种类映射到这些错误码：`Unavailable` 变为 `backend_unavailable`，`Unsupported` 变为 `policy_validation`，当 exec 发现沙箱的 VM 已消失时 `Exited` 变为 `not_started`，其他所有种类都变为 `backend_error`。同一转换（不含 exec 情况）可将任何 `nvx::Error` 转换为 `Error`。

### 元数据

| 操作 | 字段 |
| --- | --- |
| provision | 无 |
| start | `bootMilliseconds`：从启动到客户机就绪的时间 |
| stop | `forced`：是否必须终止 OpenVMM；`vmOutcome`、`vmStatusCode`、`teardownComplete`：OpenVMM 结果报告的摘要 |
| deprovision | 无 |

### 安全说明

- 能力从不出现在参数、环境变量、日志或端点名称中。它仅在 VM 启动或运行期间存储在仅所有者可访问的文件中。
- 客户端只与它启动的 OpenVMM 进程通信：
  - 在 Linux 上，Unix 套接字位于仅所有者可访问的状态目录中，其对端必须是该进程（`SO_PEERCRED`）。
  - 在 Windows 上，命名管道服务器必须是该进程（`GetNamedPipeServerProcessId`），并且管道以 SQOS 标识方式打开，使服务器无法冒充客户端。
- 客户端校验每条客户机记录，并自行执行输出限制。
- 终止操作绝不会向被复用的进程 ID 发送信号：Linux 使用 pidfd 固定进程（强制停止需要 Linux 5.3 或更高版本），Windows 则持有进程句柄。
- `WinHvPlatform.dll` 是动态加载的，因此该 crate 可以在没有 Windows Hypervisor Platform 的宿主上加载。

## 测试

```bash
cargo test --all-features   # unit, mock, and fake-OpenVMM tests; no hypervisor needed
python3 scripts/nvx.py test-agent-bundling   # agent bundle staging (repository root)
python3 scripts/nvx.py test-aci-edge-sandboxes --backend kvm   # real VM (repository root)
```

对于不应下载锁定发布版或 edge agent 捆绑包的 `--all-features` 构建，请设置 `NVX_BUNDLE=skip` 和 `ACI_EDGE_SANDBOXES_AGENT_BUNDLE=skip`。`nvx.py test-agent-bundling`（由 [`check-aci-edge-sandboxes`](https://github.com/microsoft/nvx/blob/dev/.github/actions/check-aci-edge-sandboxes/action.yml)（英文原文）action 运行）通过 `ACI_EDGE_SANDBOXES_AGENT_BUNDLE_DIR` 暂存合成 agent 捆绑包，打包 agent 的测试必须能找到它，并检查构建会拒绝其损坏副本；它既不需要 hypervisor，也不需要可运行的 agent 库。NVX 机制也在 [`nvx-rs`](/docs/nvx-rs/) 中测试，拥有自己的单元测试、黄金协议测试夹具和伪 OpenVMM 生命周期测试。

- `testing::MockBackend` 为使用方的单元测试编排执行。
- `aci-edge-sandboxes-fake-openvmm` 二进制文件（特性 `testing`）模拟 OpenVMM 控制台。它运行 `nvx::testing::fake_openvmm` 的伪 OpenVMM，`nvx-rs` 也会将其构建为 `nvx-fake-openvmm`；该二进制文件留在此软件包中，因为 `CARGO_BIN_EXE_*` 只命名被测软件包的二进制文件。它让真实的 OpenVMM 后端在没有 hypervisor 的宿主上端到端运行：分离启动、从新进程重新连接、崩溃恢复、中断启动恢复、强制停止、取消、工作目录、宿主路径映射表、拒绝缺少所需特性的客户机镜像，以及故障注入。
- `cargo run --example lifecycle -- <command>` 使用发现的产物运行一条命令。
- `nvx.py test-aci-edge-sandboxes` 使用仓库的内核和 Alpine initramfs，针对真实 hypervisor 运行被忽略的 `openvmm_e2e` 测试：生命周期、工作目录、宿主路径映射、网络规则、私有网络入站、双向宿主回环访问以及 exec 环境。CI 在 Linux/KVM、Linux/MSHV 和 Windows/WHP 上运行它们。

## MXC 集成

MXC 的 `StatefulSandboxBackend` 适配器按如下方式映射到此 crate：

| MXC | `aci_edge_sandboxes` |
| --- | --- |
| `ID_PREFIX` | `SandboxId::PREFIX`（`aci-edge-sandboxes`）；原样传递沙箱 ID |
| `provision`、`start`、`stop`、`deprovision` | 对应的 `AciEdgeSandbox` 方法；`metadata` 是 JSON 对象 |
| `exec` 与 `ExecStdio::Piped` | `AciEdgeSandbox::exec`；从 `take_stdout` 和 `take_stderr` 交出原始句柄（`AsRawFd` 或 `AsRawHandle`），并保持读取器存活 |
| `exec` 与 `ExecStdio::Relayed` | 相同的管道，由分发器转发；不暴露标准输入 |
| `ExecHandle::waiter` | `Execution::wait`：`Exited(c)` → `Exited(c)`，`Signaled(s)` → `Exited(128 + s)`，`Cancelled` → `Exited(137)`，`TimedOut` → `TimedOut`（在 `Relayed` 下则映射为 `backend_error`，因为 `Relayed` 无法表示超时），其他结果 → `backend_error` |
| `ExecHandle::terminator` | `Execution::canceller` |
| `validate_provision`、`validate_exec` 钩子 | `AciEdgeSandbox::validate_provision` 和 `AciEdgeSandbox::validate_exec`，它们运行与操作相同的检查但不运行任何内容；错误携带 `ErrorCode::wire_code` |
| 后端构造 | `nvx::Artifacts::discover` 和 `OpenVmmConfig::from_artifacts` |
| `policy.readonly_paths`、`readwrite_paths`、`denied_paths` | 使用相同宿主路径的 `FilesystemPolicy` |
| `policy.network_egress` 规则 | 逐字段对应的 `EgressPolicy` 规则 |
| `working_directory` | `ExecRequest::with_cwd(nvx::guest_path(...))`；工作负载无法进入的目录会以 `Failed(WorkingDirectory)` 结束 |
| `process.env`、`process.inheritDefaultEnv` | `ProcessSpec::env`（省略时为 `None`）和 `inherit_default_env`，或 `ExecRequest::with_envs` 与 `with_inherit_default_env`；参见[环境](#环境) |
| `runtimeConfig.networkProxy` | 使用 `agent` 后端的 `ProvisionRequest::with_network_proxy`；参见[原生代理与宿主回环](#原生代理与宿主回环) |

概念验证 MXC 适配器 `nvx_backend` 实现了此映射。它在各自的进程中针对真实 VM 运行每个阶段，并通过 MXC 的 `ExecSandboxProcess` 消费 exec 管道。它尚未接入 MXC 的线缆契约或 `ContainmentBackend` 路由。

该 crate 未发布到 registry。对 `microsoft/nvx` 的 Cargo git 依赖还会获取 `openvmm` 子模块，这需要访问 `microsoft/openvmm`；如果无法访问，请将该 crate vendor 到本地。该 crate 及其数据模型通过相对路径依赖 `nvx-rs`，因此请将 `nvx-rs/` vendor 到 `aci_edge_sandboxes/` 旁边。

## 破坏性变更

NVX 机制已移至 [`nvx-rs`](/docs/nvx-rs/)。请求、结果、线缆格式、错误码和消息，以及磁盘上的沙箱状态均未改变；迁移前预配的沙箱仍可继续工作。以下变更会影响 Rust 调用方和构建：

- `Artifacts`、`Hypervisor`、`guest_path` 和 `resolve_guest_path` 从 `aci_edge_sandboxes::openvmm` 移至 `nvx`，本 crate 将其重新导出为 `aci_edge_sandboxes::nvx`：请使用 `aci_edge_sandboxes::nvx::Hypervisor` 等。`OpenVmmConfig` 和 `OpenVmmBackend` 仍位于 `aci_edge_sandboxes::openvmm`。
- `Hypervisor` 的 `FromStr` 实现和 `Hypervisor::from_env_or_default` 以 `nvx::Error` 失败，而不是 `aci_edge_sandboxes::Error`。两者都是具有相同消息的 `ErrorKind::Unavailable` 错误，`?` 或 `Into` 会将它们转换为 `backend_unavailable` 错误。
- `aci_edge_sandboxes_model` 依赖 `nvx-rs`（不含其宿主侧）来获得 `Cidr`、`Hypervisor` 以及主机名和客户机网络规则，因此 vendor 此 crate 或其模型的使用方也需要 vendor `nvx-rs/`。`aci_edge_sandboxes_model::cidr`、`aci_edge_sandboxes_model::setup::Hypervisor` 和 `aci_edge_sandboxes_model::spec::{is_valid_hostname, is_valid_guest_network}` 保留其路径，`SetupConfig` 保留其 JSON。
- 构建变量 `ACI_EDGE_SANDBOXES_BUNDLE`、`ACI_EDGE_SANDBOXES_BUNDLE_DIR` 和 `ACI_EDGE_SANDBOXES_BUNDLE_HYPERVISOR` 变为 `NVX_BUNDLE`、`NVX_BUNDLE_DIR` 和 `NVX_BUNDLE_HYPERVISOR`，`bundled` 下载的发布版固定在 `nvx-rs/artifacts.json` 中。依赖方仍会以 `DEP_ACI_EDGE_SANDBOXES_ARTIFACTS_DIR` 收到暂存目录。
- 相对 `process.cwd` 仍会以 `policy_validation` 拒绝，但消息现在指向 `nvx::guest_path`。

OpenVMM 后端使用编译 NVX 出站策略文件的同一下沉过程（[`nvx::host::network::policy`](https://github.com/microsoft/nvx/blob/dev/nvx-rs/src/host/network/policy/mod.rs)（英文原文））下沉出站规则，而不是逐条展开规则。规则匹配的内容未变，错误码也未变，但以下内容发生了变化：

- **规则顺序。** `--network-egress-allow` 和 `--network-egress-deny` 的值按地址族、地址、前缀长度、协议和端口排序，而不是按字符串顺序：`::/0` 位于 `2001:db8::/32` 之前，`tcp:80` 位于 `tcp:443` 之前。OpenVMM 的匹配不依赖顺序。
- **规则数量。** 每个动作的目标会合并为最少的网络；针对某协议所有端口或所有协议的规则会包含其覆盖的更窄规则；网络中重叠和相邻的端口范围会合并。策略通常需要更少的 OpenVMM 规则，因此一些曾超出 256 条限制的策略现在会被接受：256 个相邻的 `/24` 目标会变为一条 `/16` 规则。仅跨网络部分重叠的端口范围可能需要一条覆盖其并集的规则，因此接近限制的策略也可能需要比以前更多的规则。
- **消息。** 后端自身的规则检查（`Backend` 调用方绕过 `AciEdgeSandbox` 的请求校验时会触发）会报告策略编译器的消息，这些消息会指出字段：
  - `network.egress.allow[0].ports[0]: ICMP has no ports` 变为 `network.egress.allow[0].ports[0].port is not supported with icmp`；
  - `....endPort must not be below port` 变为 `....endPort 80 cannot be below port 90`，而超出 1 到 65535 的端口报告 `....port must be between 1 and 65535`；
  - `...to[0]: the destination is not a network` 和 `...to[0].except: an exception is not a network within the destination` 变为 `...to[0].cidr is not a valid IPv4 or IPv6 CIDR: VALUE`、`...to[0].cidr must not name an IPv6 scope: VALUE` 和 `...to[0].except[1] must be contained in NETWORK`；以及
  - `network.egress.allow expands to 300 OpenVMM rules; the openvmm backend accepts at most 256`，以及规则级的 `expands to more than 256 OpenVMM rules` 和 `covers more than 256 networks after removing its exceptions`，变为 `network.egress.allow emits at most 256 native rules`。这是通过 `AciEdgeSandbox` 的请求也可能遇到的唯一一条消息。
- **接受的规则。** 在没有请求校验的情况下，后端现在像策略文件那样读取网络：清除主机位并接受 IPv4 子网掩码，因此 `10.0.0.7/24` 即 `10.0.0.0/24`；而端口 0（后端以前会将其传给 OpenVMM）会被拒绝。请求校验仍会先以 `malformed_request` 拒绝此类网络。覆盖宿主回环转发所用客户机网络的拒绝规则会在相同规范化之后被检测到。

## 限制

实时标准输入需要客户机控制协议方面的工作，目前会被拒绝。客户机状态在停止后不会保留。

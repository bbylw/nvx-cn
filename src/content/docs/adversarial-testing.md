---
title: 对抗性测试
description: 有边界的自适应压力测试、信任边界与隔离验证活动。
group: dev
order: 4
source: doc/adversarial-testing.md
---

NVX 有一套单独的对抗性测试夹具，仅把 GitHub Copilot CLI 用作自适应策略师。Copilot 选择确定性的客户机侧探测。带类型的 broker、免凭据执行器、独立看门狗和现有微虚拟机测试夹具保留对 NVX 的独占控制，并判定隔离是否守住。

该测试套件补充确定性的 PR 测试。它不是 PR 门禁，且绝不能运行不受信任的 fork 代码。

## 信任边界

控制器调用已安装并已认证的 `copilot` 可执行文件。它从不安装 Copilot CLI，也从不启动 `copilot login`。如果 `copilot --version` 或非交互式已认证冒烟提示失败，预检就会失败。

每次策略师调用都使用：

- 无可用工具、无内置 MCP 服务器；
- 无仓库自定义指令、远程控制或 `ask_user`；
- 无临时目录访问；
- 单个非交互式提示与有界输出；
- Copilot CLI 最低 30 信用点的会话上限；以及
- 额外的控制器级信用点预算、动作数量与墙钟预算。

Copilot 收到受信任的用例目录、分类观察、覆盖率和剩余预算。客户机 stdout 和 stderr 在进入提示之前会被截断并做 base64 编码。模型必须精确返回：

```json
{"schema_version":1,"case_id":"catalogued-case-id"}
```

控制器显式选择受跟踪的 `nvx-adversary` 自定义代理，并禁用自主继续。这可以防止主代理在不转发候选目录、或在动作周围添加说明文字的情况下进行动态委派。

broker 拒绝重复的 JSON 属性、额外属性、未知或已完成的用例、无效 UTF-8、超大响应和不支持的 schema 版本。被拒绝的响应永远不会被执行。在时间和 AI 信用点预算允许时，控制器可以发出一个有界的修复提示，其中只包含拒绝信息和确切允许的标识符。模型不能提供命令、路径、环境变量、超时、资源限制或判据结果。

## 组件

### 控制器与带类型的 broker

控制器负责 Copilot 预检、预算、自适应循环、重放、前缀最小化、目标心跳和控制器产物。带类型的 broker 加载受跟踪的用例目录，校验单动作 schema，在执行之前记录每个被接受的动作，校验执行器观察，并让客户机文本保持编码状态。

初始目录只暴露确定性的原语：

- `workload-isolation` 覆盖工作负载身份、能力、`no_new_privs`、命名空间、托管控制、存储别名和网络策略；
- `guest-isolation` 覆盖生命周期、异常退出、输出背压、virtio-net、中断进展和结构化拆除；并且
- `snapshot-isolation` 覆盖控制台、文件系统、暂存盘、网络、端点策略和 SMP 活动期间的捕获/恢复。

重复的托管执行、控制台、SMP、文件系统、内存增长和处理器前缀用例，在不允许模型合成宿主代码的前提下，提供有界的进程、信号、输出、CPU、磁盘、inode 和内存扰动。

每个原语都映射到现有的 `test-microvm` 场景。那些场景复用确定性测试套件的 OpenVMM 进程、控制台和控制会话夹具、托管沙箱生命周期、严格的控制台标记、不可变的快照指纹和结构化结果报告。预期的工作负载终止或有意测试的客户机失败，只有在确定性场景识别出预期结果且 OpenVMM 正确拆除时才通过。

初始工作负载目录通过 `test-microvm` 检验相同的托管控制与隔离机制；它尚未驱动公开的持久化 `sandbox provision -> start -> exec -> stop` 命令序列。在认为工作负载对抗模式完成之前，该生命周期仍然是必需的。确定性的 `sandbox-lifecycle` 场景已经驱动该序列，因此它是这类原语的回归基线。

模型生成的脚本被有意地不予支持。未来的生成器必须把其输出放到一次性客户机或单独的一次性构建器中；它绝不能给策略师增加宿主 shell 访问权限。

### 执行器

专用的执行器入口点启动 JSON-lines 执行器协议。执行器：

1. 要求 NVX 提交与控制器完全一致；
2. 运行 `scripts/nvx.py verify`；
3. 在基线启动之前校验并哈希内核、initramfs、initramfs 软件包清单、OpenVMM 可执行文件、场景所运行的 [nvx-rs](#目标上的-nvx-rs)，以及它们的来源信息文档；
4. 启动文件系统和网络金丝雀以及看门狗；
5. 一旦判据记录到持续存在的文件系统或网络违规证据，就拒绝此后的一切场景或金丝雀派发；
6. 启动并停止一个基线 VM；
7. 只运行本地受信任用例目录所映射的场景；
8. 在超时和父进程正常退出后回收被封闭的后代进程树；
9. 把每个派生的 OpenVMM PID 记录到会刷新、需显式启用的日志中；
10. 清点结构化结果报告并保留完整日志；并且
11. 在最终成功之前启动并停止一个全新 VM。

初始化响应必须包含全部九个产物条目，包括 `nvx_rs` 和 `nvx_rs_provenance`；控制器校验每个路径、SHA-256 和大小。

子测试进程会收到一份很小的环境变量白名单。特别是，GitHub、Copilot、SSH agent、token 和任意控制器环境变量都不会被转发。白名单携带 [nvx-rs](#目标上的-nvx-rs) 所需的路径：`NVX_RS`、`CARGO_HOME` 和 `RUSTUP_HOME`。它省略 Cargo 的其他设置和凭据，例如 `CARGO_TARGET_DIR`、`RUSTFLAGS` 和 registry token，以及 `RUSTUP_TOOLCHAIN`，这样 [`rust-toolchain.toml`](https://github.com/microsoft/nvx/blob/dev/rust-toolchain.toml)（英文原文）仍会选择 Rust 发布版。

控制器可以在本地启动执行器，但生产活动必须使用 `--executor-command`。该选项指定一个受信任的可执行文件，并且不接受参数。该可执行文件是管理员拥有的包装器，把 stdin/stdout 转发到单独配置的目标上强制的执行器命令。它不得把协议数据当作 shell 命令求值。

包装器和目标配置器必须：

- 为每个执行器进程创建全新的一次性目标；
- 在暴露之前暂存确切的 NVX 提交、来源信息绑定的产物和 [nvx-rs](#目标上的-nvx-rs)；
- 在不提供生产或 GitHub 凭据的情况下提供 KVM、MSHV 或 WHP；
- 拒绝生产网络访问，并限制目标 CPU、内存、磁盘和时间；
- 对受限主体只运行执行器入口点；
- 让控制器把连接丢失或超时归类为目标不可用；
- 每次运行后隔离并重装目标；并且
- 把目标产物目录移动到访问受控的安全存储。

这种控制器/目标分离对 CI 是必需的。本地模式对开发有用，但位于目标宿主上的控制器无法可靠地区分宿主崩溃与自身故障。

本地执行器产物使用较短的 `build/adv/<run-id>` 状态根，而不是嵌套在 `--output-dir` 之下。这样可让最深的确定性微虚拟机日志路径保持在传统 Windows `MAX_PATH` 边界之内。控制器元数据和摘要记录目标的绝对产物根。

### 目标上的 nvx-rs

除客户机和 OpenVMM 产物之外，目标还需要 nvx-rs，即 `nvx.py` 运行的 Rust 命令行界面（[用法](/docs/usage/)）。在编入目录的场景中，`managed-lifecycle` 用 Cargo 运行 nvx-rs 测试 `managed_lifecycle`，而 `l3-l4-egress-policy` 用 nvx-rs 编译其出站策略并运行 `nvx.py run`，后者也会运行 nvx-rs。它们在 `nvx.py` 查找 nvx-rs 的位置查找 nvx-rs：先查 `NVX_RS`，再查 `nvx-rs/target/release/nvx-rs[.exe]`，否则就用 Cargo 在那里构建它。

因此目标需要 Rust 工具链：rustup，Cargo 位于执行器的 `PATH` 上，并已安装 `rust-toolchain.toml` 固定的 Rust 发布版。位于 `NVX_RS` 或 `nvx-rs/target/release` 的预构建 nvx-rs 可以省去其构建，但无法省去 `managed-lifecycle` 所需的工具链。因为执行器会传递 `NVX_RS`、`CARGO_HOME` 和 `RUSTUP_HOME`，二者都可以位于主目录之外。

场景的超时包含任何构建，已存在的 nvx-rs 永远不会被重建，并且目标可能没有供 Cargo 使用的网络访问。因此，在暴露之前，请在仓库根目录针对暂存的提交构建二者，并记录 nvx-rs 构建的来源信息：

```bash
cargo build --release --locked --features cli --manifest-path nvx-rs/Cargo.toml --target-dir nvx-rs/target
cargo test --no-run --locked --manifest-path nvx-rs/Cargo.toml --test managed_lifecycle
python3 scripts/nvx.py record-nvx-rs-provenance
```

因为 `nvx.py` 从不重建已存在的 nvx-rs，执行器会在基线启动之前把它与其他产物一起校验：`build/nvx-rs.provenance.json` 中的来源信息必须描述场景所运行的 nvx-rs——即 `NVX_RS` 处或 `nvx-rs/target/release` 中的那个——且该 nvx-rs 是从暂存提交的 nvx-rs 源码构建的。过期或缺失的构建会让初始化失败，而不是在无人注意的情况下运行。当 `NVX_RS` 指明该构建时，请在设置 `NVX_RS` 的情况下运行 `record-nvx-rs-provenance`。在已从暂存提交构建发布版的目标上，[`download`](/docs/usage/) 会安装二者。

### 独立判据

执行器侧的判据看门狗运行时不咨询 Copilot。它持续记录单调心跳、子进程 CPU 时间、磁盘使用、可用时的负载、合成的文件系统金丝雀哈希，以及对回环金丝雀服务的意外连接。

broker 会在以下情况判定动作失败：

- 确定性场景失败或超时；
- 进程或结构化拆除不完整；
- OpenVMM 或执行器不可用；
- 文件系统金丝雀被修改；
- 任何网络金丝雀连接；或
- 活动结束后的干净启动失败。

执行器心跳超时也是控制器侧的失败。外部基础设施必须利用该信号隔离目标，而不是把它放回资源池。

文件系统或网络金丝雀违规属于疑似逃逸。在这种状态下执行器不会启动活动后的 VM；它会关闭其判据，返回 `quarantined`，然后退出，以便包装器阻止目标被复用。当预算允许时，更短前缀的最小化会使用新配置的目标，而不是被隔离的机器。

## 运行活动

首先准备常规的 NVX 客户机和 OpenVMM 发布版产物，以及 [nvx-rs](#目标上的-nvx-rs)。对于本地 KVM 虚拟机：

```bash
python3 scripts/nvx.py test-adversarial \
  --backend kvm \
  --campaign workload-isolation \
  --host-type virtual-machine \
  --budget-seconds 900 \
  --budget-actions 8 \
  --budget-ai-credits 300 \
  --seed 1234 \
  --output-dir build/test-results/adversarial-kvm
```

Linux 支持 `kvm` 和 `mshv`；Windows 支持 `whp`。`--host-type` 记录 `baremetal` 或 `virtual-machine`。如果省略，夹具会记录 `NVX_HOST_TYPE` 或 `unspecified`。

对于必需的二节点拓扑，配置一个无参数包装器并运行：

```bash
python3 scripts/nvx.py test-adversarial \
  --backend kvm \
  --campaign guest-isolation \
  --host-type virtual-machine \
  --executor-command nvx-adversarial-remote \
  --output-dir build/test-results/adversarial-kvm
```

包装器是受信任的基础设施配置，而不是模型输入。重放需要原始的 `actions.jsonl` 和同级的 `replay-manifest.json`；控制器在派发动作之前会校验动作哈希、用例目录摘要、活动设置，以及执行器拓扑是本地还是外部。

Copilot CLI 当前的 `--max-ai-credits` 最低值是 30。每次调用都有这个 30 信用点上限。自适应活动需要至少 60 信用点，这样认证预检就不会消耗为第一个对抗动作预留的额度；并且只有当活动至少剩余 30 信用点时，控制器才会启动后续调用。之后它会按 Copilot 报告的 `totalNanoAiu` 上限计费；缺失或格式错误的用量会保守地按 30 信用点计费。CLI 上限是有文档说明的软上限，因为用量是在模型响应之后才知道的。每次调用的用量和控制器记账 JSON 会保留以供审计。

## 重放与最小化

每个被接受的动作都会在派发之前刷新到 `actions.jsonl`。重放会校验同一 schema，并且不查找、不认证、不调用 Copilot：

```bash
python3 scripts/nvx.py test-adversarial \
  --backend kvm \
  --campaign workload-isolation \
  --host-type virtual-machine \
  --replay build/test-results/adversarial-kvm/run-.../actions.jsonl \
  --output-dir build/test-results/adversarial-kvm-replay
```

在目标出现异常之后，只要墙钟预算仍有剩余，控制器就用新的执行器进程重放逐步变短的动作前缀。因此远程包装器会为每次最小化尝试配置一个全新目标。本地模式不会对策略违规做最小化，因为另一个本地执行器进程仍会运行在被隔离的宿主上。最短的复现前缀会写入 `minimized-actions.jsonl`；请把已确认的最小化失败提升到确定性的 `test-microvm` 测试套件中。

## 产物

控制器运行目录包含：

- 控制器与目标的提交、平台、宿主类型、工作区脏状态、Copilot 版本/模型、种子和预算；
- 原始 Copilot 响应和每次调用的用量统计；
- `actions.jsonl`、规范化的 `observations.jsonl` 和重放清单；
- 目标初始化与终结报告；
- 最小化尝试和最短的复现前缀；以及
- 完整摘要，以及不含客户机文本的 `public-summary.json`。

目标目录包含看门狗采样、金丝雀访问日志、有界的控制器进程输出、完整的逐场景 OpenVMM 日志、资源采样、OpenVMM PID 日志、结果报告哈希与拆除字段、基线产物，以及活动后的金丝雀启动产物。

潜在的逃逸载荷、目标日志、Copilot 对话记录和完整结果报告必须放到访问受控的安全存储中。GitHub Actions 工作流只上传 `public-summary.json`、用例标识符和重放清单。其外部配置器负责完整控制器目录和目标目录的收集与隔离。

## CI 策略

对抗性 GitHub Actions 工作流只通过受信任的手动派发或在 `dev` 上的定时计划运行。它不处理 PR 或 fork 代码，也不安装或认证 Copilot CLI。

该工作流在专用的 `nvx-adversarial-controller` runner 上运行，并要求 `NVX_ADVERSARIAL_EXECUTOR` 仓库变量指定管理员拥有的远程包装器。它绝不能指向持久化的构建、微虚拟机测试或性能 runner 集群。控制器和执行器镜像、网络隔离、产物收集、隔离和重装是基础设施前置条件；缺失的前置条件会让预检失败，而不是跳过活动。

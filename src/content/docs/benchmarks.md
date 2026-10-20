---
title: 基准测试
description: 在 Linux/KVM 与 Linux/MSHV 上运行 NVX 基准测试、采集指标并解读结果。
group: use
order: 4
source: doc/benchmarks.md
---

受支持的 OpenVMM 基准测试协调器提供验收与诊断套件、包含 21 项指标的微虚拟机非 Python 工作负载套件，以及在 Linux/KVM、Linux/MSHV 和 Windows/WHP 上的五项设备操作速率指标。在 1 个 vCPU 下，CI 将这些工作负载与八项 128 MiB shell 生命周期指标合并，并报告全部 34 个中位数（p50）值。在 2、4 和 8 个 vCPU 下，CI 仅记录 `shell_snapshot_restore_512_mib`。延迟与常驻内存指标越低越好；吞吐量与操作速率指标越高越好。

该套件使用基础 Alpine 客户机。Python 应用快照、Python agent 控制台工作负载及其快照预取实验被有意排除，因为受支持的客户机构建不包含 Python initramfs。

人类可读的计时摘要和生命周期 JSON 会报告 p50 与最近秩 p95。受跟踪的平台 CSV 继续持久化并以 p50 作为门控值，因此历史 schema 保持不变。

生命周期结果报告被测 OpenVMM 进程的峰值常驻集大小（RSS）。Linux 读取进程的高水位标记；Windows 读取累积峰值工作集。RSS 包含常驻的客户机内存映射。CI 持久化并门控 p50 RSS，并在其生命周期诊断中同时报告 p50 和最大 RSS。

协调器在就绪标记处、OpenVMM 仍在运行时采样一次峰值 RSS。预先排队的客户机退出可能在该采样之前结束 OpenVMM。此时协调器会丢弃并重试该次尝试，每个被测样本最多尝试三次，并在 `peak_rss_remeasured_count` 中报告被丢弃的尝试次数。它绝不会用其他读数替代：在标记之前采集的样本会遗漏恢复过程，Linux 的退出统计会包含协调器的 pre-exec 映像，而 Windows 在退出后的读数会包含拆除过程。

使用本页了解指标名称和方法。当前的历史 p50 值位于 `data/` 中；复制到旧讨论或提交消息中的时序值不是基线。裸金属与虚拟机结果具有各自独立的历史，不得作为同一个回归序列比较。ABI 版本和处理器数量也是独立的历史维度。旧版 CSV 行会被解释为具有一个 vCPU 的 ABI v1；它们绝不会被用作 ABI v2 单 vCPU 的基线。新运行始终输出 ABI 值 2，并继续存储在 `microvm-v2` 路径下，因此不会与旧版无后缀的 ABI-1 历史冲突。OpenVMM 基准测试协调器实现在 `scripts/nvx_tools/benchmark.py` 中，并通过受支持的 NVX CLI 暴露。客户机负载位于 `scripts/nvx_tools/benchmark_scripts`；协调器在使用前填充 `.sh.in` 模板。

| CI 性能序列 | 后端 | 宿主类型 |
| --- | --- | --- |
| `linux-kvm-virtual-machine` | KVM | 虚拟机 |
| `linux-mshv-virtual-machine` | MSHV | 虚拟机 |
| `windows-whp-virtual-machine` | WHP | 虚拟机 |

序列名称不包含 CPU 厂商：每个 CI 微虚拟机运行器都是搭载 Intel Xeon CPU（Ice Lake-SP 或 Emerald Rapids）的 Azure 虚拟机，因此每个序列只有一家厂商的样本。没有 CI 微虚拟机运行器使用 AMD CPU，因此目前不存在 AMD 序列。AMD 运行器需要内置的 AMD [CPU 配置文件](/docs/usage/)，因为 CI 从不使用宿主配置文件，而 `benchmark` 会拒绝没有内置配置文件可服务的 CPU；目前只有 Milan、Genoa 和 Turin CPU 拥有内置配置文件。此类运行器会通过 AMD-V 在该配置文件上启动其客户机，因此其时序会使 Intel 序列的基线产生偏差。[#410](https://github.com/microsoft/nvx/issues/410) 跟踪 AMD 运行器的进展。在 AMD 运行器加入 CI 之前，请为它分配自己的序列——在 `scripts/nvx_tools/performance.py` 的 `PLATFORM_NAMES` 和 `OPENVMM_BACKENDS` 中以及在 CI 矩阵中，使用 `-amd` 后缀命名，例如 `linux-kvm-virtual-machine-amd`——以便其历史存放在单独的 `data/` 文件中。AMD 宿主上的本地测量可以使用上面的名称，因为只有 CI 会记录历史。

CI 在规范微虚拟机下以 1 个 vCPU 运行完整的验收与性能套件以及五项设备指标，并且仅在 `2`、`4` 和 `8` 个 vCPU 下运行 512 MiB shell 快照恢复。这会为每个序列产生 37 个 p50 值——1 个 vCPU 下 34 个，每个更高计数下各 1 个——三个序列矩阵合计 111 个值。各计数在每个宿主上依次运行，因此基准测试工作负载绝不会在同一物理宿主上重叠。

## 在本地运行

先构建发布版 VMM 与客户机产物。参见[构建](/docs/build/)。

使用以下命令运行验收与诊断套件：

```console
python3 scripts/nvx.py benchmark --suite boot --backend whp
python3 scripts/nvx.py benchmark --suite e2e --backend kvm --platform linux-kvm-baremetal --processors 1 --memory-mib 128 --output data/runs/linux-kvm-baremetal/microvm-v2/1vcpu/acceptance.json
```

使用以下命令运行完整的性能套件：

```console
# Linux/KVM：运行全部 21 项指标并写出与收集器兼容的日志
python3 scripts/nvx.py benchmark --suite performance --backend kvm --platform linux-kvm-baremetal --processors 1 --runs 5 --virtfs-runs 3 --skip-build --output-dir data/runs/linux-kvm-baremetal/microvm-v2/1vcpu

# Linux/MSHV：运行全部 21 项指标
python3 scripts/nvx.py benchmark --suite performance --backend mshv --platform linux-mshv-baremetal --processors 1 --runs 5 --virtfs-runs 3 --skip-build --output-dir data/runs/linux-mshv-baremetal/microvm-v2/1vcpu

# Windows/WHP
python scripts\nvx.py benchmark --suite performance --backend whp --platform windows-whp-baremetal --processors 1 --runs 5 --virtfs-runs 3 --skip-build --output-dir data\runs\windows-whp-baremetal\microvm-v2\1vcpu
```

使用以下命令运行规范的设备操作速率套件，采用其默认的五次预热、每个设备 30 次保留尝试、十秒操作窗口和 512 MiB 后备对象：

```console
# Linux/KVM；在 Linux/MSHV 上使用 --backend mshv 和匹配的平台。
python3 scripts/nvx.py benchmark --suite device-io --backend kvm --platform linux-kvm-baremetal --processors 1 --skip-build --output-dir data/runs/linux-kvm-baremetal/microvm-v2/1vcpu/device-io
python3 scripts/nvx.py performance collect --platform linux-kvm-baremetal --commit HEAD --input-dir data/runs/linux-kvm-baremetal/microvm-v2/1vcpu/device-io --output-dir data/results

# Windows/WHP。
python scripts\nvx.py benchmark --suite device-io --backend whp --platform windows-whp-baremetal --processors 1 --skip-build --output-dir data\runs\windows-whp-baremetal\microvm-v2\1vcpu\device-io
python scripts\nvx.py performance collect --platform windows-whp-baremetal --commit HEAD --input-dir data\runs\windows-whp-baremetal\microvm-v2\1vcpu\device-io --output-dir data\results
```

冒烟测试可传入 `--warmups 0 --runs 1 --device-io-duration-seconds 1`。

使用以下命令运行 CI 用于更高 vCPU 覆盖率的仅恢复形态：

```console
python3 scripts/nvx.py benchmark --suite shell-snapshot-restore --backend kvm --platform linux-kvm-baremetal --processors 8 --shell-memories 512 --warmups 1 --runs 5 --skip-build --output-dir data/runs/linux-kvm-baremetal/microvm-v2/8vcpu
python3 scripts/nvx.py performance collect --platform linux-kvm-baremetal --commit HEAD --input-dir data/runs/linux-kvm-baremetal/microvm-v2/8vcpu --output-dir data/results --require-shell-snapshot-restore-512
```

从一份不可变的容量为 8、仅 CPU 0 在线的快照测量恢复时的 vCPU 激活：

```console
python3 scripts/nvx.py benchmark --suite snapshot-restore-vcpu --backend kvm --processors 8 --memory-mib 512 --warmups 1 --runs 5 --skip-build --output-dir data/runs/restore-vcpu-kvm
```

在 Linux/MSHV 上使用 `--backend mshv`，在 Windows/WHP 上使用 `--backend whp`。该套件以 `maxcpus=1` 捕获一次，然后用同一产物在在线目标 1、2、4 和 8 下恢复。每个样本只有在客户机验证了所请求的在线前缀之后才到达其标记。捕获和恢复使用 `--timeout`（默认 10 秒）。结果仅供诊断，不会写入历史固定 vCPU 性能 CSV。

对于显式的 MSHV 目标，OpenVMM 仅实例化并绑定所请求的 VP 前缀，同时保留全容量拓扑和已保存状态的校验。无目标的 MSHV 恢复以及所有 KVM 和 WHP 恢复都会实例化完整容量。缩减前缀的 MSHV 运行时无法再次保存。

添加 `--snapshot-profile` 可打印每个在线目标的 p50 和 p95 生命周期阶段。该诊断保留其横幅前（pre-banner）捕获，因此一份不可变的 boot-online-1 快照可服务于所有目标。其总恢复延迟无法与生命周期对齐的 `shell-snapshot-restore` 指标比较；应比较宿主侧生命周期阶段，以将 VP 绑定和工作线程构建与客户机恢复行为区分开：

```console
python3 scripts/nvx.py benchmark --suite snapshot-restore-vcpu --backend mshv --processors 8 --memory-mib 128 --warmups 1 --runs 5 --snapshot-profile --skip-build --output-dir data/runs/restore-vcpu-mshv-capacity-8
```

从一份不可变的 512 MiB 快照（具有 2 GiB 的 ABI 预留容量）测量恢复时的内存激活：

```console
python3 scripts/nvx.py benchmark --suite snapshot-restore-memory --backend kvm --processors 1 --warmups 1 --runs 5 --snapshot-profile --skip-build --output-dir data/runs/restore-memory-kvm
```

在 Linux/MSHV 上使用 `--backend mshv`，在 Windows/WHP 上使用 `--backend whp`。该套件在 512 MiB、1 GiB 和 2 GiB 下恢复同一基础快照。它分别报告客户机观测到的添加并上线（add-and-online）延迟、进程启动到就绪的延迟、OpenVMM 峰值 RSS 以及可选的宿主生命周期阶段。扩展区间在恢复执行之前注册；只有每 128 MiB 内存块都在线后，客户机才发出标记。

显式的 512 MiB 目标是零扩展对照。它的私有状态不会选择恢复数据包，也不会请求快照边界，因此其启动到就绪的延迟应保持在直接恢复在 512 MiB 下捕获的快照的测量噪声范围内。

使用以下命令运行诊断性快照生命周期矩阵：

```console
# Linux/KVM 或 Linux/MSHV
python3 scripts/nvx.py benchmark --suite snapshot-profile --backend kvm --warmups 1 --runs 5 --output data/runs/linux-kvm-baremetal/snapshot-profile.json

# Windows/WHP
python scripts\nvx.py benchmark --suite snapshot-profile --backend whp --warmups 1 --runs 5 --output data\runs\windows-whp-baremetal\snapshot-profile.json
```

默认矩阵会剖析 128、256、512 和 1024 MiB 快照，并同时使用热（warm）和冷（cold）恢复产物。使用 `--shell-memories` 选择大小，使用 `--cache-state warm`、`cold` 或 `both` 选择缓存条件。该套件为这些诊断运行启用 OpenVMM 剖析；其他路径除非显式指定 `--snapshot-profile`，否则保持完整剖析关闭。快照捕获始终收集其生成指标所需的 OpenVMM 时钟记录。

使用全新的输出目录运行非规范的 virtio 恢复诊断：

```console
python3 scripts/nvx.py benchmark --suite device-restore-profile --backend kvm --platform linux-kvm-baremetal --processors 1 --warmups 1 --runs 5 --skip-build --output-dir data/runs/device-restore-kvm
python scripts\nvx.py benchmark --suite device-restore-profile --backend whp --platform windows-whp-baremetal --processors 1 --warmups 1 --runs 5 --skip-build --output-dir data\runs\device-restore-whp
```

默认情况下，该套件以活动（active）和延迟（deferred）两种模式运行控制台、网络和 virtio-fs。使用 `--restore-devices` 和 `--restore-modes` 选择子集。延迟捕获会在 `nvx-snapshot` 之前解绑所选的内置客户机驱动；恢复时重新绑定并验证 I/O。设备通过微虚拟机 ABI 槽位和 virtio 设备 ID 定位，而不是使用不稳定的 `virtioN` 编号：网络位于 `0xd0000000`/ID 1，virtio-fs 位于 `0xd0001000`/ID 26，控制台位于 `0xd0002000`/ID 3。探测控制标记独立于所选设备，使用 port-B（`/dev/hvc0`）。在重新绑定之前，延迟模式通过 `/sbin/nvx-mmio-write` 发送一个无描述符的 queue-0 MMIO 通知，以验证 staged-kick 顺序。控制台验证通过 `/dev/hvc1` 写入；网络使用 portable 配置文件和网关 ping；virtio-fs 读取宿主种子，并在重新挂载后写入宿主可见的结果。

输出目录包含 `device-restore-profile.json`、`benchmark-metadata.json` 以及原始捕获/恢复日志。JSON 保留每个被测样本、p50/p95 启动到就绪和触发到首次 I/O 的时序、峰值 RSS、客户机标记、结构化恢复事件顺序、队列启动计数、staged-kick 分发计数，以及必需的零陈旧/过早回调断言。只有该套件启用 `virtio_restore=debug` 事件流。其结果仅供诊断：`performance collect` 不接受它，不会将其持久化到 `data/*.csv`，`performance gate` 也不会使用它。宿主观测的标记时序包含串口投递和调度器延迟，重复恢复会为每个场景复用一个全新快照；仅在相同宿主、等效负载和电源条件下比较结果。

通过选择 `cold-start`、`device-io`、`virtfs`、`shell-snapshot` 或 `network-snapshot` 之一代替 `performance`，可以只运行一个工作负载。使用 `--shell-memories 128 256 512`、`--payload-mib 64` 和 `--net 10.0.0.2/24 --network-profile portable` 覆盖其默认值。运行 `python scripts/nvx.py benchmark --help` 可查看完整的选项面。

网络基准测试在 KVM、MSHV 和 WHP 上选择相同的进程内 portable 数据平面。它们不会创建 TAP 设备，也不需要宿主防火墙规则。

每个工作负载目录都包含 `benchmark-metadata.json`，其中有平台、后端、ABI、处理器数量、宿主亲和性集合、内存大小、产物修订、仓库脏状态、预热次数、被测运行次数，以及 VMM、内核、initramfs 和协调器的 SHA-256 值。设备元数据还会记录聚合的 Rust 客户机源码摘要、固定的工具链和目标，以及来自 initramfs 清单的打包 `nvx-device-io` 二进制哈希。收集过程会拒绝不匹配的生命周期/工作负载元数据和重复的拓扑行。

使用固定的亲和性集合，其中每个物理核心对应一个逻辑处理器，并且对于具有 `N` 个 vCPU 的客户机，至少要有 `N+2` 个处理器。额外的处理器用于 VMM 和设备工作。默认选择器遵循此策略；显式指定过小的 `--cpus` 集合会在测量之前被拒绝。

虚拟机 CI 运行器将四个核心暴露为八个同级逻辑 CPU。其虚拟机序列特意使用固定的 `0-7` 集合和 `--host-cpu-reserve 0`，包括同级 CPU，并在客户机、VMM 和设备工作之间共享容量。这些受限的嵌套宿主结果与裸金属序列分开保存；其他运行保留两个 CPU 的预留。CI 为受限序列提供 40 秒的客户机标记截止时间；已完成的测量仍会记录其实际延迟。

### MSHV 生命周期诊断

Linux/MSHV 后端会从现有的 `mshv map user memory` span 发出一个可选的 `MSHV_SET_GUEST_MEMORY completed` 事件。该 span 标识客户机范围和权限；事件记录 `elapsed_us` 和 `success`。在 x86_64 上，`MSHV_CREATE_VCPU completed` 报告 RAM 附加之后的 BSP 创建。与后端无关的 `post-memory partition finalization completed` 事件包含 BSP 创建和能力发现。这些作用域是嵌套的，不得相加。仅在诊断性的 `run` 调用中启用 `virt_mshv=info,openvmm_core::worker::dispatch=info`。基准测量会强制关闭 OpenVMM 日志，以避免改变被测路径。

使用以下命令收集已完成的套件：

```console
python3 scripts/nvx.py performance collect --platform linux-kvm-baremetal --commit HEAD --input-dir data/runs/linux-kvm-baremetal/microvm-v2/8vcpu --output-dir data/results --require-network --require-shell-snapshot --require-shared-suite --lifecycle-input data/runs/linux-kvm-baremetal/microvm-v2/8vcpu/acceptance.json
```

## 基准测试命令

| 基准测试 | 命令 | 描述 |
| --- | --- | --- |
| Shell 生命周期 | `benchmark --suite e2e` | 使用 shell 就绪的客户机测量冷启动、快照生成、快照恢复、拆除和峰值 RSS。 |
| 所有受支持的非 Python 工作负载 | `benchmark --suite performance` | 运行 21 项指标并写出与收集器兼容的日志。 |
| 设备操作速率 | `benchmark --suite device-io` | 通过可续跑的原始尝试测量五项随机存储与 UDP 往返操作速率。 |
| 冷启动 | `benchmark --suite cold-start` | 测量安静的 shell 就绪基线以及隔离的单参数内核命令行变体。 |
| 虚拟文件系统 | `benchmark --suite virtfs` | 测量运行中的宿主目录吞吐量，并在同一运行中的 VM 中验证宿主到客户机以及客户机到宿主的可见性。 |
| Shell 快照 | `benchmark --suite shell-snapshot` | 比较冷启动与在 128、256 和 512 MiB 下生命周期对齐的快照恢复。 |
| Shell 快照恢复 | `benchmark --suite shell-snapshot-restore` | 捕获一份不参与测量的生命周期对齐快照，并仅测量所选内存大小下的恢复延迟。 |
| 恢复时的 vCPU 激活 | `benchmark --suite snapshot-restore-vcpu --processors 8` | 在在线目标 1/2/4/8 下恢复一份 boot-online-1、容量为 8 的快照，并报告延迟与峰值 RSS。 |
| 网络快照 | `benchmark --suite network-snapshot` | 比较网络就绪的冷启动与快照恢复，并验证网关连通性。 |
| 快照生命周期剖析 | `benchmark --suite snapshot-profile` | 保留原始捕获和恢复阶段记录，并汇总 128/256/512/1024 MiB 热/冷恢复。 |
| Virtio 设备恢复剖析 | `benchmark --suite device-restore-profile` | 验证控制台、网络和 virtio-fs 的活动恢复与驱动解绑的延迟恢复；发出独立的诊断 JSON 和原始日志。 |

## 内核命令行

每个基准测试都使用固定的内核命令行启动客户机。下文反复出现两个基础命令行：

- `BASE` = `earlycon=xe9 console=hvc0 reboot=t panic=-1`
- `QUIET` = `earlycon=xe9 console=hvc0 quiet loglevel=0 reboot=t panic=-1`

OpenVMM 拥有 `BASE`；下面每个 `--cmdline` 值都会追加到它。恢复阶段不传递命令行，而是继续使用快照中捕获的命令行。OpenVMM 还会追加设备发现标记（对于已附加的挂载点或 NIC，为 `virtio_mmio.device=...`），并且当选择 virtio 控制台时，可能将 `console=hvc0` 替换为 `console=hvc1`。它不追加任何时钟标记：在[时间 ABI](/docs/design/3.2-clock-and-time/)下，NVX 内核从 hypervisor 身份的频率 MSR 读取 TSC 和 LAPIC 定时器速率，并且从不校准任何时钟；OpenVMM 会拒绝提供的 `tsc_early_khz=` 或 `lapic_timer_hz=` 标记（`E_CMDLINE_CLOCK_TOKEN`）。除下面的 `cold_start_clocksource` 变体外，没有基准命令行会调整时钟或 clocksource。

| 基准测试 | 阶段 | 内核命令行 |
| --- | --- | --- |
| Shell 生命周期 | cold/capture | `BASE` 加上 `BASE_TUNING`：`random.trust_cpu=on rcupdate.rcu_expedited=1 nokaslr mitigations=off cryptomgr.notests quiet loglevel=0`；CI 使用 128 MiB。 |
| Shell 生命周期 | restore | 恢复（从被测的 shell 就绪快照） |
| 冷启动 | baseline | `QUIET` |
| 冷启动 | tuning variant | `QUIET` 加上 `clocksource=tsc`、`tsc=reliable`、`no_timer_check`、`random.trust_cpu=on`、`rcupdate.rcu_expedited=1`、`nokaslr`、`mitigations=off` 或 `cryptomgr.notests` 之一 |
| 虚拟文件系统 | guest runs | `QUIET` |
| 设备操作速率 | guest runs | `QUIET`；virtio-net 使用位于 `10.0.0.2/24` 的 portable 配置文件 |
| Shell 快照 | cold | `QUIET` |
| Shell 快照 | capture | `QUIET`；在启动标记和 SMP/LAPIC 探测之后由宿主驱动 |
| Shell 快照 | restore | 通过恢复后的 SMP/LAPIC 探测和生命周期恢复标记进行恢复 |
| 网络快照 | cold | `QUIET virtnet_probe=<gateway>` |
| 网络快照 | capture | `QUIET virtnet_probe=<gateway> netsnap` |
| 网络快照 | restore | 恢复（从快照） |

## 规范指标

### Shell 生命周期

CI 使用 128 MiB 客户机运行一次预热和十个被测样本。每个阶段都使用全新的 OpenVMM 进程。最终被测快照会保留给恢复样本使用。

| 指标 | 单位 | 描述 |
| --- | --- | --- |
| `openvmm_cold_start` | ms | 从 OpenVMM 进程创建之前那一刻起，到 `ALPINE-MICROVM-BOOT-OK` 为止。 |
| `openvmm_snapshot_generation` | ms | 从 `capture.input_gate` 开始到 `capture.publication_commit` 的 OpenVMM 进程时钟区间；不包含宿主到客户机控制台投递和发布轮询。 |
| `openvmm_snapshot_restore` | ms | 从恢复的 OpenVMM 进程创建之前那一刻起，到 `OPENVMM-SNAPSHOT-RESTORE-OK` 为止。 |
| `openvmm_cold_start_guest_exit_teardown` | ms | 冷启动标记之后分发客户机 `nvx-exit 0`，直到 OpenVMM 进程成功退出。 |
| `openvmm_snapshot_restore_guest_exit_teardown` | ms | 从宿主观测到恢复标记起，到 OpenVMM 进程成功退出为止，此时客户机 `nvx-exit 0` 已排入捕获控制器。 |
| `openvmm_cold_start_peak_rss` | MiB | 到冷启动标记为止的每进程峰值 RSS。 |
| `openvmm_snapshot_generation_peak_rss` | MiB | 生成快照的进程的每进程峰值 RSS。 |
| `openvmm_snapshot_restore_peak_rss` | MiB | 到恢复标记为止的每进程峰值 RSS。 |

预热不计入任何聚合值。CSV 存储并门控 p50 值。CI 保留按阶段的生命周期剖析，诊断还会报告时序的最小值、最大值和样本数，以及峰值 RSS 最大值。收集过程会拒绝宿主终止语义、旧版控制台计时的捕获结果、没有预排队客户机退出的恢复结果、缺失的样本，以及任何客户机退出拆除超时。当样本数至少为 10 时，它还会拒绝 p50 比 p25 高出 25% 以上的快照生成序列；这可以防止瞬时宿主卡顿进入性能历史，同时不会掩盖整体变慢的产品结果。每次启动都会像[微虚拟机正确性作业](/docs/ci/)那样扫描客户机的时间 ABI 输出：出现违规事件或时间 ABI 关机都会使该次运行失败。每个可能返回样本的拆除过程（状态为 0 的客户机退出、宿主终止或拆除超时）都会先将控制台读到底，因此客户机在就绪标记之后打印的事件——即使位于未终止的最后一行——仍会使运行失败。被宿主终止的启动，或在拆除超时后被杀死的启动，会因时间 ABI 关机状态而失败，但不会因其终止状态而失败。状态非零的客户机退出无论如何都会使运行失败；扫描会读取控制台在一秒内投递的内容，以便时间 ABI 关机连同其事件一起被报告。基准测试从不要求客户机报告其时间 ABI 状态（正确性作业会在冷启动和恢复之后这样做），因此客户机不会打印额外内容。在标记之前，扫描只解析测试框架本来就会读取的输出；而测试框架只有在记录样本区间之后才读取控制台的其余部分，因此扫描不会给这些区间增加任何时间。客户机的启动检查（失败时会以状态 193 关闭客户机）属于 `openvmm_cold_start` 的一部分。生命周期捕获会在快照请求之前在每个 vCPU 上运行一个确定性的、绑定亲和性的工作线程。显式的正确性场景还会在恢复后布置一个探测。捕获探测位于快照生成计时区间之外。每个工作线程都会证明自己在所分配的 vCPU 上执行，并观察到该 CPU 的本地 APIC 计数器前进。工作线程最多轮询 10,000 次计数器读取，因此定时器停滞会失败，而无需依赖客户机休眠或可用的客户机时钟来限定检查。中断前/后的快照还要求每个计数器都前进，并保持至少与工作线程观测到的值一样大。即使在单 vCPU 客户机上，该检查仍然严格：LAPIC 校准失败后回退到 PIT 不算成功。计数器冻结在 12 可能表明 Linux 出现 `APIC timer disabled due to verification failure`；增加轮询预算无法修复它。时间 ABI 在每个后端上都会隐藏 TSC-deadline 定时器，因此每个客户机都使用一次性计数 LAPIC，而微虚拟机正确性作业在 1、2、4 和 8 个 vCPU 下运行的 `smp` 场景覆盖了这一点。基准测试本身不运行 LAPIC 门控（#286），也没有客户机以 `lapic=notscdeadline` 启动。`test-microvm --scenario smp-lapic` 保留供显式本地使用：它运行 `smp`，并断言没有 CPU 列出 `tsc_deadline_timer`、每个在线 CPU 的 clockevent 设备都是计数 `lapic`，以及启动行报告每个 CPU 的后端 LAPIC 速率。没有默认套件或 CI 作业运行它，因此不会有任何内容运行两次。捕获不会等待 clocksource：在时间 ABI 下，Linux 在 `device_initcall` 时、任何客户机工作之前注册 `tsc` clocksource，因此任何捕获都无法观察到过渡性的 `tsc-early` 窗口。协调器在客户机内存中布置探测和捕获控制器。控制器运行第一次探测，阻塞在 `read` 中，并在宿主发送触发时调用 `nvx-snapshot`。控制器总是在 `nvx-snapshot` 之前立即发出 `NVX-SNAPSHOT-DISPATCHED`。恢复时，它完成任何已布置的验证、打印恢复标记，并在客户机退出模式下执行预排队的 `nvx-exit 0`。宿主终止模式会让客户机继续运行，直到宿主将其终止。

无中断的 `hvc0` 控制台即使控制器阻塞在 `read` 中也会轮询。其投递延迟保留在非门控的 `request_to_publication_*` JSON 字段中；剖析捕获还会区分 `console_command_round_trip` 和宿主观测的 `guest_dispatch_to_publication`。两个观察者区间都不是生成指标。规范的 `samples_ms`/`p50_ms` 和剖析阶段 `capture.snapshot_generation` 使用相同的 OpenVMM 时钟区间。

### 冷启动

这九个场景通常使用五个样本。它们都以毫秒为单位，测量从 OpenVMM 进程启动到配置内存大小下 shell 就绪控制台标记的时间。调优场景会向安静基线追加恰好一个内核参数。

| 指标 | 描述 |
| --- | --- |
| `cold_start_base` | 未附加调优参数的安静基线。 |
| `cold_start_clocksource` | 基线加上每个后端上的 `clocksource=tsc`。在时间 ABI 之前，KVM 测量的是 `clocksource=kvm-clock`，因此该变更之前的 KVM 历史测量的是不同的 clocksource。 |
| `cold_start_tsc_reliable` | 基线加上 `tsc=reliable`。 |
| `cold_start_no_timer_check` | 基线加上 `no_timer_check`。 |
| `cold_start_random_trust_cpu` | 基线加上 `random.trust_cpu=on`。 |
| `cold_start_rcu_expedited` | 基线加上 `rcupdate.rcu_expedited=1`。 |
| `cold_start_nokaslr` | 基线加上 `nokaslr`。 |
| `cold_start_mitigations_off` | 基线加上 `mitigations=off`。 |
| `cold_start_cryptomgr_notests` | 基线加上 `cryptomgr.notests`。 |

### 虚拟文件系统

吞吐量场景通常使用三个样本和 64 MiB 负载。往返场景测量完整进程墙钟时间，同时宿主和客户机通过一个运行中的 VM 交换文件。

| 指标 | 单位 | 描述 |
| --- | --- | --- |
| `virtfs_live_write` | MB/s | 客户机使用带 `fsync` 的 `dd` 直接顺序写入宿主目录。 |
| `virtfs_live_read` | MB/s | 在丢弃客户机页缓存后，客户机从宿主文件顺序读取。 |
| `virtfs_live_roundtrip` | ms | 客户机创建宿主可观测的标记，然后在该 VM 退出前观察到宿主重写。 |

### 设备操作速率

专用套件始终使用规范微虚拟机，并将块后备对象作为可写的 `scratch` 角色附加。没有 ABI 选择器，也没有旧版无角色的 `--virtio-blk` 控制项。每个客户机都有 256 MiB RAM，并运行来自可复现 initramfs 的相同静态 Rust x86-64 二进制。规范运行会为每个设备执行五次预热，随后执行 30 次保留尝试。每个操作窗口持续十秒，针对 512 MiB 后备对象。

| 指标 | 单位 | 计时工作 |
| --- | --- | --- |
| `virtio_blk_random_read_iops` | ops/s | QD1 对齐的 4 KiB 随机 `pread64`，使用 `O_DIRECT`。 |
| `virtio_blk_random_write_iops` | ops/s | QD1 对齐的 4 KiB 随机 `pwrite64`，使用 `O_DIRECT`。 |
| `virtio_fs_random_read_iops` | ops/s | 在 `sync` 并丢弃客户机页缓存后，QD1 缓冲的 4 KiB 随机 `pread64`。 |
| `virtio_fs_random_write_iops` | ops/s | QD1 缓冲的 4 KiB 随机 `pwrite64`；最终刷写在计时结束后开始。 |
| `virtio_net_udp_roundtrip_ops` | ops/s | 通过 portable virtio-net 完成的 64 字节 UDP 回显请求/响应事务。 |

存储偏移在每个后端使用相同的确定性伪随机序列。宿主 UDP 服务器绑定宿主的主 IPv4 地址，不需要 TAP 或防火墙更改，并在套件返回之前停止。速率在聚合期间由整数操作计数和单调递增的经过纳秒数导出：$\mathrm{ops/s}=N\times10^9/t_{ns}$。

后备对象在多次尝试之间复用。在 Windows 上，扩展 virtio-fs 文件会设置其长度而不初始化其内容，因此最初的随机写入可能包含宿主文件系统初始化和零填充开销。一次被丢弃的预热会将这些冷文件开销排除在稳态操作速率之外；单次冷尝试只是冒烟测试。

`device-io.log` 为每次预热或保留尝试存储一条带版本号的 JSON 记录。缺失、重复、格式错误或零工作的辅助程序输出会使该次尝试成为显式失败；失败的尝试保留在日志中，绝不会进入 p50 或 p95。预热索引和保留索引是固定的，因此失败不会改变采样。使用相同元数据重新运行会跳过已完成的标识，并从第一个缺失的尝试继续。所选 ABI 是元数据和默认输出目录的一部分，因此 v1 和 v2 记录无法混合。更改的控制项或来源信息会被拒绝。临时原始磁盘、共享目录、UDP 服务器以及每个基准测试自有的 VMM 都会在成功、失败或中断时清理。

### Shell 快照

每个内存大小通常使用五次冷启动和五次恢复。冷启动值运行到 shell 就绪的 `ALPINE-MICROVM-BOOT-OK` 标记。随后，不参与测量的捕获会在请求快照之前运行与 shell 生命周期基准相同的 SMP/LAPIC 探测。恢复值运行到该探测和独立的 `OPENVMM-SNAPSHOT-RESTORE-OK` 标记。因此，捕获和恢复边界与 shell 生命周期基准一致；内核命令行仍然不同，因此冷启动指标不可互换。

这种生命周期对齐的方法取代了早期横幅前（pre-banner）的 `shellsnap` 捕获。由该方法产生的历史 `shell_snapshot_restore_*` 值无法与新收集的值比较。

64 MiB 指标对——`shell_snapshot_cold_64_mib` 和 `shell_snapshot_restore_64_mib`——已在 #116 中退役。`data/` 中的平台 CSV 仅将其结果保留为历史；最后一批来自 `b8912df`。

| 指标 | 描述 |
| --- | --- |
| `shell_snapshot_cold_128_mib` | 从 OpenVMM 启动到具有 128 MiB 内存的 shell 就绪客户机。 |
| `shell_snapshot_restore_128_mib` | 从恢复进程启动到对 128 MiB 快照的生命周期对齐验证。 |
| `shell_snapshot_cold_256_mib` | 从 OpenVMM 启动到具有 256 MiB 内存的 shell 就绪客户机。 |
| `shell_snapshot_restore_256_mib` | 从恢复进程启动到对 256 MiB 快照的生命周期对齐验证。 |
| `shell_snapshot_cold_512_mib` | 从 OpenVMM 启动到具有 512 MiB 内存的 shell 就绪客户机。 |
| `shell_snapshot_restore_512_mib` | 从恢复进程启动到对 512 MiB 快照的生命周期对齐验证。 |

### 快照生命周期剖析

该诊断套件会在每个所选内存大小下捕获一份新快照，然后在每个所选缓存条件下恢复该产物。热运行会在每次恢复之前依次读取 `manifest.bin`、`state.bin` 和 `memory.bin`。Linux 冷运行会对每个产物应用 `POSIX_FADV_DONTNEED`。Windows 冷运行从全新的无缓冲 `robocopy /J` 克隆恢复。所选机制会与每个结果一起记录为 `cache_control`。

快照捕获始终启用 `OPENVMM_STARTUP_PROFILE=1`，以在 OpenVMM 的进程相对时钟上测量生成过程。缺失、重复、进程不匹配或非单调的捕获边界都是错误，而不是回退到控制台计时。完整剖析保留和宿主资源计数器仍通过 `--snapshot-profile` 或 `snapshot-profile` 套件选择启用。其他基准子进程除非请求剖析，否则会移除该变量。OpenVMM 会向 stderr 为每个阶段写入一条 ASCII 记录，并带有带版本号的 `OPENVMM_SNAPSHOT_PROFILE_V1` 前缀。每条记录包含：

- `operation`、`phase` 和 `exclusive`，其中 exclusive 阶段是不相交的区间，非 exclusive 阶段是可能包含嵌套工作的累积里程碑；
- 单调的 `duration_ns` 和进程相对的 `process_elapsed_ns`，以及发出记录的 `pid`；
- 在可用时，阶段特定的 `logical_bytes`、`allocated_bytes`、`gpa_faults` 和 `populated_bytes`。

OpenVMM 从自己的线程将客户机控制台转发到 stdout，与其 stderr 写入没有顺序保证，因此当两者共享终端或管道时，任一数据流都可能拆开另一数据流的行。因此，快照捕获和启动测量通过单独的管道读取 stderr：它们仅从 stderr 解析剖析记录，并仅在控制台上匹配客户机标记。它们的日志和错误报告按整行交错两个数据流。由于数据流是独立读取的，在客户机标记之前写入的记录可能在标记之后才到达。快照捕获以及在返回样本之前的启动测量，会在配置的超时内将两个数据流读到末尾，如果任一数据流未结束则失败。

启用完整剖析时，协调器会在 `profile.raw_samples` 中保留每条记录。它从 OpenVMM 时钟导出 `capture.snapshot_generation`，并添加观察者定义的 `process_startup`、`console_input_dispatch`、`console_command_round_trip`、`guest_dispatch_to_publication`、`request_to_publication`、`source_teardown`、`resume_to_readiness` 和 `process_launch_to_readiness` 边界，而不将它们混入 OpenVMM 专属区间。`console_input_dispatch` 测量将快照命令和预排队恢复脚本同步写入 OpenVMM 控制台的过程，并记录负载大小。所有捕获都会在 `nvx-snapshot` 之前立即发出客户机标记；`console_command_round_trip` 在宿主观测到该标记时结束，`guest_dispatch_to_publication` 则跨越该观测到快照发布之间的区间。每条观测记录还包含可用的进程计数器。Linux 报告 RSS、峰值 RSS、次要和主要缺页、总缺页，以及在 `smaps_rollup` 可用时的私有脏字节和私有 RSS 字节。Windows 报告工作集、峰值工作集、私有提交和缺页。

在 Windows 上，每个保留的捕获样本还携带 `storage_telemetry`。从宿主请求快照之前不久直到源进程退出，一个协调器线程大约每 50 ms 采样累积的宿主计数器：scratch、工作区和系统卷的读/写字节数、请求计数、响应时间、空闲时间和队列深度；CPU 空闲、内核和用户时间；以及系统缓存的脏页和阈值、惰性写入器和刷写页，以及 modified page writer 和 mapped page writer 的页数。大约每 500 ms，以及在第一个和最后一个样本中，它还会加入 Microsoft Defender 进程 `MsMpEng.exe` 和 `MpDefenderCoreService.exe` 的 CPU 时间和 I/O 传输量。CI 作业以 Network Service 身份运行，无法读取性能计数器，因此采样器仅使用任何账户都可以查询的接口：卷性能 IOCTL、`GetSystemTimes` 和 `NtQuerySystemInformation`。Windows 仅按需维护磁盘计数器，卷 IOCTL 在消费者请求之前不会返回任何内容，因此采样器在采样期间保持打开磁盘性能 WMI 数据块（任何账户都可以查询它）；它不更改任何系统设置。读取失败会记录在 `errors` 中，绝不会使基准测试失败。原始 `samples` 会保留，`phases` 汇总 `capture.snapshot_generation` 和 `capture.mapped_memory_flush`。每个计数器组（卷、CPU 时间、缓存计数器或 Defender 的进程）跨越最接近每个阶段开始和结束且携带该组的样本，因此读取失败不会隐藏相邻样本记录的内容。观察者时钟通过捕获记录中最小的“观测值减报告值”时间与 OpenVMM 的时钟对齐。每个摘要报告其覆盖的采样区间；每个卷的吞吐量、IOPS、平均延迟、平均队列长度、繁忙时间和峰值队列深度；CPU 繁忙时间；惰性写入器、刷写和页写入器速率；峰值脏缓存及其阈值；以及 Defender CPU 时间和 I/O。样本与摘要不同的计数器组（例如 Defender 较稀疏的进程计数器）会报告自己的区间。Linux 捕获不会刷写文件后端的客户机 RAM 映像，耗时约 1 至 4 ms，并且不记录存储遥测。

`profile.phases` 按 `operation.phase` 对样本分组，并存储原始 `samples_ms` 以及 p50、最近秩 p95、最小值和最大值。顶层 JSON 路径为 `snapshot_profile_matrix.<backend>.<memory_mib>`。每个内存条目包含捕获结果以及 `restore.warm` 和/或 `restore.cold`，其中包括其缓存控制和完整恢复结果。预热不计入原始样本和摘要。

捕获记录会分离客户机静默、状态保存、映射内存和内存句柄刷写、每个发布步骤、发布观测以及源拆除。恢复记录会分离产物打开和准备、COW 区段和映射/视图创建、原型和最终分区工作、GPA 注册、VP 线程绑定、已保存状态恢复、设备启动、生成 ID 创建、累积门控的客户机修复区间，以及客户机恢复运行到就绪。状态和内存 SHA 阶段有意不在最终捕获与恢复路径中。

`startup.vp_thread_bind` 是所有 VP 线程绑定的独占墙钟区间。嵌套的 `startup.vp_bind_bsp` 和 `startup.vp_bind_ap_<INDEX>` 记录是非独占的每 VP 区间；将其端点与聚合区间比较，可以暴露串行化的后端 VP 创建。

### 网络快照

这些场景通常使用五个样本。只有在观测到网络验证标记之后，一次运行才会被接受。冷启动和恢复都计时到向配置网关成功发送一次 ICMP 回显；一秒超时限制了失败的探测，而不会在成功数据包之间增加区间。

| 指标 | 描述 |
| --- | --- |
| `network_snapshot_cold` | 从 OpenVMM 启动到接口配置和真实连通性探测之后的网络就绪标记。 |
| `network_snapshot_restore` | 从恢复进程启动到已验证的恢复网络标记。 |
| `network_snapshot_restore_wall` | 恢复快照、重建网络后端、验证连通性并退出的端到端宿主进程墙钟时间。 |

## CI 收集

`python scripts/nvx.py performance collect --require-shared-suite` 会拒绝不恰好包含 21 项共享指标的工作负载结果。提供 `--lifecycle-input` 会要求并合并八项生命周期指标，产生一个 29 项指标的单 vCPU 结果。CI 从其单独的原始日志目录收集五项设备操作速率指标，并按 ABI、处理器数量、提交和指标合并它们，产生最终的 34 项指标 ABI-2 单 vCPU 结果。更高 vCPU 的收集使用 `--require-shell-snapshot-restore-512`，它要求恰好包含 `shell_snapshot_restore_512_mib`，以及针对 2、4 或 8 vCPU 客户机的规范一次预热/五个样本元数据。`device-io` 目录会从元数据中识别，并且必须恰好包含其五项指标和每次配置的尝试。每个后端作业都会将其 p50 表和单 vCPU 生命周期诊断发布到 `$GITHUB_STEP_SUMMARY`。PR 回归检查会将 KVM、MSHV 和 WHP 结果与最新的基础分支历史进行比较。

这些作业会消费、门控、发布或持久化 KVM 基准测试结果（#286）；MSHV 和 WHP 通过各自的平台作业遵循相同流程：
- `Platform / Linux / KVM / Virtual machine`（`platform-kvm`）运行基准测试并发布结果：运行级 `benchmark-linux-kvm-virtual-machine-<run-id>` 产物、每次尝试的诊断产物，以及步骤摘要中的 p50 表。
- `Performance regression gate`（`performance-gate`，仅 PR）在三个平台作业全部成功后消费三个平台产物，并依据基础分支的历史对其进行门控。它不发布也不持久化任何内容。
- `Persist performance baseline`（`performance-persist`，仅 `dev` 推送）消费它们并将其持久化到 `data/*.csv`。
- `Publish development release`（`release`，仅 `dev` 推送）不读取它们，但它和 `performance-persist` 仅在两个 NVX CLI 作业和三个平台作业都成功，且每个正确性作业（包括 `nvx-microvm-tests-kvm`）都成功或被跳过时运行。
- `Required status check` 除非变更所调度的每个作业（包括 `platform-kvm`、`performance-gate` 和 `nvx-microvm-tests-kvm`）都获得预期结果，否则失败。

每个平台作业都在其后端的基准测试运行器上运行。该作业以池的标签加上 `benchmark` 为目标，每个池恰好有一个运行器携带该标签，因此每次运行都在同一个 VM 上测量该序列，门禁也将 PR 与该 VM 的历史进行比较。这些池混合了结果差异超过运行间噪声的 VM：在相同的 `dev` 提交上，Emerald Rapids 宿主上的 WHP 运行器测得的结果比 Ice Lake 宿主上的慢约 10%，而另一个规模集中的 MSHV 运行器测得的客户机退出拆除慢数倍（#415）。池化序列会将每个 PR 与测量过基础分支窗口的任意运行器进行比较，因此仅运行器的放置就可能导致门禁失败。基准测试运行器还会承接其池中的其他作业，因此平台作业可能需要等待它，而并发运行的平台作业会依次测量。使用 `gh api repos/microsoft/nvx/actions/runners --jq '.runners[] | select(any(.labels[]; .name == "benchmark")) | .name'` 列出基准测试运行器，并使用[运行器安装脚本](/docs/host-setup/)的 benchmark 开关进行配置。在测量之前，每个平台作业都会检查其运行器是否为该序列历史来源的宿主，如[期望的基准测试宿主](/docs/benchmarks/)所述。因此，将标签移到另一个运行器属于性能平台变更：除非新运行器的宿主在每个必需字段上都匹配，否则其平台作业会失败，直到某个 PR 接受其宿主并重置该序列的历史。

Linux 和 Windows CI 使用缩减的设备契约：一次预热和十次保留尝试。两种 CI 契约都使用一秒操作窗口。规范基线收集使用完整的 `5 + 30` 契约。

当前工作流在一次预热后收集 10 个被测生命周期样本。Linux 和 Windows CI 会在启动其余基准测试套件之前验证生命周期结果。快照生成不稳定会以临时失败退出状态 75 报告；CI 会在同一运行器上重新测量一次。每次尝试都会保留在基准测试产物中，为 `acceptance-attempt-1.json` 或 `acceptance-attempt-2.json`，包括其生命周期剖析。只有通过验证的尝试才会复制到 `acceptance.json` 供收集；过期的已接受结果会在测量前移除。其他验证失败会立即停止，第二次不稳定结果仍会使作业失败。稳定性防护会拒绝 p50 比 p25 高出 25% 以上的结果，并在两侧各至少有两个样本时拒绝超过 25% 的相邻间隙。单个离群值仍被容忍，而宿主卡顿无法将双峰序列发布到历史中。在 Linux CI 运行器上，快照生成在 KVM 上约需 1 ms，在 MSHV 上约需 4 ms，因此两个样本中亚毫秒级的 CPU 卡顿就足以越过间隙限制。

每次验证还会将尝试的文件、SHA-256 摘要、结果（`valid`、`unstable` 或 `invalid`）、退出状态和错误追加到 `acceptance-attempts.json`，验收步骤会在测量前删除该文件以及任何更早的尝试文件。发布步骤会将该日志传递给 `performance collect --lifecycle-attempt-log`。除非 `acceptance.json` 恰好是一个有效尝试的逐字节相同副本，否则收集会在写入 CSV 之前失败；随后它会打印提供已发布生命周期指标的尝试。步骤摘要会列出每次尝试及其结果、快照生成 p50 以及是否已发布，并报告每次尝试的存储遥测，包括被拒绝的尝试。

在更新运行级 `benchmark-<platform>-<run-id>` 产物之前，每个平台都会将其原始结果和生命周期剖析上传到不可变的 `benchmark-diagnostics-<platform>-<run-id>-attempt-<run-attempt>` 产物，包括在基准测试失败之后。两个产物都保留一天。重新运行工作流无法覆盖更早尝试的诊断。下游门禁仍使用运行级产物，因此仅失败作业的重跑可以复用更早工作流尝试中成功的平台结果。`acceptance-attempt-N.json` 文件标识单个工作流尝试内有界的生命周期重新测量，而不是工作流的 `github.run_attempt`。

生命周期 JSON 结果和工作负载 `benchmark-metadata.json` 文件在 `host` 下记录宿主来源信息：来自 `RUNNER_NAME` 的运行器名称、机器名称、操作系统及其内核版本或 Windows 构建与累积更新修订号（UBR）、CPU 型号及其厂商、家族、型号、步进和微码版本、逻辑处理器数量和物理内存，以及工作区、临时目录和 scratch 目录背后的卷、文件系统、大小、系统卷标志、磁盘编号和 SCSI 地址。磁盘编号和 SCSI 地址可区分 Azure OS 磁盘、数据盘 LUN 或临时磁盘。在疑似 Azure VM 上，协调器会直接（而非通过代理）查询实例元数据服务一次，服务无响应时最多尝试三次，并且仅保留 VM 大小；每个托管磁盘的 SKU、大小、缓存策略、写加速器和临时设置以及数据盘 LUN；Ultra Disks 报告的吞吐量和 IOPS 限制；以及临时磁盘的大小。它绝不会记录名称、资源或 VM 标识符、订阅、标签、网络地址或凭据，并将不可达的服务记录为 `azure.error`。验收套件和诊断套件在测量前打印来源信息，步骤摘要将其作为基准测试宿主表包含在内。device-io 恢复在比较控制项和来源信息时会忽略 `host`。运行器和机器名称标识测量结果的那台基准测试运行器。

调查不稳定时，将每次尝试的 `snapshot_capture.<backend>.profile.raw_samples` 与其 `samples_ms` 比较。例如，`capture.mapped_memory_flush` 较慢而其他捕获阶段稳定，会将延迟定位到宿主侧映射 RAM 刷写，而不是客户机启动或快照恢复。如果 `capture.quiesce`、`capture.save_state` 中或剖析阶段之间出现额外时间，而刷写和发布阶段保持平稳，则指向宿主 CPU 卡顿。在将延迟归因于源码变更之前，请使用完全相同的可执行文件和客户机产物哈希在同一宿主上复现。收集诊断证据时，保持稳定性阈值和有界重新测量不变。

在 Windows 上，作业日志会打印每个被测捕获的 `capture.mapped_memory_flush` 时间以及其间的宿主活动，步骤摘要会为每次尝试（包括被拒绝的尝试）汇总相同的遥测：scratch 卷的写吞吐量、平均写延迟、平均队列长度和繁忙时间；对其他受监控卷的写入；CPU 繁忙时间；峰值脏缓存；惰性写入器吞吐量；以及 Defender CPU 时间。将同一序列中的慢刷写与快刷写进行比较：

- 磁盘限流：慢刷写以较低且平稳的速率写入 scratch，同时保持繁忙，并伴随更长的延迟和队列，其他列保持平稳。将该速率与宿主表中已发布的磁盘 SKU 和大小限制进行比较。
- 扫描：在慢刷写期间，Defender CPU 时间或 I/O 上升。
- 回写：在慢刷写期间，惰性写入、脏缓存或对其他卷的写入上升。
- 无关的宿主负载：CPU 繁忙时间上升，而 scratch 在刷写的一部分时间内保持空闲。

在 JSON 中，刷写自身的页写入出现在 `memory.cache_flush_mib_per_second` 中，原始样本显示速率在单次刷写内如何变化。

快照生成受基准测试临时目录写入吞吐量的限制，因为捕获会通过在该目录中创建的后备文件刷写客户机 RAM。Windows 后备文件保持密集，以便恢复时保留已捕获页的缓存；因此 NTFS 会对低于客户机 RAM 顶端页面的未写入范围进行零填充，一个 128 MiB 客户机每次捕获约写入 150 MiB。Windows CI 运行器的 128 GiB Premium SSD 系统盘还承载运行器工作树、缓存和构建。在负载下，它会在约 173 MB/s 的突发上限和约 102 MB/s 的基线之间以数十秒为块交替，从而将一个生命周期序列拆分为接近 0.95 秒和 1.6 秒的刷写簇。因此，Windows CI 会传入 `--scratch-dir`，指向运行器预配在数据卷上的 `NVX_BENCHMARK_SCRATCH` 根目录下的每个作业目录。验收 JSON 将该目录记录为 `controls.scratch_directory`，工作负载元数据将其记录为 `scratch_directory`。当根目录未预配时，CI 会发出警告并使用系统临时目录。由 Windows 协调的 KVM 工作线程会收到同一目录的 WSL 转换路径，而不是回退到 WSL 的 `/tmp`。对于临时目录与其他 I/O 密集型工作共享卷的手动运行，请使用 `--scratch-dir`。

将基准测试 scratch 或运行器工作区背后的存储变更视为性能平台变更。这包括不同的 VM 大小、磁盘 SKU、大小、性能层、缓存策略或突发设置，以及在 OS、数据和临时磁盘之间移动 scratch。由于快照生成受 scratch 卷写入吞吐量的限制，此类变更会使 `openvmm_snapshot_generation` 发生偏移，并可能使其他生命周期指标发生偏移。请一次性将其应用于池中的每个运行器，以便基准测试运行器以及之后接管其标签的任何运行器共享同一存储机制。期望宿主会记录 VM 大小以及这些卷背后磁盘的 SKU、大小和缓存，因此基准测试运行器的下一个平台作业会在宿主检查中失败；在同一个 PR 中，接受新宿主并按[期望的基准测试宿主](/docs/benchmarks/)所述重置该序列的历史。对于宿主未记录的变更，例如性能层或突发设置，至少要通过从序列历史文件中移除受影响指标来重置它们，例如 `data/windows-whp-virtual-machine-microvm-v2-1vcpu.csv`，以便门禁重新开始其十点预热，而不是将新存储与旧基线比较。

回归门禁会将目标 p50 与 PR 基础分支上最近 10 个 p50 值的中位数比较，并要求全部 10 个匹配的历史点都存在。只有当指标恶化超过 40% 时才算回归。越低越好的毫秒指标还必须比基线慢超过 5 ms；越高越好的指标仅使用百分比比较。历史缺失或不足属于预热，而非失败。成功的 `dev` 构建会将收集到的结果追加到 `data/` 中特定于拓扑的文件。每个新的 ABI/计数序列都会先作为预热基线，直到其回归门禁拥有足够的匹配历史。

只有 CI 实际使用的虚拟机拓扑才有受跟踪的历史。CI 会传入 `--history-reset-dir data`，以便在重置合并到基础分支之前，就尊重从受跟踪候选历史文件中显式移除的指标，并将候选期望宿主与基础分支的期望宿主比较。合并后，被重置的指标会重新开始正常的十点预热；仅候选文件缺失不会重置基础分支历史。

### 期望的基准测试宿主

每个受跟踪序列都会在 `data/<platform>-host.json` 中指定测量其历史的宿主，例如 [`data/windows-whp-virtual-machine-host.json`](https://github.com/microsoft/nvx/blob/dev/data/windows-whp-virtual-machine-host.json)。该文件就是该宿主来源信息的身份标识：运行器和机器名称；CPU 的厂商、家族、型号、步进、品牌字符串和微码版本；逻辑处理器和内存；操作系统及其内核版本，或 Windows 构建和 UBR；Azure VM 大小以及可为基准测试卷提供后备的 Azure 磁盘；以及工作区、临时和 scratch 卷的挂载点、文件系统和系统卷标志。当卷是系统卷时，会纳入 OS 磁盘；当卷位于另一块磁盘上时，会纳入数据盘和临时磁盘；因此，scratch 位于 tmpfs 的 Linux 运行器的数据盘不会被纳入。路径、设备名称、SCSI 地址和卷大小被省略，因为它们在相同的 VM 之间也会不同。

在首次基准测试之前，平台作业的 `Check Linux benchmark host` 或 `Check Windows benchmark host` 步骤会运行 `nvx.py performance check-host`，将运行器与该文件比较。每个字段要么是必需，要么是建议性：

| 属性 | 必需 | 建议性 |
| --- | --- | --- |
| CPU | 厂商、家族、型号、步进和品牌字符串 | 微码版本 |
| 处理器与内存 | 逻辑处理器；内存差异在 5% 以内 | |
| Linux | 内核主版本和次版本以及 flavor，即包含字母的发布标记，例如 `mshv3` 和 `azl3` | 内核补丁版本 |
| Windows | 构建号，例如 `10.0.26100` | 累积更新修订号（UBR） |
| Azure | VM 大小；每块磁盘的 SKU、大小、缓存、写加速器、临时选项和限制 | |
| 卷 | 挂载点、文件系统和系统卷标志 | |
| 运行器 | | 运行器和机器名称 |

必需属性的差异会在作业开始测量之前使其失败。其错误注解会列出每处差异，步骤摘要会比较每个属性并显示运行器的宿主文件，诊断产物也会将其保留为 `<platform>-host.json`。内存容差可吸收内核预留，同一大小的 VM 之间这些预留有所不同：KVM 和 MSHV 运行器同为 `Standard_D8s_v5`，分别报告 31.3 和 30.9 GiB。内核 flavor 是必需的，因为 #415 的 `azure-mshv-scus` 运行器运行在 `6.6.137.mshv2-2.azl3` 而非 `6.6.148-200.azl3` 上，测得的客户机退出拆除慢数倍。建议性差异（例如微码或 Windows 累积更新、内核补丁版本，或 VM 被替换为相同的 VM）只会发出警告。要确认该差异，请用运行器的宿主信息替换文件；这不需要重置历史。

`performance collect` 会将结果记录的宿主以 `<platform>-host.json` 的形式写在结果旁边。它会拒绝其中只有部分结果记录了宿主的输入，也会拒绝将两个宿主的结果，或有记录宿主与无记录宿主的结果收集到同一目录。`performance persist` 会拒绝追加其记录宿主在必需字段上与历史的 `<platform>-host.json` 不同的结果，或对于记录了宿主的历史，拒绝未记录宿主的结果。`Persist performance baseline` 还会传入 `--require-host`，要求两个宿主文件都存在，作为 `dev` 推送的兜底。

要接受新宿主——例如在重新部署、调整大小、重装镜像或 OS 更新改变了必需属性之后，或在 `benchmark` 标签移动到宿主不同的运行器之后——请打开一个 PR，在一次变更中：

1. 用失败检查的步骤摘要或诊断产物中运行器的宿主信息替换 `data/<platform>-host.json`。
2. 通过将序列的每个历史文件（例如 `data/<platform>-microvm-v2-1vcpu.csv`）截断到其标题行来重置该序列。

该 PR 的平台作业会将运行器与新文件比较，门禁会将重置的指标视为预热。门禁会将 PR 的期望宿主与基础分支的期望宿主比较，并在必需属性发生变化而序列的历史文件仍保留任何指标的任何行时失败，从而确保新宿主的结果绝不会延续前一宿主的历史。合并后，`dev` 推送会重新开始该序列的十点预热。

## 生命周期方法

生命周期基准测试使用优化的 128 MiB shell 就绪客户机，作为 KVM、MSHV 和 WHP 上的同一基线。宿主计时从 `Popen` 之前立即开始，因此冷启动和恢复值包含 OpenVMM 进程启动和 VM 构建。快照生成使用 OpenVMM 的单调进程时钟，从输入门控开始（在客户机请求快照之后）到原子发布为止。它不包含通过轮询控制台投递 `nvx-snapshot` 的时间。宿主请求到发布以及首次发布观测（每 1 ms 轮询一次）仍作为诊断。

冷启动标记之后，宿主分发客户机 `nvx-exit 0` 并测量到 OpenVMM 进程成功退出；冷启动拆除仍包含控制台投递。快照捕获则会在捕获边界之后将恢复标记和 `nvx-exit 0` 一起排队。因此，恢复拆除从独立的标记行开始，不依赖对无中断 `hvc0` 控制台的第二次宿主到客户机轮询。它是宿主观测的标记到退出区间，包含剩余的客户机关闭和观察者调度，而不是仅对 VMM 内部拆除的测量。CI 允许进程退出最多 15 秒，之后才拒绝被测样本。发布后快照源的退出会作为诊断保留在原始 JSON 中，但不是客户机退出拆除指标。

## 冷启动方法

冷启动计时在启动 OpenVMM 进程之前立即开始，到 shell 就绪控制台子串出现时结束。因此它包含宿主进程启动、VM 构建和客户机执行。每个场景都会抑制常规内核日志，并捕获控制台输出而不进行渲染，因此终端渲染不属于测量的一部分。

`earlycon=xe9` 和 `hvc0` 路径每字节使用一次 `outb`。它们取代了通常需要一次线路状态读取加一次数据写入的 16550 风格路径。VMM 会同步扫描每个发出的字节以查找标记。`OPENVMM_LOG=off` 抑制 VMM 日志，而 `quiet loglevel=0` 抑制客户机中的大部分输出。

基线命令行是：

```text
earlycon=xe9 console=hvc0 quiet loglevel=0 reboot=t panic=-1
```

其他每个场景只追加指标表中指定的参数。这会隔离该参数的影响；基准测试不会组合各项调优，也不会在场景之间更改客户机内存。诸如 `nokaslr` 和 `mitigations=off` 之类的降低安全性的参数是针对受信任的单租户部署测量的，并非一般性建议。

在构建当前内核配置时识别出的主要冷启动影响因素包括：

- `PM_TRACE_RTC` 墙钟探测，它可能等待缺失或最小的 RTC 行为；
- 对机器未暴露的硬件子系统进行初始化和探测；
- 随着客户机 RAM 增长而进行的每页内核元数据初始化；
- 控制台 VM 退出。

因此，签入的内核省略了未使用的 PCI、存储、图形、声音、电源管理、跟踪和调试栈，保留了最小的 RTC 实现，并使用低滴答率与无滴答空闲。在更改 `kernel/config-microvm` 时，请将这些视为设计约束；同时验证启动正确性和相关的冷启动指标。

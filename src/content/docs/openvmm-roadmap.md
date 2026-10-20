---
title: OpenVMM 上游路线图
description: 将 OpenVMM 分支中的微虚拟机提交上游化的 PR 策略、依赖图与落地顺序。
group: dev
order: 7
source: doc/openvmm-upstream-roadmap.md
---

## 范围

- OpenVMM fork 基点：`e1cdbd916d3aacb216309c8e7779b832546759a1`。
- 映射的 fork 末端：`2728f33ea9a44d2d0fb956d9f01768ae2100fb62`，位置 166。下文的依赖图、PR 摘要和提交映射覆盖位置 001-166。
- NVX 固定的 OpenVMM 修订：`5ab8a84621524f1777b2cb5e65a70dab42c8b453`，在同一第一父链上比映射末端多 154 个提交。这些提交尚未分配到 PR；见[映射末端之后的提交](#映射末端之后的提交)。
- 上游 main：`1fd455b19e7c69c72a2d375d0ed1cb35d901c688`（2026-10-01），比 fork 基点多 18 个提交。

## 上游状态

自 fork 基点以来的 18 个上游提交中，有两个与 fork 链所代表的工作重叠。其中一个取代了整个 fork 提交；另一个提供了生命周期基础设施，而两个 fork 提交的部分内容重复实现了该基础设施。其余 16 个未实现路线图条目。

| fork 位置 | fork 提交 | 上游 PR | 上游提交 | 状态 |
| --- | --- | --- | --- | --- |
| 022（PR05） | `9b3ce6760`（`fix-virt_mshv` 上的 `46e43f8fa`）- kvm：在捕获 VP 状态期间保留挂起的外部中断 | microsoft/openvmm#4522 | `392890680` | 已被取代；从 fork 链中移除 |
| 059-060（PR10） | `b7bc2586b`、`00bced019` - MSHV/WHP 恢复后的时钟同步 | microsoft/openvmm#4524 | `9cf109547` | 部分重叠；复用上游 `PartitionTimeControl`，但保留频率与恢复后 TSC 的工作 |

microsoft/openvmm#4522 以不同方式修复了同一个丢失 PIC 中断的缺陷。它不在 `kvm::VpRunner` 中跟踪排队向量，而是通过 vCPU 的注入中断槽（`KVM_SET_VCPU_EVENTS`）注入 PIC 中断，现有的活动状态保存/恢复机制已经覆盖该槽。因此：

- 移除 022 后，PR05 缩减为四个可上游化的提交。已发布的 `origin/fix-virt_mshv` 分支仍基于 `e1cdbd916`，并且仍包含 022；其当前包含五个提交的历史从 `f09d89a37` 到 `092ab9352`。请基于当前上游 main 重建该分支，并省略 `46e43f8fa`。
- 将 fork 链变基到 `1fd455b19` 时必须移除 022。在触及相同 `kvm` 和 `virt_kvm` 文件的后续提交（055、056、058、109）中，只有 109 与 microsoft/openvmm#4522 冲突，且冲突很轻微：在 `vmm_core/virt_kvm/src/arch/x86_64/mod.rs` 中，同时保留该提交的 `mod cpu_contract;` 和上游的 `mod extint;`。没有其他 fork 提交使用 022 添加的 extint API，也没有使用被 microsoft/openvmm#4522 重命名的 extint API（`inject_extint_interrupt` 现为 `queue_extint_interrupt`）。
- 包含 022 的 fork 构建可能会将排队的 PIC 向量保存为挂起的 `ExtInt` 事件。microsoft/openvmm#4522 从不保存该事件，并且会以 `KvmError::InvalidState` 拒绝恢复该事件，因此在变基前捕获的 KVM 快照在变基后可能无法恢复。请重新捕获这些快照。

microsoft/openvmm#4524 添加了通用的 `PartitionTimeControl` 契约、MSHV 和 WHP 实现，以及全 VM 冻结/解冻生命周期调用。这取代了位置 059 和 060 内部的私有冻结/解冻管道，但不会取代它们精确的 TSC 频率暴露、快照停机处理或恢复后 vCPU 同步。因此，位置 057-061 和位置 160 的修正仍保留在路线图中：将 059-060 改为使用上游契约，然后对所得的 MSHV 同步代码重新应用 160。没有剩余的 fork 提交与当前上游 main 补丁等价。

## 图例

| 类别 | 含义 |
| --- | --- |
| U | 可独立上游化 |
| P | 可作为已接受的微虚拟机 profile 的一部分上游化 |
| N | NVX 产品策略；除非通用化，否则仅保留在 fork 中 |
| F | 仅保留在 fork 中 |

图中的实线箭头表示建议的落地/堆叠顺序。虚线箭头表示可以在产品栈到达该 PR 之前就开始的工作。紫色节点标记取代或部分重叠 fork 工作的上游变更。

## PR 依赖与上游提交图

**节点颜色分组**

灰色：`B`、`U0`、`F`；紫色：`L4522`、`L4524`；蓝色：`P01`-`P14`、`P26`；绿色：`P15`、`P16`、`P17`、`P18`、`P20`、`P22`、`P25`、`P27`；琥珀色：`P19`、`P21`、`P23`、`P24`；红色：`Z`。

**基线与已落地的上游变更**

- `B` — OpenVMM fork 基点 `e1cdbd916`（灰色）
- `L4522` — 已落地上游：microsoft/openvmm#4522，合并为 `392890680`，取代 022（紫色）
- `L4524` — 已落地上游：microsoft/openvmm#4524，合并为 `9cf109547`，部分重叠 059-060（紫色）
- `U0` — 当前上游 main `1fd455b19`（灰色）
- `F` — 微虚拟机 profile 栈之前建议的基础汇聚点（灰色）

**并行、可上游化的基础 PR**

- `P01` — PR01：构建/测试基础设施 — U，8 个提交
- `P02` — PR02：Mesh + sparse_mmap — U，3 个提交
- `P03` — PR03：Unix 上的 PAL — U，3 个提交
- `P04` — PR04：Windows 上的 PAL/PAL async — U，6 个提交
- `P05` — PR05：虚拟机监控程序修复 — U，4 个提交
- `P06` — PR06：设备加固 — U，10 个提交
- `P07` — PR07：Consomme 资源限制 — U，3 个提交
- `P08` — PR08：预备性重构 — U，6 个提交
- `P14` — PR14：直接启动 loader — U，5 个提交

**通用快照与持久化链**

- `P09` — PR09：可失败 VM 生命周期 — U，6 个提交
- `P10` — PR10：CPU/时钟状态 — U，11 个提交
- `P11` — PR11：快照发布 — U，4 个提交
- `P12` — PR12：私有 CoW 恢复 — U，5 个提交
- `P13` — PR13：Virtio 持久化 — U，11 个提交

**有序微虚拟机产品栈**

- `P15` — PR15：机器 profile — P，11 个提交
- `P16` — PR16：固定 virtio-MMIO ABI — P，4 个提交
- `P17` — PR17：捕获 + 权威恢复 — P，11 个提交
- `P18` — PR18：宿主附件 — P，11 个提交 + 拆分末端
- `P19` — PR19：块角色 + 层级 — N/P，3 个提交
- `P20` — PR20：恢复激活 — P，8 个提交 + 拆分末端
- `P21` — PR21：网络出站策略 — P/N，6 个提交
- `P22` — PR22：文件系统拒绝策略 — P，2 个提交
- `P23` — PR23：经过认证的控制台 — N，9 个提交 + 拆分末端
- `P24` — PR24：托管工作负载/报告 — N，5 个提交
- `P25` — PR25：管理平面 — P，3 个提交 + 拆分末端
- `P26` — PR26：性能分析基准测试 — U，1 个提交
- `P27` — PR27：可写共享的安全符号链接 — U/P，2 个提交
- `Z` — 仅 fork 的尾部 — F，2 个提交

**实线依赖（建议的落地/堆叠顺序）**

- `B` → `L4522` → `L4524` → `U0`
- `U0` → `P01`、`P02`、`P03`、`P04`、`P05`、`P06`、`P07`、`P08`、`P09`、`P14`（各自独立）
- `P09` → `P10`
- `P10` → `P11`
- `P10` → `P12`
- `P11` → `P13`
- `P12` → `P13`
- `P01`、`P02`、`P03`、`P04`、`P05`、`P06`、`P07`、`P08`、`P13`、`P14` → `F`
- `F` → `P15` → `P16` → `P17` → `P18` → `P19` → `P20` → `P21` → `P22` → `P23` → `P24` → `P25` → `P26` → `Z`
- `P22` → `P27`

**虚线依赖（可提前开始）**

- `P07`、`P08`、`P13` → `P21`：PR21 核心可提前开始
- `P03`、`P04`、`P13` → `P23`：PR23 协议/broker 可提前开始

## 实际分支 DAG

物理分支是一条第一父链：

```text
e1cdbd916
  -> PR01 [001-008] -> PR02 [009-011] -> PR03 [012-014]
  -> PR04 [015-020] -> PR05 [021-025] -> PR06 [026-035]
  -> PR07 [036-038] -> PR08 [039-044] -> PR09 [045-050]
  -> PR10 [051-061] -> PR11 [062-065] -> PR12 [066-070]
  -> PR13 [071-081] -> PR14 [082-086] -> PR15 [087-097]
  -> PR16 [098-101] -> PR17 [102-112] -> PR18 [113-122]
  -> PR19 [123-125] -> PR20 [126-132] -> PR21 [133-138]
  -> PR22 [139-140] -> PR23 [141-149] -> PR24 [150-154]
  -> PR25 [155-156] -> PR26 [157] -> fork tail [158-159]
  -> PR20 fixup [160] -> PR20/PR25 split [161]
  -> PR18/PR23 split [162]
  -> PR18 fixup [163] -> PR25 fixup [164] -> PR27 [165-166]
  -> 2728f33ea (mapped tip)
  -> unassigned [167-320] -> 5ab8a8462 (NVX pin)
```

为便于上游审查，PR01-PR08 和 PR14 可以独立变基到当前上游 main。PR09-PR13 构成上文所示的通用依赖链。随后，推荐的产品队列将这些基础汇聚到 PR15，并保持 PR15-PR26 有序。PR21 的通用策略执行提交可以在 PR07、PR08 和 PR13 之后准备；PR23 的协议和 broker 提交可以在 PR03、PR04 和 PR13 之后准备。移除位置 022，它已作为 microsoft/openvmm#4522 落地上游（见[上游状态](#上游状态)）。位置 158-159 仍在上游队列之外。提交前，将位置 160 折叠进 PR20，将位置 161 拆分到 PR20 和 PR25，将位置 162 拆分到 PR18 和 PR23。将位置 163 折叠进 PR18 的位置 113，将位置 164 折叠进 PR25 的位置 155。PR27 可以在 PR22 落地后准备；如果愿意，其通用路径限制提交可以独立提交。

## 映射末端之后的提交

NVX 固定的版本将链延伸过位置 166，且没有合并提交。后续 154 个提交尚未分类，也未分配到 PR。下表按链顺序按主题对它们分组；范围包含端点，与 [PR 摘要](#pr-摘要) 一致。

| 位置 | 提交范围 | 数量 | 主题 |
| ---: | --- | ---: | --- |
| 167 | `4355c010e` | 1 | 在客户机请求快照前刷新缓冲的 portb 输出 |
| 168-278 | `ad38a75c6..974f35652` | 111 | 在 KVM、MSHV 和 WHP 上实现 NVX time ABI v1；固定 CPU profile 与 `--cpu-fingerprint` 工具；移除旧版微虚拟机时钟路径；将快照清单版本 6 作为唯一格式；以及由 MSHV 和 WHP 投递写入已停止 VP 的 IRR 的 LAPIC 向量 |
| 279-280 | `8c01aabc1..b7696e7ba` | 2 | 以客户机调用者的身份处理微虚拟机 virtio-fs 共享请求 |
| 281-283 | `fc7f7b2c4..4cb5777fa` | 3 | Alder Lake CPU profile 与可选的宿主 CPU profile |
| 284-285 | `22a868409..a41cf7351` | 2 | 第二个微虚拟机 virtio-fs 槽位，位置 302 会将其移除 |
| 286-291 | `d290df675..3951c8415` | 6 | AMD CPU profile（Milan、Genoa 和 Turin）以及 AMD 宿主 profile |
| 292 | `762bc1c7a` | 1 | 微虚拟机共享的按子树访问策略 |
| 293 | `3e1f5bd48` | 1 | WHP 无需退出即可应答 CPUID leaf 0 和 1 |
| 294-296 | `92205a8ce..0eccda895` | 3 | 按代绑定的微虚拟机快照，以及按文件身份绑定的暂存磁盘 |
| 297 | `96e2363b1` | 1 | `--cpu-profile auto` 回退到宿主 profile |
| 298 | `f12dcf5e8` | 1 | 由 RAM 支持、无需暂存磁盘的微虚拟机 overlay |
| 299-301 | `3796991d5..e5bf79776` | 3 | 选择协议或目标端口范围的出站规则，以及可移植网络 profile 中的 IPv6 |
| 302-305 | `3072d7a91..7bf0ee28b` | 4 | 一个 virtio-fs 槽位上的多个宿主目录、其快照及其路径策略 |
| 306-308 | `be5297817..2130f24b5` | 3 | 作为聚合 virtio-fs 子项的单个宿主文件、其保存类型，以及请求该类型的 `file` 标志 |
| 309 | `70dde4c65` | 1 | 跨快照的分区停止状态 |
| 310-311 | `9b2073ded..d43dd87d5` | 2 | 恢复时按停机时间加上从捕获时停止到捕获锚点所记录的间隔，推进 VM 时间和 RTC |
| 312 | `a5955855c` | 1 | 微虚拟机 virtio-fs 共享上 `RENAME_EXCHANGE` 的测试：节点名称、别名限制和快照 |
| 313-314 | `5a7aad12c..1feb1f4a3` | 2 | `--mount` 中带逗号的宿主路径，其模式遵循最后一个逗号 |
| 315 | `dd8def143` | 1 | 私有网络入站：`--network-ingress allow` 将客户机公布的监听器发布给宿主私有网络上的客户端 |
| 316 | `a44fcc2aa` | 1 | 双向宿主回环访问：`--host-loopback allow` 仅为主机本身在宿主回环上发布客户机公布的监听器 |
| 317 | `7f225e2cd` | 1 | IPv6 宿主对等方出现在静态 IPv6 子网内，因此客户机从其在该子网中的地址应答它们 |
| 318 | `c6d97c529` | 1 | 独立的时间 ABI 文档：注释描述契约，而不再引用 NVX 已移除的规范 |
| 319 | `eae7da6f3` | 1 | 客户机在其网关处访问的宿主回环服务的回复来自网关，因此已连接的客户机 UDP 套接字能收到它们 |
| 320 | `5ab8a8462` | 1 | VM worker 在拆除分区和客户机内存之前停止其设备，因此没有设备 worker 会读取拆除后已取消映射的客户机内存 |

其中一些提交修改了已映射的工作，而不是新增工作。位置 255-259 移除了旧版微虚拟机时钟路径，并修改了 PR10 和 PR17 也会修改的文件。位置 261 将清单版本 6 设为唯一的快照格式，并修改了 PR11 和 PR17 也会修改的文件。因此，分配这些后续提交意味着要重新审视这些 PR，而不只是追加新的 PR。

## PR 摘要

`N + split` 表示 N 个完整提交加上来自某个物理提交的选定 hunk。此处修正位置按完整物理提交计数，但在提交前应折叠进其目标提交。

| PR | 类别 | 主题 | 实际位置 | 实际提交范围 | 数量 | 建议的直接依赖 |
| --- | --- | --- | ---: | --- | ---: | --- |
| PR01 | U | 构建与测试基础设施 | 001-008 | `8b31625e9..003d56c1f` | 8 | 当前上游 |
| PR02 | U | 宿主原语：mesh 与 sparse_mmap | 009-011 | `f07aa5f3c..e6c6c0dfe` | 3 | 当前上游 |
| PR03 | U | 宿主原语：Unix 上的 PAL | 012-014 | `568b2b348..0de137158` | 3 | 当前上游 |
| PR04 | U | 宿主原语：Windows 上的 PAL 与 PAL async | 015-020 | `501d5ddbb..01b7adbf6` | 6 | 当前上游 |
| PR05 | U | 虚拟机监控程序后端修复 | 021、023-025（022 已落地上游） | `88865bf90`；`072a7841f..a8f5a03aa` | 4 | 当前上游 `1fd455b19` |
| PR06 | U | 设备修复与加固 | 026-035 | `4e396f9df..54c5c34cd` | 10 | 当前上游 |
| PR07 | U | Consomme 资源限制 | 036-038 | `c463c8957..99c6fec26` | 3 | 当前上游 |
| PR08 | U | 预备性重构 | 039-044 | `dd349021e..bd2158d7d` | 6 | 当前上游 |
| PR09 | U | 可失败且有界的 VM 生命周期 | 045-050 | `ac994e467..a40676941` | 6 | 当前上游 |
| PR10 | U | 可移植的 CPU 与时钟状态 | 051-061 | `c1be51ed4..b3070731e` | 11 | PR09；复用 microsoft/openvmm#4524 时间控制 |
| PR11 | U | 快照发布协议 | 062-065 | `eea6dff56..f6a4471fc` | 4 | PR10 |
| PR12 | U | 不可变的私有 CoW 恢复 | 066-070 | `16a340484..91ca89d0c` | 5 | PR10 |
| PR13 | U | 通用 virtio 持久化 | 071-081 | `6bf6fe22d..18869b05e` | 11 | PR11 + PR12 |
| PR14 | U | 无固件直接启动，loader 部分 | 082-086 | `977b518d1..0ee411e5c` | 5 | 当前上游 |
| PR15 | P | 微虚拟机机器 profile 与最小 chipset | 087-097 | `b05cc3ec1..f68f2c6ab` | 11 | 基础汇聚 |
| PR16 | P | 固定的 virtio-MMIO ABI 与共享中断状态 | 098-101 | `354815ec8..9686e9460` | 4 | PR15 |
| PR17 | P | 微虚拟机快照捕获与权威恢复 | 102-112 | `2ce524409..56a2cdd15` | 11 | PR16 |
| PR18 | P | 微虚拟机宿主附件与设备持久化 | 113-122；162（拆分）；163（修正） | `f802e90f2..7e8fa8d09`；`885fde30f`（拆分）；`dc61c5189` | 11 + 拆分 | PR17 |
| PR19 | N/P | 沙箱块角色与快照层级 | 123-125 | `2236eb7c1..409efdd84` | 3 | PR18 |
| PR20 | P | 恢复时的处理器与内存激活 | 126-132；160-161 | `34ca126b5..e3a0ccfa7`；`842f5e3fd..b26d19cec` | 8 + 拆分 | PR19 |
| PR21 | P/N | 网络出站策略 | 133-138 | `8aac9a8d2..5865c2ec6` | 6 | PR20；核心可在 PR07 + PR08 + PR13 后开始 |
| PR22 | P | 文件系统拒绝策略 | 139-140 | `d085f44f3..dbe0903f1` | 2 | PR21 |
| PR23 | N | 经过认证的控制台 | 141-149；162（拆分） | `4296c40af..868601037`；`885fde30f`（拆分） | 9 + 拆分 | PR22；协议/broker 可在 PR03 + PR04 + PR13 后开始 |
| PR24 | N | 托管工作负载与结果报告 | 150-154 | `9d4ebe19d..e211e604d` | 5 | PR23 |
| PR25 | P | 管理平面 | 155-156；161（拆分）；164（修正） | `9354e0960..9a60f9f13`；`b26d19cec`（拆分）；`cb6bf8064` | 3 + 拆分 | PR24 |
| PR26 | U | 性能分析基准测试 | 157 | `980a2e7e9` | 1 | 当前栈中的 PR25 |
| PR27 | U/P | 可写微虚拟机共享的安全符号链接 | 165-166 | `8f8eca239..2728f33ea` | 2 | PR22；位置 165 可独立落地 |
| fork 尾部 | F | CI 守卫与 NVX wire-tag 兼容性 | 158-159 | `40380585d..c94a280d2` | 2 | PR26；不要提交上游 |

## 提交到 PR 的精确映射

位置 161 和 162 有意出现在两个 PR 下，因为在组建提交给上游的分支时必须拆分它们的提交。位置 163 和 164 是修正，应分别折叠进位置 113 和 155。末端位置 160-164 列在其目标 PR 下，而不是按数字顺序。计数区分完整提交与选定的拆分 hunk。带删除线的条目已落地上游，不计入计数；部分上游重叠会注明，但不会给其余 fork 工作加删除线。

<details>
<summary><strong>PR01 - 构建与测试基础设施（U）</strong> - 8 个提交</summary>

- 001 `8b31625e9` - build：在 Windows 上保持 Winsock 预先导入
- 002 `607e6c6a2` - nextest：将更长的预算限定用于穷举 ring-buffer loom 测试
- 003 `53594392c` - flowey：区分原生 Windows 与 WSL 的 nextest 路径
- 004 `ff1746110` - flowey：跳过重新安装相同且可能正在运行的 cargo-nextest 二进制文件
- 005 `fe6bd7773` - flowey：为原生本地 VMM 测试运行保留调用方临时目录
- 006 `fea2e8992` - lxutil：在测试中容忍继承的扩展属性
- 007 `b74d4e6c9` - consomme：使 TCP 窗口重开校验具有确定性
- 008 `003d56c1f` - virt_whp、petri：在 WHP 上启用原生 PCIe NVMe 启动

</details>

<details>
<summary><strong>PR02 - 宿主原语：mesh 与 sparse_mmap（U）</strong> - 3 个提交</summary>

- 009 `f07aa5f3c` - mesh_protobuf：克隆类型擦除消息并暴露编码长度
- 010 `26f8f7c99` - sparse_mmap：添加私有写时复制文件视图
- 011 `e6c6c0dfe` - sparse_mmap：以有界并发刷新文件支持的范围

</details>

<details>
<summary><strong>PR03 - 宿主原语：Unix 上的 PAL（U）</strong> - 3 个提交</summary>

- 012 `568b2b348` - pal：限制 Linux 描述符表的预扩展
- 013 `7b173b653` - pal：添加 Unix extent 克隆与稀疏 extent 定位
- 014 `0de137158` - pal：查询 Unix 套接字对等方凭据

</details>

<details>
<summary><strong>PR04 - 宿主原语：Windows 上的 PAL 与 PAL async（U）</strong> - 6 个提交</summary>

- 015 `501d5ddbb` - pal：添加不跟随重解析点的句柄相对文件访问
- 016 `b36a4755e` - pal：添加稀疏文件范围查询、清零与块克隆
- 017 `c61d77644` - pal：使用显式安全描述符创建文件和目录
- 018 `a3f124a59` - pal：解析进程令牌用户 SID
- 019 `ea77a73e8` - pal：查询命名管道对等方并创建受保护的管道
- 020 `01b7adbf6` - pal_async：修复命名管道重连与已连接状态下的监听

</details>

<details>
<summary><strong>PR05 - 虚拟机监控程序后端修复（U）</strong> - 4 个提交 + 1 个已落地上游</summary>

- 021 `88865bf90` - virt_mshv：在不使用 ACI 专有名称的情况下描述 SNP 客户机变通方案
- ~~022 `9b3ce6760` - kvm：在捕获 VP 状态期间保留挂起的外部中断~~
  （**已落地上游**：被 microsoft/openvmm#4522 取代，合并为 `392890680`）
- 023 `072a7841f` - virt_mshv：使 RUN_VP 取消无竞争
- 024 `752ff3ab5` - virt：添加 Partition::finalize_memory；在完成终结后创建 MSHV BSP
- 025 `a8f5a03aa` - virt_mshv：持久化并重新投递挂起的外部中断

</details>

<details>
<summary><strong>PR06 - 设备修复与加固（U）</strong> - 10 个提交</summary>

- 026 `4e396f9df` - chipset：在恢复期间保留 IOAPIC 线路电平
- 027 `e9946b279` - chipset：在长时间间隔内快进周期性 PIT 计数
- 028 `55e4a809f` - virtio_blk：让停止取消优先于就绪队列，并排空已接受的 I/O
- 029 `947ae858b` - virtio：让中断测试等待队列完成
- 030 `21c2206c9` - fuse：对客户机可触发的诊断进行速率限制
- 031 `cb0b3cde1` - virtiofs：使句柄和 inode ID 分配可失败
- 032 `2400875db` - virtiofs：限制客户机负载分配并对诊断进行速率限制
- 033 `6d64c181d` - serial_socket：在任何写入失败时断开连接
- 034 `a60e1210b` - serial_socket：保持 Windows 命名管道监听器可重连
- 035 `54c5c34cd` - virtio_console：对 worker 错误进行速率限制

</details>

<details>
<summary><strong>PR07 - Consomme 资源限制（U）</strong> - 3 个提交</summary>

- 036 `c463c8957` - consomme：限制活动的 TCP、UDP 和 ICMP 流
- 037 `4f543e1de` - consomme：用测试覆盖挂起 DNS 请求上限
- 038 `99c6fec26` - consomme：用测试覆盖 IPv4 分片拒绝

</details>

<details>
<summary><strong>PR08 - 预备性重构（U）</strong> - 6 个提交</summary>

- 039 `dd349021e` - openvmm_entry：接受 `delay:<ms>:<disk>` 磁盘包装器
- 040 `67fda13c7` - openvmm_helpers：在不改变行为的情况下拆分快照模块
- 041 `dea3b95d3` - net_tap：将发送路径移入独立模块
- 042 `57a52c8fa` - net_consomme：将队列发送处理移入模块
- 043 `e63353b3d` - virtio_console：将直接接收循环移入独立模块
- 044 `bd2158d7d` - openvmm_entry：当 stdin 不是终端时跳过原始控制台模式

</details>

<details>
<summary><strong>PR09 - 可失败且有界的 VM 生命周期（U）</strong> - 6 个提交</summary>

- 045 `ac994e467` - state_unit：使单元启动可失败并回滚部分启动
- 046 `16529618a` - vmcore：通过 chipset 设备 worker 添加可失败的设备启动
- 047 `d5f89e064` - openvmm：使 VM 恢复可失败
- 048 `7d578ecb7` - state_unit：在已保存状态中记录精确的单元清单
- 049 `dcf754250` - state_unit：添加带回滚分类的有界静默事务
- 050 `a40676941` - vmcore：添加设备输入静默与恢复

</details>

<details>
<summary><strong>PR10 - 可移植的 CPU 与时钟状态（U）</strong> - 11 个提交</summary>

- 051 `c1be51ed4` - vmcore、state_unit：在停止停机期间推进客户机时间
- 052 `0831fcbdf` - chipset：持久化并推进 RTC 时钟
- 053 `76b157b0e` - chipset：在恢复时拒绝不一致的 RTC 中断状态
- 054 `8f7e3f94f` - chipset：在停机后追上 PIT
- 055 `9dc92d334` - virt：定义规范的 x86 CPU 兼容性契约
- 056 `14b985ea5` - virt：添加可移植的 TSC-deadline VP 状态与 APIC 定时器推进
- 057 `d7e676ece` - virt：添加精确 TSC 频率辅助函数与快照时钟钩子
- 058 `fd20fd85b` - virt_kvm：保存和恢复精确的 TSC 与 kvm-clock 状态
- 059 `b7bc2586b` - virt_mshv：同步恢复后的 vCPU 时钟并暴露精确的 TSC 频率
- 060 `00bced019` - virt_whp：同步恢复后的 vCPU 时钟并保持 SMP TSC 读取一致
- 061 `b3070731e` - vmm_core：在停机期间推进 VP TSC 和 APIC 定时器

位置 059-060 与 microsoft/openvmm#4524 部分重叠。保留它们精确频率和恢复后 TSC 同步的工作，但在变基时用上游的 `PartitionTimeControl` 实现替换其私有分区冻结/解冻管道。

</details>

<details>
<summary><strong>PR11 - 快照发布协议（U）</strong> - 4 个提交</summary>

- 062 `eea6dff56` - openvmm_defs：添加可选的快照生命周期性能分析
- 063 `388d52800` - openvmm_helpers：为快照清单格式添加版本并限制其解码
- 064 `9f680d5b3` - openvmm_helpers：通过持久暂存原子发布快照
- 065 `f6a4471fc` - openvmm：发布精确的文件支持 RAM 句柄

</details>

<details>
<summary><strong>PR12 - 不可变的私有 CoW 恢复（U）</strong> - 5 个提交</summary>

- 066 `16a340484` - membacking：以私有写时复制映射客户机 RAM 并统计缺页
- 067 `6fa7e4cba` - openvmm_helpers：只打开一次快照，并相对于目录读取产物
- 068 `a8c616b10` - openvmm：通过私有 CoW 映射恢复 RAM 并保留代句柄
- 069 `8765361d4` - openvmm：向本地套接字或管道发出恢复就绪信号
- 070 `91ca89d0c` - virt_whp：解析未映射 GPA 缺页并延迟注册恢复的 RAM

</details>

<details>
<summary><strong>PR13 - 通用 virtio 持久化（U）</strong> - 11 个提交</summary>

- 071 `6bf6fe22d` - virtio：添加设备私有保存状态，支持延迟激活与串行化 kick
- 072 `415eed04b` - virtio：通过传输层转发输入静默与恢复
- 073 `fd4ab02c5` - virtio_console：添加附件身份以及重连和断开策略
- 074 `65442cd4e` - virtio_console：持久化缓冲的直接控制台 I/O
- 075 `df730819b` - net_backend：添加端点队列静默契约
- 076 `ebc1ef345` - net_tap：静默队列并保留挂起发送的所有权
- 077 `6614bc41e` - net_consomme：静默端点队列
- 078 `bb0544114` - consomme：添加精确的静态 IPv4 与网关身份
- 079 `5bed17bdc` - virtio_net：为静态身份 NIC 持久化已排空的队列状态
- 080 `5066f52d4` - fuse：保存和恢复协商的会话状态
- 081 `18869b05e` - virtiofs：通过 link、rename 和 unlink 跟踪 inode 别名

</details>

<details>
<summary><strong>PR14 - 无固件直接启动，loader 部分（U）</strong> - 5 个提交</summary>

- 082 `977b518d1` - loader_defs：命名 boot_params 的 ACPI RSDP 字段
- 083 `f840a0c14` - loader：让静态 ELF 加载复用调用方缓冲区
- 084 `25326daf4` - loader：添加 Intel MP 1.4 表构建器
- 085 `1adbd9f87` - loader：添加使用 MP 表的无固件 Linux 直接启动
- 086 `0ee411e5c` - vmm_core：显式表示电平触发的旧式 IRQ

</details>

<details>
<summary><strong>PR15 - 微虚拟机机器 profile 与最小 chipset（P）</strong> - 11 个提交</summary>

- 087 `b05cc3ec1` - openvmm_defs：添加机器 profile 选择
- 088 `cf523f95b` - virt：描述确定性的微虚拟机拓扑
- 089 `d99e685c9` - chipset：添加 RTC 模式接缝
- 090 `abd20e652` - vm_manifest_builder：添加不含 ACPI 的最小微虚拟机基础 chipset
- 091 `76ce1a5ac` - vmm_core：添加带退出状态的客户机关机
- 092 `a39fe4806` - chipset：添加微虚拟机 portb 控制台
- 093 `073018af8` - chipset：添加微虚拟机停机与退出状态端口
- 094 `9d8f017f7` - openvmm_core：通过 MP 表直接加载启动微虚拟机
- 095 `a0a3dd45f` - openvmm_core：拒绝微虚拟机的宿主保存、脉冲保存/恢复和 worker 重启
- 096 `345a97dba` - openvmm_entry：暴露 `--machine microvm`
- 097 `f68f2c6ab` - petri、vmm_tests：添加微虚拟机构建器、portb 测试夹具和冷启动测试

</details>

<details>
<summary><strong>PR16 - 固定的 virtio-MMIO ABI 与共享中断状态（P）</strong> - 4 个提交</summary>

- 098 `354815ec8` - virtio：允许对 virtio-MMIO 设备进行特性掩蔽
- 099 `b298c23dc` - openvmm：将 virtio 设备放置在固定的微虚拟机 MMIO 槽位
- 100 `589c217c4` - virtio：添加共享 MMIO 中断状态与 ACK 门铃
- 101 `9686e9460` - openvmm：为固定微虚拟机槽位使用共享中断状态

</details>

<details>
<summary><strong>PR17 - 微虚拟机快照捕获与权威恢复（P）</strong> - 11 个提交</summary>

- 102 `2ce524409` - vmm_core：在延迟 I/O 边界停止 VP
- 103 `c8da54eec` - chipset：添加微虚拟机快照请求端口
- 104 `637cd1034` - openvmm_core：在 worker 中建立 OUT 之后的快照边界
- 105 `3b5bb4ecd` - openvmm_core：在快照边界期间拦截管理变更
- 106 `5221003da` - openvmm_helpers：定义权威的微虚拟机机器契约
- 107 `534f68886` - openvmm_core：为支持快照的冷启动传播客户机 TSC 频率
- 108 `5751cf356` - openvmm_entry：捕获客户机请求的微虚拟机快照
- 109 `6f19f3fe2` - virt：为微虚拟机分区构建可复现的 CPU 与时钟契约
- 110 `2c43a1865` - openvmm_core：校验恢复的 CPU 与时钟契约并应用宿主停机时间
- 111 `12ba2a3b9` - openvmm_entry：以权威方式恢复微虚拟机
- 112 `56a2cdd15` - vmm_tests：检查未配置的微虚拟机快照请求会继续运行

</details>

<details>
<summary><strong>PR18 - 微虚拟机宿主附件与设备持久化（P）</strong> - 11 个提交 + 拆分末端</summary>

- 113 `f802e90f2` - openvmm_entry：添加带有限超时的 connect= 串口后端
- 114 `38177c6bf` - openvmm：持久化微虚拟机启动控制台并在恢复时重建其附件
- 115 `085961760` - openvmm：将可移植 Consomme NIC 附加到微虚拟机
- 116 `fd2ac5133` - openvmm：持久化微虚拟机 NIC 并恢复新的端点代
- 117 `1ba29fc49` - net_tap：支持持久 TAP 附件
- 118 `a139f7cd7` - virtiofs：添加固定的微虚拟机文件系统 profile
- 119 `f716cef39` - openvmm_entry：为微虚拟机 HostFs 槽位暴露 `--mount`
- 120 `0eb2e5b00` - virtiofs：持久化微虚拟机 FUSE 命名空间、句柄和目录 cookie
- 121 `f68d1eae3` - openvmm：对微虚拟机文件系统制作快照并在恢复时重新校验
- 122 `7e8fa8d09` - openvmm：预留休眠的微虚拟机文件系统槽位
- 162 `885fde30f` - 恢复时重新绑定监听器端点（**与 PR23 拆分**：启动监听器和共享附件契约部分属于 PR18；经过认证的控制监听器部分属于 PR23）
- 163 `dc61c5189` - openvmm_entry：在没有 RPC 特性时编译 connect_serial（**折叠进 113**）

</details>

<details>
<summary><strong>PR19 - 沙箱块角色与快照层级（N/P）</strong> - 3 个提交</summary>

- 123 `2236eb7c1` - openvmm：添加固定角色的微虚拟机沙箱块槽位
- 124 `b94811f13` - openvmm：使用配对或全新暂存磁盘对沙箱块制作快照
- 125 `409efdd84` - openvmm：添加克隆与恢复层级，使用一次性恢复声明

</details>

<details>
<summary><strong>PR20 - 恢复时的处理器与内存激活（P）</strong> - 8 个提交 + 拆分末端</summary>

- 126 `34ca126b5` - chipset：暴露稳定的代 ID 并在 portb 上恢复熵
- 127 `782f822ca` - openvmm：在恢复后修复完成前门控外部输入
- 128 `b80b54fc7` - vmm_core：实例化活动 VP 前缀
- 129 `15313864a` - openvmm：使恢复时的处理器前缀上线
- 130 `d23857033` - openvmm_core：用全新的私有内存支持可扩展的恢复 RAM
- 131 `e01fb70c3` - openvmm：添加有界的恢复时内存扩展
- 132 `e3a0ccfa7` - openvmm_entry：在启动时预扩展 Linux 描述符表
- 160 `842f5e3fd` - virt_mshv：仅在已创建的 VP 上同步恢复的 TSC
- 161 `b26d19cec` - openvmm_core：在 MSHV 恢复时仅实例化请求的 VP 前缀（**与 PR25 拆分**：worker 和后端变更属于 PR20；gRPC 引用 hunk 属于 PR25）

</details>

<details>
<summary><strong>PR21 - 网络出站策略（P/N）</strong> - 6 个提交</summary>

- 133 `8aac9a8d2` - net_backend_resources：定义规范且有界的 IPv4 出站策略
- 134 `5330b0cb4` - net_backend：让端点接受运行作用域的出站策略
- 135 `5cb02a192` - net_consomme：对最终发送字节执行出站策略
- 136 `94b189785` - net_tap：在 TAP 发送时执行出站策略
- 137 `76d3ec0de` - virtio_net：安装并预过滤出站策略
- 138 `5865c2ec6` - openvmm：添加微虚拟机网络出站策略并将其绑定到快照

</details>

<details>
<summary><strong>PR22 - 文件系统拒绝策略（P）</strong> - 2 个提交</summary>

- 139 `d085f44f3` - virtiofs：按对象身份强制执行被拒绝的子树
- 140 `dbe0903f1` - openvmm：添加 `--mount-deny` 并在快照中记录被拒绝的路径

</details>

<details>
<summary><strong>PR23 - 经过认证的控制台（N）</strong> - 9 个提交 + 拆分末端</summary>

- 141 `4296c40af` - serial_core：暴露本地对等方身份与活动对等方驱逐
- 142 `297e593a3` - serial_socket：报告 Unix 和命名管道对等方身份
- 143 `d671447d3` - virtio_console：定义控制会话记录协议
- 144 `d3c37ceb4` - virtio_console：添加控制会话 broker 状态机
- 145 `cf99b6a67` - virtio_console：将 broker 附加到串口 I/O 并带有接收信用额度
- 146 `6dc780a9c` - virtio_console：保存和恢复 broker 状态
- 147 `a9996abd1` - openvmm：预留专用的微虚拟机控制台槽位
- 148 `96056b299` - openvmm_helpers：在微虚拟机机器契约中记录控制台
- 149 `868601037` - openvmm_entry：添加经过认证的微虚拟机控制台端点
- 162 `885fde30f` - 恢复时重新绑定监听器端点（**与 PR18 拆分**：经过认证的控制监听器部分属于 PR23；启动监听器和共享附件契约部分属于 PR18）

</details>

<details>
<summary><strong>PR24 - 托管工作负载与结果报告（N）</strong> - 5 个提交</summary>

- 150 `9d4ebe19d` - openvmm_entry：在客户机请求退出前排空 portb 输出
- 151 `7b8f2878d` - openvmm：添加固定的非 root 工作负载身份
- 152 `921aa9caa` - openvmm：支持托管工作负载生命周期
- 153 `a264cdacd` - openvmm_entry：写入有界的微虚拟机结果报告
- 154 `e211e604d` - 指南：描述快照边界失败后的拆除

</details>

<details>
<summary><strong>PR25 - 管理平面（P）</strong> - 3 个提交 + 拆分末端</summary>

- 155 `9354e0960` - vmservice：通过管理 RPC 创建、捕获和恢复微虚拟机
- 156 `9a60f9f13` - ttrpc：传播非零客户机退出状态
- 161 `b26d19cec` - openvmm_core：在 MSHV 恢复时仅实例化请求的 VP 前缀（**与 PR20 拆分**：gRPC 引用 hunk 属于 PR25；worker 和后端变更属于 PR20）
- 164 `cb6bf8064` - openvmm_entry：将仅 RPC 的微虚拟机辅助函数置于 RPC 特性之后（**折叠进 155**）

</details>

<details>
<summary><strong>PR26 - 性能分析基准测试（U）</strong> - 1 个提交</summary>

- 157 `980a2e7e9` - openvmm_helpers：添加发布与私有恢复基准测试

</details>

<details>
<summary><strong>PR27 - 可写微虚拟机共享的安全符号链接（U/P）</strong> - 2 个提交</summary>

- 165 `8f8eca239` - lxutil：添加从不跟随符号链接的路径限制
- 166 `2728f33ea` - virtiofs：允许在读写微虚拟机共享上创建符号链接

</details>

<details>
<summary><strong>仅 fork 的尾部（F）</strong> - 2 个提交</summary>

- 158 `40380585d` - ci：将特权、自托管和发布作业限制到 microsoft/openvmm
- 159 `c94a280d2` - vmservice：保持 NVX wire-tag 兼容性

</details>

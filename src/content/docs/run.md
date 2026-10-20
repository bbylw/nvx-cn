---
title: 运行
description: 启动、退出、直接运行 OpenVMM，以及网络、挂载和托管生命周期的运行说明。
group: use
order: 3
source: doc/run.md
---

首次运行之前，从 `HEAD` 对应的发布版下载并安装宿主平台的软件包；如果 `HEAD` 没有对应的软件包，则从它最近的已发布第一父提交祖先的发布版下载并安装：

```bash
python3 scripts/nvx.py download
python3 scripts/nvx.py run
```

这会把打包的内核和 initramfs 安装到 `build/` 下，把 OpenVMM 安装到 `openvmm/target/release/` 下，因此无需本地构建。从私有仓库下载时，请将 `GH_TOKEN` 设置为具有内容读取权限的令牌。在 Linux 上，为两条命令都传入 `--hypervisor mshv`，即可使用 MSHV 软件包。

CLI 在 Windows 上选择 WHP，在 Linux 上选择 KVM：

```bash
python3 scripts/nvx.py run
```

Alpine 启动成功时会同时打印 `ALPINE-MICROVM-BOOT-OK` 和 `NVX-GUEST-BOOT-OK: alpine`。用同一个 NVX 内核启动 Ubuntu 用户态：

```bash
python3 scripts/nvx.py run --guest ubuntu
```

Ubuntu 默认使用 512 MiB，并打印 `NVX-GUEST-BOOT-OK: ubuntu`。它是运行在 NVX 内核上的 Ubuntu 用户态，而不是原版 Ubuntu 内核或 systemd 虚拟机。用 `--guest azurelinux` 以同样的方式启动 Azure Linux 3.0 用户态。内核会把它的 rootfs 解包到 RAM 文件系统，该文件系统上限为客户机内存的一半，因此默认为 512 MiB，并打印 `NVX-GUEST-BOOT-OK: azurelinux`。用以下命令从客户机正常退出：

```sh
/sbin/nvx-exit 0
```

在不改变生成的设备 ABI 的前提下传入额外的客户机选项：

```bash
python3 scripts/nvx.py run \
  --memory-mib 256 \
  --net 10.0.0.2/24 \
  --network-profile portable \
  --cmdline "quiet loglevel=0"
```

网络功能要求显式指定 `portable` 能力配置。它在 KVM、MSHV 和 WHP 上使用同一个进程内数据平面；省略 `--net` 或 `--network-profile portable` 中的任何一个，都会在 OpenVMM 启动前被拒绝。

在构建了匹配的专用客户机内核之后，选择显式的处理器数量：

```bash
python3 scripts/nvx.py run --machine microvm --processors 8
```

微虚拟机使用固定的设备拓扑，保留一个共享的中断状态页，并在 1、2、4 或 8 个 vCPU 时使用共享状态的边沿触发 virtio 中断。

## 直接运行 OpenVMM

各平台的发布归档是自包含的；`scripts/nvx.py` 只是便利封装，运行时并不需要它。解压与宿主匹配的归档，并在其 `nvx-VERSION-PLATFORM` 目录中运行以下命令。对于 Linux/KVM：

```bash
./bin/openvmm \
  --single-process \
  --machine microvm \
  --processors 1 \
  --hypervisor kvm \
  --memory 128M \
  --kernel guest/vmlinux \
  --initrd guest/initramfs.cpio.gz
```

对于 Windows/WHP，在 PowerShell 中：

```powershell
.\bin\openvmm.exe `
  --single-process `
  --machine microvm `
  --processors 1 `
  --hypervisor whp `
  --memory 128M `
  --kernel guest\vmlinux `
  --initrd guest\initramfs.cpio.gz
```

对于 Linux/MSHV，使用 `linux-mshv` 归档，并把 `kvm` 替换为 `mshv`。如果产物已经按仓库布局安装，请使用 `openvmm/target/release/openvmm[.exe]`、`build/vmlinux` 和 `build/initramfs.cpio.gz`，而不是上面这些路径。

对于 Ubuntu 用户态，使用 512 MiB，并选择 `guest/initramfs-ubuntu.cpio.gz` 或 `build/initramfs-ubuntu.cpio.gz` 作为 initrd。低于 320 MiB 时，内核无法解包整个 Ubuntu initramfs，会启动一个被截断的根。内核路径保持不变。

直接启动 OpenVMM 时，接受通用的方向性网络默认值：

```bash
./bin/openvmm \
  --single-process \
  --machine microvm \
  --hypervisor kvm \
  --memory 128M \
  --kernel guest/vmlinux \
  --initrd guest/initramfs.cpio.gz \
  --net 10.0.0.2/24 \
  --network-profile portable \
  --network-egress allow \
  --network-ingress deny
```

出站默认为 `allow`，入站默认为 `deny`。入站为 `deny` 时，对客户机发起连接的响应仍然可用，但新的入站连接不可用。入站为 `allow` 时，宿主私有网络上的客户端可以访问客户机的监听端口，如[私有网络入站](#私有网络入站)所述。

网卡是双栈的。客户机的 IPv6 地址把它的 IPv4 地址嵌入唯一本地前缀 `fd00::/96`，前缀长度为 96 加上 IPv4 前缀，其 IPv6 网关也以同样方式嵌入 IPv4 网关：`10.0.0.2/24` 会为客户机生成 `fd00::a00:2/120`，其网关为 `fd00::a00:1`。客户机静态配置这两个身份；它既不请求路由器通告，也不从中自动配置地址，因此它在链路之外的唯一其他 IPv6 地址是 `fe80::/64` 中内核的链路本地地址。与 IPv4 网关一样，IPv6 网关会应答 ICMPv6 回显请求，并在允许宿主回环访问时，把 TCP 和 UDP 流映射到宿主回环，这里是 `::1`。由于客户机在链路之外的唯一 IPv6 源地址是唯一本地地址，标准地址选择会优先使用 IPv4 访问同时具有两者的目的地址。

对于目的地址和端口规则，选择显式默认值，并重复使用通用的 allow/deny 选项：

```bash
./bin/openvmm \
  --single-process \
  --machine microvm \
  --hypervisor kvm \
  --memory 128M \
  --kernel guest/vmlinux \
  --initrd guest/initramfs.cpio.gz \
  --net 10.0.0.2/24 \
  --network-profile portable \
  --network-egress deny \
  --network-egress-allow 140.82.112.0/20:tcp:443 \
  --network-egress-deny 140.82.114.0/24:tcp:443
```

规则匹配 IPv4 或 IPv6 地址或 CIDR，并可选择一个协议：`tcp`、`udp` 或 `icmp`。TCP 或 UDP 规则可以添加一个目的端口，或写成 `FIRST-LAST` 的闭区间端口范围；不指定端口时，它匹配该协议的所有端口。端口范围是 `1` 到 `65535`，范围的结束端口不能低于起始端口。ICMP 规则不带端口，IPv6 ICMP 规则匹配 ICMPv6。例如，`192.0.2.0/24:udp` 匹配所有端口的 UDP，`192.0.2.1:tcp:8000-8010` 匹配 TCP 端口 8000 到 8010，但不匹配 UDP，`192.0.2.1:icmp` 匹配 ICMP 但不匹配 TCP 或 UDP，`2001:db8::/32:tcp:443` 匹配该 IPv6 网络上的 TCP 端口 443。deny 匹配优先于 allow 匹配，因此添加 `--network-egress-deny 192.0.2.1:tcp:8005` 会让该范围内的端口 8005 保持阻断。

规则只匹配自身地址族的目的地址，因此 IPv4 规则绝不会放行 IPv6 流量，反之亦然；`deny` 默认值会阻断任何没有 IPv6 规则允许的 IPv6 目的地址。使用 `0.0.0.0/0` 和 `::/0` 匹配某个地址族的所有目的地址。与 IPv4 网关的 ARP 类似，IPv6 网关的邻居发现（Neighbor Discovery）在 `allow` 默认值下或存在任何 IPv6 allow 规则时被允许。网关从不转发携带扩展头或目标为 IPv4 映射地址的 IPv6 数据包。当策略允许访问 IPv4 网关的 TCP 或 UDP 端口 53 时，客户机把该 IPv4 网关指定为 DNS 服务器；否则，当策略允许访问 DNS 时，把 IPv6 网关指定为 DNS 服务器。

NVX 可以把协议选择器、闭区间 TCP/UDP 端口范围以及规则局部的 IPv4 或 IPv6 排除项下沉为这些原生规则：

```json
{
  "allow": [
    {
      "to": [
        {
          "cidr": "192.0.2.0/24",
          "except": ["192.0.2.128/25"]
        }
      ],
      "ports": [
        {
          "protocol": "tcp",
          "port": 8000,
          "endPort": 8010
        }
      ]
    },
    {
      "to": [
        {
          "cidr": "192.0.2.200/32"
        }
      ]
    },
    {
      "to": [
        {
          "cidr": "198.51.100.0/24"
        }
      ],
      "ports": [
        {
          "protocol": "any",
          "port": 443
        }
      ]
    },
    {
      "to": [
        {
          "cidr": "198.51.100.7/32"
        }
      ],
      "ports": [
        {
          "protocol": "icmp"
        }
      ]
    },
    {
      "to": [
        {
          "cidr": "2001:db8::/48",
          "except": ["2001:db8::/56"]
        }
      ],
      "ports": [
        {
          "protocol": "tcp",
          "port": 443
        }
      ]
    }
  ],
  "deny": [
    {
      "to": [
        {
          "cidr": "192.0.2.0/24"
        }
      ],
      "ports": [
        {
          "protocol": "tcp",
          "port": 8005
        }
      ]
    }
  ]
}
```

在 `run`、一次性 `sandbox run` 或 `sandbox provision` 上，用 `--network-egress-policy-file PATH` 传入该文件。必须显式指定 `--network-egress allow` 或 `deny`。文件选项不能与 `--network-egress-allow` 或 `--network-egress-deny` 混用。

根对象只接受 `allow` 和 `deny` 数组。每个元素使用 MXC 的 `NetworkRule` 结构：可选的 `to` 和 `ports` 数组。省略 `to` 会匹配所有 IPv4 和 IPv6 目的地址。每个 `to` 条目需要一个 IPv4 或 IPv6 的 `cidr`；可选的 `except` 条目必须是该父项所包含的同地址族 CIDR，每个地址族的条目会下沉为该地址族的原生规则。主机位按原生 CIDR 语法规范化：`10.0.0.5/24` 表示 `10.0.0.0/24`，而不是单个主机。使用 `/32` 选择一个 IPv4 地址，使用 `/128` 选择一个 IPv6 地址。IPv6 作用域 ID 会在规范化主机位之前被拒绝，因此 `fe80::1%eth0/64` 是错误，而不是 `fe80::/64`。

省略 `ports` 会匹配原生规则支持的所有传输协议。每个端口选择器遵循 MXC：`protocol` 默认为 `any`。不带 `port` 时，`tcp` 和 `udp` 匹配该协议的所有端口，`icmp` 只匹配 ICMP（对 IPv6 目的地址则是 ICMPv6），`any` 匹配所有协议。`1..65535` 范围内的 `port` 适用于 `tcp`、`udp` 或 `any`；`any` 会展开为该端口上的 TCP 和 UDP，但不包括 ICMP。可选的闭区间 `endPort` 需要 `port`，且不能低于它。

重复的 JSON 属性、未知字段以及显式的 `null` 协议值都会被拒绝。策略文件限制为 1 MiB 的 UTF-8 输入。为兼容起见，仍接受旧的扁平 `cidr`/`except`/`protocol`/`port` 规则形式，其中 `cidr` 为 IPv4 或 IPv6，但新的策略文件应使用 MXC 结构。

端口范围会为每个目的网络下沉为一条原生 `FIRST-LAST` 规则。因此上文的策略会允许 `192.0.2.0/25:tcp:8000-8010`，它匹配该网络上的 TCP 端口 8000 到 8010，但不匹配 UDP 或端口 7999 和 8011；它的 deny 规则 `192.0.2.0/24:tcp:8005` 会让该范围内的端口 8005 保持阻断。

排除项只影响其所属规则：它们永远不会成为全局 deny 规则。因此，后面的 allow 规则可以匹配被前面 allow 规则排除的地址；而被 deny 规则排除的地址会落到其他规则和显式默认值。显式 deny 匹配仍然优先于 allow 匹配。

NVX 会规范化安全等价的前缀，合并每个网络中相邻和重叠的端口范围，并拒绝下沉后 allow 规则或 deny 规则超过 256 条的策略，两个地址族合并计数；带端口或端口范围的 `any` 协议会下沉为一条 TCP 和一条 UDP 规则。NVX 会在启动前拒绝过大的展开，而不是截断或放宽它们。托管 provision 会把经过验证的下沉规则存入沙箱状态，因此后续启动不会重新读取可变的源策略文件。

宿主回环阻断和有意发布 localhost 端口与普通出站分开控制：

```bash
./bin/openvmm \
  --single-process \
  --machine microvm \
  --hypervisor kvm \
  --memory 128M \
  --kernel guest/vmlinux \
  --initrd guest/initramfs.cpio.gz \
  --net 10.0.0.2/24 \
  --network-profile portable \
  --host-loopback deny \
  --network-proxy 10.0.0.1:3128
```

使用 `deny` 时，一般性的客户机到宿主回环访问以及所有宿主到客户机的转发都会被阻断，但精确的 TCP 代理端点仍然可用。即使允许普通出站，同一端口上的 UDP 和其他宿主服务端口仍然被阻断。

显式的 `--host-loopback allow` 在不指定端口列表的情况下双向开放客户机与宿主回环之间的访问，`--host-loopback-forward` 会发布更多 localhost 端口；参见[宿主回环访问](#宿主回环访问)。省略 `--host-loopback` 会保留现有的客户机到宿主映射，但不发布客户机端口。客户机发起的流量仍然受出站策略约束。

大多数 `nvx.py run` 选项原样传递：`--machine`、`--processors`、`--cpu-profile`、`--mount`、`--net`、`--network-profile`、`--cmdline`、`--restore-snapshot`、`--restore-processors` 和 `--restore-ready-path`。封装脚本会执行以下转换和补充：

| `nvx.py run` | 直接 OpenVMM 选项 |
| --- | --- |
| `--guest alpine` | 全新启动时的 `--initrd .../initramfs.cpio.gz` |
| `--guest ubuntu` | 全新启动时的 `--initrd .../initramfs-ubuntu.cpio.gz` 以及 512 MiB 默认值 |
| `--guest azurelinux` | 全新启动时的 `--initrd .../initramfs-azurelinux.cpio.gz` 以及 512 MiB 默认值 |
| `--hypervisor auto` | Linux 上的 `--hypervisor kvm` 或 Windows 上的 `--hypervisor whp` |
| `--memory-mib N` | `--memory NM` |
| `--memory-capacity-mib N` | 全新启动时的 `--memory-capacity NM` |
| `--restore-memory-mib N` | `--restore-memory NM` |
| `--dry-run` | 无对应项；它只打印生成的命令 |

始终包含 `--single-process`。恢复时，省略 `--memory`、`--kernel` 和 `--initrd`。每次恢复都会通过时间 ABI 的恢复数据包为客户机提供新的熵，因此不再需要 `--restore-entropy`；OpenVMM 仍会接受它，但不起作用。恢复期间不要传入 `--guest ubuntu`；捕获的 RAM 和机器契约已经标识了要恢复的客户机。例如：

```bash
./bin/openvmm \
  --single-process \
  --machine microvm \
  --processors 8 \
  --hypervisor kvm \
  --restore-snapshot /var/lib/nvx/snapshot \
  --restore-processors 4 \
  --restore-memory 1024M \
  --restore-ready-path /run/nvx/restore-ready.sock
```

### 私有网络入站

入站 `allow` 允许宿主私有网络上的客户端访问客户机监听的每个 TCP 和 UDP 端口，无需端口列表：

```bash
./bin/openvmm \
  --single-process \
  --machine microvm \
  --hypervisor kvm \
  --memory 128M \
  --kernel guest/vmlinux \
  --initrd guest/initramfs.cpio.gz \
  --net 10.0.0.2/24 \
  --network-profile portable \
  --network-egress deny \
  --network-ingress allow
```

OpenVMM 会把 `virtnet_ingress=allow` 追加到内核命令行，客户机的 init 随后启动 `nvx-ingress`，后者把客户机正在监听的 TCP 套接字以及未连接的 UDP 套接字报告给网关，绑定到回环地址或 IPv6 链路本地地址的套接字除外。它会在 100 毫秒内报告变更（新 UDP 套接字约需一秒），并每 2 秒重复报告一次。只有客户机 root 能从特权端口发送报告，出站策略不适用于该报告。对于每个报告的端口，OpenVMM 会在客户机监听的每个地址族的每个宿主地址的同一端口上监听，并把连接和数据报中继到客户机。

只有当客户端地址不是全局可达时，OpenVMM 才会接纳它，例如位于 `10.0.0.0/8`、`172.16.0.0/12`、`192.168.0.0/16`、`100.64.0.0/10`、`169.254.0.0/16` 或 `fc00::/7` 中的地址。它会重置其他客户端的 TCP 连接并丢弃其 UDP 数据报，因此互联网客户端永远无法到达客户机。它还会拒绝客户机无法应答的客户端：位于客户机自身网络内的客户端，例如针对 `10.0.0.2/24` 的 `10.0.0.0/24` 和 `fd00::a00:0/120`，客户机会把它们当作自己的网关或邻居；以及 IPv6 链路本地客户端。因此请选择不包含任何客户端的客户机网络。宿主自身，无论是回环地址还是它自己的某个地址，都算作宿主回环：OpenVMM 只在显式指定 `--host-loopback allow` 时才接纳它。对被接纳客户端的回复不受出站策略限制，而客户机自身的连接仍然受其约束。

发布是尽力而为的。OpenVMM 无法发布宿主进程占用的端口，在 Linux 上也无法发布它无权绑定的特权端口；它会记录一条警告，并在下次报告时重试。指向同一客户机端口的显式 `--host-loopback-forward` 仍可与该发布并存。客户机最多报告 64 个端口。监听 `::` 的 TCP 套接字也会计入 IPv4，除非它是仅 IPv6 的；监听 `::` 的 UDP 套接字同理，除非客户机设置了 `net.ipv6.bindv6only`。其他宿主上的客户端还需要宿主防火墙放行它们访问 OpenVMM，例如在 Windows 上为 `openvmm.exe` 添加入站规则。快照捕获和恢复会拒绝入站 `allow`，因为发布的监听器是活动的宿主附件。

### 宿主回环访问

显式的 `--host-loopback allow` 在不指定端口列表的情况下，把宿主回环开放给客户机，也把客户机开放给宿主回环：

```bash
./bin/openvmm \
  --single-process \
  --machine microvm \
  --hypervisor kvm \
  --memory 128M \
  --kernel guest/vmlinux \
  --initrd guest/initramfs.cpio.gz \
  --net 10.0.0.2/24 \
  --network-profile portable \
  --network-egress deny \
  --host-loopback allow
```

客户机通过其网关访问宿主回环服务，并受出站策略约束：宿主上 `127.0.0.1:8080` 的服务可通过 `10.0.0.1:8080` 访问，`[::1]:8080` 的服务可通过 `[fd00::a00:1]:8080` 访问。它们的回复来自客户机所寻址的网关地址和端口，因此已连接的 UDP 套接字也能收到回复。客户机会在 OpenVMM 于其自身网络内分配的地址上看到其他宿主对端，例如其发布端口的客户端；出站策略会约束客户机到这些对端的流量，就像它在网关处生效一样，因此拒绝某个网关端口的规则也会在这些地址上拒绝该端口。在另一个方向上，除非入站为 `allow`，OpenVMM 会把 `virtnet_ingress=host-loopback` 追加到内核命令行，客户机的 `nvx-ingress` 会像[私有网络入站](#私有网络入站)那样报告其监听器。对于每个报告的端口，OpenVMM 会在宿主 `127.0.0.1` 或 `::1` 的同一端口上监听，覆盖客户机监听的每个地址族，并且只接纳宿主，因此宿主的网络和互联网都无法到达客户机。对宿主的回复不受出站策略限制。仅绑定到 `127.0.0.1` 或 `::1` 的客户机监听器永远不会被报告，并对客户机保持私有。宿主进程占用的端口，无论是在回环上还是在所有宿主地址上，都归该进程所有：OpenVMM 会记录一条警告，并在下次报告时重试。若宿主进程随后在某个已发布端口上绑定所有宿主地址，在 Linux 上会失败；在 Windows 上，除非它请求独占该端口，否则会成功，但收不到回环流量，这些流量仍归客户机，与任何仅监听回环的宿主进程一样。如果入站也为 `allow`，OpenVMM 在所有宿主地址上发布的监听器则会改为接纳宿主。

`/30` 的客户机网络只能容纳网关和客户机，因此 OpenVMM 改为在网关处呈现 IPv4 宿主对端。TCP 仍然可用，但客户机通过 `127.0.0.1` 发往宿主客户端的 UDP 回复不会经由发布端口返回，因此使用 `--host-loopback allow` 时请选用 `/29` 或更大的网络。NVX Rust API 会拒绝 `/30` 的宿主回环访问。`/30` 的 IPv6 子网会为宿主对端保留一个地址。

重复使用 `--host-loopback-forward tcp:HOST_PORT:GUEST_PORT` 或其 UDP 形式（最多 64 次），即可把更多 localhost 端口发布到你选择的客户机端口，例如把宿主 `127.0.0.1:18080` 发布到客户机端口 `8080`；转发需要显式的 `--host-loopback allow`。同一协议的每次转发都需要各自的宿主端口和客户机端口：OpenVMM 会在启动前拒绝重复的宿主端口，并在启动时因重复的客户机端口而失败。客户机会在 OpenVMM 于其自身网络内分配的地址上应答转发流量，出站策略会过滤这些回复，因此转发端口需要一条允许它们出站的出站策略。快照捕获和恢复会拒绝显式的 `--host-loopback allow`，因为其监听器是活动的宿主附件。

## 从已退役的配置迁移

`microvm` 现在是唯一的选择器，并启动先前名为 `microvm-v2` 的契约。`microvm-v2` 拼写、以前单 vCPU 的 ABI-1 行为、ABI-1 设备 I/O 控制、TTRPC 数值 1、ABI-1 快照恢复以及 boot-layout-1 快照恢复均已移除。快照元数据和性能序列继续使用数值 ABI 值 2 和 boot-layout 值 2。要运行已退役的 ABI-1 客户机或快照，请使用 NVX 提交 `cb52bcd454b454cb241096c33ed42a1dcdc65347` 搭配 OpenVMM 提交 `1b70365613517a10718e00284a62bdffbd80e41c`，或更早的兼容组合。

## 快照恢复就绪

使用可选的宿主就绪端点恢复现有微虚拟机快照：

```bash
python3 scripts/nvx.py run \
  --machine microvm \
  --processors 8 \
  --restore-snapshot /var/lib/nvx/snapshot \
  --restore-processors 4 \
  --restore-memory-mib 1024 \
  --restore-ready-path /run/nvx/restore-ready.sock
```

该端点必须已经在监听。OpenVMM 会连接 Linux 上的 Unix 域套接字或 Windows 上的 `//./pipe/...` 命名管道，并在快照验证、附件解析、工作线程启动、受门控的客户机修复以及宿主输入重新启用全部完成、且恢复的 vCPU 仍处于停止状态之后，准确写入 `OPENVMM_RESTORE_READY_V1\n`。使用 `--restore-processors` 时，快照保持其不可变的八 vCPU 容量；源必须已捕获规范的 `maxcpus` 启动上线前缀，客户机会在就绪和宿主输入释放之前准确上线所请求的前缀。目标处理器数量限制为 1、2、4 或 8，不能低于已捕获的启动上线数量，也不能高于容量。旧版快照会拒绝该选项。对端必须在启动进行期间接受并读取；Windows 上的刷新完成会等待命名管道对端消费该帧。无法写完整事件会中止并拆除恢复过程。

要在恢复时扩展内存，请用 `--memory-mib 512 --memory-capacity-mib 2048` 捕获一个新快照，然后用 `--restore-memory-mib 512`、`1024` 或 `2048` 选择目标。快照的 `memory.bin` 仍恰好为 512 MiB；选定的扩展范围会获得每次启动全新的后备存储，并在恢复就绪之前上线。

## virtio-fs 宿主映射

微虚拟机有一个 virtio-fs 槽位，固定标签为 `microvm`。使用 `--mount` 冷启动时，initramfs 会自动挂载该映射：

```bash
python3 scripts/nvx.py run --mount "/mnt/host,/absolute/host/share,rw"
```

PowerShell 示例：

```powershell
python scripts\nvx.py run `
  --mount "/mnt/host,C:\Users\me\microvm-share,rw"
```

使用 `ro` 表示只读访问。客户机目标必须是绝对的 Linux 路径。它在第一个逗号处结束，而模式跟在最后一个逗号之后，因此当给出模式时，宿主路径可以包含逗号，此时也必须给出模式：

```powershell
python scripts\nvx.py run `
  --mount "/mnt/alpha,C:\projects\alpha,beta,rw" `
  --mount "/mnt/reports,C:\reports\2026, final,ro" `
  --mount-deny "C:\projects\alpha,beta\secrets" `
  --mount-deny "C:\reports\2026, final\secrets"
```

重复使用 `--mount` 可以附加更多目录，每个目录都有自己的目标和访问模式，例如在一个只读工具缓存旁边放一个读写工作区：

```bash
python3 scripts/nvx.py run \
  --mount "/workspace,/srv/checkout,rw" \
  --mount "/opt/hostedtoolcache,/opt/hostedtoolcache,ro"
```

`--mount` 也可以共享一个常规宿主文件。客户机随后可以在其目标处访问该文件，但既不能访问其目录，也不能访问其同级文件，例如在一个读写结果文件旁边放一个只读设置文件：

```bash
python3 scripts/nvx.py run \
  --mount "/config/settings.json,/srv/app/config/settings.json,ro" \
  --mount "/results/output.txt,/srv/app/results/output.txt,rw"
```

存在多个映射或一个共享文件时，NVX 会以聚合方式附加该槽位：OpenVMM 的 `--mount-aggregate /run/nvx/shares`，每个映射按顺序对应一个 `--mount-child NAME,HOST_PATH,MODE[,file]`，其中 OpenVMM 的 `file` 标志标记共享文件，因此 OpenVMM 会拒绝替换该文件的目录，而不是把它整个导出。initramfs 会把聚合挂载到 `/run/nvx/shares`，其根目录为每个映射列出一个条目，且只有 root 能进入，然后把每个条目按其模式和 `nosuid,nodev` 绑定到其目标，正如内核命令行上的 `nvx_share=NAME,TARGET,MODE[,file]` 令牌所描述的那样。`file` 后缀标记共享文件，initramfs 会把它绑定到它在目标处创建的常规文件，同时创建目标缺失的目录；已存在的目标必须已经是常规文件。映射的名称是它的索引、一个连字符，以及其目标 SHA-256 摘要的前 32 个十六进制数字。快照会记录每个名称，因此会固定每个目标：请求另一个目标的恢复会在客户机运行之前失败，而不是在快照的目标处恢复绑定。

OpenVMM 会在宿主上强制执行每个映射的访问模式，因此只读映射会以 `EROFS` 拒绝写入，即使客户机 root 以读写方式重新挂载其绑定或通过 `/run/nvx/shares` 写入。映射之间的重命名会以 `EXDEV` 失败，硬链接也是如此，除非其目标是只读的，此时会先以 `EROFS` 失败。OpenVMM 单独提供共享文件：客户机无法列出、检查或更改该文件所在目录，也无法访问其同级项，文件下方的查找会以 `ENOTDIR` 失败，读写文件可以原地重写，但不能替换、重命名或删除。OpenVMM 会跟随文件的名称，因此客户机看到的是宿主软件（例如编辑器）覆盖保存后的文件；当该名称被任何非常规文件占用时，请求会以 `EACCES` 失败。彼此相等或相互包含的客户机目标或 `/run/nvx/shares`，以及彼此相等或相互包含的宿主路径（例如共享目录中的共享文件，或指向同一文件的两个硬链接），都会在启动前被拒绝。映射数量仅受这些令牌与 `--cmdline` 在内核命令行上共享的 1024 字节预算限制。带有映射的快照要求相同的映射，顺序相同，规范的宿主路径、种类、目标、模式和文件系统身份也相同，因此恢复会拒绝自捕获以来被替换的共享文件。

可重复使用的 `--mount-deny HOST_PATH` 会隐藏映射根目录中已有的文件或目录。存在多个映射或一个共享文件时，每个 `--mount-deny`、`--mount-allow` 和 `--mount-write` 路径都必须是绝对路径，并应用于其根目录包含该路径的映射。共享文件不接受这些选项，因为它的模式适用于整个文件。被拒绝的名称会从目录列表中省略，并且通过 `..`、符号链接/联接点或同一 virtio-fs 设备的另一个挂载仍然无法访问。名称可以包含空格，但不能以空格开头或结尾。当其中的 `--mount-allow` 路径仍然存在时，`--mount-deny` 可以指定映射的根目录本身：此时根目录只列出通往这些路径的入口。不安全、外部、重复、重叠和嵌套挂载规则会在启动前被拒绝。可重复使用的 `--mount-allow HOST_PATH` 会再次暴露被拒绝路径中的某个路径，可重复使用的 `--mount-write HOST_PATH` 会使某个路径成为 `rw` 映射中少数可写部分之一；参见[访问策略](#访问策略)。使用这些路径捕获的快照要求相同的被拒绝、被允许和可写路径。

在 `rw` 映射中，客户机可以创建符号链接，OpenVMM 会按给定内容原样存储每个目标。客户机在自己的命名空间中解析链接；OpenVMM 在解析宿主路径时从不跟随链接，因此指向绝对宿主路径、根目录之外或已拒绝路径的链接无法触达宿主数据。`ro` 映射会以 `EROFS` 拒绝创建链接。在 Windows 上，链接是 WSL 风格的重解析点，Windows 路径解析从不跟随它们。当宿主软件稍后读取目录时，请把可写共享中的链接视为不可信。

在 Linux 宿主上，客户机还可以用 `renameat2(RENAME_EXCHANGE)` 原子地交换 `rw` 映射中的两个名称，正如 `exch` 所做的那样；在交换后立即捕获的快照会让每个名称与其对象保持对应。Windows 宿主会以 `EINVAL` 拒绝重命名标志，且不更改任何一个名称。

默认情况下，OpenVMM 以自身用户身份执行映射上的每个客户机操作。在 Linux 宿主上，`--mount-owner caller` 改为以客户机调用者的 UID 和 GID 执行每个操作，并把客户机 root 压缩为共享宿主目录或文件的所有者，因此客户机 root 创建的文件归该所有者所有，而不是归 root 或 OpenVMM 所有；参见[文件所有权](#文件所有权)。带有映射捕获的快照还要求相同的 `--mount-owner` 模式。捕获和恢复会以 OpenVMM 用户身份检查和重新打开客户机已打开的文件，因此除非 OpenVMM 以 root 运行，否则当客户机持有只有其调用者才能访问或重新打开的文件（例如以写入方式打开的文件）时，它们会失败。

不带映射捕获的快照在恢复时可以新增一个目录的 `--mount`，但不能新增多个，也不能新增文件；恢复之后，请在客户机内显式挂载它，因为 initramfs 钩子已经完成：

```sh
mkdir -p /mnt/host
mount -t virtiofs microvm /mnt/host
```

## 实验性单工作负载沙箱

`sandbox` 命令用一个压缩的 EROFS 发行版层和一个预格式化的 ext4 暂存磁盘镜像启动微虚拟机。`nvx.py` 使用 [`nvx-rs`](/docs/usage/) 运行它——它会查找该 crate，或用 Cargo 构建——如[命令行参考](/docs/usage/)所述：

```bash
python3 scripts/nvx.py build-distro-layer \
  --guest ubuntu \
  --output build/ubuntu-distro.erofs
```

从 `build/ubuntu-distro.erofs.manifest.json` 读取确定性 UUID，用 `mkfs.ext4` 独立创建暂存磁盘，然后通过现有的 Alpine 控制 initramfs 启动 Ubuntu 工作负载：

```bash
python3 scripts/nvx.py sandbox \
  --layer distro,build/ubuntu-distro.erofs,11111111-1111-1111-1111-111111111111 \
  --scratch /var/lib/nvx/scratch.ext4 \
  --entrypoint /bin/sh \
  --workload-user 65534:65534 \
  --memory-mib 256
```

CI 使用 `/sbin/nvx-sandbox-smoke` 作为入口点，在客户机正常退出之前验证本节描述的安全配置。在任何其他检查之前，它要求：

- 固定的 `65534:65534` 身份作为真实、有效、保存和文件系统 ID，没有补充组，且 `HOME=/nonexistent`；
- 可继承、允许、有效、边界和环境能力集为空，且 `NoNewPrivs: 1`；
- 挂载、PID 和 UTS 命名空间不同于客户机的初始命名空间，其 inode 编号由 Linux 6.18 在其 UAPI 中固定，工作负载是其 PID 命名空间中的 PID 1，`--hostname` 值作为其主机名；
- 在 `/`、`/proc`、`/sys`、`/dev`、`/dev/pts` 和 `/dev/shm` 各恰好有一个挂载，且都不会传播到另一个命名空间：在 EROFS 层之上的 overlay 根，其中上层目录位于暂存磁盘上；`nosuid,nodev,noexec` 的 procfs；只读 sysfs；以及一个私有的 `/dev` tmpfs，其中只包含 `fd`、`full`、`null`、`ptmx`、`pts`、`random`、`shm`、`stderr`、`stdin`、`stdout`、`tty`、`urandom` 和 `zero`，并拥有自己的 devpts 实例；
- 代理所有的 `/container` cgroup；以及
- 工作负载无法修改的 Ubuntu 镜像文件，以及写入落在 overlay 中的、由暂存磁盘支撑的 `/tmp` 写入。

如果托管工作负载挂载到代理的命名空间中，它的运行时挂载就会叠加在先前请求的挂载之上，因此单挂载检查也覆盖重复的托管 exec。使用 `--arg limits --arg MEMORY_MAX --arg PIDS_MAX` 时，对于用相同 `--memory-max` 和 `--pids-max` 启动的沙箱，它还要求内存控制器以 `SIGKILL` 杀死分配两倍 `MEMORY_MAX` 的请求，同时 1 MiB 的分配成功；并要求 pids 控制器在 `PIDS_MAX` 个进程（包括自身）时停止工作负载；请让两倍 `MEMORY_MAX` 保持在客户机的空闲内存之内。使用 `--arg TARGET --arg ro|rw` 时，它还会按下文所述检查 `TARGET` 处的活动共享，包括 `rw` 共享中的符号链接；该共享需要一个由宿主创建、全局可写的 `nvx-links` 目录来存放这些链接。使用 `--arg TARGET --arg file-ro|file-rw` 时，它检查 `TARGET` 处的共享文件：以给定模式绑定的 `virtiofs` 挂载，独占其目录，存放 `host-to-guest`，工作负载既不能删除也不能重命名它。它要求对 `file-ro` 文件的写入以 `EROFS` 失败，因此宿主必须允许每个身份写入该文件；它还会向 `file-rw` 文件写入 `guest-to-host`。重复该对参数可以检查多个共享；存在一个 `rw` 和一个 `ro` 共享时，它还会验证 `rw` 共享中的链接无法写入 `ro` 共享。使用 `--mount-owner caller` 时，`--arg caller` 会执行 `rw` 检查，并验证工作负载拥有它创建的内容、能在它创建的目录中填充内容，并在自己的 `nvx-caller-links` 目录中创建链接；而 `--arg eperm` 要求读取和列出该共享以 `EPERM` 失败、写入失败，这正是 OpenVMM 无法采用工作负载身份时的结果。`--arg policy` 检查一个 `rw` 共享，其[访问策略](#访问策略)拒绝 `nvx-denied`、允许 `nvx-denied/nvx-allowed`，并只让 `nvx-writable` 可写：工作负载只能在 `nvx-writable` 内写入，在其他所有位置得到 `EROFS`，不能把只读文件硬链接到 `nvx-writable`，并且在 `nvx-denied` 中只能看到保持可读的 `nvx-allowed`。该共享的其他目录和文件必须对每个身份都可写，这样只有 OpenVMM 才能拒绝写入。

层 UUID 是 EROFS 超级块 UUID，而不是内容摘要。该命令会在启动前验证文件，独立于选项顺序确定各角色的顺序，以只读方式附加层，并为暂存磁盘保留可写槽位。转换和暂存磁盘格式化不在启动路径上。Ubuntu 转换器会验证不可变输入，应用默认拒绝的元数据策略，为 UID/GID 65534 创建 `/nonexistent`，并调用 `mkfs.erofs`。显式不支持 systemd 入口点，且不会放宽非 root、丢弃所有能力的沙箱策略。

这是[沙箱设计](/docs/design/4.1-guest-filesystem-and-image-model/)中描述的冷文件系统引导流程，而不是最终的生产代理。它不接受任何环境变量或机密，也不暴露沙箱快照捕获或恢复、配置区域或运行时 RPC。参数是独立的内核命令行令牌，因此不能包含空白字符。工作负载进入私有的挂载/PID/UTS 命名空间，拥有私有的 `/dev`、代理所有的 cgroup、无能力以及 `no_new_privs`。它始终以 VM 创建时选定的固定非 root `UID:GID` 运行（默认为 `65534:65534`）。客户机会验证组装后的根中恰好存在一个匹配用户、其主组及其绝对家目录；否则工作负载永远不会启动。外层代理保留 initramfs 根；剥离能力的子进程仅通过 `chroot` 进入组装后的根，因为 Linux 无法从 initramfs 的 `rootfs` 执行 `pivot_root` 离开。

### 活动宿主共享

`sandbox run` 和 `sandbox provision` 接受可重复的 `--mount GUEST_TARGET,HOST_PATH[,ro|rw]` 选项（默认为 `ro`），每个都有自己的客户机目标和访问模式，另加可重复的 `--mount-deny HOST_PATH`、`--mount-allow HOST_PATH` 和 `--mount-write HOST_PATH` 规则（参见[访问策略](#访问策略)）。与 `run` 一样，模式跟在最后一个逗号之后，因此当给出模式时，宿主路径可以包含逗号。OpenVMM 通过微虚拟机的 virtio-fs 设备导出一个宿主目录，多个共享或一个共享文件则作为该设备上某个聚合的子项，并在宿主侧强制执行每个共享的访问模式和策略，因此两个方向上的编辑都可见，无需暂存或回拷：

```bash
python3 scripts/nvx.py sandbox \
  --layer distro,build/ubuntu-distro.erofs,11111111-1111-1111-1111-111111111111 \
  --scratch /var/lib/nvx/scratch.ext4 \
  --mount /workspace,/srv/checkout,rw \
  --mount-deny .git/credentials \
  --mount /opt/hostedtoolcache,/opt/hostedtoolcache,ro \
  --entrypoint /bin/sh
```

宿主路径为常规文件的 `--mount` 只共享该文件，如 [virtio-fs 宿主映射](#virtio-fs-宿主映射)所述：工作负载在其目标处看到它，但既看不到其目录，也看不到其同级项。共享文件不接受 `--mount-deny`、`--mount-allow` 或 `--mount-write` 路径，因为它的模式适用于整个文件。

相对的 `--mount-deny`、`--mount-allow` 或 `--mount-write` 路径会在其共享的宿主目录内解析。只有一个共享时，每个此类路径都应用于它。有多个共享时，每个路径应用于它之前的 `--mount`，并且必须指定该共享目录内的路径。共享的客户机目标和宿主路径不得彼此相等或相互包含，否则一个共享可能隐藏另一个共享，或以不同的访问模式触达其文件，因此共享文件可以位于共享目录旁边，但不能位于其内部。NVX 和 OpenVMM 会按解析后的路径和文件身份比较宿主路径，因此通过两条路径到达的同一目录或文件（例如绑定挂载或硬链接）也会被拒绝。NVX 还会把每个共享的身份与其他共享祖先的身份进行比较，因此位于另一个共享目录的绑定挂载中的共享会在 OpenVMM 启动前被拒绝。在 Linux 上，OpenVMM 还会比较每个目录通过包含它的挂载及其下每个挂载所能到达的文件系统源，因此它也会拒绝在一个共享内部暴露另一个共享部分的绑定挂载或嵌套挂载。该检查仅限 Linux，因此在 Windows 上，不要共享通过挂载触达另一个共享文件的目录。客户机挂载标志不是安全边界：无论客户机内的哪个挂载或链接到达 `ro` 共享，OpenVMM 都会以 `EROFS` 拒绝所有写入。

在组装容器 overlay 并验证工作负载身份之后，客户机代理会在容器根内创建每个目标，并在工作负载进入其私有挂载命名空间之前用 `nosuid,nodev` 在那里挂载共享。存在多个共享或一个共享文件时，它会把聚合挂载到容器根之外的 `/run/nvx/shares`，并按顺序用各自的模式和 `nosuid,nodev` 把每个子项绑定到其目标，正如 NVX 添加到内核命令行的 `nvx_share=NAME,TARGET,MODE[,file]` 令牌所描述的那样。它会把共享文件绑定到一个常规文件；当容器根在目标处没有任何内容时，它会创建该文件。共享数量仅受沙箱 1024 字节内核命令行预算的限制。一次性工作负载退出、托管 `stop` 以及共享挂载后的任何失败，都会按相反顺序卸载这些绑定，然后卸载聚合，最后才卸载 overlay 或关闭 VM 电源。每个目标必须是绝对、规范的路径；`/`、`/etc`、`/run` 和 `/run/nvx`，以及 `/etc/machine-id`、`/proc`、`/sys`、`/dev`、`/.nvx-agent` 和 `/run/nvx/time` 目录树，保留给容器运行时；它会用工作负载的机器 ID 替换 `/etc/machine-id`，创建 `/run` 和 `/run/nvx`，并把其时间状态绑定到 `/run/nvx/time` 之上。客户机会拒绝以下目标：路径跨越容器层中的符号链接、容器层以与共享不同种类的文件持有该目标、重复的子项以及重叠的目标；任何验证或挂载失败都会以状态 125 中止沙箱，而不是在没有共享的情况下启动工作负载。

`rw` 共享支持包管理器和语言工具链创建的符号链接；其语义参见 [virtio-fs 宿主映射](#virtio-fs-宿主映射)。现有的 OpenVMM 文件身份策略适用于每个共享。托管沙箱会在其配置中存储每个共享的绝对宿主路径、种类、模式、被拒绝、被允许和可写路径以及所有权模式，并在每次 `start` 时重新附加每个共享；如果某个宿主路径不再按记录持有目录或常规文件，`start` 会拒绝它。包含多个共享的配置使用格式 4，较早的 NVX 发布版会拒绝它，而不是在没有其他共享的情况下启动。包含被允许或可写路径的配置使用格式 5，较早的 NVX 发布版会拒绝它，而不是在没有其访问策略的情况下启动共享。包含共享文件的配置使用格式 6，较早的 NVX 发布版会拒绝它，而不是在没有该文件的情况下启动。包含逗号的宿主路径保持配置的格式，因为较早的 NVX 发布版已经拒绝它。

#### 访问策略

每个共享都可以收窄工作负载能在其中看到和修改的内容。对每个请求，无论客户机通过哪个挂载、路径或链接到达该共享，OpenVMM 都会在宿主上强制执行该策略：

- `--mount-deny HOST_PATH` 隐藏一个路径及其下所有内容。当其中仍有被允许的路径时，它可以指定共享的根目录本身，这样该共享只暴露这些路径。
- `--mount-allow HOST_PATH` 会再次暴露被拒绝路径内部的某个路径及其下所有内容。通往该路径的被隐藏目录仅供穿越：工作负载可以进入并列出它们，但列表只显示通往被允许路径的条目，任何其他名称都会以 `EACCES`（`Permission denied`）失败，且工作负载无法修改它们。被拒绝的路径也可以反过来位于被允许的路径内部。
- 在 `rw` 共享上，`--mount-write HOST_PATH` 使一个文件或目录及其下所有内容成为该共享中少数可写部分之一。其他所有写入都会以 `EROFS`（`Read-only file system`）失败，包括在只读目录中创建、删除或重命名条目；这也会阻止重命名进入或离开可写路径。从可写路径到只读文件的硬链接会以 `EXDEV`（`Invalid cross-device link`）失败，因此该链接无法使文件变为可写。

每个路径必须存在于该共享的宿主目录中，不得跨越符号链接或联接点，并像 `--mount-deny` 一样归属于某个共享。其名称可以包含空格，但不能以空格开头或结尾，也不能包含其他空白字符、冒号或反斜杠。被允许的路径遵循该共享的写入策略：没有 `--mount-write` 时，`rw` 共享中的被允许路径可写；有它时，被允许路径仅在可写路径内部才可写。例如，下面的共享隐藏 MCP 网关的日志，但保留它溢出到其下的工具负载，这些负载仍可读，并让工作负载只能写入 `agent` 和 `cache`：

```bash
python3 scripts/nvx.py sandbox \
  --layer distro,build/ubuntu-distro.erofs,11111111-1111-1111-1111-111111111111 \
  --scratch /var/lib/nvx/scratch.ext4 \
  --mount /tmp/mcp-runtime,/tmp/mcp-runtime,rw \
  --mount-deny mcp-logs \
  --mount-allow mcp-logs/mcp-payloads \
  --mount-write agent \
  --mount-write cache \
  --entrypoint /bin/sh
```

OpenVMM 会在启动前拒绝以下情况：被允许的路径不在被拒绝路径之内、可写路径位于共享的被隐藏部分或其他可写路径之内，以及在 `ro` 共享上指定可写路径。该策略适用于共享内部的名称：若宿主硬链接或绑定挂载使只读文件可在可写路径内访问，该文件就会变为可写；若使被拒绝路径的一部分可在别处访问，就会暴露该部分。因此不要在共享目录内创建此类别名。

#### 文件所有权

`--mount-owner` 选择执行共享文件操作的宿主身份：

- `vmm`（默认）：OpenVMM 以自身用户身份执行每个操作，因此工作负载创建的文件和目录归 OpenVMM 用户所有。客户机文件权限使用 OpenVMM 报告的所有者和模式位，因此请授予工作负载身份访问宿主目录的权限。除非宿主允许其他人写入，否则工作负载无法在其创建的目录中创建条目。
- `caller`：OpenVMM 以客户机调用者的数字 UID 和 GID 执行每个操作，不带补充组或能力。工作负载创建的文件和目录在宿主上归其 `--workload-user` 身份所有，宿主还会为该身份强制执行权限，因此工作负载可以在它创建的目录中填充内容。客户机 UID 0 和 GID 0 会被压缩为宿主目录的所有者和组，因此该目录不能归 UID 0 或 GID 0 所有；客户机既不能创建 root 所有的宿主文件，也不能创建 setuid-root 的宿主文件。如果 OpenVMM 无法采用调用者的身份，该操作会以 `EPERM`（`Operation not permitted`）失败，而不是以 OpenVMM 身份运行。

```bash
python3 scripts/nvx.py sandbox \
  --layer distro,/var/lib/nvx/distro.erofs,11111111-1111-1111-1111-111111111111 \
  --scratch /var/lib/nvx/scratch.ext4 \
  --mount /workspace,/srv/checkout,rw \
  --mount-owner caller \
  --workload-user 1001:1001 \
  --entrypoint /bin/sh
```

与任何沙箱一样，层必须定义工作负载用户。选择宿主目录的所有者作为工作负载身份，可使其中的每个文件都归该用户所有。

`caller` 需要 Linux 宿主。Windows 没有可供 OpenVMM 切换的每请求 POSIX 身份，因此 NVX 和 OpenVMM 在 Windows/WHP 上拒绝 `--mount-owner caller`。在 Linux 上，采用 OpenVMM 自身之外的身份，或丢弃 OpenVMM 的补充组，需要 `CAP_SETUID` 和 `CAP_SETGID` 能力，例如作为非特权 NVX 进程的环境能力。`sudo` 会把 `HOME` 替换为 root 的家目录，因此示例把用户自己的家目录传回去：

```bash
sudo setpriv --reuid="$(id -u)" --regid="$(id -g)" --init-groups \
  --inh-caps=+setuid,+setgid --ambient-caps=+setuid,+setgid -- \
  env HOME="$HOME" python3 scripts/nvx.py sandbox ... --mount-owner caller
```

服务管理器可以授予同一组能力，例如 systemd 的 `AmbientCapabilities=CAP_SETUID CAP_SETGID`。没有这些能力时，只有调用者具有 OpenVMM 的用户和主组，且 OpenVMM 的用户不属于其他任何组，操作才会成功；其他所有操作都会以 `EPERM` 失败。宿主通常通过这样的组授予对 `/dev/kvm` 或 `/dev/mshv` 的访问权限，因此 `caller` 通常需要这两种能力。不要授予 OpenVMM 其他能力：`CAP_SETUID` 使它能够采用任何宿主身份，而 `caller` 模式会把它限制在其导出范围内。

客户机内核会报告每个调用者的身份，客户机 root 可以在客户机内采用任何身份，因此客户机 root 和被攻破的客户机内核可以在共享内以任何非零宿主 UID 和 GID 行事，包括留下那些身份所有的 setuid 文件。只共享此类身份可以修改的目录，并且当宿主用户可能从中执行文件时，请把共享放在以 `nosuid` 挂载的宿主文件系统上。

### 托管生命周期

对于有状态感知的沙箱，可以在不启动 VM 的情况下 provision 配置，启动一次，在同一个热客户机中运行多个工作负载，在保留配置的同时停止它，最后 deprovision 它：

```bash
python3 scripts/nvx.py sandbox provision \
  --state-dir /run/user/1000/nvx-example \
  --layer distro,/var/lib/nvx/distro.erofs,11111111-1111-1111-1111-111111111111 \
  --scratch /var/lib/nvx/scratch.ext4
python3 scripts/nvx.py sandbox start \
  --state-dir /run/user/1000/nvx-example
python3 scripts/nvx.py sandbox exec \
  --state-dir /run/user/1000/nvx-example \
  --entrypoint /usr/bin/python3 --arg=/work/agent.py --cwd /work \
  --environment-file /run/user/1000/nvx-example-environment.json \
  --outcome-report /run/user/1000/nvx-example-exec.json
python3 scripts/nvx.py sandbox exec \
  --state-dir /run/user/1000/nvx-example \
  --entrypoint /bin/sh --arg=-c --arg='cat /tmp/previous-result'
python3 scripts/nvx.py sandbox stop \
  --state-dir /run/user/1000/nvx-example
python3 scripts/nvx.py sandbox deprovision \
  --state-dir /run/user/1000/nvx-example
```

生命周期转换采用失败关闭（fail closed）：`start` 会拒绝已在运行或过期的运行时记录；`exec` 和 `stop` 要求有活动的 OpenVMM 进程；`deprovision` 拒绝删除正在运行的沙箱或未知文件。没有运行时记录却残留的控制能力或控制套接字（例如 `start` 被杀死之后）可能属于仍在运行的 OpenVMM 进程，因此 `start` 和 `deprovision` 也会拒绝它：结束任何参数中指定该状态目录的 OpenVMM 进程，然后删除 `control.capability` 和 `control.sock`。`provision`、`start`、`stop` 和 `deprovision` 会持有状态目录中 `lifecycle.lock` 的排他锁直到返回，因此一个沙箱的转换会逐个生效：对任何正在进行的其他转换，每个转换最多等待 `--timeout` 秒；在两个重叠的 `start` 中，恰好一个会启动 OpenVMM，另一个随后因沙箱已在运行而失败。`exec` 不获取该锁，因此长时间运行的工作负载不会延迟 `stop`。已 provision 的状态目录会保留 `lifecycle.lock`，`deprovision` 会随 NVX 的其他文件一起删除它。在 NFS 以及 ReFS 等没有 POSIX 删除语义的 Windows 文件系统上，被删除的锁文件会在等待它的转换关闭它之前保持该空目录，因此 `deprovision` 会在删除目录之前先释放锁，而等待该删除的 `provision` 会在没有任何东西占用该目录后完成删除。在 `deprovision` 删除沙箱期间等待的转换随后会因沙箱未 provision 而失败，但 `provision` 除外：一旦 `deprovision` 删除了该状态目录，它就会再次 provision，除非另一个 `provision` 先完成 provision。只有恰好在 `deprovision` 删除空目录时开始的 `provision` 才能抢先 provision，此时 `deprovision` 会因沙箱被重新 provision 而失败。`--timeout` 必须是有限值且大于 0。如果客户机在 `start` 等待其就绪时退出（例如因为它拒绝工作负载身份），OpenVMM 会关闭控制端点并关机。`start` 随后最多等待 `--timeout` 秒，让 OpenVMM 发布 `outcome.json` 并退出，并以报告中的类别和状态失败，例如 `guest-exit status 125`。只有当 OpenVMM 超过该等待时间仍存活时，`start` 才会终止 OpenVMM。运行时记录通过进程 ID 和启动时间标识 OpenVMM，因此一旦 OpenVMM 退出，这些检查就会把它视为已消失，即使没有进程回收它，或另一个进程复用了它的 ID。较早 NVX 版本写入的记录缺少启动时间，仅通过进程 ID 标识 OpenVMM。托管工作负载参数使用有界控制协议而不是内核命令行，并且可以包含空白字符。托管执行可以选择绝对工作目录，并可使用重复的内联 `KEY=VALUE` 条目或 UTF-8 JSON 数组环境文件。这两种环境形式互斥。省略时会继承客户机引导环境，而不是宿主环境：`PATH=/usr/sbin:/usr/bin:/sbin:/bin`、`TERM=linux`，以及从固定工作负载身份解析出的 `HOME`、`USER` 和 `LOGNAME`。空文件数组请求空环境。`--inherit-default-environment` 会把提供的条目层叠到该默认环境之上，而不是替换它，每个条目替换同名的默认变量；未提供条目时它不起作用。内联值在宿主进程参数中可见，不应用于机密。这些选项仅适用于托管 `sandbox exec`；一次性执行会拒绝它们。工作负载在 VM 的整个生命周期内看到同一个机器 ID。执行 `stop` 时，客户机代理会按依赖顺序卸载活动共享、overlay、层和暂存磁盘，然后 VM 才关闭电源，与一次性工作负载退出时相同。旧式无操作 `sandbox` 形式就是 `sandbox run`；它仍然是一次性的，并拒绝 `--state-dir` 或任何保留 VM 状态的请求。

环境文件限制为 1 MiB 的 UTF-8 JSON。环境最多包含 256 个唯一且非空的名称。每个 `KEY=VALUE` 条目和工作目录路径限制为 4096 个 UTF-8 字节；合并后的执行请求还必须符合现有的 64 KiB 控制负载上限。托管 `exec` 最多转发 1 MiB 的标准输出和标准错误总和；客户机代理会杀死写入更多内容的工作负载，`exec` 会以状态 125 退出并报告 `output-limit` 类别。

显式的 `test-microvm --scenario managed-exec-config --backend BACKEND` 场景是这些公开选项的权威验收。它会以子进程方式调用 `scripts/nvx.py sandbox provision`、`start`、`exec`、`stop` 和 `deprovision`，使用 Alpine 控制客户机和 Ubuntu 工作负载层。它检查顺序执行的不同 CWD 和精确环境请求、层叠在默认环境之上的环境，以及随后省略默认值的情况。它会通过一次公开的托管 `getent` 执行，从 Ubuntu 工作负载自身的 passwd 数据库解析选定的 UID 65534 账户，然后要求 `PATH`、`TERM`、`HOME`、`USER` 和 `LOGNAME` 的值与文档完全一致；层叠条目只在其自身的执行中替换这些值。不相关的客户机引导条目和 shell 提供的条目是允许的，因为省略会继承客户机引导环境；先前请求的条目和内部执行配置描述符不得泄漏。它还检查公开拒绝相对 CWD 和超出范围的 `uint32` 超时、超时恢复、stdout/stderr 转发以及类型化 exec 结果报告。它需要 `build/ubuntu-distro.erofs`、其清单，以及客户机产物构建生成的 `build/ubuntu-smoke-scratch.ext4` 模板。CI 会在每个后端上单独调用它；它不包含在默认场景集中，因为下载的软件包不包含暂存磁盘模板。空环境用 `/usr/bin/env` 测量，而不是用能自行合成变量的 shell。该场景会保留有界的子进程参数和状态观察、类型化 exec 结果以及 OpenVMM 日志。内联环境值会从保留的命令观察记录中脱敏。

显式的 `test-microvm --scenario sandbox-lifecycle --backend BACKEND` 场景是托管生命周期本身的权威验收。它同样以子进程方式针对真实内核、Alpine 控制 initramfs、Ubuntu EROFS 层以及同一暂存磁盘模板的全新副本运行公开命令，因此具有相同的产物要求，并且同样只在被命名时运行。它检查：

- `provision` 在创建任何状态之前拒绝 root 的 `--workload-user`；客户机在一次性工作负载启动之前拒绝 Ubuntu 镜像缺少的身份，在托管 `start` 中也如此，后者随后会因 OpenVMM 结果报告中的 `guest-exit status 125` 而失败，并只留下 `config.json`、`lifecycle.lock`、`openvmm.log` 和该 `outcome.json`，没有运行时记录、能力、控制套接字、报告暂存文件或 OpenVMM 进程；
- 每个操作在从未 provision 的状态目录上都会失败；重复的 `provision` 使配置保持不变；`exec` 和 `stop` 在 `start` 之前会失败；
- 对正在运行的沙箱重复执行 `start` 和 `deprovision` 会失败，且不会更改其运行时记录、能力或 OpenVMM 进程，沙箱继续服务请求；
- 托管参数保留前导、尾随和嵌入的空格、制表符和换行符；后续请求能读取先前请求写入的文件；该文件在 `stop` 和新的 `start` 之后仍然存在，因为 overlay 的上层目录位于暂存磁盘上；
- 在先前请求之后，`/sbin/nvx-sandbox-smoke` 能在使用 `--hostname`、`--memory-max` 和 `--pids-max` provision 的沙箱中通过其安全配置和资源限制检查；
- 写入超过 1 MiB 输出上限的请求，会在宿主已接收超过（1 MiB 减去一个 32 KiB 读取块）且至多 1 MiB 的数据之后，以状态 125 和 `output-limit` 结果报告退出；`--outcome-report` 路径已存在的请求会在其工作负载运行之前失败，并保持该文件不变；
- `stop` 会结束 OpenVMM 及其控制套接字或管道，只留下 `config.json`、`lifecycle.lock`、`openvmm.log` 和成功的 `outcome.json`，并留下已干净卸载的暂存磁盘文件系统，之后 `exec` 和 `stop` 会失败；
- 两个重叠的 `start` 调用随后只启动一个 OpenVMM 进程：一个成功，另一个以 `sandbox is already running or has stale runtime state` 失败；
- 在 OpenVMM 未经 `stop` 而退出后，`exec` 和 `stop` 会报告过期的运行时状态，`start` 会拒绝它；以及
- `deprovision` 只删除 NVX 的文件：当状态目录中存在外来文件时它会失败并保留该文件；一旦该文件消失，它会删除目录，而后续 `exec` 不会重新创建该目录。

在整个过程中，任何参数中指定该场景夹具的 OpenVMM 进程都不会比其沙箱存活更久，EROFS 层保持其摘要，暂存磁盘镜像保持其文件。失败时，该场景会停止并 deprovision 它启动的内容，结束所有指定其夹具的 OpenVMM 进程，删除任何没有运行时记录指定的控制能力或套接字，并且只在该清理失败时才保留夹具以供恢复。其证据会写入输出目录，带有 `sandbox-lifecycle-` 前缀，包含有界的命令观察（参数、状态、输出大小和状态目录条目）、运行时记录、OpenVMM 日志、VM 级和 exec 结果报告、客户机探测的转录，以及被拒绝的一次性运行的输出，每项都限制为其最后 64 KiB。命令观察不包含工作负载输出，任何证据都不包含控制能力。

解码器、辅助程序和直接控制会话测试仍然是协议边界和客户机实现细节的有用补充覆盖。它们不能替代或确立通过公开 `nvx.py sandbox` 接口的支持。

`run --outcome-report PATH` 和一次性 `sandbox run --outcome-report PATH` 会转发 OpenVMM 有界的本地 JSON 报告。托管 `sandbox exec` 只把操作、有界的结果类别、数字状态和不透明的操作 ID 写入其请求的报告；stdout、stderr、参数、环境值和凭据仍然排除在外。`sandbox stop` 会等待 OpenVMM 拆除，并把最新的 VM 级报告保留为状态目录中的 `outcome.json`。OpenVMM 和 NVX 都不会上传这些文件。

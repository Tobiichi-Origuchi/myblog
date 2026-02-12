+++
authors = ["Origuchi"]
title = "Arch Linux 安装教程"
date = 2026-01-23
[taxonomies]
tags = ["Arch", "Linux"]
[extra]
toc = true
toc_sidebar = true
+++

本文记录本人 Arch Linux 的安装及调优的思路和过程，用于本人不小心玩坏系统时，快速重装恢复，同时也用作想要入坑 Arch Linux 的新手教程

原本写这篇文章的打算是粗略地概括整个过程，只讲一些重点关心的点，后来想着写都写了，干脆写一个尽可能完整详细的指南，省的再去其他页面上去找

由于知识相当浅薄，文中可能会包含一些错误，我会尽量保证正常按照我的记录安装和调优不会出现破坏性的问题，但是我也不能担保，如果观者有任何建议，恳请可以[联系本人](mailto:tobiichioriguchi@gmail.com)，批评指正

以下是本人使用的硬件信息：
- Processors: 32 × AMD Ryzen 9 7940HX with Radeon Graphics
- Memory: 32 GiB of RAM (30.6 GiB usable)
- Graphics Processor 1: NVIDIA GeForce RTX 4060 Laptop GPU
- Graphics Processor 2: AMD Radeon 610M
- Manufacturer: ASUSTeK COMPUTER INC.
- Product Name: ASUS TUF Gaming A16 FA607PV_FA607PV

## 1. Arch-based 发行版选取

对于日常使用，本人推荐：
- Arch Linux：神！
- [EndeavourOS](https://endeavouros.com/)：一个包含预配置和美化的 Arch 系统，本质上就是完全的 Arch Linux
- [CachyOS](https://cachyos.org/)：注重速度和优化的 Arch 系统，有专门优化编译的软件仓库，如 cachyos-znver4

同时，无特殊需求的情况下，本人反推荐：
- [Manjaro](https://manjaro.org/)：史

## 2. 验证安装镜像签名

为了您的安全，强烈建议下载完镜像后第一时间验证签名，**请务必避免安装未经验证的镜像到您的爱机上！**

对应发行版的 ISO 下载页必然会有 Checksums and signatures 或类似的部分，具体验证方法不赘述，自己看教程（如 [https://archlinux.org/download/#checksums](https://archlinux.org/download/#checksums)）

## 3. 安装介质

你需要一个 U 盘，没有的话买一个，8g 完全够用

然后安装 [Ventoy](https://www.ventoy.net/cn/index.html)，安装教程看官网

把下载且经过验证的 ISO 镜像复制到 U 盘里，大功告成

如果你急须安装 Arch Linux，并且手头没有 U 盘，可以考虑：
- 本地磁盘安装：勾选 Ventoy 中的 `配置选项 --> 显示所有设备`，**需要特别注意的是，不管安装在U盘还是硬盘，都会重新分区、格式化，整个盘的数据都会被清除，请慎重操作**
- 无损安装：[https://www.ventoy.net/cn/doc_non_destructive.html](https://www.ventoy.net/cn/doc_non_destructive.html)

然而上述方法只是权宜之计，最好有个 U 盘

## 4. live 环境

根据主板不同，在开机时狂按 F1, F2, F4, F11, F12, Del, Tab 等按键（具体按键是什么需要自己去搜索自己主板的 BIOS/UEFI 设置界面启动按键），然后在 BIOS/UEFI 设置界面中关闭安全启动并将当前启动设备指向 Ventoy，启动 Ventoy 界面之后选择你要安装的 ISO 镜像启动 live 环境

## 5. 启动管理器

主要的启动管理器有 systemd-boot、rEFInd、GRUB 和 Limine

ArchWiki 有详细的[介绍](https://wiki.archlinux.org/title/Arch_boot_process#Boot_loader)

此处引用 CachyOS Wiki 的 [boot_managers](https://wiki.cachyos.org/installation/boot_managers/) 的 TL;DR 作一个大致介绍：
- Choose GRUB if you need encrypted /boot, BIOS compatibility, or want Btrfs snapshots with a stable, mature boot manager.
- Choose Limine if you want a modern bootloader with Btrfs snapshot integration out of the box, plus support for both BIOS and UEFI and Windows dual-boot (via limine-scan).
- Choose rEFInd if you want a polished graphical interface and automatic multi-boot detection on UEFI systems.
- Choose systemd-boot if you prefer the simplest setup and don’t require snapshots or advanced features. It’s also the most reliable fallback for MSI motherboards with UEFI issues.

在我看来，没有特殊美化需求，或者 MSI 主板，直接选最稳妥，最简洁的 systemd-boot 就完事了

如果需要集成 Btrfs 的快照功能，我推荐可以选 Limine。GRUB 比较笨重，而且默认样式不好看，需要手动安装主题美化；Limine 默认样式就很美观现代，而且很轻量，兼容性也更好

## 6. 文件系统

见 ArchWiki 的 [File systems](https://wiki.archlinux.org/title/File_systems)

建立一个基础的知识就行了

EFI 分区必须 FAT32，后面分区时会讲

根分区我推荐：
- BTRFS：拥有许多实用功能（快照、压缩）
- EXT4：简单快速

其他还有很多很多种文件系统，我认为没有特殊需求，懒得看每个文件系统的特性的话直接无脑 EXT4 就 OK

## 7. 桌面环境

选取完全取决于个人喜好

虽然说是这么说，但是我还是推荐新手使用经典的 KDE Plasma 和 GNOME
- KDE Plasma：操作逻辑类似 Windows，非常适合刚从 Windows 转来的 Linux 新手用户，他的配置非常简单且丰富
- GNOME操作逻辑类似 MacOS，喜欢 MacOS 可以试试这个，他的配置比较麻烦，而且非常碎片化，基本上没有自定义配置的空间，适合懒得配置，装好就用的人

其他还有两个桌面环境我认为可以选取
- Hyprland：平铺，适合大屏使用
- Niri：滚动平铺，适合小屏或者长屏使用

这两个桌面环境都能配置得相当漂亮，社区也有很多预设，但是我认为不适合新手，不然你会花费大量的时间来用于学习他的配置和交互逻辑，而不是专注于学习 Linux 系统本身

熟悉 Linux 本身之后，完全可以尝试安装各种桌面环境，看哪个对自己胃口，Linux 系统非常自由，可以同时安装多个桌面环境，想启动哪个就启动哪个。我的推荐只是我个人的感觉，最终选取完全看个人喜好

## 8. 安装系统

上面只是开始安装前的准备，先考虑好，这步正式开始安装

### 8.1. 手动安装

Arch Linux 本身推荐手动安装，也有自动脚本 [archinstall](https://wiki.archlinux.org/title/Archinstall)

其他基于 Arch 的发行版大多都有 GUI 自动安装界面，当然也能尝试手动安装

我的建议是 Arch Linux 手动安装，其他基于 Arch 的发行版直接 GUI 自动安装就行

以下是基于 ArchWiki 的 [Installation guide](https://wiki.archlinux.org/title/Installation_guide)，应该仔细 ArchWiki 的内容并学习安装，我的内容只是一些我的补充理解

#### 8.1.1. 联网

**必须要有网络！**

推荐有线连接，如果条件不允许再考虑无线连接

无线连接方法见[此处](https://wiki.archlinux.org/title/Iwd#iwctl)

大部分现代网卡均在 Linux 系统上开箱即用，但是不排除一些老旧的网卡或其他特殊情况下，需要安装完系统后自行在驱动官网下载安装网卡驱动，甚至极端情况下还需要自行编译安装

对于这种情况下，考虑使用手机的 USB 共享网络功能，完成安装后进入系统再安装网卡驱动

最终还有一个 [Offline installation](https://wiki.archlinux.org/title/Offline_installation)，但是如果你必须使用这个方法才能完成安装，表明你的硬件完全不适合安装 Arch Linux，前面的区域，换完硬件再来探索吧

#### 8.1.2. 更新时钟

```sh
timedatectl
```

#### 8.1.3. 分区并格式化

正常情况下，都是使用的 UEFI/GPT，除非你的机器原本安装的是 DOS/Windows XP 等非常原始的系统，才说明你可能使用的是 BIOS/MBR

EFI 分区可以参考 CachyOS 的 [安装指南](https://wiki.cachyos.org/installation/installation_on_root/)，写的非常详细

总结而言如下：

- systemd-boot & rEFInd：
  - 挂载点：/boot
  - 大小：2048 MiB
- Limine：
  - 挂载点：/boot
  - 大小：4192 MiB
- GRUB：
  - 挂载点：/boot/efi
  - 大小：最少 100 MiB（如果要双系统，推荐 1024 MiB 以上）

EFI 分区必须格式化为 FAT32 文件系统

根分区见 1.6. 文件系统 所述

如果需要休眠功能，则还需要创建一个 [SWAP] 分区，或者也可以安装完系统之后创建一个 Swap file，具体方法见 ArchWiki 的 [Swap](https://wiki.archlinux.org/title/Swap)

[SWAP] 分区或者 Swap file 的大小一般推荐是物理内存的 1.5-2 倍

ArchWiki 因为是面向所有人的一个普适安装过程，所以他只讲了必须的 EFI 分区和根分区

然而事实上，Linux 的所有分区都能单独创建并挂载，比较实用的就是 `/home` 分区单独创建并挂载，这个分区存放你的个人文件，万一玩坏了系统（这是一个非常常见的事情），只需要重新安装根分区就行，可以保留 `/home` 分区下的个人文件

顺带提一句，BTRFS 文件系统最好不要单独创建并挂载分区，因为他本身有快照功能，玩坏了可以一键恢复，而且分开挂载分区就无法享受 BTRFS 强大的自动分配子卷大小的功能，在 BTRFS 文件系统中所有分区都以子卷的形式挂载在根分区 `/@` 下，例如 `/@home` ，只要所有分区的总大小不超过整个根分区的大小，就不会出现磁盘空间不足的问题，如果单独创建一个 `/home` 分区，他就只能是你创建时已分配的那个大小，这种情况就违反了 BTRFS 的设计初衷了

#### 8.1.4. 挂载分区

#### 8.1.5.

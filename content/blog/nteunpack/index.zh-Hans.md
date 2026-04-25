+++
authors = ["Origuchi"]
title = "NTE ResList Unpack"
description = "A record of my entire process of unpacking NTE's reslist."
date = 2026-04-21
[taxonomies]
tags = ["Game", "Reverse engineering"]
+++

## 前言

第一次尝试逆向，而且是靠 Gemini 的支持完成的，本文记录一下过程，防止以后忘了

## 开始

[Neverness to Everness](https://en.wikipedia.org/wiki/Neverness_to_Everness)，后面简称 NTE，将于 4 月 23 日于中国服公测，4 月 29 日于国际服公测

今天，也就是 4 月 21 号，国服已经开放了预下载，我自然也是第一时间下载了

结果一打开启动器就给我喂了依托大的，直接下了 1 个多 G 的资源，不用想也知道是 CEF 了，为了不让我的系统 chromium 喜加一，我觉得或许可以开发一款第三方的启动器

## 游戏资源

首先我需要获得游戏资源的下载直链，这个过程很简单，网络连接的日志必然是会被启动器记录的，稍微读取一下就好了

首先看下时间，然后启动游戏启动器并点击开始下载，大概下载半分钟关闭启动器，然后开始找日志：
```bash
rg '2026-04-21 13:37'
```
输出很长就不贴了，以下是关键的信息：
```bash
NTELauncher/UserData/Log/Patcher/log/patcher_updater.log
...
NTELauncher/UserData/Log/Patcher/log/publish_PC.log
...
1449:2026-04-21 13:37:25.275 [tid:532] [DEBUG] @[PatcherSDKImpl::Init] initInfo(updateUrl: https://yhcdn1.wmupd.com/clientRes, backupUpdateUrl: https://yhcdn2.wmupd.com/clientRes) // CDN 的位置知道了
...
1465:2026-04-21 13:37:25.277 [tid:1348] [TRACE] @[ResourceDownloadFileTask::AddFile] https://yhcdn1.wmupd.com/clientRes/publish_PC/Version/Windows/config.xml?tValue=1776749845277 // 这里请求了一个显然和游戏资源有关的 xml，之后检查
...
1523:2026-04-21 13:37:30.722 [tid:708] [DEBUG] @[PatcherSDK::SafeConfigFileRead] Z:/home/origuchi/.local/share/Steam/steamapps/common/nte launcher/Neverness To Everness/NTELauncher/UserData/Patcher/PatcherSDK/ResList.xml // 从本地缓存中读取到了 ResList.xml
...
1631:2026-04-21 13:37:30.958 [tid:724] [TRACE] @[ResourceDownloadFileTask::AddPackFiles] publish_PC/Res/5/547d51e659c8d4ea6ce79ab5c386ded6.113831224.
1632:2026-04-21 13:37:30.958 [tid:724] [TRACE] @[ResourceDownloadFileTask::AddPackFiles] publish_PC/Res/7/70aecfd573afbea554dcd7f68798a6f5.241488016.
1633:2026-04-21 13:37:30.958 [tid:724] [TRACE] @[ResourceDownloadFileTask::AddPackFiles] publish_PC/Res/a/ab190b1bd80ce94e62e18537e09914dd.248182892. // 这里下面全是类似的 AddPackFiles 重复
...
1868:2026-04-21 13:37:30.981 [tid:740] [DEBUG] @[ResourceDownloadClient::Request] request: https://yhcdn1.wmupd.com/clientRes/publish_PC/Res/5/547d51e659c8d4ea6ce79ab5c386ded6.113831224, 49197400-113831223 64633824 bytes
1869:2026-04-21 13:37:30.981 [tid:740] [DEBUG] @[HttpClient_Curl::Setup] request https://yhcdn1.wmupd.com/clientRes/publish_PC/Res/5/547d51e659c8d4ea6ce79ab5c386ded6.113831224 // 请求网络开始下载
```
从日志中可以看出以下几点：
1. PatchSDK 是请求游戏资源下载的工具
2. 游戏资源以 publish_PC/Res/5/547d51e659c8d4ea6ce79ab5c386ded6.113831224 这种非常奇怪的格式命名
3. ResList.xml 从本地读取了缓存，所以现在还不知道他是从哪个地方下载的
4. https://yhcdn1.wmupd.com/clientRes/publish_PC/Version/Windows/config.xml?tValue=1776749845277 是和游戏资源位置紧密相关的，但是 tValue 的值暂时无法推测

现在一个一个解决

### ResList.xml

首先是 ResList.xml 本地缓存的问题，这个肯定是因为我之前启动的时候下载了一次，已经请求过了，所以在后来测试时没有预先删除缓存，然后他直接从缓存读取了

搜索一下日志：
```bash
rg -i 'reslist'
UserData/Log/Patcher/log/publish_PC.log
83:2026-04-21 12:32:59.537 [tid:888] [TRACE] @[ResourceDownloadFileTask::AddFile] publish_PC/Version/Windows/version/1.0.3/ResList.bin.zip
89:2026-04-21 12:32:59.539 [tid:1276] [DEBUG] @[ResourceDownloadFileTask::_InitTaskFile] [0]init for Z:/home/origuchi/.local/share/Steam/steamapps/common/nte launcher/Neverness To Everness/NTELauncher/UserData/Patcher/PatcherSDK/tmp/ResList.bin.zip
93:2026-04-21 12:32:59.540 [tid:1276] [DEBUG] @[ResourceDownloadClient::Request] request: https://yhcdn2.wmupd.com/clientRes/publish_PC/Version/Windows/version/1.0.3/ResList.bin.zip
...
```
OK，找到了，然后下载这个 zip 文件，解压得到了两个文件 `lastdiff.bin` 和 `ResList.bin`，是两个 bin 二进制文件，而不是最后的 xml 文件

然而对比了这个 bin 文件和本地缓存的 xml 文件之后，惊人地发现 bin 和 xml 的数据是对应着完全相同的，也就是他下载解压完，把 bin 文件直接重命名为 xml，事实上那个 xml 文件是某种伪装，他们依旧是不可读的二进制文件

顺便提一个关键，两个文件的开头都有 “PatcherXML0” 后面会讲到这有什么用

### tValue

tValue=1776749845277 ，首先查看了日志，这个 tValue 字段每次都会出现在请求链接 https://yhcdn1.wmupd.com/clientRes/publish_PC/Version/Windows/config.xml 的后面，而且值并非固定

问了 Gemini，它一下就知道了这只是个 UTC 时间戳，查了一下 <https://www.utctime.net/utc-timestamp> 目前确实是 17767... 开头的，然后结合日志时间证实了这个观点

测试了一下这个值改变对于请求内容是否有变化，貌似是没有的，那就是说它目前无关紧要

然后关于这个链接本身返回的内容，大致结构如下：
```xml
<config>
<AppVersion>0.0</AppVersion>
<ResVersion>1.0.3</ResVersion>
<UpdateResVersion>0.0</UpdateResVersion>
<Section>1.0</Section>
<ResSize>47399967798</ResSize>
<Hash>e5906c</Hash>
<BaseVerson appVersion="0.0">
<Res section="0.104" version="0.104.4" Tag="pakchunk104" ResSize="898354337"/>
<Res section="..." version="..." Tag="..." ResSize="..."/>
...
<Res section="1.0" version="1.0.3" Tag="baseTag" ResSize="47399967798"/>
</BaseVerson>
<Tag>baseTag</Tag>
<Extra>
<BaseTag>
<item name="baseTag"/>
</BaseTag>
<speed>50</speed>
<maxThreadCnt>5</maxThreadCnt>
<tagTaskThreadCnt>2</tagTaskThreadCnt>
<diffHash>e34d9d55982e5ec8457e2af50de467ed</diffHash>
<listHash>681b5a3903f31e425a2a23f16b3fbb4c</listHash>
<playAssetsTimeout>20</playAssetsTimeout>
<Devices>
<d name="cc62a32400090313b8eb85691b97459b_00059a3c7a00"/>
<d name="..."/>
...
</Devices>
<Compressed>1</Compressed>
<Encrypt>1</Encrypt>
</Extra>
</config>
```

游戏资源的版本和大小在这里都知道了，然后 diffHash 和 listHash 就是上面提到的两个文件的 Hash

### 资源命名

我自己没有开发经验，完全不知道这堆乱七八糟是什么鬼，问了 Gemini，它直接告诉我这就是 {哈希首字母}/{完整MD5哈希}.{文件总大小} ，没想到是这样命名的，但是我测试下载了一个文件，的确如此，那么之后的资源直链拼接方式就非常简单了，关键点依旧落到了如何获得包含 文件路径/文件名/MD5/文件大小 的列表（ResList.xml）

### PatchSDK

直接找有没有这个文件：
```bash
fd -IH patchersdk
PatcherSDK_x64.dll
UserData/Patcher/PatcherSDK/
```
可以推测这个 PatcherSDK_x64.dll 就是日志里出现的，用来下载游戏 patch 的工具

然后检查 UserData/Patcher/PatcherSDK/ 下的内容
```bash
tree UserData/Patcher/PatcherSDK/
UserData/Patcher/PatcherSDK/
├── internal
├── ResList.xml
├── server
└── tmp
    ├── client.xml
    ├── lastdiff.xml
    ├── Res
    │   └── Client
    │       └── WindowsNoEditor
    │           └── HT
    │               ├── Binaries
    │               │   └── Win64
    │               │       ├── AntiCheatExpert
    │               │       │   └── ACE-Base.dat
    │               │       └── HTGameBase.dll.cb
    │               └── Content
    │                   ├── Movies
    │                   │   └── FFMpeg_Mana
    │                   │       ├── advert
    │                   │       │   └── ...
    │                   │       ├── Login2K-huanghun.usm
    │                   │       ├── RoomInvite
    │                   │       │   └── xiaozhi
    │                   │       │       └── ...
    │                   │       ├── Story
    │                   │       │   └── ...
    │                   │       └── Void
    │                   │           └── ...
    │                   └── PatchPaks
    │                       └── ...
    └── ResList.xml

20 directories, 51 files
```
可以看出 `ResList.xml` 和 `lastdiff.xml` 这两个之前提到的东西都在这里，然后 `UserData/Patcher/PatcherSDK/tmp/Res/Client` 里的就是下载过程中的缓存了，这证实了 PatcherSDK 就是用来获取游戏资源的，后面需要重点研究

## .dll 分析

现在开始 PatcherSDK_x64.dll 的分析，使用了 [hey-rays](https://hex-rays.com/) 开发的免费软件 [IDA Free](https://hex-rays.com/ida-free)

首先加载 PatcherSDK_x64.dll，由于需要解包的两个 bin 文件头部都有 PatcherXML0 的字符串，所以合理推测在 dll 中会读取这个字符串，所以直接尝试在 IDA 中搜索 String “PatcherXML0”
```plain
.rdata:0000000180543E18 aPatchersdkRead db 'PatcherSDK::ReadProtectedFile',0
.rdata:0000000180543E18                                         ; DATA XREF: sub_180138C40+8A↑o
.rdata:0000000180543E18                                         ; sub_180138C40:loc_180138D20↑o ...
.rdata:0000000180543E36                 align 20h
.rdata:0000000180543E40 aCfgFileTooLarg db 'cfg file too large. not correct!',0
.rdata:0000000180543E40                                         ; DATA XREF: sub_180138C40+D9↑o
.rdata:0000000180543E61                 align 8
.rdata:0000000180543E68 aCanNotOpenEncr db 'can not open encrypted file.',0
.rdata:0000000180543E68                                         ; DATA XREF: sub_180138C40+169↑o
.rdata:0000000180543E85                 align 10h
.rdata:0000000180543E90 aTheSizeNotMatc db 'the size not matched. %d %d',0
.rdata:0000000180543E90                                         ; DATA XREF: sub_180138C40+345↑o
```
这里写的非常清晰，展示了 `PatcherSDK::ReadProtectedFile` 方法的读取和错误处理过程，然后调用的函数是 `sub_180138C40`

尝试查看 `sub_180138C40` 的汇编代码，不是我喜欢的语言，直接 F5 反编译为 C 伪代码，如下：
```c
__int64 __fastcall sub_180138C40(__int64 a1, const char *a2)
{
  const char *v2; // rbx
  __int64 v4; // rax
  int v5; // ebx
  size_t v6; // rbx
  unsigned __int64 v7; // rsi
  _BYTE *v8; // r14
  _BYTE *v9; // rax
  void **v10; // rdx
  __int64 v11; // rbx
  void **v12; // rdx
  void *Src[2]; // [rsp+30h] [rbp-D0h] BYREF
  __int128 v15; // [rsp+40h] [rbp-C0h]
  char Destination[12]; // [rsp+50h] [rbp-B0h] BYREF
  int v17; // [rsp+5Ch] [rbp-A4h] BYREF
  __int128 v18; // [rsp+60h] [rbp-A0h] BYREF
  __int128 v19; // [rsp+70h] [rbp-90h]
  void *pExceptionObject[3]; // [rsp+80h] [rbp-80h] BYREF
  unsigned __int64 v21; // [rsp+98h] [rbp-68h]
  void *Block[3]; // [rsp+A0h] [rbp-60h] BYREF
  unsigned __int64 v23; // [rsp+B8h] [rbp-48h]
  _BYTE v24[64]; // [rsp+C0h] [rbp-40h] BYREF

  v2 = a2;
  *(_QWORD *)Destination = a1;
  sub_1800067A3((unsigned int)v24, (_DWORD)a2, 0, 1, 0);
  if ( !(unsigned __int8)sub_180003DDC(v24, "rb") )
  {
    v4 = sub_1800118DD(Block);
    if ( *(_QWORD *)(v4 + 24) >= 0x10u )
      v4 = *(_QWORD *)v4;
    if ( *((_QWORD *)v2 + 3) >= 0x10u )
      v2 = *(const char **)v2;
    sub_18000860C(4, "PatcherSDK::ReadProtectedFile", "%s open failed. %s", v2, (const char *)v4);
    if ( v23 >= 0x10 )
      j_free(Block[0]);
    goto LABEL_8;
  }
  v5 = sub_1800092B9(v24);
  if ( v5 > 104857600 )
  {
    sub_18000860C(4, "PatcherSDK::ReadProtectedFile", "cfg file too large. not correct!");
    goto LABEL_8;
  }
  v17 = 0;
  j_strncpy(Destination, "PatcherXML0", 0xCu);
  v17 = 0;
  sub_18000ACD6(v24, Destination, 12);
  sub_18000ACD6(v24, &v17, 4);
  if ( j_strcmp(Destination, "PatcherXML0") )
  {
    Src[0] = nullptr;
    *(_QWORD *)&v15 = 0;
    *((_QWORD *)&v15 + 1) = 15;
    sub_180011C2F(Src);
    v12 = Src;
    if ( *((_QWORD *)&v15 + 1) >= 0x10u )
      v12 = (void **)Src[0];
    sub_18000ACD6(v24, v12, v5);
    *(_OWORD *)a1 = *(_OWORD *)Src;
    *(_OWORD *)(a1 + 16) = v15;
    goto LABEL_40;
  }
  if ( qword_180667C80 )
  {
    v6 = v5 - 16LL;
    Src[0] = nullptr;
    *(_QWORD *)&v15 = 0;
    *((_QWORD *)&v15 + 1) = 15;
    if ( v6 > 0xF )
    {
      v7 = 0x7FFFFFFFFFFFFFFFLL;
      if ( v6 > 0x7FFFFFFFFFFFFFFFLL )
        std::vector<void *>::_Xlen();
      if ( (v6 | 0xF) <= 0x7FFFFFFFFFFFFFFFLL )
      {
        v7 = v6 | 0xF;
        if ( (v6 | 0xF) < 0x16 )
          v7 = 22;
      }
      v9 = j_j_j__malloc_base(v7 + 1);
      v8 = v9;
      if ( !v9 )
      {
        sub_180012FEE(pExceptionObject);
        j__CxxThrowException(pExceptionObject, (_ThrowInfo *)&pThrowInfo);
      }
      *(_QWORD *)&v15 = v6;
      *((_QWORD *)&v15 + 1) = v7;
      j_memset(v9, 0, v6);
      v8[v6] = 0;
      Src[0] = v8;
    }
    else
    {
      *(_QWORD *)&v15 = v6;
      j_memset(Src, 0, v6);
      *((_BYTE *)Src + v6) = 0;
      v7 = *((_QWORD *)&v15 + 1);
      v8 = Src[0];
    }
    v10 = Src;
    if ( v7 >= 0x10 )
      v10 = (void **)v8;
    sub_18000ACD6(v24, v10, v6);
    v21 = 15;
    pExceptionObject[2] = (void *)10;
    strcpy((char *)pExceptionObject, "PatcherSDK");
    v11 = sub_180009ACF(Block, Src, &qword_180667C70, pExceptionObject);
    if ( Src != (void **)v11 )
    {
      if ( *((_QWORD *)&v15 + 1) >= 0x10u )
        j_free(Src[0]);
      *(_QWORD *)&v15 = 0;
      *((_QWORD *)&v15 + 1) = 15;
      LOBYTE(Src[0]) = 0;
      *(_OWORD *)Src = *(_OWORD *)v11;
      v15 = *(_OWORD *)(v11 + 16);
      *(_QWORD *)(v11 + 16) = 0;
      *(_QWORD *)(v11 + 24) = 15;
      *(_BYTE *)v11 = 0;
    }
    if ( v23 >= 0x10 )
      j_free(Block[0]);
    Block[2] = nullptr;
    v23 = 15;
    LOBYTE(Block[0]) = 0;
    if ( v21 >= 0x10 )
      j_free(pExceptionObject[0]);
    *(_QWORD *)&v18 = 0;
    *(_QWORD *)&v19 = 0;
    *((_QWORD *)&v19 + 1) = 15;
    sub_180006794(Src, &v18);
    if ( (_QWORD)v19 != v17 )
      sub_18000860C(3, "PatcherSDK::ReadProtectedFile", "the size not matched. %d %d", v17, (_DWORD)v15);
    *(_OWORD *)a1 = v18;
    *(_OWORD *)(a1 + 16) = v19;
    *(_QWORD *)&v19 = 0;
    *((_QWORD *)&v19 + 1) = 15;
    LOBYTE(v18) = 0;
    if ( *((_QWORD *)&v15 + 1) >= 0x10u )
      j_free(Src[0]);
LABEL_40:
    LOBYTE(Src[0]) = 0;
    *((_QWORD *)&v15 + 1) = 15;
    *(_QWORD *)&v15 = 0;
    goto LABEL_41;
  }
  sub_18000860C(4, "PatcherSDK::ReadProtectedFile", "can not open encrypted file.");
LABEL_8:
  *(_QWORD *)a1 = 0;
  *(_QWORD *)(a1 + 24) = 15;
  *(_BYTE *)a1 = 0;
  *(_QWORD *)(a1 + 16) = 0;
  *(_BYTE *)a1 = 0;
LABEL_41:
  sub_180005E2A(v24);
  return a1;
}
```
简单分析一下：
1. 读取 `a2` 文件
2. `sub_18000ACD6(v24, Destination, 12)` 读取文件前 12 个字节，就是 `PatcherXML0\0`（`\0` 是字符串结束符）
3. `sub_18000ACD6(v24, &v17, 4)` 读取四个字节，存入 v17
4. Payload `v6=v5-16LL` 总文件大小减去 12 字节头和 4 字节变量，剩下的是加密的数据
5. `strcmp(Destination,"PatcherXML0") != 0` 直接读入全部内容并传给 `a1`，说明如果头部没有 `PatcherXML0` 标记就当作没有加密的普通文件
6. `strcpy((char *)pExceptionObject, "PatcherSDK")`，也就是说 `pExceptionObject` 的值就是字符串 `"PatcherSDK"`
7. `sub_180009ACF(Block, Src, &qword_180667C70, pExceptionObject)` 解密函数
8. `sub_180006794` 大概率是在解压？解压完传给 `v18/v19`
9. `v19 != v17` 检查，如果最终得到的解密数据 `v19` 和 `v17` 不相等，将 `v19` 传给 `a1`
10. 输出 `a1`，并销毁所有中间资源

我们的需求是要找到解密的方法，自然需要查看最重要的解密函数 `sub_180009ACF`，OK 继续打开 `sub_180009ACF` 函数汇编，F5 反编译
```c
// attributes: thunk
__int64 __fastcall sub_180009ACF(__int64 a1, __int64 a2, __int64 a3, __int64 a4)
{
  return sub_1801E7F10(a1, a2, a3, a4);
}
```
是个 thunk 函数，真正的解密函数是 `sub_1801E7F10`，OK，对其使用反编译
```c
__int64 __fastcall sub_1801E7F10(__int64 a1, _QWORD *a2, void *a3, void *a4)
{
  __int64 v7; // r8
  __int64 v8; // rax
  __int64 v9; // rax
  unsigned __int64 v10; // rbx
  __int64 v11; // r14
  void *v12; // rax
  __int64 v13; // r14
  void **v14; // rdi
  void **v15; // rbx
  int v16; // eax
  char *v17; // rax
  char *v18; // rdi
  void **v19; // r9
  __int64 v21; // [rsp+38h] [rbp-91h] BYREF
  void *Block[2]; // [rsp+40h] [rbp-89h] BYREF
  unsigned __int64 v23; // [rsp+50h] [rbp-79h]
  unsigned __int64 v24; // [rsp+58h] [rbp-71h]
  void *v25[2]; // [rsp+60h] [rbp-69h] BYREF
  unsigned __int64 v26; // [rsp+70h] [rbp-59h]
  unsigned __int64 v27; // [rsp+78h] [rbp-51h]
  void *v28[2]; // [rsp+80h] [rbp-49h] BYREF
  unsigned __int64 v29; // [rsp+90h] [rbp-39h]
  unsigned __int64 v30; // [rsp+98h] [rbp-31h]
  __int128 Src; // [rsp+A0h] [rbp-29h] BYREF
  __int128 v32; // [rsp+B0h] [rbp-19h]
  void *pExceptionObject[3]; // [rsp+C0h] [rbp-9h] BYREF
  unsigned __int64 v34; // [rsp+D8h] [rbp+Fh]

  v21 = a1;
  sub_180008355(v28, a4);
  sub_180008355(v25, a3);
  if ( v29 < 0x10 )
  {
    LOBYTE(v7) = 48;
    v8 = sub_18000186B(pExceptionObject, 16 - v29, v7);
    j_unknown_libname_1146(v28, v8);
    if ( v34 >= 0x10 )
      j_free(pExceptionObject[0]);
  }
  if ( v26 < 0x10 )
  {
    LOBYTE(v7) = 48;
    v9 = sub_18000186B(pExceptionObject, 16 - v26, v7);
    j_unknown_libname_1146(v25, v9);
    if ( v34 >= 0x10 )
      j_free(pExceptionObject[0]);
  }
  Block[0] = nullptr;
  v23 = 0;
  v24 = 0;
  v10 = a2[2];
  if ( a2[3] >= 0x10u )
    a2 = (_QWORD *)*a2;
  if ( v10 >= 0x10 )
  {
    v11 = v10 | 0xF;
    if ( (v10 | 0xF) > 0x7FFFFFFFFFFFFFFFLL )
      v11 = 0x7FFFFFFFFFFFFFFFLL;
    v12 = j_j_j__malloc_base(v11 + 1);
    if ( !v12 )
    {
      sub_180012FEE(pExceptionObject);
      j__CxxThrowException(pExceptionObject, (_ThrowInfo *)&pThrowInfo);
    }
    Block[0] = v12;
    j_memmove(v12, a2, v10 + 1);
    v24 = v11;
  }
  else
  {
    *(_OWORD *)Block = *(_OWORD *)a2;
    v24 = 15;
  }
  v23 = v10;
  v13 = sub_18000E606();
  if ( v13 )
  {
    v14 = v28;
    if ( v30 >= 0x10 )
      v14 = (void **)v28[0];
    v15 = v25;
    if ( v27 >= 0x10 )
      LODWORD(v15) = v25[0];
    v16 = sub_18000C5EF();
    if ( (unsigned int)sub_180003FFD(v13, v16, 0, (int)v15, v14) == 1 )
    {
      LODWORD(v21) = 0;
      v17 = (char *)j_j_j___2_YAPEAX_K_Z((int)v23);
      v18 = v17;
      v19 = Block;
      if ( v24 >= 0x10 )
        LODWORD(v19) = Block[0];
      if ( (unsigned int)sub_180009F5C(v13, (_DWORD)v17, (unsigned int)&v21, (_DWORD)v19, v23) == 1 )
      {
        if ( (unsigned int)sub_1800057CC(v13, &v18[(int)v21], &v21) == 1 )
        {
          sub_180008116(v13);
          *(_QWORD *)&Src = 0;
          *(_QWORD *)&v32 = 0;
          *((_QWORD *)&v32 + 1) = 15;
          sub_180001686(&Src);
          j_j_j_j_j_free_0(v18);
          *(_OWORD *)a1 = Src;
          *(_OWORD *)(a1 + 16) = v32;
          *(_QWORD *)&v32 = 0;
          *((_QWORD *)&v32 + 1) = 15;
          LOBYTE(Src) = 0;
        }
        else
        {
          sub_18000860C(4, "_pw_sdk_10_base::Encrypt::DecryptWithAES128", "chiper finish error");
          *(_QWORD *)a1 = 0;
          *(_QWORD *)(a1 + 24) = 15;
          *(_BYTE *)a1 = 0;
          *(_QWORD *)(a1 + 16) = 0;
          *(_BYTE *)a1 = 0;
        }
      }
      else
      {
        sub_18000860C(4, "_pw_sdk_10_base::Encrypt::DecryptWithAES128", "chiper update error");
        *(_QWORD *)a1 = 0;
        *(_QWORD *)(a1 + 24) = 15;
        *(_BYTE *)a1 = 0;
        *(_QWORD *)(a1 + 16) = 0;
        *(_BYTE *)a1 = 0;
      }
    }
    else
    {
      sub_18000860C(4, "_pw_sdk_10_base::Encrypt::DecryptWithAES128", "chiper init error");
      *(_QWORD *)a1 = 0;
      *(_QWORD *)(a1 + 24) = 15;
      *(_BYTE *)a1 = 0;
      *(_QWORD *)(a1 + 16) = 0;
      *(_BYTE *)a1 = 0;
    }
  }
  else
  {
    sub_18000860C(4, "_pw_sdk_10_base::Encrypt::DecryptWithAES128", "ctx error");
    *(_QWORD *)a1 = 0;
    *(_QWORD *)(a1 + 24) = 15;
    *(_BYTE *)a1 = 0;
    *(_QWORD *)(a1 + 16) = 0;
    *(_BYTE *)a1 = 0;
  }
  if ( v24 >= 0x10 )
    j_free(Block[0]);
  v23 = 0;
  v24 = 15;
  LOBYTE(Block[0]) = 0;
  if ( v27 >= 0x10 )
    j_free(v25[0]);
  v26 = 0;
  v27 = 15;
  LOBYTE(v25[0]) = 0;
  if ( v30 >= 0x10 )
    j_free(v28[0]);
  return a1;
}
```
现在加密算法知道了，就是 AES-128，四个变量很显然也知道了
1. `a1` 输出的解密文
2. `a2` 输入的密文
3. `a3` Key
4. `a4` IV

前面分析 `sub_180138C40` 时提到 `pExceptionObject`/`a4` 其实就是字符串 `"PatcherSDK"`，使用 0 补全至 16 位，得到 IV 的值就是 `"PatcherSDK000000"`

现在的目标就变得非常明确了，要得到 `a3` 的值，也就是 AES-Key

`a3` 也就是前面传给 `sub_180009ACF` 的 `&qword_180667C70` 尝试查找他的交叉引用：
```c
void **__fastcall sub_18013F720(size_t *a1)
{
  void **result; // rax
  void *v2; // rdx

  result = &qword_180667C70;
  if ( &qword_180667C70 != (void **)a1 )
  {
    v2 = a1;
    if ( a1[3] >= 0x10 )
      v2 = (void *)*a1;
    return (void **)sub_18000B2AD(&qword_180667C70, v2, a1[2]);
  }
  return result;
}
```
这是 Key 值被写入 `&qword_180667C70` 的函数，但是该 dll 中没有任何地方调用了它，那必然是主程序里调用了他，然后把 Key 值传了进去

那也就意味着还要去费劲检查主程序，甚至有可能这个值并非硬编码在主程序中而是从其他地方导入的，我感觉直接去查找太麻烦了

然而事实上，`&qword_180667C70` 的内存位置是早就知道的，就是 `PatcherSDK_x64.dll` 的基址 + 内存偏移量 `667C70`，那其实只要运行一下主程序，跑一下下载，`PatcherSDK_x64.dll+667C70` 这个位置必然就能读取到我们需要的 Key 的字符串值了

## 调试

由于调试器 [x64dbg](https://github.com/x64dbg/x64dbg) 目前仅支持 Windows（据最新的 [Release Note](https://github.com/x64dbg/x64dbg/releases/tag/2026.04.20) 称，"the first pre-alpha pieces of a Linux debugger based on the new `ElfBug` engine have been merged"，也就是已经有对 Linux 的第一版实验性支持了，期待以后会完全支持 Linux），所以需要安装一个 Windows 虚拟机，方法很多，[winboat](https://github.com/TibixDev/winboat) 和 [winapps](https://github.com/winapps-org/winapps) 都是不错的便捷安装工具，或者使用 qemu/kvm 直接安装也并非难事，在此不赘述

启动 x64dbg，加载启动器主程序 NTEGame.exe，切换到“符号”选项卡，一边按 F9，一边观察 `PatcherSDK_x64.dll` 是否被主程序加载

然而断点进行到加载 `ntdll.dll` 的时候，NTEGame.exe 进程崩溃并弹窗：“请关闭调试器后再试”

这个情况再常见不过了，说明他的启动器进程加载 `ntdll.dll` 时会探测当前是否处于被调试的状态

解决方法很简单，只要请出我们的反反调试（anti-anti-debug）插件 [ScyllaHide](https://github.com/x64dbg/ScyllaHide)

首先直接运行启动器程序，等其完全加载后，使用 ScyllaHide 的 Attach process 功能，用十字准星瞄准 NTEGame.exe 的窗口，获取其进程的 PID，然后点击 Attach，将进程加载入 x64dbg 中

依旧先看“符号”选项卡，`PatcherSDK_x64.dll` 出现了，说明启动器打开并完全加载好之后就成功加载了 `PatcherSDK_x64.dll`

转到“内存”窗口，`Ctrl+G` 搜索 `PatcherSDK_x64.dll+667C70`，跳转到 `&qword_180667C70` 的内存位置，x64dbg 已经自动将十六进制转成了 ASCII 字符，显示：
```plain
1289@Patcher....
```
十二位的字符串，使用 0 补齐至 16 位，得到最终的 AES-Key 为 `1289@Patcher0000`

## 测试

目前已经通过简单的逆向得到了 AES-Key 和 AES-IV，现在需要测试其有效性
```python
from Crypto.Cipher import AES

def unpack(file_path):
    key = b"1289@Patcher0000"
    iv = b"PatcherSDK000000"
    
    with open(file_path, 'rb') as f:
        data = f.read()
        
    payload = data[16:]
    
    cipher = AES.new(key, AES.MODE_CBC, iv)
    dec = cipher.decrypt(payload)
    save(file_path, dec)

def save(original_path, final_data):
    out_path = original_path + ".xml"
    with open(out_path, 'wb') as f:
        f.write(final_data)

if __name__ == "__main__":
    unpack("ResList.bin")
    unpack("lastdiff.bin")
```
打开解密的文件，全是乱码，检查其文件头的 hex 值，均是 `789C`，那我想大概率就是文件先 zlib 压缩了再 AES 加密的

那就再加一层解压：
```python
import zlib
from Crypto.Cipher import AES

def unpack(file_path):
    key = b"1289@Patcher0000"
    iv = b"PatcherSDK000000"
    
    with open(file_path, 'rb') as f:
        data = f.read()
        
    payload = data[16:]
    
    cipher = AES.new(key, AES.MODE_CBC, iv)
    dec = cipher.decrypt(payload)
    
    decompressor = zlib.decompressobj()
    xml = decompressor.decompress(dec)
    save(file_path, xml)

def save(original_path, final_data):
    out_path = original_path + ".xml"
    with open(out_path, 'wb') as f:
        f.write(final_data)

if __name__ == "__main__":
    unpack("ResList.bin")
    unpack("lastdiff.bin")
```
得到的两个最终的 xml 文件的预览如下：
```xml
<?xml version="1.0" ?>
<PatchList>
	<Patch oldfile="574d464afa067f98975e6272c41d4629.56443408" newfile="ff96060fa4cb662b3757c2251a8f0154.98867728" patch="a10e03ac369bdfdef426add6a74ae454.46537895" v="e5906c"/>
	<Patch oldfile="..." newfile="..." patch="..." v="..."/>
	...
```
```xml
<?xml version="1.0" ?>
<ResList version="1.0.3" tag="baseTag">
	<Res filename="Client/WindowsNoEditor/Engine/Binaries/ThirdParty/CEF3/Win64/libcef.dll" filesize="153114624" md5="3a1cb9e5814c6a22261824396f79b55d"/>
	<Res filename="..." filesize="..." md5="..."/>
	...
```
> PS：第一个文件是 CEF 有点没绷住

## 总结

无（不用被强迫写总结的感觉真好）
